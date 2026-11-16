import fs from 'fs';

const filePath = 'src/server.mjs';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add getCuradoriaDecisions right after getLatestRun
const getLatestRunAnchor = `function getLatestRun(clientCode) {
  const db = getAnalyticsDb();
  const row = db
    .prepare('SELECT * FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1')
    .get(clientCode);
  if (!row) return null;
  return { ...row, summary: JSON.parse(row.summary_json) };
}`;

const curadoriaDecisionsFunc = `
function getCuradoriaDecisions(clientCode, runId) {
  const db = getAnalyticsDb();
  const filiais = getFilialPolicies(clientCode);
  const filMap = new Map(filiais.map(f => [Number(f.filial_id), f]));
  const transfers = getMotorTransfers(clientCode);

  const logs = db.prepare(\`
    SELECT id, filial_id, produto_id, molecule_key, descricao, tipo_evento, motivo, acao_futura, created_at
    FROM buyer_learning_log
    WHERE client_code = ? AND tipo_evento IN ('DEDUZIU_ESTOQUE_MOLECULA', 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA', 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL')
    ORDER BY id DESC
  \`).all(clientCode);

  if (!logs || logs.length === 0) return [];

  const grouped = new Map();
  for (const l of logs) {
    if (!grouped.has(l.produto_id)) {
      grouped.set(l.produto_id, {
        produto_id: l.produto_id,
        descricao: l.descricao,
        molecule_key: l.molecule_key,
        actions: [],
        total_un_abatidas: 0,
        lojas_canceladas: new Set(),
        created_at: l.created_at,
      });
    }
    const g = grouped.get(l.produto_id);
    g.actions.push(l);
    if (l.filial_id > 0) g.lojas_canceladas.add(l.filial_id);
    
    const match = (l.motivo || '').match(/(\\d+)\\s*un/i);
    if (match) {
      const un = Number(match[1]);
      if (l.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA') {
        g.total_un_abatidas = Math.max(g.total_un_abatidas, un);
      } else if (l.tipo_evento === 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL') {
        if (!g.actions.some(a => a.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA')) {
          g.total_un_abatidas += un;
        }
      }
    }
  }

  const result = [];
  for (const [pId, g] of grouped.entries()) {
    const skuInfo = db.prepare(\`
      SELECT produto_id, barras, descricao, labora, custo_unit, preco_venda, abc_class
      FROM engine_sku_results
      WHERE run_id = ? AND produto_id = ?
      LIMIT 1
    \`).get(runId, pId);

    let altStockStores = [];
    if (g.molecule_key) {
      altStockStores = db.prepare(\`
        SELECT filial_id, produto_id, descricao, labora, estoque_atual, abc_class
        FROM engine_sku_results
        WHERE run_id = ? AND molecule_key = ? AND produto_id <> ? AND estoque_atual > 0
        ORDER BY estoque_atual DESC
      \`).all(runId, g.molecule_key, pId);
    }

    const existingTransfer = transfers.find(t => 
      (t.itens && t.itens.some(it => it.produto_id === pId)) || 
      (t.observacao && g.molecule_key && t.observacao.includes(g.molecule_key))
    );

    const custo = skuInfo?.custo_unit || 0;
    const economiaRs = Math.round(g.total_un_abatidas * custo * 100) / 100;

    result.push({
      produto_id: pId,
      descricao: skuInfo?.descricao || g.descricao,
      barras: skuInfo?.barras || '',
      labora: skuInfo?.labora || '',
      molecule_key: g.molecule_key,
      total_un_abatidas: g.total_un_abatidas,
      custo_unit: custo,
      economia_rs: economiaRs,
      lojas_canceladas: Array.from(g.lojas_canceladas).map(fId => ({
        filial_id: fId,
        nome: filMap.get(fId)?.nome_reduz || \`Loja \${fId}\`
      })),
      lojas_doadoras: altStockStores.map(s => ({
        filial_id: s.filial_id,
        nome: filMap.get(s.filial_id)?.nome_reduz || \`Loja \${s.filial_id}\`,
        estoque_atual: s.estoque_atual,
        labora: s.labora,
        descricao: s.descricao
      })),
      transfer_emitted: existingTransfer ? {
        codigo: existingTransfer.codigo_transferencia,
        id: existingTransfer.id,
        status: existingTransfer.status,
        filial_origem: existingTransfer.filial_origem_nome,
        filial_destino: existingTransfer.filial_destino_nome
      } : null,
      created_at: g.created_at
    });
  }

  return result;
}`;

if (!content.includes('function getCuradoriaDecisions')) {
  content = content.replace(getLatestRunAnchor, `${getLatestRunAnchor}\n${curadoriaDecisionsFunc}`);
  console.log('✓ Injected getCuradoriaDecisions function');
}

// 2. Support /api/remanejamento/status in addition to transfer-status
content = content.replace(
  `if (pathname === '/api/remanejamento/transfer-status' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.transferId || !body.status) {
        return sendJson(res, 400, { error: 'transferId e status obrigatorios.' });
      }
      updateMotorTransferStatus(clientCode, Number(body.transferId), body.status);
      return sendJson(res, 200, { ok: true, transferId: body.transferId, status: body.status });
    }`,
  `if ((pathname === '/api/remanejamento/transfer-status' || pathname === '/api/remanejamento/status') && req.method === 'POST') {
      const body = await readBody(req);
      const tId = Number(body.transferId || body.id);
      const status = body.status;
      if (!tId || !status) {
        return sendJson(res, 400, { error: 'transferId e status obrigatorios.' });
      }
      updateMotorTransferStatus(clientCode, tId, status);
      return sendJson(res, 200, { ok: true, transferId: tId, status });
    }`
);
console.log('✓ Patched /api/remanejamento/status route');

// 3. Add endpoints /api/curadoria/emit-transfer and /api/remanejamento/fefo-action
const endpointsToAdd = `
    // REV-026: Emitir transferência formal a partir de decisão da Curadoria IA
    if (pathname === '/api/curadoria/emit-transfer' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const body = await readBody(req);
      const { produto_id, all } = body;
      const decs = getCuradoriaDecisions(clientCode, latestRun.id);

      if (all) {
        let count = 0;
        const emitted = [];
        for (const dec of decs) {
          if (!dec.transfer_emitted && dec.lojas_doadoras && dec.lojas_doadoras.length > 0) {
            const bestDonor = dec.lojas_doadoras[0];
            const bestDest = dec.lojas_canceladas[0] || { filial_id: bestDonor.filial_id === 2 ? 3 : 2, nome: bestDonor.filial_id === 2 ? 'Loja 3' : 'Loja 2' };
            const qty = dec.total_un_abatidas || 1;
            const resTrf = createMotorTransfer(clientCode, latestRun.id, {
              filialOrigem: bestDonor.filial_id,
              filialOrigemNome: bestDonor.nome,
              filialDestino: bestDest.filial_id,
              filialDestinoNome: bestDest.nome,
              items: [{
                produto_id: dec.produto_id,
                barras: dec.barras,
                descricao: dec.descricao,
                labora: dec.labora,
                qtd_solicitada: qty,
                custo_unit: dec.custo_unit,
                valor_total: dec.economia_rs,
                motivo_decisao: \`🧬 Curadoria IA • Transfer-First (Cancelou compras externas da molécula \${dec.molecule_key || ''})\`
              }],
              observacao: \`🧬 Curadoria IA • Transfer-First (\${dec.descricao} • Cancelou compra externa)\`
            });
            count++;
            emitted.push(resTrf.codigoTransferencia);
          }
        }
        return sendJson(res, 200, { ok: true, count, emitted, message: \`\${count} guias de transferência emitidas no motor!\` });
      }

      const targetDec = decs.find(d => Number(d.produto_id) === Number(produto_id));
      if (!targetDec) return sendJson(res, 404, { error: 'Decisao nao encontrada.' });
      if (!targetDec.lojas_doadoras || targetDec.lojas_doadoras.length === 0) {
        return sendJson(res, 400, { error: 'Nenhuma loja doadora com estoque alternativo para transferir.' });
      }

      const donor = targetDec.lojas_doadoras[0];
      const dest = targetDec.lojas_canceladas[0] || { filial_id: donor.filial_id === 2 ? 3 : 2, nome: donor.filial_id === 2 ? 'Loja 3' : 'Loja 2' };
      const qty = targetDec.total_un_abatidas || 1;
      const resTrf = createMotorTransfer(clientCode, latestRun.id, {
        filialOrigem: donor.filial_id,
        filialOrigemNome: donor.nome,
        filialDestino: dest.filial_id,
        filialDestinoNome: dest.nome,
        items: [{
          produto_id: targetDec.produto_id,
          barras: targetDec.barras,
          descricao: targetDec.descricao,
          labora: targetDec.labora,
          qtd_solicitada: qty,
          custo_unit: targetDec.custo_unit,
          valor_total: targetDec.economia_rs,
          motivo_decisao: \`🧬 Curadoria IA • Transfer-First (Cancelou compras externas da molécula \${targetDec.molecule_key || ''})\`
        }],
        observacao: \`🧬 Curadoria IA • Transfer-First (\${targetDec.descricao} • Cancelou compra externa)\`
      });

      return sendJson(res, 200, { ok: true, codigoTransferencia: resTrf.codigoTransferencia, message: \`Guia \${resTrf.codigoTransferencia} emitida com sucesso!\` });
    }

    // REV-026: Ação operacional no lote crítico FEFO
    if (pathname === '/api/remanejamento/fefo-action' && req.method === 'POST') {
      const body = await readBody(req);
      const { produto_id, filial_id, acao, motivo } = body;
      recordBuyerLearning(clientCode, {
        filial_id: Number(filial_id || 0),
        produto_id: Number(produto_id),
        descricao: body.descricao || \`SKU \${produto_id}\`,
        tipo_evento: acao === 'SEGREGA_DEVOLUCAO' ? 'FEFO_SEGREGA_DEVOLUCAO' : 'FEFO_DESOVA_BALCAO',
        motivo: motivo || (acao === 'SEGREGA_DEVOLUCAO' ? 'Lote vencido segregado para troca/devolução ao fornecedor' : 'Ação de desova ativa no balcão da loja'),
        acao_futura: 'PREVENCAO_PERDAS'
      });
      return sendJson(res, 200, { ok: true, message: 'Ação operacional registrada com sucesso!' });
    }
`;

if (!content.includes('/api/curadoria/emit-transfer')) {
  content = content.replace(
    "if (pathname === '/api/remanejamento/export-excel' && req.method === 'GET') {",
    `${endpointsToAdd}\n    if (pathname === '/api/remanejamento/export-excel' && req.method === 'GET') {`
  );
  console.log('✓ Added /api/curadoria/emit-transfer and /api/remanejamento/fefo-action endpoints');
}

// 4. Fix /api/remanejamento SQL aliases and add curadoriaDecisions
const oldExpSql = `const expSql = hasFilial
        ? \`SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada, lote_vencendo_90d_qtd, lote_vencendo_90d_rs,
                  lote_vencido_qtd, lote_menor_validade,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS lote_risco_total_rs
           FROM engine_sku_results
           WHERE run_id = ? AND filial_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY lote_risco_total_rs DESC, lote_menor_validade ASC
           LIMIT 150\`
        : \`SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada, lote_vencendo_90d_qtd, lote_vencendo_90d_rs,
                  lote_vencido_qtd, lote_menor_validade,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS lote_risco_total_rs
           FROM engine_sku_results
           WHERE run_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY lote_risco_total_rs DESC, lote_menor_validade ASC
           LIMIT 150\`;
      const expParams = hasFilial ? [latestRun.id, fNum] : [latestRun.id];
      const expiringLots = db.prepare(expSql).all(...expParams);

      return sendJson(res, 200, { transfers, expiringLots });`;

const newExpSql = `const expSql = hasFilial
        ? \`SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada,
                  lote_menor_validade AS menor_validade,
                  lote_vencendo_90d_qtd AS qtd_vencendo_90d,
                  lote_vencido_qtd AS qtd_vencido,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS valor_risco_rs,
                  CASE 
                    WHEN lote_vencido_qtd > 0 THEN 'LOTE_VENCIDO'
                    WHEN lote_vencendo_90d_qtd > 0 AND estoque_atual > (ddv_projetada * 90) THEN 'PERDA_VALIDADE_IMINENTE'
                    ELSE 'FEFO_ALERTA'
                  END AS acao_recomendada
           FROM engine_sku_results
           WHERE run_id = ? AND filial_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY valor_risco_rs DESC, lote_menor_validade ASC
           LIMIT 150\`
        : \`SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada,
                  lote_menor_validade AS menor_validade,
                  lote_vencendo_90d_qtd AS qtd_vencendo_90d,
                  lote_vencido_qtd AS qtd_vencido,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS valor_risco_rs,
                  CASE 
                    WHEN lote_vencido_qtd > 0 THEN 'LOTE_VENCIDO'
                    WHEN lote_vencendo_90d_qtd > 0 AND estoque_atual > (ddv_projetada * 90) THEN 'PERDA_VALIDADE_IMINENTE'
                    ELSE 'FEFO_ALERTA'
                  END AS acao_recomendada
           FROM engine_sku_results
           WHERE run_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY valor_risco_rs DESC, lote_menor_validade ASC
           LIMIT 150\`;
      const expParams = hasFilial ? [latestRun.id, fNum] : [latestRun.id];
      const expiringLots = db.prepare(expSql).all(...expParams);
      const curadoriaDecisions = getCuradoriaDecisions(clientCode, latestRun.id);

      return sendJson(res, 200, { transfers, expiringLots, curadoriaDecisions });`;

if (content.includes(oldExpSql)) {
  content = content.replace(oldExpSql, newExpSql);
  console.log('✓ Patched /api/remanejamento with correct aliases and curadoriaDecisions');
}

// 5. In /api/remanejamento/routes, if tipoParam === 'CURADORIA_IA', merge synthetic routes from curadoria decisions
const routesBeforeSendAnchor = `const activeTransfers = getMotorTransfers(clientCode);`;

const routesCuradoriaMerge = `const activeTransfers = getMotorTransfers(clientCode);
      const curadoriaDecisionsList = getCuradoriaDecisions(clientCode, latestRun.id);

      // REV-026: Quando o comprador filtra por Curadoria IA, mesclar decisões tomadas para que nunca apareça vazio
      if (tipoParam === 'CURADORIA_IA' || tipoParam === 'ALL') {
        for (const cd of curadoriaDecisionsList) {
          if (cd.lojas_doadoras && cd.lojas_doadoras.length > 0) {
            const donor = cd.lojas_doadoras[0];
            const dest = cd.lojas_canceladas[0] || { filial_id: donor.filial_id === 2 ? 3 : 2, nome: donor.filial_id === 2 ? 'BF CENTRO' : 'BF CID.NOVA' };
            const rKey = \`\${donor.filial_id}->\${dest.filial_id}\`;
            
            if (!routesMap.has(rKey)) {
              routesMap.set(rKey, {
                routeKey: rKey,
                filialOrigem: donor.filial_id,
                filialOrigemNome: donor.nome,
                filialOrigemReduz: donor.nome,
                filialDestino: dest.filial_id,
                filialDestinoNome: dest.nome,
                filialDestinoReduz: dest.nome,
                totalItens: 0,
                totalUnidades: 0,
                valorTotalRs: 0,
                countFefo: 0,
                countExcesso: 0,
                countParado: 0,
                countCuradoria: 0,
                items: []
              });
            }
            
            const rObj = routesMap.get(rKey);
            // Evitar duplicar o mesmo produto na mesma rota
            if (!rObj.items.some(it => it.produto_id === cd.produto_id)) {
              const itemQty = cd.total_un_abatidas || 1;
              const itemRs = cd.economia_rs || Math.round(itemQty * cd.custo_unit * 100) / 100;
              rObj.totalItens += 1;
              rObj.totalUnidades += itemQty;
              rObj.valorTotalRs = Math.round((rObj.valorTotalRs + itemRs) * 100) / 100;
              rObj.countCuradoria += 1;
              curadoriaCount += 1;
              curadoriaVal += itemRs;

              rObj.items.push({
                id: \`curad-\${cd.produto_id}\`,
                run_id: latestRun.id,
                produto_id: cd.produto_id,
                descricao: cd.descricao,
                filial_origem: donor.filial_id,
                filial_origem_nome: donor.nome,
                filial_destino: dest.filial_id,
                filial_destino_nome: dest.nome,
                tipo: 'CURADORIA_IA',
                qtd_sugerida: itemQty,
                custo_unit: cd.custo_unit,
                valor_total: itemRs,
                validade_prioritaria: '2027-12-31',
                motivo: \`🧬 Curadoria IA • Transfer-First: Abatimento de compra externa suprido por estoque de \${donor.labora} (\${donor.estoque_atual} un em estoque)\`,
                barras: cd.barras,
                labora: cd.labora,
                isCuradoria: true
              });
            }
          }
        }
      }`;

if (!content.includes('curadoriaDecisionsList = getCuradoriaDecisions')) {
  content = content.replace(routesBeforeSendAnchor, routesCuradoriaMerge);
  console.log('✓ Added Curadoria routes merging in /api/remanejamento/routes');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done patching src/server.mjs!');

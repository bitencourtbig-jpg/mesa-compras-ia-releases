import fs from 'node:fs';

const filePath = 'src/server.mjs';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Atualizar /api/remanejamento/routes com filtros avançados e contagens
const oldRoutesHandler = `    if (pathname === '/api/remanejamento/routes' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { routes: [], summary: {} });

      const filialId = urlObj.searchParams.get('filial_id');
      const hasFilial = filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0;
      const fNum = hasFilial ? Number(filialId) : null;

      const remanSql = hasFilial
        ? \`SELECT r.*,
                 esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
                 esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
                 esr_orig.barras, esr_orig.labora
          FROM engine_remanejamento r
          LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
          LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
          WHERE r.run_id = ? AND (r.filial_origem = ? OR r.filial_destino = ?)
          ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC\`
        : \`SELECT r.*,
                 esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
                 esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
                 esr_orig.barras, esr_orig.labora
          FROM engine_remanejamento r
          LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
          LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
          WHERE r.run_id = ?
          ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC\`;
      const remanParams = hasFilial ? [latestRun.id, fNum, fNum] : [latestRun.id];
      const remanRows = db.prepare(remanSql).all(...remanParams);

      const routesMap = new Map();
      for (const row of remanRows) {
        const routeKey = \`\${row.filial_origem}->\${row.filial_destino}\`;
        if (!routesMap.has(routeKey)) {
          routesMap.set(routeKey, {
            routeKey,
            filialOrigem: row.filial_origem,
            filialOrigemNome: row.filial_origem_nome || \`Filial \${row.filial_origem}\`,
            filialOrigemReduz: row.filial_origem_reduz || \`L\${String(row.filial_origem).padStart(2, '0')}\`,
            filialDestino: row.filial_destino,
            filialDestinoNome: row.filial_destino_nome || \`Filial \${row.filial_destino}\`,
            filialDestinoReduz: row.filial_destino_reduz || \`L\${String(row.filial_destino).padStart(2, '0')}\`,
            totalItens: 0,
            totalUnidades: 0,
            valorTotalRs: 0,
            items: [],
          });
        }
        const rObj = routesMap.get(routeKey);
        rObj.totalItens += 1;
        rObj.totalUnidades += Number(row.qtd_sugerida || 0);
        rObj.valorTotalRs = Math.round((rObj.valorTotalRs + Number(row.valor_total || 0)) * 100) / 100;
        rObj.items.push({
          ...row,
          barras: row.barras || '',
          labora: row.labora || '',
        });
      }

      const activeTransfers = getMotorTransfers(clientCode);

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        routes: Array.from(routesMap.values()),
        totalGeralRs: remanRows.reduce((a, b) => a + Number(b.valor_total || 0), 0),
        totalGeralUnidades: remanRows.reduce((a, b) => a + Number(b.qtd_sugerida || 0), 0),
        transfers: activeTransfers,
      });
    }`;

const newRoutesHandler = `    if (pathname === '/api/remanejamento/routes' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { routes: [], summary: {} });

      const filialId = urlObj.searchParams.get('filial_id');
      const origemParam = urlObj.searchParams.get('origem');
      const destinoParam = urlObj.searchParams.get('destino');
      const tipoParam = urlObj.searchParams.get('tipo') || 'ALL';
      const curvaParam = urlObj.searchParams.get('curva') || 'ALL';
      const minValParam = Number(urlObj.searchParams.get('min_valor') || 0);
      const searchParam = (urlObj.searchParams.get('search') || '').trim();

      const conditions = ['r.run_id = ?'];
      const params = [latestRun.id];

      if (origemParam && origemParam !== 'ALL' && !isNaN(Number(origemParam))) {
        conditions.push('r.filial_origem = ?');
        params.push(Number(origemParam));
      }
      if (destinoParam && destinoParam !== 'ALL' && !isNaN(Number(destinoParam))) {
        conditions.push('r.filial_destino = ?');
        params.push(Number(destinoParam));
      }
      if (filialId && filialId !== 'all' && !isNaN(Number(filialId)) && !origemParam && !destinoParam) {
        conditions.push('(r.filial_origem = ? OR r.filial_destino = ?)');
        params.push(Number(filialId), Number(filialId));
      }
      if (tipoParam && tipoParam !== 'ALL') {
        if (tipoParam === 'CURADORIA_IA') {
          conditions.push("(r.tipo = 'CURADORIA_IA' OR r.motivo LIKE '%Curadoria%' OR esr_orig.justificativa_ia LIKE '%Remanejamento%')");
        } else {
          conditions.push('r.tipo = ?');
          params.push(tipoParam);
        }
      }
      if (curvaParam && curvaParam !== 'ALL') {
        conditions.push('esr_orig.abc_class = ?');
        params.push(curvaParam);
      }
      if (minValParam > 0) {
        conditions.push('r.valor_total >= ?');
        params.push(minValParam);
      }
      if (searchParam) {
        conditions.push('(r.descricao LIKE ? OR esr_orig.barras LIKE ? OR esr_orig.labora LIKE ? OR CAST(r.produto_id AS TEXT) LIKE ?)');
        const s = \`%\${searchParam}%\`;
        params.push(s, s, s, s);
      }

      const remanSql = \`
        SELECT r.id, r.run_id, r.produto_id, r.descricao, r.filial_origem, r.filial_destino,
               r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.validade_prioritaria, r.motivo,
               esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
               esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
               esr_orig.barras, esr_orig.labora, esr_orig.abc_class, esr_orig.justificativa_ia, esr_orig.molecule_key
        FROM engine_remanejamento r
        LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
        LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
        WHERE \${conditions.join(' AND ')}
        ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC
      \`;

      const remanRows = db.prepare(remanSql).all(...params);

      // Agrupamento por Rota
      const routesMap = new Map();
      let fefoCount = 0, fefoVal = 0;
      let excessoCount = 0, excessoVal = 0;
      let paradoCount = 0, paradoVal = 0;
      let curadoriaCount = 0, curadoriaVal = 0;

      for (const row of remanRows) {
        const routeKey = \`\${row.filial_origem}->\${row.filial_destino}\`;
        if (!routesMap.has(routeKey)) {
          routesMap.set(routeKey, {
            routeKey,
            filialOrigem: row.filial_origem,
            filialOrigemNome: row.filial_origem_nome || \`Filial \${row.filial_origem}\`,
            filialOrigemReduz: row.filial_origem_reduz || \`L\${String(row.filial_origem).padStart(2, '0')}\`,
            filialDestino: row.filial_destino,
            filialDestinoNome: row.filial_destino_nome || \`Filial \${row.filial_destino}\`,
            filialDestinoReduz: row.filial_destino_reduz || \`L\${String(row.filial_destino).padStart(2, '0')}\`,
            totalItens: 0,
            totalUnidades: 0,
            valorTotalRs: 0,
            countFefo: 0,
            countExcesso: 0,
            countParado: 0,
            countCuradoria: 0,
            items: [],
          });
        }
        const rObj = routesMap.get(routeKey);
        const val = Number(row.valor_total || 0);
        const un = Number(row.qtd_sugerida || 0);

        rObj.totalItens += 1;
        rObj.totalUnidades += un;
        rObj.valorTotalRs = Math.round((rObj.valorTotalRs + val) * 100) / 100;

        const isCuradoria = row.tipo === 'CURADORIA_IA' || (row.motivo && row.motivo.includes('Curadoria')) || (row.justificativa_ia && row.justificativa_ia.includes('Remanejamento'));
        if (isCuradoria) {
          rObj.countCuradoria += 1;
          curadoriaCount += 1;
          curadoriaVal += val;
        } else if (row.tipo === 'FEFO_VALIDADE') {
          rObj.countFefo += 1;
          fefoCount += 1;
          fefoVal += val;
        } else if (row.tipo === 'EXCESSO') {
          rObj.countExcesso += 1;
          excessoCount += 1;
          excessoVal += val;
        } else {
          rObj.countParado += 1;
          paradoCount += 1;
          paradoVal += val;
        }

        rObj.items.push({
          ...row,
          barras: row.barras || '',
          labora: row.labora || '',
          isCuradoria,
        });
      }

      const activeTransfers = getMotorTransfers(clientCode);

      // Lista de filiais ativas para os dropdowns de filtro
      const filiais = db.prepare('SELECT DISTINCT filial_id, nome_loja, nome_reduz FROM config_filiais WHERE client_code = ? AND filial_id <> 1 ORDER BY filial_id ASC').all(clientCode);

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        routes: Array.from(routesMap.values()),
        totalGeralRs: Math.round(remanRows.reduce((a, b) => a + Number(b.valor_total || 0), 0) * 100) / 100,
        totalGeralUnidades: remanRows.reduce((a, b) => a + Number(b.qtd_sugerida || 0), 0),
        totalItens: remanRows.length,
        summary: {
          fefoCount, fefoVal: Math.round(fefoVal * 100) / 100,
          excessoCount, excessoVal: Math.round(excessoVal * 100) / 100,
          paradoCount, paradoVal: Math.round(paradoVal * 100) / 100,
          curadoriaCount, curadoriaVal: Math.round(curadoriaVal * 100) / 100,
        },
        filiais,
        transfers: activeTransfers,
      });
    }`;

if (code.includes(oldRoutesHandler)) {
  code = code.replace(oldRoutesHandler, newRoutesHandler);
  console.log('/api/remanejamento/routes atualizado com filtros no server.mjs');
} else {
  console.log('AVISO: oldRoutesHandler não encontrado exatamente, tentando com CRLF/LF...');
  const normCode = code.replace(/\r\n/g, '\n');
  const normOld = oldRoutesHandler.replace(/\r\n/g, '\n');
  if (normCode.includes(normOld)) {
    code = normCode.replace(normOld, newRoutesHandler.replace(/\r\n/g, '\n'));
    console.log('/api/remanejamento/routes atualizado com sucesso via normalização!');
  }
}

// 2. Emitir transferência formal com observação de Curadoria IA quando REMANEJAR_E_CANCELAR ou EXECUTE_IA_1CLICK for chamado com rotas
const targetRemanDecision = `        recordBuyerLearning(clientCode, {
          filial_id: 0,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA',`;

const formalTransferCode = `        // REV-025: Registrar guia de transferência formal no motor com sinalização de Curadoria IA
        if (routes && routes.length > 0) {
          const groupedRoutes = new Map();
          for (const r of routes) {
            const key = \`\${r.from_filial_id || r.filial_origem}->\${r.to_filial_id || r.filial_destino}\`;
            if (!groupedRoutes.has(key)) {
              groupedRoutes.set(key, {
                origem: Number(r.from_filial_id || r.filial_origem),
                origemNome: r.from_label || \`Loja \${r.from_filial_id || r.filial_origem}\`,
                destino: Number(r.to_filial_id || r.filial_destino),
                destinoNome: r.to_label || \`Loja \${r.to_filial_id || r.filial_destino}\`,
                items: [],
              });
            }
            groupedRoutes.get(key).items.push({
              produto_id: Number(r.produto_id || pId),
              barras: r.barras || '',
              descricao: r.produto_desc || descricao,
              labora: r.labora || '',
              qtd_solicitada: Number(r.qty || 0),
              custo_unit: Number(r.custo_unit || 0),
              valor_total: Number(r.economia_rs || 0),
              motivo_decisao: \`🧬 Curadoria IA: Substituição de molécula para suprir demanda da filial e cancelar compras externas\`,
            });
          }

          for (const grp of groupedRoutes.values()) {
            try {
              createMotorTransfer(clientCode, latestRun.id, {
                filialOrigem: grp.origem,
                filialOrigemNome: grp.origemNome,
                filialDestino: grp.destino,
                filialDestinoNome: grp.destinoNome,
                items: grp.items,
                observacao: \`🧬 Curadoria IA • Transfer-First (Cancelou compras externas da molécula \${molecule_key})\`
              });
            } catch (errTransf) {
              console.error('Aviso ao emitir transferência formal da curadoria:', errTransf.message);
            }
          }
        }

        recordBuyerLearning(clientCode, {
          filial_id: 0,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA',`;

if (code.includes(targetRemanDecision)) {
  code = code.replace(targetRemanDecision, formalTransferCode);
  console.log('Emissão de guia formal da Curadoria IA adicionada em REMANEJAR_E_CANCELAR!');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Patch backend aplicado com sucesso!');

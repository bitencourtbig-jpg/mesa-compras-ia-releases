import fs from 'node:fs';

const filePath = 'src/server.mjs';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Inserir a função auxiliar analyzeMoleculeStoreStrategy antes de buildMoleculeMatricialCard
const auxFuncMarker = `// ========================================================\n// AUXILIAR: VISÃO MATRICIAL POR MOLÉCULA (REV-021)\n// ========================================================`;

const analyzeStoreFuncCode = `// ========================================================
// AUXILIAR: ANÁLISE FILIAL A FILIAL & SINERGIA COM REMANEJAMENTO (REV-023)
// ========================================================
function analyzeMoleculeStoreStrategy(targetSku, distinctSkus, filiais, nativeRemanRoutes = []) {
  if (!targetSku) return { stores: [], remanejamento: null };

  const otherSkus = distinctSkus.filter((s) => s.produto_id !== targetSku.produto_id);
  const storesAnalysis = [];
  const doadoras = [];
  const receptoras = [];

  for (const f of filiais) {
    const fId = Number(f.filial_id);
    const targetInStore = (targetSku.lojas && targetSku.lojas[fId]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0, ddv_projetada: 0 };
    const sugUn = Number(targetInStore.sugestao_compra_un || 0);
    const sugRs = Number(targetInStore.sugestao_compra_rs || (sugUn * (targetSku.custo_unit || 0)).toFixed(2));
    const estAlvo = Number(targetInStore.estoque_atual || 0);
    const cobAlvo = Number(targetInStore.cobertura_dias || 0);
    const ddvAlvo = Number(targetInStore.ddv_projetada || 0);

    const altItems = [];
    let altEstTotal = 0;
    let deadEstTotal = 0;
    let altDdvTotal = 0;

    for (const os of otherSkus) {
      const osInStore = (os.lojas && os.lojas[fId]) || { estoque_atual: 0, cobertura_dias: 0, ddv_projetada: 0 };
      const e = Number(osInStore.estoque_atual || 0);
      if (e > 0) {
        altEstTotal += e;
        altDdvTotal += Number(osInStore.ddv_projetada || 0);
        const isDead = os.abc_class === 'D' || /D/i.test(os.curva_erp_classe || '');
        if (isDead) deadEstTotal += e;
        altItems.push({
          produto_id: os.produto_id,
          descricao: os.descricao,
          labora: os.labora,
          estoque: e,
          cobertura_dias: osInStore.cobertura_dias,
          abc_class: os.abc_class,
          isDead,
        });
      }
    }

    const cobAltMedia = altDdvTotal > 0 ? Math.round((altEstTotal / altDdvTotal) * 10) / 10 : (altEstTotal > 0 ? 999 : 0);

    let veredito = 'EQUILIBRADO';
    let badgeColor = 'neutral';
    let tituloVeredito = '✓ Estoque Equilibrado';
    let orientacao = 'Estoque em níveis normais para esta filial.';
    let acaoSugerida = 'Nenhuma compra externa necessária.';
    let cancelQty = 0;
    let faltaQty = 0;

    if (sugUn > 0) {
      if (altEstTotal >= sugUn || cobAltMedia >= 45 || altEstTotal >= 15) {
        veredito = 'BLOQUEAR_COMPRA';
        badgeColor = 'danger';
        tituloVeredito = '🛑 NÃO COMPRAR NESTA FILIAL';
        cancelQty = sugUn;
        const labsText = altItems.map(a => \`\${a.labora}: \${a.estoque} un (\${a.cobertura_dias >= 999 ? '999+d' : a.cobertura_dias + 'd'})\`).slice(0, 3).join(', ');
        orientacao = \`A loja já possui \${altEstTotal} un em estoque de marcas concorrentes (\${labsText}). Repor mais \${sugUn} un gerará sobre-estoque crítico e imobilização desnecessária de caixa!\`;
        acaoSugerida = \`Cancelar a compra de \${sugUn} un desta filial (Economia de R$ \${(sugUn * (targetSku.custo_unit || 0)).toFixed(2)}).\`;
      } else if (altEstTotal > 0) {
        veredito = 'DEDUZIR_PARCIAL';
        badgeColor = 'warning';
        tituloVeredito = '📉 DESCONTAR DO PEDIDO DA FILIAL';
        cancelQty = Math.min(sugUn, altEstTotal);
        const labsText = altItems.map(a => \`\${a.labora}: \${a.estoque} un\`).join(', ');
        orientacao = \`A loja possui demanda de \${sugUn} un, mas já tem \${altEstTotal} un de marcas alternativas em prateleira (\${labsText}).\`;
        acaoSugerida = \`Abater as \${cancelQty} un existentes, reduzindo a compra para \${sugUn - cancelQty} un.\`;
      } else {
        veredito = 'RUPTURA_REAL';
        badgeColor = 'primary';
        faltaQty = sugUn;
        tituloVeredito = '🛒 RUPTURA / DEMANDA GENUÍNA';
        orientacao = \`Loja com estoque zerado e sem alternativas na mesma molécula. Demanda comprovada de \${sugUn} un.\`;
        acaoSugerida = \`Atender prioritariamente via Remanejamento Interno (custo zero) ou compra direta.\`;
        receptoras.push({
          filial_id: fId,
          label: f.short || f.label,
          faltaQty: sugUn,
          sugRs: Number((sugUn * (targetSku.custo_unit || 0)).toFixed(2)),
        });
      }
    } else {
      if (altEstTotal >= 15 && cobAltMedia >= 60) {
        veredito = 'DOADORA_EXCESSO';
        badgeColor = 'purple';
        tituloVeredito = '🚚 LOJA DOADORA (SOBRA DE ESTOQUE)';
        const surplus = Math.max(0, altEstTotal - Math.round(altDdvTotal * 30));
        orientacao = \`Possui excedente de \${altEstTotal} un em marcas concorrentes (\${cobAltMedia}d de cobertura).\`;
        acaoSugerida = \`Pode transferir até \${surplus} un para filiais com falta, evitando compras externas.\`;
        if (surplus > 0) {
          doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
        }
      } else if (deadEstTotal > 0) {
        veredito = 'DESOVAR_BALCAO';
        badgeColor = 'warning';
        tituloVeredito = '⚠️ PRIORIZAR DESOVA NO BALCÃO';
        orientacao = \`Possui \${deadEstTotal} un de Curva D sem giro recente correndo risco de vencimento.\`;
        acaoSugerida = \`Focar no balcão e não repor nada até zerar este estoque.\`;
      }
    }

    if (altEstTotal >= 20 && cobAltMedia >= 60) {
      const surplus = Math.max(0, altEstTotal - Math.max(1, Math.round(altDdvTotal * 30)));
      if (surplus > 0 && !doadoras.some((d) => d.filial_id === fId)) {
        doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
      }
    }

    storesAnalysis.push({
      filial_id: fId,
      label: f.short || f.label,
      full_label: f.label,
      targetSug: sugUn,
      sugRs,
      targetEst: estAlvo,
      targetCob: cobAlvo,
      altEstTotal,
      deadEstTotal,
      cobAltMedia,
      altItems,
      veredito,
      badgeColor,
      tituloVeredito,
      orientacao,
      acaoSugerida,
      cancelQty,
      faltaQty,
    });
  }

  // Rotas de Remanejamento: nativas do motor ou calculadas entre doadoras e receptoras
  const transferRoutes = [];
  let totalTransferivel = 0;

  if (nativeRemanRoutes.length > 0) {
    for (const r of nativeRemanRoutes) {
      totalTransferivel += r.qtd_sugerida;
      const fOrig = filiais.find((fl) => fl.filial_id === r.filial_origem);
      const fDest = filiais.find((fl) => fl.filial_id === r.filial_destino);
      transferRoutes.push({
        id: r.id,
        from_filial_id: r.filial_origem,
        from_label: fOrig ? (fOrig.short || fOrig.label) : \`L0\${r.filial_origem}\`,
        to_filial_id: r.filial_destino,
        to_label: fDest ? (fDest.short || fDest.label) : \`L0\${r.filial_destino}\`,
        produto_id: r.produto_id,
        produto_desc: r.descricao,
        labora: r.labora,
        qty: r.qtd_sugerida,
        economia_rs: r.valor_total || Math.round(r.qtd_sugerida * (targetSku.custo_unit || 0) * 100) / 100,
        motivo: r.motivo,
        tipo: r.tipo,
      });
    }
  } else if (doadoras.length > 0 && receptoras.length > 0) {
    const doadorasCopy = doadoras.map((d) => ({ ...d }));
    for (const rec of receptoras) {
      let needed = rec.faltaQty;
      for (const donor of doadorasCopy) {
        if (needed <= 0) break;
        if (donor.surplus <= 0 || donor.filial_id === rec.filial_id) continue;
        const qtyToTransfer = Math.min(needed, donor.surplus);
        donor.surplus -= qtyToTransfer;
        needed -= qtyToTransfer;
        totalTransferivel += qtyToTransfer;
        const mainItem = donor.items[0] || { labora: 'Marca Alternativa', descricao: targetSku.descricao };
        transferRoutes.push({
          from_filial_id: donor.filial_id,
          from_label: donor.label,
          to_filial_id: rec.filial_id,
          to_label: rec.label,
          produto_id: mainItem.produto_id || targetSku.produto_id,
          produto_desc: mainItem.descricao,
          labora: mainItem.labora,
          qty: qtyToTransfer,
          economia_rs: Math.round(qtyToTransfer * (targetSku.custo_unit || 0) * 100) / 100,
          motivo: 'Transferência de estoque excedente para cobrir ruptura sem compra externa',
          tipo: 'EXCESSO',
        });
      }
    }
  }

  const economiaRemanejamentoRs = Math.round(transferRoutes.reduce((acc, r) => acc + (r.economia_rs || 0), 0) * 100) / 100;
  const remanejamento = {
    hasOpportunities: transferRoutes.length > 0,
    routes: transferRoutes,
    totalTransferivel,
    economiaRemanejamentoRs,
    doadoras: doadoras.map((d) => ({ filial_id: d.filial_id, label: d.label, surplus: d.surplus })),
    receptoras: receptoras.map((r) => ({ filial_id: r.filial_id, label: r.label, faltaQty: r.faltaQty })),
  };

  return {
    stores: storesAnalysis,
    remanejamento,
  };
}

`;

if (!code.includes('analyzeMoleculeStoreStrategy')) {
  code = code.replace(auxFuncMarker, `${analyzeStoreFuncCode}\n${auxFuncMarker}`);
  console.log('Inserida analyzeMoleculeStoreStrategy');
}

// 2. Atualizar /api/molecules/sweep para buscar rotas e anexar store_analysis e remanejamento_sinergia
const sweepSendJsonOld = `      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        filiais,
        filialId,
        moleculeKey: key,
        substancia,
        concentracao,
        forma,
        packBucket,
        summary: {
          ...(mol || {}),
          skus_count: visibleSkus.length,
          labs_count: new Set(visibleSkus.map((s) => s.labora)).size,
          estoque_total: visibleSkus.reduce((acc, s) => acc + s.total_estoque, 0),
          ddv_proj_total: totalDdvMolecula,
          cobertura_molecula_dias: otherCoverageDays,
          economia_rs_evitada: mol?.economia_rs_evitada || 0,
        },
        targetSku,
        cheapestSku,
        otherStockTotal,
        otherCoverageDays,
        deadStocks,
        ia_advice: iaAdvice,
        skus: visibleSkus,
      });`;

const sweepSendJsonNew = `      // REV-023: Rotas nativas de remanejamento e estratégia loja a loja
      const molProductIds = visibleSkus.map((s) => s.produto_id);
      let nativeRemanRoutes = [];
      if (molProductIds.length > 0) {
        nativeRemanRoutes = db.prepare(\`
          SELECT r.id, r.produto_id, r.filial_origem, r.filial_destino, r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.motivo,
                 p.descricao, p.labora
          FROM engine_remanejamento r
          JOIN engine_sku_results p ON p.run_id = r.run_id AND p.filial_id = r.filial_origem AND p.produto_id = r.produto_id
          WHERE r.run_id = ? AND r.produto_id IN (\${molProductIds.map(() => '?').join(',')})
          ORDER BY r.valor_total DESC
        \`).all(latestRun.id, ...molProductIds);
      }
      const storeStrategy = analyzeMoleculeStoreStrategy(targetSku, visibleSkus, filiais, nativeRemanRoutes);

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        filiais,
        filialId,
        moleculeKey: key,
        substancia,
        concentracao,
        forma,
        packBucket,
        summary: {
          ...(mol || {}),
          skus_count: visibleSkus.length,
          labs_count: new Set(visibleSkus.map((s) => s.labora)).size,
          estoque_total: visibleSkus.reduce((acc, s) => acc + s.total_estoque, 0),
          ddv_proj_total: totalDdvMolecula,
          cobertura_molecula_dias: otherCoverageDays,
          economia_rs_evitada: mol?.economia_rs_evitada || 0,
        },
        targetSku,
        cheapestSku,
        otherStockTotal,
        otherCoverageDays,
        deadStocks,
        ia_advice: iaAdvice,
        store_analysis: storeStrategy.stores,
        remanejamento_sinergia: storeStrategy.remanejamento,
        skus: visibleSkus,
      });`;

if (code.includes(sweepSendJsonOld)) {
  code = code.replace(sweepSendJsonOld, sweepSendJsonNew);
  console.log('Atualizado /api/molecules/sweep com remanejamento e store_analysis');
} else {
  console.log('AVISO: sweepSendJsonOld não encontrado exatamente, verificando...');
}

// 3. Atualizar buildMoleculeMatricialCard para também incluir store_analysis e remanejamento_sinergia
const cardReturnOld = `  return {
    molecule_key: molRow.molecule_key,
    substancia: molRow.substancia,
    concentracao: molRow.concentracao,
    forma: molRow.forma,
    pack_bucket: molRow.pack_bucket,
    labs_count: new Set(visibleSkus.map(s => s.labora)).size,
    skus_count: visibleSkus.length,
    targetSku,
    cheapestSku,
    otherStockTotal,
    otherCoverageDays,
    iaAdvice,
    filiais,
    skus: visibleSkus,
  };`;

const cardReturnNew = `  // REV-023: Rotas nativas de remanejamento e estratégia loja a loja
  const molProductIds = visibleSkus.map(s => s.produto_id);
  const nativeRemanRoutes = molProductIds.length > 0 ? db.prepare(\`
    SELECT r.id, r.produto_id, r.filial_origem, r.filial_destino, r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.motivo,
           p.descricao, p.labora
    FROM engine_remanejamento r
    JOIN engine_sku_results p ON p.run_id = r.run_id AND p.filial_id = r.filial_origem AND p.produto_id = r.produto_id
    WHERE r.run_id = ? AND r.produto_id IN (\${molProductIds.map(() => '?').join(',')})
    ORDER BY r.valor_total DESC
  \`).all(runId, ...molProductIds) : [];
  const storeStrategy = analyzeMoleculeStoreStrategy(targetSku, visibleSkus, filiais, nativeRemanRoutes);

  return {
    molecule_key: molRow.molecule_key,
    substancia: molRow.substancia,
    concentracao: molRow.concentracao,
    forma: molRow.forma,
    pack_bucket: molRow.pack_bucket,
    labs_count: new Set(visibleSkus.map(s => s.labora)).size,
    skus_count: visibleSkus.length,
    targetSku,
    cheapestSku,
    otherStockTotal,
    otherCoverageDays,
    iaAdvice,
    store_analysis: storeStrategy.stores,
    remanejamento_sinergia: storeStrategy.remanejamento,
    filiais,
    skus: visibleSkus,
  };`;

if (code.includes(cardReturnOld)) {
  code = code.replace(cardReturnOld, cardReturnNew);
  console.log('Atualizado buildMoleculeMatricialCard com remanejamento e store_analysis');
}

// 4. Adicionar suporte a action === 'REMANEJAR_E_CANCELAR' em /api/curadoria/decision
const decisionSwitchOld = `      if (action === 'SWITCH') {`;
const decisionRemanCode = `      if (action === 'REMANEJAR_E_CANCELAR') {
        const pId = Number(produto_id);
        const { blockedStores = [], routes = [] } = body;

        db.exec('BEGIN');
        try {
          // 1. Zera compra nas lojas com excesso bloqueado
          for (const b of blockedStores) {
            const bFId = Number(b.filial_id);
            db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ? AND filial_id = ?')
              .run(\`Compra cancelada via Curadoria IA: Loja já possui \${b.altEstTotal || 0} un de marcas alternativas em estoque\`, latestRun.id, pId, bFId);

            recordSkuSuspension(clientCode, bFId, pId, {
              descricao: descricao || '',
              motivo: \`Compra bloqueada pela Curadoria IA: loja possui \${b.altEstTotal || 0} un de marcas alternativas da mesma molécula\`,
              days: 30,
              origem: 'CURADORIA_SOBREESTOQUE',
              moleculeKey: molecule_key,
              gatilhoCobertura: 7.0,
            });
          }

          // 2. Abate transferências nas lojas receptoras
          for (const r of routes) {
            const destFId = Number(r.to_filial_id);
            const qty = Number(r.qty || 0);
            if (qty > 0) {
              db.prepare(\`
                UPDATE engine_sku_results
                SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
                    sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
                    justificativa_ia = ?
                WHERE run_id = ? AND produto_id = ? AND filial_id = ?
              \`).run(qty, qty, \`Suprido por Remanejamento Interno (\${qty} un vindas de \${r.from_label}) - Transfer-First\`, latestRun.id, pId, destFId);
            }
          }

          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }

        recordBuyerLearning(clientCode, {
          filial_id: 0,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA',
          motivo: \`Remanejamento homologado pela IA: compras canceladas em lojas com excesso e demanda suprida por transferência interna\`,
          acao_futura: 'SEMPRE_PRIORIZAR_TRANSFER_FIRST',
        });

        return sendJson(res, 200, {
          ok: true,
          message: 'Remanejamento homologado com sucesso! Compras canceladas nas lojas com excesso e transferências aprovadas!'
        });
      }

      if (action === 'SWITCH') {`;

if (code.includes(decisionSwitchOld)) {
  code = code.replace(decisionSwitchOld, decisionRemanCode);
  console.log('Adicionado action === REMANEJAR_E_CANCELAR em /api/curadoria/decision');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Patch aplicado com sucesso em src/server.mjs!');

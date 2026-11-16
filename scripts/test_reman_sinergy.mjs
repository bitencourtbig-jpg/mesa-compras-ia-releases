import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
const run = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get('bandeirante');

export function analyzeMoleculeStoreStrategy(targetSku, distinctSkus, filiais, nativeRemanRoutes = []) {
  if (!targetSku) return { stores: [], remanejamento: null };

  const otherSkus = distinctSkus.filter(s => s.produto_id !== targetSku.produto_id);
  const storesAnalysis = [];
  const doadoras = [];
  const receptoras = [];

  for (const f of filiais) {
    const fId = Number(f.filial_id);
    const targetInStore = (targetSku.lojas && targetSku.lojas[fId]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0, ddv_projetada: 0 };
    const sugUn = Number(targetInStore.sugestao_compra_un || 0);
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
        const labsText = altItems.map(a => `${a.labora}: ${a.estoque} un (${a.cobertura_dias >= 999 ? '999+d' : a.cobertura_dias + 'd'})`).slice(0, 3).join(', ');
        orientacao = `A loja já possui ${altEstTotal} un em estoque de marcas concorrentes (${labsText}). Repor mais ${sugUn} un gerará sobre-estoque crítico e imobilização de caixa!`;
        acaoSugerida = `Cancelar a compra de ${sugUn} un desta filial (Economia de R$ ${(sugUn * (targetSku.custo_unit || 0)).toFixed(2)}).`;
      } else if (altEstTotal > 0) {
        veredito = 'DEDUZIR_PARCIAL';
        badgeColor = 'warning';
        tituloVeredito = '📉 DESCONTAR DO PEDIDO DA FILIAL';
        cancelQty = Math.min(sugUn, altEstTotal);
        const labsText = altItems.map(a => `${a.labora}: ${a.estoque} un`).join(', ');
        orientacao = `A loja possui demanda de ${sugUn} un, mas já tem ${altEstTotal} un de marcas alternativas em prateleira (${labsText}).`;
        acaoSugerida = `Abater as ${cancelQty} un existentes, reduzindo a compra para ${sugUn - cancelQty} un.`;
      } else {
        veredito = 'RUPTURA_REAL';
        badgeColor = 'primary';
        faltaQty = sugUn;
        tituloVeredito = '🛒 RUPTURA / DEMANDA GENUÍNA';
        orientacao = `Loja com estoque zerado e sem alternativas na mesma molécula. Demanda comprovada de ${sugUn} un.`;
        acaoSugerida = `Atender prioritariamente via Remanejamento Interno (custo zero) ou compra direta.`;
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
        orientacao = `Possui excedente de ${altEstTotal} un em marcas concorrentes (${cobAltMedia}d de cobertura).`;
        acaoSugerida = `Pode transferir até ${surplus} un para filiais com falta, evitando compras externas.`;
        if (surplus > 0) {
          doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
        }
      } else if (deadEstTotal > 0) {
        veredito = 'DESOVAR_BALCAO';
        badgeColor = 'warning';
        tituloVeredito = '⚠️ PRIORIZAR DESOVA NO BALCÃO';
        orientacao = `Possui ${deadEstTotal} un de Curva D sem giro recente correndo risco de vencimento.`;
        acaoSugerida = `Focar no balcão e não repor nada até zerar este estoque.`;
      }
    }

    if (altEstTotal >= 20 && cobAltMedia >= 60) {
      const surplus = Math.max(0, altEstTotal - Math.max(1, Math.round(altDdvTotal * 30)));
      if (surplus > 0 && !doadoras.some(d => d.filial_id === fId)) {
        doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
      }
    }

    storesAnalysis.push({
      filial_id: fId,
      label: f.short || f.label,
      full_label: f.label,
      targetSug: sugUn,
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

  // Montar rotas de remanejamento: prioritariamente as rotas nativas do motor
  const transferRoutes = [];
  let totalTransferivel = 0;

  if (nativeRemanRoutes.length > 0) {
    for (const r of nativeRemanRoutes) {
      totalTransferivel += r.qtd_sugerida;
      const fOrig = filiais.find(fl => fl.filial_id === r.filial_origem);
      const fDest = filiais.find(fl => fl.filial_id === r.filial_destino);
      transferRoutes.push({
        id: r.id,
        from_filial_id: r.filial_origem,
        from_label: fOrig ? (fOrig.short || fOrig.label) : `L0${r.filial_origem}`,
        to_filial_id: r.filial_destino,
        to_label: fDest ? (fDest.short || fDest.label) : `L0${r.filial_destino}`,
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
    const doadorasCopy = doadoras.map(d => ({ ...d }));
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
          motivo: 'Transferência de estoque excedente para cobrir ruptura sem compra',
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
    doadoras: doadoras.map(d => ({ filial_id: d.filial_id, label: d.label, surplus: d.surplus })),
    receptoras: receptoras.map(r => ({ filial_id: r.filial_id, label: r.label, faltaQty: r.faltaQty })),
  };

  return {
    stores: storesAnalysis,
    remanejamento,
  };
}

const filiais = [
  { filial_id: 2, label: 'L02 • BF CID.NOVA', short: 'L02' },
  { filial_id: 3, label: 'L03 • BF CENTRO', short: 'L03' },
  { filial_id: 4, label: 'L04 • FARMELHOR', short: 'L04' },
  { filial_id: 5, label: 'L05 • BF DBFLORES', short: 'L05' },
  { filial_id: 6, label: 'L06 • BF COROADO', short: 'L06' },
  { filial_id: 7, label: 'L07 • BF DOMPEDRO', short: 'L07' },
  { filial_id: 8, label: 'L08 • CD', short: 'L08' },
  { filial_id: 9, label: 'L09 • BF DROGARIA', short: 'L09' }
];

const molKey = 'CLORIDRATO DE ONDANSETRONA|8MG|CPR_ESP|10UN';
const res = await fetch('http://127.0.0.1:3456/api/molecules/sweep?key=' + encodeURIComponent(molKey) + '&skuId=78967857');
const d = await res.json();

const molProductIds = d.skus.map(s => s.produto_id);
const nativeRoutes = db.prepare(`
  SELECT r.id, r.produto_id, r.filial_origem, r.filial_destino, r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.motivo,
         p.descricao, p.labora
  FROM engine_remanejamento r
  JOIN engine_sku_results p ON p.run_id = r.run_id AND p.filial_id = r.filial_origem AND p.produto_id = r.produto_id
  WHERE r.run_id = ? AND r.produto_id IN (${molProductIds.map(() => '?').join(',')})
  ORDER BY r.valor_total DESC
`).all(run.id, ...molProductIds);

const analysis = analyzeMoleculeStoreStrategy(d.targetSku, d.skus, filiais, nativeRoutes);
console.log('Rotas combinadas:', analysis.remanejamento.routes.length);
console.log('Economia total de remanejamento:', analysis.remanejamento.economiaRemanejamentoRs);
console.log('Total cancelado em lojas que não devem comprar:', analysis.stores.reduce((a, s) => a + s.cancelQty, 0));

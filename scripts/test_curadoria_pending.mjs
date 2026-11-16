import { getAnalyticsDb, getFilialPolicies, getActiveSkuSuspensions } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
const clientCode = 'bandeirante';
const run = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);

const activePolicies = getFilialPolicies(clientCode).filter(p => Number(p.filial_id) !== 1);
const filiais = activePolicies.map(p => ({
  filial_id: Number(p.filial_id),
  label: `L${String(p.filial_id).padStart(2, '0')} • ${p.nome_reduz || p.nome_loja?.slice(0, 15) || `Loja ${p.filial_id}`}`,
  short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
}));

const activeSuspensions = getActiveSkuSuspensions(clientCode);
const suspensionsMap = new Map(activeSuspensions.map(s => [s.produto_id, s]));

export function buildMoleculeCard(db, runId, molRow) {
  const allRows = db.prepare(`
    SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome,
           abc_class, xyz_class, curva_erp_ranking, curva_erp_classe,
           preco_venda, custo_unit, margem_pct,
           estoque_atual, transito_real, ddv_projetada, cobertura_dias,
           sugestao_compra_un, sugestao_compra_rs, justificativa_ia
    FROM engine_sku_results
    WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1
    ORDER BY produto_id ASC, filial_id ASC
  `).all(runId, molRow.molecule_key);

  const groupedMap = new Map();
  for (const r of allRows) {
    if (!groupedMap.has(r.produto_id)) {
      groupedMap.set(r.produto_id, {
        produto_id: r.produto_id,
        barras: r.barras,
        descricao: r.descricao,
        labora: r.labora || 'Não Informado',
        abc_class: r.abc_class || 'D',
        curva_erp_classe: r.curva_erp_classe,
        preco_venda: r.preco_venda,
        custo_unit: r.custo_unit,
        margem_pct: r.margem_pct,
        lojas: {},
        total_estoque: 0,
        total_transito: 0,
        total_ddv: 0,
        total_sugestao_un: 0,
        total_sugestao_rs: 0,
        is_suspended: suspensionsMap.has(r.produto_id),
      });
    }
    const item = groupedMap.get(r.produto_id);
    item.lojas[r.filial_id] = {
      filial_id: r.filial_id,
      estoque_atual: Number(r.estoque_atual || 0),
      transito_real: Number(r.transito_real || 0),
      cobertura_dias: Number(r.cobertura_dias || 0),
      ddv_projetada: Number(r.ddv_projetada || 0),
      sugestao_compra_un: Number(r.sugestao_compra_un || 0),
      sugestao_compra_rs: Number(r.sugestao_compra_rs || 0),
      abc_class: r.abc_class,
    };
    item.total_estoque += Math.max(0, Number(r.estoque_atual || 0));
    item.total_transito += Math.max(0, Number(r.transito_real || 0));
    item.total_ddv += Number(r.ddv_projetada || 0);
    item.total_sugestao_un += Number(r.sugestao_compra_un || 0);
    item.total_sugestao_rs += Number(r.sugestao_compra_rs || 0);
    if (r.custo_unit > 0 && (!item.custo_unit || r.custo_unit < item.custo_unit)) {
      item.custo_unit = r.custo_unit;
    }
    if (r.preco_venda > 0 && (!item.preco_venda || r.preco_venda > item.preco_venda)) {
      item.preco_venda = r.preco_venda;
    }
    if (['A', 'B'].includes(r.abc_class)) {
      item.abc_class = r.abc_class;
    }
  }

  const distinctSkus = Array.from(groupedMap.values()).map(p => {
    p.cobertura_rede = p.total_ddv > 0
      ? Math.round((p.total_estoque / p.total_ddv) * 10) / 10
      : (p.total_estoque > 0 ? 999 : 0);
    return p;
  }).sort((a, b) => (a.custo_unit || 9999) - (b.custo_unit || 9999));

  // O SKU que tem a maior sugestão de compra é o alvo a ser decidido
  const targetSku = distinctSkus.slice().sort((a, b) => b.total_sugestao_un - a.total_sugestao_un)[0] || distinctSkus[0];
  const cheapestSku = distinctSkus.filter(s => s.custo_unit > 0).sort((a, b) => a.custo_unit - b.custo_unit)[0] || distinctSkus[0];
  const otherSkus = targetSku ? distinctSkus.filter(s => s.produto_id !== targetSku.produto_id) : distinctSkus;
  const otherStockTotal = otherSkus.reduce((acc, s) => acc + s.total_estoque, 0);
  const totalDdvMolecula = distinctSkus.reduce((acc, s) => acc + s.total_ddv, 0);
  const otherCoverageDays = totalDdvMolecula > 0 ? Math.round((otherStockTotal / totalDdvMolecula) * 10) / 10 : (otherStockTotal > 0 ? 999 : 0);

  // Detecção de Curva D / Parados
  const deadStocks = distinctSkus.filter(s => (s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '')) && s.total_estoque > 0);
  const deadTotalQty = deadStocks.reduce((acc, s) => acc + s.total_estoque, 0);
  const deadLabsList = Array.from(new Set(deadStocks.map(s => s.labora || 'Outro'))).join(', ');

  let iaAdvice = null;
  if (deadStocks.length > 0 && targetSku && targetSku.total_sugestao_un > 0) {
    iaAdvice = {
      type: 'DEAD_STOCK_WARNING',
      severity: 'warning',
      title: '⚠️ Atenção ao Giro na Rede: Estoque Parado de Baixo Giro (Curva D) na Mesma Molécula',
      message: `Existem ${deadTotalQty} un em estoque na rede de marcas/laboratórios de baixo giro (${deadLabsList}) com curva D e sem demanda recente. Antes de fechar compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao}, recomendamos priorizar a desova no balcão das lojas ou suspender temporariamente a compra.`,
      canSuspend: true,
      canDiscount: otherStockTotal > 0,
      canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
    };
  } else if (cheapestSku && targetSku && targetSku.produto_id !== cheapestSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit) {
    const diffUnit = (targetSku.custo_unit - cheapestSku.custo_unit).toFixed(2);
    const economiaTotal = Math.round(Number(diffUnit) * targetSku.total_sugestao_un * 100) / 100;
    iaAdvice = {
      type: 'MARGIN_OPPORTUNITY',
      severity: 'info',
      title: '💡 Oportunidade de Maior Margem / Menor Custo na Rede',
      message: `O laboratório ${cheapestSku.labora} (${cheapestSku.descricao}) tem o menor custo de compra: R$ ${cheapestSku.custo_unit.toFixed(2)} vs R$ ${targetSku.custo_unit.toFixed(2)} da marca sugerida (Economia de R$ ${diffUnit}/un • R$ ${economiaTotal.toFixed(2)} no pedido). A rede já possui ${cheapestSku.total_estoque} un em estoque deste fabricante mais econômico!`,
      canSwitch: true,
      canDiscount: otherStockTotal > 0,
      canSuspend: true,
      economiaTotal,
    };
  } else if (targetSku && targetSku.total_sugestao_un > 0 && otherStockTotal > 0 && otherCoverageDays >= 14) {
    const ecoDeducao = Math.round(Math.min(otherStockTotal, targetSku.total_sugestao_un) * targetSku.custo_unit * 100) / 100;
    iaAdvice = {
      type: 'ENOUGH_STOCK_WARNING',
      severity: 'warning',
      title: '⚠️ Estoque Existente da Mesma Molécula em Outros Laboratórios na Rede',
      message: `O motor sugeriu compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}) totalizando R$ ${(targetSku.total_sugestao_rs || 0).toFixed(2)}. Porém, a rede já possui ${otherStockTotal} unidades em estoque de outros laboratórios desta mesma apresentação (${otherCoverageDays} dias de cobertura)! Economia imediata de R$ ${ecoDeducao.toFixed(2)} deduzindo este saldo.`,
      canDiscount: true,
      canSuspend: true,
      canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
      ecoDeducao,
    };
  }

  return {
    molecule_key: molRow.molecule_key,
    substancia: molRow.substancia,
    concentracao: molRow.concentracao,
    forma: molRow.forma,
    pack_bucket: molRow.pack_bucket,
    labs_count: new Set(distinctSkus.map(s => s.labora)).size,
    skus_count: distinctSkus.length,
    targetSku,
    cheapestSku,
    otherStockTotal,
    otherCoverageDays,
    iaAdvice,
    filiais,
    skus: distinctSkus,
  };
}

const mol1 = db.prepare("SELECT * FROM engine_molecule_summary WHERE run_id = ? AND molecule_key LIKE 'DICLOFENACO SODICO|50MG%' LIMIT 1").get(run.id);
if (mol1) {
  const card1 = buildMoleculeCard(db, run.id, mol1);
  console.log('--- CARD DICLOFENACO ---');
  console.log('Substancia:', card1.substancia, card1.concentracao, card1.forma);
  console.log('Target SKU:', card1.targetSku?.labora, card1.targetSku?.descricao, 'Sug:', card1.targetSku?.total_sugestao_un, 'Custo:', card1.targetSku?.custo_unit);
  console.log('Cheapest SKU:', card1.cheapestSku?.labora, card1.cheapestSku?.descricao, 'Custo:', card1.cheapestSku?.custo_unit);
  console.log('IA Advice Title:', card1.iaAdvice?.title);
  console.log('IA Advice Message:', card1.iaAdvice?.message);
  console.log('SKUs in matrix:', card1.skus.length);
  card1.skus.forEach(s => console.log('  *', s.labora, s.descricao, 'Estoque:', s.total_estoque, 'Sug:', s.total_sugestao_un, 'Custo:', s.custo_unit));
}

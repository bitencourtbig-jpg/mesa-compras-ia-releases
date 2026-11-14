import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/analytics.db');

const rows = db.prepare(`
  SELECT 
    produto_id, 
    descricao, 
    curva_erp_ranking,
    curva_erp_classe,
    abc_class,
    vendas_13s AS venda_91d_un,
    ROUND(vendas_13s * preco_venda, 2) AS faturamento_91d,
    margem_pct,
    estoque_atual,
    sugestao_compra_un,
    sugestao_compra_rs
  FROM engine_sku_results 
  WHERE run_id = 22 AND filial_id = 2
`).all();

console.log('Total SKUs analisados (run 22):', rows.length);
const totalFat = rows.reduce((s, r) => s + (r.faturamento_91d || 0), 0);
const totalQty = rows.reduce((s, r) => s + (r.venda_91d_un || 0), 0);
console.log('Total Faturamento 91d (13 sem): R$', totalFat.toFixed(2));
console.log('Total Unidades 91d (13 sem):', totalQty);

// 1. Agrupamento pela Curva Atual do Motor
const byEngine = {};
for (const r of rows) {
  const c = r.abc_class || 'D';
  if (!byEngine[c]) byEngine[c] = { skus: 0, fat: 0, qty: 0, buyRs: 0, buySkus: 0 };
  byEngine[c].skus++;
  byEngine[c].fat += r.faturamento_91d || 0;
  byEngine[c].qty += r.venda_91d_un || 0;
  byEngine[c].buyRs += r.sugestao_compra_rs || 0;
  if (r.sugestao_compra_un > 0) byEngine[c].buySkus++;
}
console.log('\n--- 1. Agrupamento pela Curva Atual do Motor (run 22) ---');
for (const [k, v] of Object.entries(byEngine)) {
  console.log(`Curva ${k}: ${v.skus} SKUs (${((v.skus/rows.length)*100).toFixed(1)}%) | Fat: R$ ${v.fat.toFixed(2)} (${((v.fat/totalFat)*100).toFixed(1)}%) | Qtd: ${v.qty} (${((v.qty/totalQty)*100).toFixed(1)}%) | Compras: ${v.buySkus} SKUs (R$ ${v.buyRs.toFixed(2)})`);
}

// 2. Agrupamento pela Curva Nativa do ERP BIG
const byErp = {};
for (const r of rows) {
  const c = (r.curva_erp_classe || (r.curva_erp_ranking ? r.curva_erp_ranking.charAt(0) : 'D')).toUpperCase();
  if (!byErp[c]) byErp[c] = { skus: 0, fat: 0, qty: 0, buyRs: 0, buySkus: 0 };
  byErp[c].skus++;
  byErp[c].fat += r.faturamento_91d || 0;
  byErp[c].qty += r.venda_91d_un || 0;
  byErp[c].buyRs += r.sugestao_compra_rs || 0;
  if (r.sugestao_compra_un > 0) byErp[c].buySkus++;
}
console.log('\n--- 2. Agrupamento pela Letra da Curva do BIG (curva_erp_ranking) ---');
for (const [k, v] of Object.entries(byErp)) {
  console.log(`Curva BIG ${k}: ${v.skus} SKUs (${((v.skus/rows.length)*100).toFixed(1)}%) | Fat: R$ ${v.fat.toFixed(2)} (${((v.fat/totalFat)*100).toFixed(1)}%) | Qtd: ${v.qty} (${((v.qty/totalQty)*100).toFixed(1)}%) | Compras: ${v.buySkus} SKUs (R$ ${v.buyRs.toFixed(2)})`);
}

// 3. SIMULAÇÃO DO MÉTODO DO COMPRADOR NO EXCEL:
// Ele pega os produtos ordenados (pelo ranking do BIG ou por Faturamento) e faz o corte em:
// Curva A: até 55% do faturamento acumulado
// Curva B: de 55% a 90% do faturamento acumulado (mais 35%)
// Curva C: de 90% a 100% (últimos 10%)
// Curva D: 0 vendas
const rowsSortedByFat = [...rows].sort((a, b) => (b.faturamento_91d || 0) - (a.faturamento_91d || 0));
let accFat = 0;
let cutA = 0, cutB = 0, cutC = 0, cutD = 0;
let fatA = 0, fatB = 0, fatC = 0, fatD = 0;
let qtyA = 0, qtyB = 0, qtyC = 0, qtyD = 0;
let buyRsA = 0, buyRsB = 0, buyRsC = 0, buyRsD = 0;
let buySkusA = 0, buySkusB = 0, buySkusC = 0, buySkusD = 0;

for (const r of rowsSortedByFat) {
  const f = r.faturamento_91d || 0;
  accFat += f;
  const pct = accFat / totalFat;
  if (f === 0) {
    cutD++; fatD += f; qtyD += (r.venda_91d_un || 0); buyRsD += (r.sugestao_compra_rs || 0);
    if (r.sugestao_compra_un > 0) buySkusD++;
  } else if (pct <= 0.55) {
    cutA++; fatA += f; qtyA += (r.venda_91d_un || 0); buyRsA += (r.sugestao_compra_rs || 0);
    if (r.sugestao_compra_un > 0) buySkusA++;
  } else if (pct <= 0.90) {
    cutB++; fatB += f; qtyB += (r.venda_91d_un || 0); buyRsB += (r.sugestao_compra_rs || 0);
    if (r.sugestao_compra_un > 0) buySkusB++;
  } else {
    cutC++; fatC += f; qtyC += (r.venda_91d_un || 0); buyRsC += (r.sugestao_compra_rs || 0);
    if (r.sugestao_compra_un > 0) buySkusC++;
  }
}

console.log('\n--- 3. Simulação Pareto Estrito de Faturamento (55% A, 35% B, 10% C, 0% D) ---');
console.log(`Curva A (até 55% fat): ${cutA} SKUs (${((cutA/rows.length)*100).toFixed(1)}%) | Fat: R$ ${fatA.toFixed(2)} (${((fatA/totalFat)*100).toFixed(1)}%) | Qtd: ${qtyA} (${((qtyA/totalQty)*100).toFixed(1)}%) | Compras: ${buySkusA} SKUs (R$ ${buyRsA.toFixed(2)})`);
console.log(`Curva B (55% a 90% fat): ${cutB} SKUs (${((cutB/rows.length)*100).toFixed(1)}%) | Fat: R$ ${fatB.toFixed(2)} (${((fatB/totalFat)*100).toFixed(1)}%) | Qtd: ${qtyB} (${((qtyB/totalQty)*100).toFixed(1)}%) | Compras: ${buySkusB} SKUs (R$ ${buyRsB.toFixed(2)})`);
console.log(`Curva C (90% a 100% fat): ${cutC} SKUs (${((cutC/rows.length)*100).toFixed(1)}%) | Fat: R$ ${fatC.toFixed(2)} (${((fatC/totalFat)*100).toFixed(1)}%) | Qtd: ${qtyC} (${((qtyC/totalQty)*100).toFixed(1)}%) | Compras: ${buySkusC} SKUs (R$ ${buyRsC.toFixed(2)})`);
console.log(`Curva D (zero venda): ${cutD} SKUs (${((cutD/rows.length)*100).toFixed(1)}%) | Fat: R$ ${fatD.toFixed(2)} | Qtd: ${qtyD} | Compras: ${buySkusD} SKUs (R$ ${buyRsD.toFixed(2)})`);

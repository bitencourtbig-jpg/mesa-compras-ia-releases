import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const latestRun = db.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get();
const runId = latestRun.id;

console.log('Analyzing current engine_sku_results for runId:', runId);

const allSkus = db.prepare(`
  SELECT 
    produto_id, descricao, labora, macro_categoria, abc_class, xyz_class,
    estoque_atual, estoque_reserva, transito_real, ddv_projetada, custo_unit, preco_venda,
    estoque_min, estoque_max, sugestao_compra_un, sugestao_compra_rs
  FROM engine_sku_results
  WHERE run_id = ?
`).all(runId);

console.log('Total SKUs in run:', allSkus.length);

// 1. Current figures
const currentBuy = allSkus.filter(s => s.sugestao_compra_un > 0);
const currentTotalRs = currentBuy.reduce((a, b) => a + b.sugestao_compra_rs, 0);
console.log(`\n=== SITUAÇÃO ATUAL (SEM TRIGGER DE PONTO DE PEDIDO) ===`);
console.log(`SKUs com sugestão: ${currentBuy.length}`);
console.log(`Valor total sugerido: R$ ${currentTotalRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

// 2. Com Trigger estrito de Ponto de Pedido (disponível <= estoqueMin)
let triggerBuyCount = 0;
let triggerTotalRs = 0;
let healthyStockCount = 0;
let healthySavedRs = 0;

for (const s of currentBuy) {
  const disp = s.estoque_atual - s.estoque_reserva + s.transito_real;
  if (disp <= s.estoque_min) {
    triggerBuyCount++;
    triggerTotalRs += s.sugestao_compra_rs;
  } else {
    healthyStockCount++;
    healthySavedRs += s.sugestao_compra_rs;
  }
}

console.log(`\n=== APLICAÇÃO DO TRIGGER DE PONTO DE PEDIDO (disp <= min) ===`);
console.log(`SKUs que realmente precisam de reposição: ${triggerBuyCount}`);
console.log(`Valor real necessário: R$ ${triggerTotalRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`SKUs com estoque saudável (disp > min) que foram prevenidos de comprar à toa: ${healthyStockCount}`);
console.log(`Capital em excesso poupado: R$ ${healthySavedRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);


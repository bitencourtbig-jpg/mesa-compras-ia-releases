import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
const lastRun = db.prepare('SELECT id, client_code FROM engine_runs ORDER BY id DESC LIMIT 1').get();
console.log('Last run:', lastRun);

const rows = db.prepare(`
  SELECT abc_class,
         COUNT(*) as skus,
         ROUND(SUM(vendas_13s), 0) as total_un,
         ROUND(SUM(vendas_13s * preco_venda), 2) as faturamento_calculado,
         ROUND(SUM(sugestao_compra_un), 0) as sugestao_un,
         ROUND(SUM(sugestao_compra_rs), 2) as sugestao_rs
  FROM engine_sku_results
  WHERE run_id = ?
  GROUP BY abc_class
  ORDER BY abc_class
`).all(lastRun.id);

console.log('Breakdown by Engine abc_class:');
console.table(rows);

const totalFat = rows.reduce((acc, r) => acc + (r.faturamento_calculado || 0), 0);
console.log('Total Faturamento Calculado:', totalFat);
rows.forEach(r => {
  const pct = totalFat > 0 ? (r.faturamento_calculado / totalFat) * 100 : 0;
  console.log(`Curva ${r.abc_class}: ${pct.toFixed(2)}% do faturamento total`);
});

const erpBreakdown = db.prepare(`
  SELECT curva_erp_classe,
         COUNT(*) as skus,
         ROUND(SUM(vendas_13s), 0) as total_un,
         ROUND(SUM(vendas_13s * preco_venda), 2) as faturamento_calculado
  FROM engine_sku_results
  WHERE run_id = ? AND curva_erp_classe != ''
  GROUP BY curva_erp_classe
  ORDER BY curva_erp_classe
`).all(lastRun.id);

console.log('\nBreakdown by Linx BIG ERP curva_erp_classe:');
console.table(erpBreakdown);


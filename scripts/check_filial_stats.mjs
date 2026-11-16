import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/analytics.db');
const stats = db.prepare(`
  SELECT filial_id,
         count(*) as total_skus,
         sum(case when abc_class = 'A' and estoque_atual <= 0 then 1 else 0 end) as rupturas_A,
         sum(case when abc_class = 'B' and estoque_atual <= 0 then 1 else 0 end) as rupturas_B,
         round(sum(venda_perdida_est_rs), 2) as venda_perdida_rs,
         sum(case when sugestao_compra_un > 0 then 1 else 0 end) as skus_comprar,
         round(sum(sugestao_compra_rs), 2) as total_compra_rs,
         round(sum(case when estoque_max > 0 and estoque_atual > estoque_max then (estoque_atual - estoque_max) * custo_unit else 0 end), 2) as excesso_rs,
         round(sum(case when abc_class = 'D' and estoque_atual > 0 then estoque_atual * custo_unit else 0 end), 2) as parado_d_rs,
         round(sum(lote_vencendo_90d_rs), 2) as vencendo_90d_rs,
         round(sum(lote_vencido_qtd * custo_unit), 2) as vencidos_rs
  FROM engine_sku_results
  WHERE run_id = (SELECT max(id) FROM engine_runs)
  GROUP BY filial_id
`).all();
console.table(stats);

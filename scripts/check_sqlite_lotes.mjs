import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const rows = db.prepare(`
  SELECT filial_id, produto_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
         estoque_atual, ddv_projetada, lote_vencendo_90d_qtd, lote_vencendo_90d_rs,
         lote_vencido_qtd, lote_menor_validade
  FROM engine_sku_results
  WHERE run_id = (SELECT max(id) FROM engine_runs) AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
  ORDER BY lote_vencido_qtd DESC
  LIMIT 20
`).all();

console.log('TOP EXPIRING LOTS IN SQLITE:');
console.table(rows);

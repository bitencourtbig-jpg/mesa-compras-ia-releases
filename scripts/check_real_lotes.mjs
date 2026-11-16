import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
const rows = db.prepare(`
  SELECT produto_id, filial_id, descricao, lote_menor_validade, lote_vencendo_90d_qtd, lote_vencido_qtd,
         ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS lote_risco_total_rs
  FROM engine_sku_results
  WHERE run_id = 69 AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
  ORDER BY lote_risco_total_rs DESC
  LIMIT 5
`).all();

console.log('Real lot data in engine_sku_results:');
console.log(rows);

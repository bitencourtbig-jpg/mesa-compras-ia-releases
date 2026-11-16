import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';
const db = getAnalyticsDb();

const latestRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get('bandeirante');

const rows = db.prepare(`
  SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
         estoque_atual, ddv_projetada,
         lote_menor_validade AS menor_validade,
         lote_vencendo_90d_qtd AS qtd_vencendo_90d,
         lote_vencido_qtd AS qtd_vencido,
         ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS valor_risco_rs,
         CASE 
           WHEN lote_vencido_qtd > 0 THEN 'LOTE_VENCIDO'
           WHEN lote_vencendo_90d_qtd > 0 AND estoque_atual > (ddv_projetada * 90) THEN 'PERDA_VALIDADE_IMINENTE'
           ELSE 'FEFO_ALERTA'
         END AS acao_recomendada
  FROM engine_sku_results
  WHERE run_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
  ORDER BY valor_risco_rs DESC, lote_menor_validade ASC
  LIMIT 10
`).all(latestRun.id);

console.log('Sample rows with aliases:');
console.log(rows);

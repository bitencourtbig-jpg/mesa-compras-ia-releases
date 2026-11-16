import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';
const db = getAnalyticsDb();

const latestRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get('bandeirante');
console.log('Latest run:', latestRun);

const decisions = db.prepare(`
  SELECT bll.*, esr.barras, esr.labora, esr.preco_venda, esr.custo_unit
  FROM buyer_learning_log bll
  LEFT JOIN engine_sku_results esr ON esr.run_id = ? AND esr.produto_id = bll.produto_id AND esr.filial_id = (
    CASE WHEN bll.filial_id > 0 THEN bll.filial_id ELSE 2 END
  )
  WHERE bll.client_code = ? AND bll.tipo_evento IN ('DEDUZIU_ESTOQUE_MOLECULA', 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA', 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL')
  ORDER BY bll.id DESC
`).all(latestRun.id, 'bandeirante');

console.log('Decisions found:', decisions.length);
console.log(decisions);

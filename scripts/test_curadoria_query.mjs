import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';
const db = getAnalyticsDb();
const count = db.prepare("SELECT count(r.id) as c FROM engine_remanejamento r LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id WHERE (r.tipo = 'CURADORIA_IA' OR r.motivo LIKE '%Curadoria%' OR esr_orig.justificativa_ia LIKE '%Remanejamento%')").all();
console.log('Matches in engine_remanejamento:', count);

const curadoriaSkus = db.prepare("SELECT produto_id, filial_id, justificativa_ia, sugestao_compra_un FROM engine_sku_results WHERE justificativa_ia LIKE '%Curadoria%' OR justificativa_ia LIKE '%Remanejamento%' OR justificativa_ia LIKE '%concorrente%'").all();
console.log('curadoriaSkus in engine_sku_results:', curadoriaSkus);

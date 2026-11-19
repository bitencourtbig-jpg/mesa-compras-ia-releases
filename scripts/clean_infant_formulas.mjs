import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
const res = db.prepare(`
  UPDATE engine_sku_results
  SET molecule_key = NULL,
      medicamento_efetivo = 0,
      macro_categoria = 'SUPLEMENTO_VITAMINA',
      justificativa_ia = 'Higienização IA: Produto alimentar/fórmula infantil desvinculado de princípio ativo farmacêutico.'
  WHERE descricao LIKE '%LEITE%' OR descricao LIKE '%APTAMIL%' OR descricao LIKE '%NESTOGENO%' OR descricao LIKE '%ASCENDA%' OR descricao LIKE '%APTANUTRI%'
`).run();
console.log('Cleaned infant formula rows:', res.changes);

db.prepare("DELETE FROM engine_molecule_summary WHERE molecule_key LIKE '%CIPROFLOXACINO%800G%'").run();
console.log('Removed contaminated molecule summary.');

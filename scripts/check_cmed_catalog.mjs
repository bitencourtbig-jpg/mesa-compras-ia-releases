import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const rows = db.prepare(`
  SELECT produto, apresentacao, concentracao, forma, pack_exact, pack_bucket, sig_key
  FROM cmed_catalog
  WHERE substancia_norm LIKE '%ACETILCISTEINA%'
  LIMIT 25
`).all();

console.table(rows);

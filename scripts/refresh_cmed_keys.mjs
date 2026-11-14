import { DatabaseSync } from 'node:sqlite';
import { buildPresentationSignature } from '../lib/moleculeNormalizer.mjs';

const db = new DatabaseSync('data/analytics.db');
const rows = db.prepare('SELECT id, substancia_raw, apresentacao FROM cmed_catalog').all();
console.log('Total CMED catalog rows to refresh:', rows.length);

const updateStmt = db.prepare(`
  UPDATE cmed_catalog 
  SET substancia_norm = ?, concentracao = ?, forma = ?, pack_exact = ?, pack_bucket = ?, sig_key = ?
  WHERE id = ?
`);

db.exec('BEGIN');
let updated = 0;
for (const r of rows) {
  const sig = buildPresentationSignature({
    substancia: r.substancia_raw,
    textoFonte: r.apresentacao,
    isCmed: true,
    allowTolerance: true,
  });
  updateStmt.run(
    sig.substanciaNorm,
    sig.concentracao,
    sig.forma,
    sig.packExact,
    sig.packBucket,
    sig.key || '',
    r.id
  );
  updated++;
}
db.exec('COMMIT');
console.log('Successfully refreshed CMED catalog rows:', updated);


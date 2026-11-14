import { DatabaseSync } from 'node:sqlite';
import { buildPresentationSignature, normalizeSubstance } from '../lib/moleculeNormalizer.mjs';

const db = new DatabaseSync('data/analytics.db');
const latestRun = db.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get();
const runId = latestRun?.id || 13;

const skus = db.prepare(`
  SELECT produto_id, descricao, labora, molecule_key, macro_categoria
  FROM engine_sku_results
  WHERE run_id = ? AND (descricao LIKE '%ACETILCIST%' OR descricao LIKE '%FLUIMUCIL%' OR descricao LIKE '%CISTEIL%')
`).all(runId);

console.log('Acetilcisteína SKUs in latest run:', skus.length);

const grouped = new Map();
for (const s of skus) {
  const sig = buildPresentationSignature({ substancia: 'ACETILCISTEINA', textoFonte: s.descricao });
  if (!sig.isReliable) continue;
  const list = grouped.get(sig.key) || [];
  list.push({ id: s.produto_id, desc: s.descricao, lab: s.labora });
  grouped.set(sig.key, list);
}

console.log('Total unified canonical presentation keys:', grouped.size);
for (const [key, items] of grouped.entries()) {
  console.log(`\n=== [${key}] (${items.length} SKUs agrupados) ===`);
  for (const it of items) {
    console.log(`  • [${it.id}] ${it.desc} (${it.lab || '—'})`);
  }
}

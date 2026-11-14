import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const latestRun = db.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get();
const runId = latestRun?.id || 13;

const rows = db.prepare(`
  SELECT molecule_key, count(*) as sku_count, sum(estoque_atual) as tot_estoque, group_concat(produto_id) as pids
  FROM engine_sku_results 
  WHERE run_id = ? AND molecule_key IS NOT NULL
  GROUP BY molecule_key
  ORDER BY sku_count DESC
  LIMIT 15
`).all(runId);

console.table(rows.map(r => ({
  molecule_key: r.molecule_key,
  sku_count: r.sku_count,
  tot_estoque: r.tot_estoque,
  sample_pids: r.pids.split(',').slice(0, 3).join(',')
})));


import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

const samplePids = [131786, 39109, 39110, 131979];
const skuResults = db.prepare(`SELECT produto_id, descricao, molecule_key, tipo_produto_cmed FROM engine_sku_results WHERE produto_id IN (${samplePids.join(',')})`).all();
console.log('SKU results in SQLite:');
console.table(skuResults);

import { getAnalyticsDb, DEFAULT_DB_PATH } from '../src/store/analyticsDb.mjs';

console.log('DB PATH:', DEFAULT_DB_PATH);
const db = getAnalyticsDb();
const runs = db.prepare('SELECT * FROM engine_runs ORDER BY id DESC LIMIT 5').all();
console.log('RUNS:', runs);

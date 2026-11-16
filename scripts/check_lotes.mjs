import Database from 'better-sqlite3';
const db = new Database('data/app_analytics.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('SQLITE TABLES:', tables.map(t => t.name));

// Find any table with lote or skus
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
  const matched = cols.filter(c => c.name.includes('lote') || c.name.includes('validad') || c.name.includes('vencid'));
  if (matched.length > 0) {
    console.log(`Table ${t.name} has lote cols:`, matched.map(m => m.name));
  }
}

import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const prof = db.prepare('SELECT * FROM client_profiles LIMIT 1').get();

const pool = mysql.createPool({
  host: prof?.db_host || '127.0.0.1',
  port: Number(prof?.db_port || 3306),
  user: prof?.db_user || 'root',
  password: prof?.db_password || '',
  database: prof?.db_name || 'gerente',
  connectTimeout: 5000,
});

async function main() {
  const [cols] = await pool.query("SHOW COLUMNS FROM produto");
  const matching = cols.filter(c => /loja|alt|cad|dt/i.test(c.Field));
  console.table(matching);
  await pool.end();
}
main();


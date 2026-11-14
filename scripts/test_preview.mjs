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
  const [apres] = await pool.query('SELECT count(*) as total FROM produto_apresentacao');
  console.log('Total in produto_apresentacao:', apres[0].total);

  const [prodsWithApres] = await pool.query('SELECT count(*) as total FROM produto WHERE produto_apresentacao_id IS NOT NULL AND produto_apresentacao_id > 0');
  console.log('Total produtos in BIG with produto_apresentacao_id:', prodsWithApres[0].total);

  const [prodsWithConsidera] = await pool.query("SELECT count(*) as total FROM produto WHERE considera_prod_apresentacao = 'S'");
  console.log('Total produtos with considera_prod_apresentacao = S:', prodsWithConsidera[0].total);

  await pool.end();
}
main();


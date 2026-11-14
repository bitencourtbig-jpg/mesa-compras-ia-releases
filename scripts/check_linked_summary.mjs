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
  const [rows] = await pool.query('SELECT count(*) as total FROM produto WHERE produto_apresentacao_id >= 1019');
  console.log('Total products currently linked to >= 1019:', rows[0].total);

  // Check how many have concentracao = '?'
  const [qMols] = await pool.query(`
    SELECT pa.substancia, pa.concentracao, pa.qtd_forma_farmaceutica, count(p.produto_id) as prods
    FROM produto_apresentacao pa
    LEFT JOIN produto p ON p.produto_apresentacao_id = pa.produto_apresentacao_id
    WHERE pa.concentracao = '?'
    GROUP BY pa.produto_apresentacao_id
  `);
  console.log('Molecules with ? concentration:', qMols.length);
  console.table(qMols.slice(0, 10));

  await pool.end();
}
main();


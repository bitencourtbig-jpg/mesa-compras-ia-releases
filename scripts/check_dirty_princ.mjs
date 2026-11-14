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
  const [rows] = await pool.query(`
    SELECT descricao 
    FROM principio_ativo 
    WHERE descricao REGEXP '\\\\b(PO|PÓ|COMPRIMIDOS?|CAPSULAS?|XAROPE|GOTAS|CREME|POMADA|INJETAVEL|SOLUCAO|EFERVESCENTE|GEL)\\\\b'
    LIMIT 30
  `);
  console.log('Sample dirty principio_ativo in BIG:', rows.length);
  console.table(rows);
  await pool.end();
}
main();


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
    SELECT produto_id, descricao, labora, produto_apresentacao_id, considera_prod_apresentacao, qtde_apres
    FROM produto
    WHERE descricao LIKE '%ACETILCIST%' 
       OR descricao LIKE '%FLUIMUCIL%' 
       OR descricao LIKE '%CISTEIL%' 
       OR descricao LIKE '%FLUX%'
    ORDER BY descricao
  `);
  console.log('Total Acetilcisteina products found in BIG:', rows.length);
  console.table(rows);
  await pool.end();
}
main();


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
  const [apres] = await pool.query("SELECT produto_apresentacao_id, substancia, concentracao, qtd_forma_farmaceutica, dtcadastro FROM produto_apresentacao WHERE substancia LIKE '%ACETILCISTEINA%' ORDER BY produto_apresentacao_id");
  console.log('=== produto_apresentacao for ACETILCISTEINA ===');
  console.table(apres);

  const [prods] = await pool.query(`
    SELECT p.produto_id, p.descricao, p.labora, p.produto_apresentacao_id, pa.substancia, pa.concentracao, pa.qtd_forma_farmaceutica
    FROM produto p
    LEFT JOIN produto_apresentacao pa ON pa.produto_apresentacao_id = p.produto_apresentacao_id
    WHERE p.descricao LIKE '%ACETILCIST%' OR p.descricao LIKE '%FLUIMUCIL%' OR p.descricao LIKE '%CISTEIL%'
    ORDER BY p.descricao
    LIMIT 40
  `);
  console.log('=== PRODUTOS de ACETILCISTEINA no BIG ===');
  console.table(prods);

  await pool.end();
}
main();


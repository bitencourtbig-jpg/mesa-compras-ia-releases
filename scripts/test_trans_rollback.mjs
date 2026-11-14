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

async function testTransactionRollback() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('Transaction started.');

    // 1. Test inserting a dummy presentation
    const [res] = await conn.query(
      `INSERT INTO produto_apresentacao (substancia, concentracao, qtd_forma_farmaceutica, dtcadastro, cad_usuario_id, lojas_leram, apagado)
       VALUES (?, ?, ?, NOW(), 1, '1', 'N')`,
      ['TESTE MOLECULA IA', '10MG', '30 COMPRIMIDOS']
    );
    const newId = res.insertId;
    console.log('Inserted dummy produto_apresentacao_id:', newId);

    // 2. Test updating a dummy product
    const [upd] = await conn.query(
      `UPDATE produto 
       SET produto_apresentacao_id = ?,
           considera_prod_apresentacao = 'S',
           qtde_apres = 30,
           dtalteracao = NOW()
       WHERE produto_id = 999999999`,
      [newId]
    );
    console.log('Updated produto test, affectedRows:', upd.affectedRows);

    // Rollback test
    await conn.rollback();
    console.log('Transaction rolled back cleanly! No changes committed.');
  } catch (err) {
    await conn.rollback();
    console.error('Test transaction failed:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}
testTransactionRollback();


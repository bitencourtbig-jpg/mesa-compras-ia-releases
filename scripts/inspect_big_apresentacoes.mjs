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
  try {
    console.log('=== DESCRIBE apresentacoes ===');
    const [descApres] = await pool.query("DESCRIBE apresentacoes");
    console.table(descApres);

    console.log('=== SAMPLE apresentacoes ===');
    const [sampleApres] = await pool.query("SELECT * FROM apresentacoes LIMIT 5");
    console.table(sampleApres);

    console.log('=== COUNT apresentacoes ===');
    const [countApres] = await pool.query("SELECT count(*) as total FROM apresentacoes");
    console.log('Total in apresentacoes:', countApres[0].total);

    console.log('=== DESCRIBE produto_apresentacao ===');
    const [descProdApres] = await pool.query("DESCRIBE produto_apresentacao");
    console.table(descProdApres);

    console.log('=== SAMPLE produto_apresentacao ===');
    const [sampleProdApres] = await pool.query("SELECT * FROM produto_apresentacao LIMIT 5");
    console.table(sampleProdApres);

    console.log('=== COUNT produto_apresentacao ===');
    const [countProdApres] = await pool.query("SELECT count(*) as total FROM produto_apresentacao");
    console.log('Total in produto_apresentacao:', countProdApres[0].total);

    console.log('=== DESCRIBE principio_ativo ===');
    const [descPrinc] = await pool.query("DESCRIBE principio_ativo");
    console.table(descPrinc);

    console.log('=== SAMPLE principio_ativo ===');
    const [samplePrinc] = await pool.query("SELECT * FROM principio_ativo LIMIT 5");
    console.table(samplePrinc);

    console.log('=== COLUMNS IN produto (apresenta, princ) ===');
    const [colsProd] = await pool.query("SHOW COLUMNS FROM produto WHERE Field LIKE '%apres%' OR Field LIKE '%princ%' OR Field LIKE '%dcb%'");
    console.table(colsProd);

    // Let's check substituicao_sugcompra if it exists
    try {
      const [descSubst] = await pool.query("DESCRIBE substituicao_sugcompra");
      console.log('=== DESCRIBE substituicao_sugcompra ===');
      console.table(descSubst);
      const [sampleSubst] = await pool.query("SELECT * FROM substituicao_sugcompra LIMIT 5");
      console.table(sampleSubst);
    } catch (e) {
      console.log('substituicao_sugcompra describe error:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
main();

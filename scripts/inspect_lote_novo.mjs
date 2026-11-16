import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });
  
  // Count by fillogica_id
  const [counts] = await conn.query('SELECT fillogica_id, count(*), sum(estoque) as total_est FROM lote_novo GROUP BY fillogica_id');
  console.log('LOTE_NOVO COUNTS BY FILLOGICA_ID:');
  console.table(counts);

  // Look for product 35242, 17188, 21624
  const [sampleLots] = await conn.query('SELECT * FROM lote_novo WHERE produto_id IN (35242, 17188, 21624)');
  console.log('SAMPLE LOTES:');
  console.table(sampleLots);

  await conn.end();
}
main().catch(console.error);

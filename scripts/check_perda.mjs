import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });
  const [rows] = await conn.query("SELECT filial_id, produto_id, data_hora, quantiuni, valortot, motivo_perda FROM perda WHERE produto_id IN (11185, 35773, 50342, 143581) AND apagado = 'N' ORDER BY data_hora DESC LIMIT 10");
  console.table(rows);
  await conn.end();
}
main().catch(console.error);

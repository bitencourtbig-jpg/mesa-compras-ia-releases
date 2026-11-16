import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });

console.log('Testing budget CMV query with FORCE INDEX (data_hora)...');
const t0 = Date.now();
const [rows] = await conn.query(`
  SELECT SUM(ABS(m.preco_custo * m.qtde)) as cmv_anterior
  FROM movment m FORCE INDEX (data_hora)
  WHERE m.filial_id IN (2,3)
    AND m.data_hora >= '2026-09-01 00:00:00'
    AND m.data_hora <= '2026-09-30 23:59:59'
    AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
`);
console.log('Budget CMV took', (Date.now() - t0)/1000, 'seconds! Result:', rows[0]);
await conn.end();

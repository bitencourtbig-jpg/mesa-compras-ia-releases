import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });

const lyNextStart = '2025-10-29';
const lyNextEndExcl = '2025-11-28';
const lyPrevStart = '2025-08-30';

console.log('Testing execution time for yoySales with FORCE INDEX (data_hora)...');
const t0 = Date.now();
const [rows] = await conn.query(`
  SELECT m.filial_id,
         m.produto_id,
         SUM(CASE WHEN m.data_hora >= ? AND m.data_hora < ? THEN ABS(m.quanti_uni) ELSE 0 END) AS next30_ly,
         SUM(CASE WHEN m.data_hora >= ? AND m.data_hora < ? THEN ABS(m.quanti_uni) ELSE 0 END) AS prev60_ly
  FROM movment m FORCE INDEX (data_hora)
  WHERE m.filial_id IN (2,3)
    AND m.data_hora >= ?
    AND m.data_hora < ?
    AND m.apagado = 'N'
    AND COALESCE(m.cancelado, 'N') <> 'S'
    AND m.E_S = 'S'
    AND m.oper IN (2, 3)
  GROUP BY m.filial_id, m.produto_id
`, [lyNextStart, lyNextEndExcl, lyPrevStart, lyNextStart, lyPrevStart, lyNextEndExcl]);

console.log('yoySales Took', (Date.now() - t0)/1000, 'seconds! Rows:', rows.length);
await conn.end();

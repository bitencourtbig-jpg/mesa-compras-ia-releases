import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });
const t0 = Date.now();
const [rows] = await conn.query(`
  SELECT e.fornece_id,
         p.grupo_id,
         DATEDIFF(DATE(e.data_hora), e.datanota) AS lt_dias
  FROM entradas e
  JOIN produto p ON p.Produto_id = e.produto_id
  WHERE e.datanota >= '2026-08-01'
    AND e.apagado = 'N'
    AND e.data_hora >= e.datanota
    AND DATEDIFF(DATE(e.data_hora), e.datanota) BETWEEN 0 AND 45
  LIMIT 5000
`);
console.log('Query took', Date.now() - t0, 'ms! Rows returned:', rows.length);
await conn.end();

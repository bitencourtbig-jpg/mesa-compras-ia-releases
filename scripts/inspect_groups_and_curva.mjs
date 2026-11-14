import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '123456big',
  database: 'bandeirante'
});

console.log('=== 1. CHECK PRODUCT STATUS FLAGS IN MARIADB ===');
const [statusCheck] = await conn.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN inativo = 'S' THEN 1 ELSE 0 END) as inativo_S,
    SUM(CASE WHEN apagado = 'S' THEN 1 ELSE 0 END) as apagado_S
  FROM produto
`);
console.table(statusCheck);

console.log('\n=== 2. TOP 15 GRUPOS DE PRODUTOS ===');
const [topGrupos] = await conn.query(`
  SELECT 
    g.grupo_id,
    g.descricao as grupo_nome,
    g.minA, g.maxA, g.minB, g.maxB, g.minC, g.maxC, g.minD, g.maxD,
    COUNT(p.produto_id) as total_prods
  FROM grupo g
  LEFT JOIN produto p ON p.grupo_id = g.grupo_id AND p.apagado = 'N' AND p.inativo = 'N'
  WHERE g.apagado = 'N'
  GROUP BY g.grupo_id
  ORDER BY total_prods DESC
  LIMIT 15
`);
console.table(topGrupos);

console.log('\n=== 3. CURVAABC SAMPLES FROM PRODUTO & CURVAABC ===');
const [curvaSamples] = await conn.query(`
  SELECT 
    p.produto_id,
    p.descricao,
    p.curvaabc as prod_curvaabc,
    p.curvaabc_est as prod_curvaabc_est,
    c.curvaabc as tab_curvaabc,
    c.curvaabc_est as tab_curvaabc_est,
    em.minimo as big_min,
    em.maximo as big_max,
    em.demanda as big_demanda
  FROM produto p
  LEFT JOIN curvaabc c ON c.filial_id = 2 AND c.produto_id = p.produto_id AND c.apagado = 'N'
  LEFT JOIN estoque_minimo2 em ON em.filial_id = 2 AND em.produto_id = p.produto_id AND em.apagado = 'N'
  WHERE p.apagado = 'N' AND p.inativo = 'N' AND p.curvaabc IS NOT NULL
  LIMIT 10
`);
console.table(curvaSamples);

await conn.end();

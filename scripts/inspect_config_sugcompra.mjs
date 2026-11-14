import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '123456big',
  database: 'bandeirante'
});

console.log('=== 1. CONFIG_SUGCOMPRA ===');
try {
  const [cols] = await conn.query("DESCRIBE config_sugcompra");
  console.table(cols);
  const [sample] = await conn.query("SELECT * FROM config_sugcompra LIMIT 5");
  console.log(sample);
} catch (e) {
  console.log('config_sugcompra error:', e.message);
}

console.log('\n=== 2. CONFIG_CURVAABCPROD ===');
try {
  const [cols] = await conn.query("DESCRIBE config_curvaabcprod");
  console.table(cols);
  const [sample] = await conn.query("SELECT * FROM config_curvaabcprod LIMIT 5");
  console.log(sample);
} catch (e) {
  console.log('config_curvaabcprod error:', e.message);
}

console.log('\n=== 3. REABASTECIMENTO_CONFIG_GRUPO ===');
try {
  const [cols] = await conn.query("DESCRIBE reabastecimento_config_grupo");
  console.table(cols);
  const [sample] = await conn.query("SELECT * FROM reabastecimento_config_grupo LIMIT 5");
  console.log(sample);
} catch (e) {
  console.log('reabastecimento_config_grupo error:', e.message);
}

console.log('\n=== 4. ESTOQUE_MINIMO2 ===');
try {
  const [cols] = await conn.query("DESCRIBE estoque_minimo2");
  console.table(cols);
  const [sample] = await conn.query("SELECT * FROM estoque_minimo2 WHERE estoque_minimo > 0 OR estoque_maximo > 0 LIMIT 10");
  console.log(sample);
} catch (e) {
  console.log('estoque_minimo2 error:', e.message);
}

console.log('\n=== 5. PRODUTO INATIVO / APAGADO STATS ===');
const [prodStats] = await conn.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN inativo = 'S' THEN 1 ELSE 0 END) as inativos,
    SUM(CASE WHEN apagado = 'S' THEN 1 ELSE 0 END) as apagados,
    SUM(CASE WHEN inativo = 'N' AND apagado = 'N' THEN 1 ELSE 0 END) as ativos_nao_apagados
  FROM produto
`);
console.table(prodStats);

console.log('\n=== 6. PRODUTOS COM CURVAABC NO ERP ===');
const [curvaStats] = await conn.query(`
  SELECT 
    LEFT(curvaabc, 1) as curva_letra,
    COUNT(*) as total
  FROM produto
  WHERE apagado = 'N' AND inativo = 'N'
  GROUP BY LEFT(curvaabc, 1)
`);
console.table(curvaStats);

await conn.end();


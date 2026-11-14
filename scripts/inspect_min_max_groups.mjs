import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '123456big',
  database: 'bandeirante'
});

console.log('=== 1. TABLES MATCHING grupo, min, curva, estoque, param ===');
const [tables] = await conn.query("SHOW TABLES");
const allNames = tables.map(t => Object.values(t)[0]);
console.log('Tables matching grupo:', allNames.filter(n => n.includes('grupo')));
console.log('Tables matching min/max:', allNames.filter(n => n.includes('min') || n.includes('max')));
console.log('Tables matching curva:', allNames.filter(n => n.includes('curva')));
console.log('Tables matching estoque:', allNames.filter(n => n.includes('estoque')));
console.log('Tables matching param/config:', allNames.filter(n => n.includes('param') || n.includes('config')));

console.log('\n=== 2. PRODUTO COLUMNS RELATED TO STATUS & CURVA ===');
const [prodCols] = await conn.query("DESCRIBE produto");
const statusCols = prodCols.filter(c => 
  /ativo|apag|status|linha|bloq|susp|curva|min|max|descon/i.test(c.Field)
);
console.table(statusCols);

console.log('\n=== 3. ESTOQUE COLUMNS RELATED TO STATUS & MIN/MAX ===');
const [estCols] = await conn.query("DESCRIBE estoque");
const estStatusCols = estCols.filter(c => 
  /ativo|apag|status|linha|bloq|susp|curva|min|max/i.test(c.Field)
);
console.table(estStatusCols);

console.log('\n=== 4. ESTOQUE_MINIMO2 COLUMNS & SAMPLE ===');
try {
  const [estMin2Cols] = await conn.query("DESCRIBE estoque_minimo2");
  console.table(estMin2Cols);
  const [estMin2Sample] = await conn.query("SELECT * FROM estoque_minimo2 WHERE estoque_minimo > 0 OR estoque_maximo > 0 LIMIT 5");
  console.log('estoque_minimo2 sample:', estMin2Sample);
} catch (e) {
  console.log('estoque_minimo2 error:', e.message);
}

await conn.end();


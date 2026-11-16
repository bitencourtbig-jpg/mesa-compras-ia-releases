import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });
  
  // 1. Ghost stock (lote_novo.estoque > 0 while estoque_minimo.estoque <= 0)
  const [rows] = await conn.query(`
    SELECT COUNT(*) as prods_fantasma, SUM(ln.estoque_lote) as qty_fantasma
    FROM (
      SELECT fillogica_id, produto_id, SUM(estoque) as estoque_lote
      FROM lote_novo
      WHERE apagado = 'N' AND estoque > 0
      GROUP BY fillogica_id, produto_id
    ) ln
    JOIN estoque_minimo em ON em.filial_id = ln.fillogica_id AND em.produto_id = ln.produto_id
    WHERE em.estoque <= 0
  `);
  console.log('FANTASMAS EM LOTE_NOVO (estoque_minimo <= 0):', rows);

  // 2. Discrepancies where estoque_minimo > 0
  const [sample] = await conn.query(`
    SELECT ln.fillogica_id, ln.produto_id, ln.estoque_lote, em.estoque as estoque_real
    FROM (
      SELECT fillogica_id, produto_id, SUM(estoque) as estoque_lote
      FROM lote_novo
      WHERE apagado = 'N' AND estoque > 0
      GROUP BY fillogica_id, produto_id
    ) ln
    JOIN estoque_minimo em ON em.filial_id = ln.fillogica_id AND em.produto_id = ln.produto_id
    WHERE em.estoque > 0 AND ln.estoque_lote <> em.estoque
    LIMIT 10
  `);
  console.log('DIVERGENCIAS LOTE_NOVO vs ESTOQUE_MINIMO:');
  console.table(sample);

  // 3. Check MAXALGINA (50342), PURAN T4 (11185), DIPIMED (31654), NEOSORO (16796), ESPIRONOLACTONA (35773)
  const [targets] = await conn.query(`
    SELECT em.filial_id, em.produto_id, p.descricao, em.estoque as estoque_loja,
           COALESCE(ln.lote_count, 0) as lotes_cadastrados,
           COALESCE(ln.soma_lote, 0) as soma_estoque_lote
    FROM estoque_minimo em
    JOIN produto p ON p.Produto_id = em.produto_id
    LEFT JOIN (
      SELECT fillogica_id, produto_id, count(*) as lote_count, sum(estoque) as soma_lote
      FROM lote_novo
      WHERE apagado = 'N' AND estoque > 0
      GROUP BY fillogica_id, produto_id
    ) ln ON ln.fillogica_id = em.filial_id AND ln.produto_id = em.produto_id
    WHERE em.filial_id IN (2, 3) AND em.produto_id IN (50342, 11185, 31654, 16796, 35773)
  `);
  console.log('PRODUTOS CRITICOS DO PRINT:');
  console.table(targets);

  await conn.end();
}
main().catch(console.error);

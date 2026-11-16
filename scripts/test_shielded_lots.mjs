import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });
  const cutoff = '2026-05-01';
  const limit90d = '2027-01-26';

  const [lots] = await conn.query(`
    SELECT ln.fillogica_id AS filial_id,
           ln.produto_id,
           p.descricao,
           ln.lote,
           ln.validade,
           ln.estoque as lote_bruto,
           em.estoque as estoque_loja,
           LEAST(ln.estoque, em.estoque) AS qty_real,
           ROUND(LEAST(ln.estoque, em.estoque) * p.preco_cmp, 2) AS risco_rs
    FROM lote_novo ln
    JOIN estoque_minimo em ON em.filial_id = ln.fillogica_id AND em.produto_id = ln.produto_id AND em.apagado = 'N'
    JOIN produto p ON p.Produto_id = ln.produto_id AND p.apagado = 'N' AND p.inativo = 'N'
    WHERE ln.fillogica_id IN (2, 3)
      AND ln.apagado = 'N'
      AND ln.estoque > 0
      AND em.estoque > 0
      AND ln.validade >= ?
      AND ln.validade <= ?
    ORDER BY risco_rs DESC
    LIMIT 20
  `, [cutoff, limit90d]);

  console.log('LOTES EXPIRANDO (<= 90 DIAS) COM RISCO REAL:');
  console.table(lots.map(l => ({
    filial: l.filial_id,
    prod: l.produto_id,
    desc: l.descricao.slice(0, 30),
    lote: l.lote,
    validade: l.validade instanceof Date ? l.validade.toISOString().slice(0, 10) : l.validade,
    estoque_loja: l.estoque_loja,
    qty_real: l.qty_real,
    risco_rs: l.risco_rs
  })));

  await conn.end();
}
main().catch(console.error);

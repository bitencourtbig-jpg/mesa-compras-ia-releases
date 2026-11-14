import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456big',
    database: 'bandeirante'
  });

  const [cols] = await conn.query('DESCRIBE movment');
  const relevantCols = cols.map(c => c.Field).filter(f => /custo|pr|val|quant/i.test(f));
  console.log('Colunas relevantes em movment:', relevantCols);

  const [rows] = await conn.query(`
    SELECT 
      c.produto_id, 
      p.descricao, 
      c.curvaabc,
      CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(c.curvaabc, '/', 1), ' ', -1) AS UNSIGNED) AS big_rank,
      em.demanda AS big_demanda,
      IFNULL(m.quanti, 0) AS real_qtd_91d,
      IFNULL(m.total_liquido, 0) AS real_fat_91d
    FROM curvaabc c
    JOIN produto p ON p.produto_id = c.produto_id
    LEFT JOIN estoque_minimo2 em ON em.produto_id = c.produto_id AND em.filial_id = c.filial_id
    LEFT JOIN (
      SELECT 
        m.produto_id, 
        SUM(ABS(m.quanti_uni)) AS quanti, 
        SUM(ABS(m.valor_tot)) AS total_liquido
      FROM movment m
      WHERE m.filial_id = 2 
        AND m.E_S = 'S' 
        AND m.apagado = 'N'
        AND COALESCE(m.cancelado, 'N') <> 'S'
        AND m.oper IN (2, 3)
        AND m.data_hora >= DATE_SUB('2026-10-28', INTERVAL 91 DAY)
      GROUP BY m.produto_id
    ) m ON m.produto_id = c.produto_id
    WHERE c.filial_id = 2 AND c.curvaabc LIKE 'A %'
    ORDER BY big_rank ASC
    LIMIT 25
  `);
  console.table(rows);

  await conn.end();
}

main().catch(console.error);

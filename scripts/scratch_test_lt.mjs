import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '123456big', database: 'bandeirante' });

  console.log('--- TESTE 1: PEDIDO -> ENTRADA FISICA ---');
  const [q1] = await conn.query(`
    SELECT f.nome AS fornecedor,
           COUNT(*) AS total_itens,
           ROUND(AVG(DATEDIFF(e.data_hora, ped.datahora)), 1) AS lt_medio_dias,
           MIN(DATEDIFF(e.data_hora, ped.datahora)) AS lt_min,
           MAX(DATEDIFF(e.data_hora, ped.datahora)) AS lt_max
    FROM pedidos ped
    JOIN entradas e ON e.fornece_id = ped.fornece_id AND e.produto_id = ped.produto_id AND e.filial_id = ped.filial_id
      AND e.data_hora >= ped.datahora AND DATEDIFF(e.data_hora, ped.datahora) BETWEEN 0 AND 30
    JOIN fornece f ON f.fornece_id = ped.fornece_id
    GROUP BY f.nome
    HAVING COUNT(*) >= 5
    ORDER BY total_itens DESC
    LIMIT 10
  `);
  console.table(q1);

  console.log('--- TESTE 2: EMISSAO NF -> ENTRADA FISICA NA LOJA ---');
  const [q2] = await conn.query(`
    SELECT f.nome AS fornecedor,
           COUNT(*) AS total_itens,
           ROUND(AVG(DATEDIFF(e.data_hora, e.datanota)), 1) AS dias_transito_nf,
           MIN(DATEDIFF(e.data_hora, e.datanota)) AS transito_min,
           MAX(DATEDIFF(e.data_hora, e.datanota)) AS transito_max
    FROM entradas e
    JOIN fornece f ON f.fornece_id = e.fornece_id
    WHERE e.datanota >= DATE_SUB('2026-10-20', INTERVAL 90 DAY)
      AND e.data_hora >= e.datanota AND DATEDIFF(e.data_hora, e.datanota) BETWEEN 0 AND 30
    GROUP BY f.nome
    HAVING COUNT(*) >= 10
    ORDER BY total_itens DESC
    LIMIT 10
  `);
  console.table(q2);

  console.log('--- TESTE 3: EXISTE CONFIG_SUGCOMPRA NO BANCO? ---');
  const [tables] = await conn.query("SHOW TABLES LIKE '%sug%' OR SHOW TABLES LIKE '%compra%' OR SHOW TABLES LIKE '%curva%'").catch(async () => {
    const [all] = await conn.query('SHOW TABLES');
    return [all.filter(t => Object.values(t)[0].toLowerCase().includes('sug') || Object.values(t)[0].toLowerCase().includes('compra'))];
  });
  console.log(tables);

  await conn.end();
}

run().catch(console.error);

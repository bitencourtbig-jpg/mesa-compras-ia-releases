import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456big',
    database: 'bandeirante'
  });

  // Itens com alto volume de vendas (Top unidades) mas preço baixo
  const [rows] = await conn.query(`
    SELECT 
      m.produto_id, 
      p.descricao, 
      p.labora,
      g.desc_arvore,
      SUM(ABS(m.quanti_uni)) AS qtd_vendida_91d,
      ROUND(AVG(m.preco_unit), 2) AS preco_medio_venda,
      ROUND(SUM(ABS(m.valor_tot)), 2) AS faturamento_91d,
      COUNT(DISTINCT DATE(m.data_hora)) AS dias_com_venda_em_91d
    FROM movment m
    JOIN produto p ON p.produto_id = m.produto_id
    LEFT JOIN grupo g ON g.grupo_id = p.grupo_id
    WHERE m.filial_id = 2 
      AND m.E_S = 'S' 
      AND m.apagado = 'N'
      AND COALESCE(m.cancelado, 'N') <> 'S'
      AND m.oper IN (2, 3)
      AND m.data_hora >= DATE_SUB('2026-10-28', INTERVAL 91 DAY)
    GROUP BY m.produto_id
    HAVING preco_medio_venda <= 15.00 AND qtd_vendida_91d >= 500
    ORDER BY qtd_vendida_91d DESC
    LIMIT 25
  `);
  console.log('--- Top Produtos Baratos de Altíssimo Giro (Candidatos a Chamariz) ---');
  console.table(rows);

  await conn.end();
}

main().catch(console.error);


import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';

async function q(conn, title, sql) {
  console.log(`\n=== ${title} ===`);
  const rows = await runReadOnlyQuery(conn, sql);
  console.log(`(${rows.length} rows)`);
  if (rows.length > 0) console.table(rows);
  return rows;
}

async function main() {
  const conn = await createReadOnlyConnection();
  try {
    await q(conn, 'DESC_PRINCIPIO_ATIVO', 'DESCRIBE principio_ativo');
    await q(conn, 'DESC_PRODUTO_APRESENTACAO', 'DESCRIBE produto_apresentacao');

    await q(
      conn,
      'COBERTURA_CADASTRO_MOLECULA_MEDICAMENTOS_F2',
      `SELECT
          SUBSTRING_INDEX(c.curvaabc, ' ', 1) AS curva,
          COUNT(*) AS skus_med,
          SUM(CASE WHEN p.principio_ativo_id > 0 AND pa.principio_ativo_id IS NOT NULL THEN 1 ELSE 0 END) AS tem_principio,
          SUM(CASE WHEN p.produto_apresentacao_id > 0 THEN 1 ELSE 0 END) AS tem_prod_apres,
          SUM(CASE WHEN p.considera_prod_apresentacao = 'S' THEN 1 ELSE 0 END) AS usa_prod_apres
       FROM curvaabc c
       JOIN produto p ON p.produto_id = c.produto_id AND p.apagado = 'N' AND p.inativo = 'N' AND p.medicamento = 'S'
       LEFT JOIN principio_ativo pa ON pa.principio_ativo_id = p.principio_ativo_id AND pa.apagado = 'N'
       WHERE c.filial_id = 2 AND c.apagado = 'N'
         AND SUBSTRING_INDEX(c.curvaabc, ' ', 1) IN ('A','B','C')
       GROUP BY SUBSTRING_INDEX(c.curvaabc, ' ', 1)
       ORDER BY curva`
    );

    await q(
      conn,
      'AMOSTRA_LOSARTANA_MOLECULA_F2',
      `SELECT p.produto_id, LEFT(p.descricao, 42) AS descricao,
              p.labora, g.descricao AS grupo,
              pa.descricao AS principio,
              pap.substancia, pap.concentracao, pap.qtd_forma_farmaceutica,
              p.considera_prod_apresentacao,
              SUBSTRING_INDEX(c.curvaabc, ' ', 1) AS curva,
              em1.estoque, em2.demanda,
              ROUND(COALESCE(NULLIF(pmc.pmc_atual,0), p.preco_cmp/GREATEST(p.qt_fr,1), 0), 2) AS custo_unit
       FROM produto p
       JOIN principio_ativo pa ON pa.principio_ativo_id = p.principio_ativo_id
       LEFT JOIN produto_apresentacao pap ON pap.produto_apresentacao_id = p.produto_apresentacao_id
       LEFT JOIN grupo g ON g.grupo_id = p.grupo_id
       LEFT JOIN curvaabc c ON c.filial_id = 2 AND c.produto_id = p.produto_id AND c.apagado = 'N'
       LEFT JOIN estoque_minimo em1 ON em1.filial_id = 2 AND em1.produto_id = p.produto_id AND em1.apagado = 'N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id = 2 AND em2.produto_id = p.produto_id AND em2.apagado = 'N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id = 2 AND pmc.produto_id = p.produto_id AND pmc.apagado = 'N'
       WHERE p.apagado = 'N' AND p.inativo = 'N'
         AND pa.descricao LIKE '%LOSARTANA%'
         AND (em1.estoque > 0 OR em2.demanda > 0)
       ORDER BY COALESCE(em2.demanda, 0) DESC
       LIMIT 15`
    );

    await q(
      conn,
      'PARETO_REAL_CURVAABC_F2_91D',
      `SELECT
          SUBSTRING_INDEX(c.curvaabc, ' ', 1) AS curva,
          COUNT(*) AS skus,
          ROUND(SUM(COALESCE(m91.fat_91d, 0)), 2) AS faturamento_91d,
          ROUND(SUM(COALESCE(m91.unid_91d, 0)), 0) AS unidades_91d,
          ROUND(SUM(COALESCE(m91.fat_91d, 0)) * 100.0 / SUM(SUM(COALESCE(m91.fat_91d, 0))) OVER (), 2) AS pct_faturamento,
          ROUND(SUM(COALESCE(m91.unid_91d, 0)) * 100.0 / SUM(SUM(COALESCE(m91.unid_91d, 0))) OVER (), 2) AS pct_unidades
       FROM curvaabc c
       LEFT JOIN (
         SELECT produto_id,
                SUM(quanti_uni) AS unid_91d,
                SUM(quanti_uni * preco_unit) AS fat_91d
         FROM sugcompra_movment
         WHERE filial_id = 2 AND E_S = 'S' AND oper IN (2,3)
           AND data_hora >= '2026-07-29 00:00:00' AND data_hora < '2026-10-28 00:00:00'
         GROUP BY produto_id
       ) m91 ON m91.produto_id = c.produto_id
       WHERE c.filial_id = 2 AND c.apagado = 'N'
       GROUP BY SUBSTRING_INDEX(c.curvaabc, ' ', 1)
       ORDER BY curva`
    );

    await q(
      conn,
      'SAZONALIDADE_2025_VS_2026_EXEMPLOS_F2',
      `SELECT produto_id,
              DATE_FORMAT(data_hora, '%Y-%m') AS mes,
              SUM(quanti_uni) AS unid_vendidas
       FROM sugcompra_movment
       WHERE filial_id = 2 AND E_S = 'S' AND oper IN (2,3)
         AND produto_id IN (9963, 17569, 33307)
       GROUP BY produto_id, DATE_FORMAT(data_hora, '%Y-%m')
       ORDER BY produto_id, mes`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});

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
    // 1. Verificar preco unitario de custo e venda nos Top 10
    await q(
      conn,
      'TOP_10_EXCESSO_COM_VENDA_E_MARGEM',
      `SELECT p.produto_id, LEFT(p.descricao, 35) AS descr, p.qt_fr,
              SUBSTRING_INDEX(COALESCE(c.curvaabc, 'D'), ' ', 1) AS curva,
              em1.estoque, em2.maximo, em2.demanda,
              ROUND(COALESCE(NULLIF(pmc.pmc_atual,0), p.preco_cmp / GREATEST(p.qt_fr,1), 0), 2) AS custo_unit,
              ROUND(COALESCE(NULLIF(pf.preco,0), p.preco_vnd / GREATEST(p.qt_fr,1), 0), 2) AS venda_unit,
              ROUND(em1.estoque * COALESCE(NULLIF(pmc.pmc_atual,0), p.preco_cmp / GREATEST(p.qt_fr,1), 0), 2) AS capital_custo
       FROM estoque_minimo em1
       JOIN produto p ON p.produto_id = em1.produto_id AND p.apagado='N' AND p.inativo='N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id=em1.filial_id AND em2.produto_id=em1.produto_id AND em2.apagado='N'
       LEFT JOIN curvaabc c ON c.filial_id=em1.filial_id AND c.produto_id=em1.produto_id AND c.apagado='N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id=em1.filial_id AND pmc.produto_id=em1.produto_id AND pmc.apagado='N'
       LEFT JOIN precosfilial pf ON pf.filial_id=em1.filial_id AND pf.produto_id=em1.produto_id AND pf.apagado='N'
       WHERE em1.filial_id = 2 AND em1.apagado = 'N' AND em1.estoque > 0
       ORDER BY capital_custo DESC
       LIMIT 10`
    );

    // 2. Verificar porque demanda de 9963 (15.841) e 16796 (47.632) deu fracao nao exata sobre 91
    await q(
      conn,
      'DEMANDA_DIARIA_ULTIMOS_95D_9963_16796',
      `SELECT produto_id,
              COUNT(DISTINCT DATE(data_hora)) AS dias_95d_com_venda,
              SUM(CASE WHEN DATE(data_hora) BETWEEN '2026-07-28' AND '2026-10-27' THEN quanti_uni ELSE 0 END) AS s_92d_jul28_out27,
              SUM(CASE WHEN DATE(data_hora) BETWEEN '2026-07-29' AND '2026-10-27' THEN quanti_uni ELSE 0 END) AS s_91d_jul29_out27,
              SUM(CASE WHEN DATE(data_hora) BETWEEN '2026-07-30' AND '2026-10-27' THEN quanti_uni ELSE 0 END) AS s_90d_jul30_out27,
              SUM(CASE WHEN DATE(data_hora) BETWEEN '2026-07-25' AND '2026-10-27' THEN quanti_uni ELSE 0 END) AS s_95d_jul25_out27
       FROM movment
       WHERE filial_id = 2 AND produto_id IN (9963, 16796)
         AND apagado='N' AND cancelado='N' AND E_S='S' AND oper IN (2,3)
         AND data_hora >= '2026-07-25 00:00:00' AND data_hora < '2026-10-28 00:00:00'
       GROUP BY produto_id`
    );

    // 3. Verificar top 10 SKUs Curva A com maior venda perdida estimada por ruptura nos ultimos 91 dias
    await q(
      conn,
      'TOP_10_CURVA_A_EM_RUPTURA_HOJE_F2',
      `SELECT em2.produto_id, LEFT(p.descricao, 38) AS descr, p.labora,
              em1.estoque, em2.minimo, em2.maximo, em2.demanda,
              ROUND(COALESCE(NULLIF(pmc.pmc_atual,0), p.preco_cmp / GREATEST(p.qt_fr,1), 0), 2) AS custo_unit,
              ROUND(COALESCE(NULLIF(pf.preco,0), p.preco_vnd / GREATEST(p.qt_fr,1), 0), 2) AS venda_unit,
              ROUND(em2.demanda * COALESCE(NULLIF(pf.preco,0), p.preco_vnd / GREATEST(p.qt_fr,1), 0), 2) AS venda_dia_perdida_est
       FROM estoque_minimo2 em2
       JOIN curvaabc c ON c.filial_id=em2.filial_id AND c.produto_id=em2.produto_id AND c.apagado='N' AND c.curvaabc LIKE 'A %'
       JOIN estoque_minimo em1 ON em1.filial_id=em2.filial_id AND em1.produto_id=em2.produto_id AND em1.apagado='N'
       JOIN produto p ON p.produto_id=em2.produto_id AND p.apagado='N' AND p.inativo='N' AND p.taxa_entrega='N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id=em2.filial_id AND pmc.produto_id=em2.produto_id AND pmc.apagado='N'
       LEFT JOIN precosfilial pf ON pf.filial_id=em2.filial_id AND pf.produto_id=em2.produto_id AND pf.apagado='N'
       WHERE em2.filial_id = 2 AND em2.apagado = 'N'
         AND em1.estoque <= 0 AND em2.demanda > 0
       ORDER BY venda_dia_perdida_est DESC
       LIMIT 10`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});


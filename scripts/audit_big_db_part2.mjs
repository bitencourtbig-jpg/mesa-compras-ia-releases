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
    await q(
      conn,
      'PEDIDOS_POR_FILIAL',
      `SELECT filial_id, COUNT(*) AS itens, COUNT(DISTINCT numlanc) AS num_pedidos,
              SUM(CASE WHEN recebido = 'N' AND falta = 'N' THEN 1 ELSE 0 END) AS pendentes,
              MIN(datahora) AS min_dt, MAX(datahora) AS max_dt
       FROM pedidos
       WHERE apagado = 'N'
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'ENTRADAS_POR_FILIAL',
      `SELECT filial_id, COUNT(*) AS itens, MIN(datanota) AS min_dt, MAX(datanota) AS max_dt,
              MAX(hr_fecha_entrada) AS max_fecha
       FROM entradas
       WHERE apagado = 'N'
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'ESTOQUE_POSTERIOR_RANGE',
      `SELECT filial_id, COUNT(*) AS regs, MIN(data_hora) AS min_dt, MAX(data_hora) AS max_dt
       FROM estoque_posterior
       WHERE apagado = 'N'
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'VENDASPERDIDAS_RESUMO',
      `SELECT filial_id, COUNT(*) AS regs, SUM(qtde) AS qtd_perdida, MIN(data) AS min_dt, MAX(data) AS max_dt
       FROM vendasperdidas
       WHERE apagado = 'N'
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'PRODUTOS_SUSPENSOS_ATIVOS',
      `SELECT filial_id, compra_suspensa, COUNT(*) AS qtd,
              SUM(CASE WHEN (data_inicio_bloqueio IS NULL OR data_inicio_bloqueio <= '2026-10-29')
                        AND (data_fim_bloqueio IS NULL OR data_fim_bloqueio >= '2026-10-29') THEN 1 ELSE 0 END) AS vigentes_out2026
       FROM produtos_suspensos_compra
       WHERE apagado = 'N'
       GROUP BY filial_id, compra_suspensa
       ORDER BY filial_id, compra_suspensa`
    );

    await q(
      conn,
      'SAUDE_ESTOQUE_FILIAL_2_POR_CURVA',
      `SELECT
          SUBSTRING_INDEX(COALESCE(c.curvaabc, 'SEM_CURVA'), ' ', 1) AS curva,
          COUNT(*) AS total_skus,
          SUM(CASE WHEN em1.estoque <= 0 AND em2.demanda > 0 THEN 1 ELSE 0 END) AS em_ruptura_com_giro,
          SUM(CASE WHEN em1.estoque > 0 AND em1.estoque < em2.minimo THEN 1 ELSE 0 END) AS abaixo_minimo,
          SUM(CASE WHEN em1.estoque > em2.maximo AND em2.maximo > 0 THEN 1 ELSE 0 END) AS acima_maximo,
          SUM(CASE WHEN em1.estoque > 0 AND em2.demanda = 0 THEN 1 ELSE 0 END) AS estoque_parado_demanda_zero,
          ROUND(SUM(GREATEST(em1.estoque, 0) * COALESCE(NULLIF(pmc.pmc_atual, 0), p.preco_cmp, 0)), 2) AS capital_total_custo,
          ROUND(SUM(CASE WHEN em1.estoque > em2.maximo AND em2.maximo > 0
                         THEN (em1.estoque - em2.maximo) * COALESCE(NULLIF(pmc.pmc_atual, 0), p.preco_cmp, 0)
                         ELSE 0 END), 2) AS capital_excesso_acima_max,
          ROUND(SUM(CASE WHEN em1.estoque > 0 AND em2.demanda = 0
                         THEN em1.estoque * COALESCE(NULLIF(pmc.pmc_atual, 0), p.preco_cmp, 0)
                         ELSE 0 END), 2) AS capital_parado_demanda_zero
       FROM estoque_minimo em1
       INNER JOIN produto p ON p.produto_id = em1.produto_id AND p.apagado = 'N' AND p.inativo = 'N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id = em1.filial_id AND em2.produto_id = em1.produto_id AND em2.apagado = 'N'
       LEFT JOIN curvaabc c ON c.filial_id = em1.filial_id AND c.produto_id = em1.produto_id AND c.apagado = 'N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id = em1.filial_id AND pmc.produto_id = em1.produto_id AND pmc.apagado = 'N'
       WHERE em1.filial_id = 2
         AND em1.apagado = 'N'
         AND (em1.estoque <> 0 OR em2.demanda > 0)
       GROUP BY SUBSTRING_INDEX(COALESCE(c.curvaabc, 'SEM_CURVA'), ' ', 1)
       ORDER BY curva`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});


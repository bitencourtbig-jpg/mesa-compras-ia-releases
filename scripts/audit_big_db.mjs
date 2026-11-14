import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';

async function q(conn, title, sql) {
  console.log(`\n=== ${title} ===`);
  const rows = await runReadOnlyQuery(conn, sql);
  console.log(`(${rows.length} rows)`);
  if (rows.length > 0) {
    console.table(rows);
  }
  return rows;
}

async function main() {
  const conn = await createReadOnlyConnection();
  try {
    await q(conn, 'CONFIG_SUGCOMPRA', 'SELECT * FROM config_sugcompra');
    await q(conn, 'FILIAL_CONFIG_REMANEJAMENTO', 'SELECT * FROM filial_config_remanejamento');

    await q(
      conn,
      'ESTOQUE_MINIMO2_ULT_ALTERACAO_POR_FILIAL',
      `SELECT filial_id, COUNT(*) AS total_skus,
              SUM(CASE WHEN demanda > 0 THEN 1 ELSE 0 END) AS skus_com_demanda,
              MIN(dtalteracao) AS min_dtalt, MAX(dtalteracao) AS max_dtalt,
              MIN(data_comunic) AS min_dtcom, MAX(data_comunic) AS max_dtcom
       FROM estoque_minimo2
       WHERE apagado = 'N'
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'CURVAABC_RESUMO_POR_FILIAL',
      `SELECT filial_id,
              SUBSTRING_INDEX(curvaabc, ' ', 1) AS curva,
              COUNT(*) AS qtd,
              MAX(data) AS max_data
       FROM curvaabc
       WHERE apagado = 'N'
       GROUP BY filial_id, SUBSTRING_INDEX(curvaabc, ' ', 1)
       ORDER BY filial_id, curva`
    );

    await q(
      conn,
      '9963_E_16796_CORTES_MOVMENT_F2',
      `SELECT produto_id,
              SUM(CASE WHEN oper IN (2,3) AND data_hora >= '2026-07-29 00:00:00' AND data_hora < '2026-10-28 00:00:00' THEN quanti_uni ELSE 0 END) AS balcao_jul29_out27_91d,
              SUM(CASE WHEN oper IN (2,3) AND data_hora >= '2026-07-30 00:00:00' AND data_hora < '2026-10-28 00:00:00' THEN quanti_uni ELSE 0 END) AS balcao_jul30_out27_90d,
              SUM(CASE WHEN oper IN (2,3) AND data_hora >= '2026-07-29 00:00:00' AND data_hora < '2026-10-29 00:00:00' THEN quanti_uni ELSE 0 END) AS balcao_jul29_out28_92d,
              SUM(CASE WHEN oper = 10    AND data_hora >= '2026-07-29 00:00:00' AND data_hora < '2026-10-28 00:00:00' THEN quanti_uni ELSE 0 END) AS transf_jul29_out27
       FROM movment
       WHERE filial_id = 2
         AND produto_id IN (9963, 16796)
         AND apagado = 'N'
         AND cancelado = 'N'
         AND E_S = 'S'
         AND data_hora >= '2026-07-28 00:00:00'
       GROUP BY produto_id`
    );

    await q(
      conn,
      'SUGCOMPRA_MOVMENT_RANGE',
      `SELECT filial_id, COUNT(*) AS total, MIN(data_hora) AS min_dt, MAX(data_hora) AS max_dt
       FROM sugcompra_movment
       GROUP BY filial_id
       ORDER BY filial_id`
    );

    await q(
      conn,
      'SUGCOMPRA_MOVMENT_9963_16796',
      `SELECT filial_id, produto_id, E_S, oper, COUNT(*) AS regs, SUM(quanti_uni) AS unidades
       FROM sugcompra_movment
       WHERE produto_id IN (9963, 16796)
       GROUP BY filial_id, produto_id, E_S, oper
       ORDER BY produto_id, filial_id, oper`
    );

    await q(conn, 'DESC_PEDIDOS', 'DESCRIBE pedidos');
    await q(
      conn,
      'PEDIDOS_POR_FILIAL',
      `SELECT filial_id, COUNT(*) AS itens, COUNT(DISTINCT numped) AS num_pedidos,
              MIN(dt_pedido) AS min_dt, MAX(dt_pedido) AS max_dt
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
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});


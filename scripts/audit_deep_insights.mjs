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
    // 1. Verificar se custo (pmc_atual / preco_cmp / custo_item) está na unidade ou caixa
    await q(
      conn,
      'TOP_10_EXCESSO_VALOR_F2_CHECK_CUSTO',
      `SELECT p.produto_id, p.descricao, p.qt_fr, p.qtde_apres,
              SUBSTRING_INDEX(COALESCE(c.curvaabc, 'D'), ' ', 1) AS curva,
              em1.estoque, em2.minimo, em2.maximo, em2.demanda,
              pmc.pmc_atual, p.preco_cmp, pf.preco AS preco_venda,
              ROUND(em1.estoque * COALESCE(NULLIF(pmc.pmc_atual,0), p.preco_cmp, 0), 2) AS val_pmc
       FROM estoque_minimo em1
       JOIN produto p ON p.produto_id = em1.produto_id AND p.apagado='N' AND p.inativo='N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id=em1.filial_id AND em2.produto_id=em1.produto_id AND em2.apagado='N'
       LEFT JOIN curvaabc c ON c.filial_id=em1.filial_id AND c.produto_id=em1.produto_id AND c.apagado='N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id=em1.filial_id AND pmc.produto_id=em1.produto_id AND pmc.apagado='N'
       LEFT JOIN precosfilial pf ON pf.filial_id=em1.filial_id AND pf.produto_id=em1.produto_id AND pf.apagado='N'
       WHERE em1.filial_id = 2 AND em1.apagado = 'N' AND em1.estoque > 0
       ORDER BY val_pmc DESC
       LIMIT 10`
    );

    // 2. Verificar sugcompra_movment por mês para 9963 e 16796 na filial 2
    await q(
      conn,
      'SUGCOMPRA_MOVMENT_MENSAL_9963_16796',
      `SELECT produto_id,
              DATE_FORMAT(data_hora, '%Y-%m') AS mes,
              SUM(CASE WHEN E_S='S' AND oper IN (2,3) THEN quanti_uni ELSE 0 END) AS vendas_balcao,
              SUM(CASE WHEN E_S='E' AND oper = 6 THEN quanti_uni ELSE 0 END) AS dev_cliente,
              SUM(CASE WHEN E_S='S' AND oper = 10 THEN quanti_uni ELSE 0 END) AS transf_saida
       FROM sugcompra_movment
       WHERE filial_id = 2 AND produto_id IN (9963, 16796)
       GROUP BY produto_id, DATE_FORMAT(data_hora, '%Y-%m')
       ORDER BY produto_id, mes`
    );

    // 3. Verificar dias zerados / stockout no historico recente via estoque_posterior (últimos 91 dias ate 2026-10-27)
    await q(
      conn,
      'RUPTURA_HISTORICA_CURVA_A_F2_91D',
      `SELECT
          COUNT(*) AS skus_curva_a_com_demanda,
          SUM(CASE WHEN em1.estoque <= 0 THEN 1 ELSE 0 END) AS zerados_hoje,
          SUM(CASE WHEN ep_zero.dias_estoque_zero > 0 THEN 1 ELSE 0 END) AS tiveram_dia_zerado_91d,
          ROUND(AVG(COALESCE(ep_zero.dias_estoque_zero, 0)), 1) AS media_dias_zerados_quem_zerou
       FROM estoque_minimo2 em2
       JOIN curvaabc c ON c.filial_id=em2.filial_id AND c.produto_id=em2.produto_id AND c.apagado='N' AND c.curvaabc LIKE 'A %'
       JOIN estoque_minimo em1 ON em1.filial_id=em2.filial_id AND em1.produto_id=em2.produto_id AND em1.apagado='N'
       LEFT JOIN (
         SELECT produto_id,
                COUNT(DISTINCT CASE WHEN estoque_pos <= 0 THEN DATE(data_hora) END) AS dias_estoque_zero
         FROM estoque_posterior
         WHERE filial_id = 2
           AND apagado = 'N'
           AND data_hora >= '2026-07-29 00:00:00'
           AND data_hora <  '2026-10-28 00:00:00'
         GROUP BY produto_id
       ) ep_zero ON ep_zero.produto_id = em2.produto_id
       WHERE em2.filial_id = 2 AND em2.apagado = 'N' AND em2.demanda > 0`
    );

    // 4. Testar Lead Time real por fornecedor (pedidos -> proxima entrada fechada em ate 45 dias)
    await q(
      conn,
      'LEAD_TIME_FORNECEDORES_2025_2026',
      `SELECT
          p.fornece_id,
          COALESCE(f.fantasia, f.nome, MAX(p.comprar_no_fornecedo)) AS fornecedor,
          COUNT(DISTINCT CONCAT(p.numlanc, '-', p.produto_id)) AS itens_pedidos,
          COUNT(DISTINCT CASE WHEN e_match.dias_entrega IS NOT NULL THEN CONCAT(p.numlanc, '-', p.produto_id) END) AS itens_atendidos_ate_45d,
          ROUND(AVG(e_match.dias_entrega), 1) AS lead_time_medio_dias,
          MAX(e_match.dias_entrega) AS lead_time_max_dias
       FROM pedidos p
       LEFT JOIN fornece f ON f.fornece_id = p.fornece_id
       LEFT JOIN (
         SELECT p2.pedidos_id,
                MIN(DATEDIFF(e.datanota, DATE(p2.datahora))) AS dias_entrega
         FROM pedidos p2
         JOIN entradas e
           ON e.filial_id = p2.filial_id
          AND e.produto_id = p2.produto_id
          AND e.fornece_id = p2.fornece_id
          AND e.apagado = 'N'
          AND e.fechada = 'S'
          AND e.datanota >= DATE(p2.datahora)
          AND e.datanota <= DATE_ADD(DATE(p2.datahora), INTERVAL 45 DAY)
         WHERE p2.filial_id = 2 AND p2.apagado = 'N' AND p2.datahora >= '2025-01-01'
         GROUP BY p2.pedidos_id
       ) e_match ON e_match.pedidos_id = p.pedidos_id
       WHERE p.filial_id = 2 AND p.apagado = 'N' AND p.datahora >= '2025-01-01' AND p.fornece_id > 0
       GROUP BY p.fornece_id, f.fantasia, f.nome
       HAVING itens_pedidos >= 20
       ORDER BY itens_pedidos DESC
       LIMIT 12`
    );

    // 5. Amostra de sugestao_compras_080323
    await q(
      conn,
      'AMOSTRA_SUGESTAO_COMPRAS_080323',
      `SELECT * FROM sugestao_compras_080323 LIMIT 3`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});


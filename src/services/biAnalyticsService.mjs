import { getAnalyticsDb } from '../store/analyticsDb.mjs';

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

/**
 * Gera agregacoes executivas de BI a partir dos resultados persistidos no SQLite.
 */
export function buildExecutiveBi(clientCode, runId, summary = {}, filialId = null) {
  const db = getAnalyticsDb();

  const filialWhere = (filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0)
    ? ` AND filial_id = ${Number(filialId)}`
    : '';

  // 1. Quebra por Macrocategoria (100% do Mix)
  const byMacro = db
    .prepare(
      `SELECT macro_categoria,
              COUNT(*) AS skus_total,
              SUM(CASE WHEN sugestao_compra_un > 0 THEN 1 ELSE 0 END) AS skus_comprar,
              ROUND(SUM(CASE WHEN estoque_atual > 0 THEN estoque_atual * custo_unit ELSE 0 END), 2) AS estoque_rs,
              ROUND(SUM(sugestao_compra_rs), 2) AS compra_sugerida_rs,
              ROUND(SUM(venda_perdida_est_rs), 2) AS venda_perdida_rs,
              ROUND(SUM(CASE WHEN estoque_atual > estoque_max AND estoque_max > 0 THEN (estoque_atual - estoque_max) * custo_unit ELSE 0 END), 2) AS excesso_rs,
              SUM(CASE WHEN estoque_atual <= 0 AND ddv_projetada > 0 AND abc_class IN ('A','B') THEN 1 ELSE 0 END) AS rupturas_ab,
              ROUND(AVG(CASE WHEN margem_pct > 0 AND margem_pct < 95 THEN margem_pct END), 1) AS margem_media_pct
       FROM engine_sku_results
       WHERE run_id = ?${filialWhere}
       GROUP BY macro_categoria
       ORDER BY compra_sugerida_rs DESC, estoque_rs DESC`
    )
    .all(runId);

  // 2. Matriz ABC x XYZ (Heatmap estrategico 4x3)
  const abcXyzRaw = db
    .prepare(
      `SELECT abc_class, xyz_class,
              COUNT(*) AS skus,
              ROUND(SUM(CASE WHEN estoque_atual > 0 THEN estoque_atual * custo_unit ELSE 0 END), 2) AS estoque_rs,
              ROUND(SUM(sugestao_compra_rs), 2) AS compra_rs,
              ROUND(SUM(venda_perdida_est_rs), 2) AS perda_rs,
              SUM(CASE WHEN estoque_atual <= 0 AND ddv_projetada > 0 THEN 1 ELSE 0 END) AS zerados
       FROM engine_sku_results
       WHERE run_id = ?${filialWhere}
       GROUP BY abc_class, xyz_class`
    )
    .all(runId);

  const matrix = {};
  for (const r of abcXyzRaw) {
    matrix[`${r.abc_class}${r.xyz_class}`] = r;
  }

  // 3. Top 12 Fornecedores por Compra Sugerida
  const topSuppliers = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(fornecedor_nome), ''), 'SEM FORNECEDOR RECENTE') AS fornecedor,
              COUNT(*) AS skus,
              ROUND(SUM(sugestao_compra_un), 0) AS unidades,
              ROUND(SUM(sugestao_compra_rs), 2) AS compra_rs,
              ROUND(AVG(lead_time_dias), 1) AS lt_medio_dias
       FROM engine_sku_results
       WHERE run_id = ? AND sugestao_compra_un > 0${filialWhere}
       GROUP BY fornecedor
       ORDER BY compra_rs DESC
       LIMIT 12`
    )
    .all(runId);

  // 4. Saude do Capital + Economia IA (PBM + Molecula)
  const capRow = db
    .prepare(
      `SELECT ROUND(SUM(CASE WHEN estoque_atual > 0 THEN estoque_atual * custo_unit ELSE 0 END), 2) AS capital_total_estoque,
              ROUND(SUM(CASE WHEN ddv_pbm_auto > 0 THEN ddv_pbm_auto * 30 * custo_unit ELSE 0 END), 2) AS economia_mensal_pbm_rs,
              ROUND(SUM(CASE WHEN ddv_pbm_auto > 0 THEN ddv_pbm_auto * 30 ELSE 0 END), 0) AS economia_mensal_pbm_un,
              ROUND(SUM(CASE WHEN estoque_max > 0 AND estoque_atual > estoque_max THEN (estoque_atual - estoque_max) * custo_unit ELSE 0 END), 2) AS capital_excesso_max,
              ROUND(SUM(CASE WHEN abc_class = 'D' AND estoque_atual > 0 THEN estoque_atual * custo_unit ELSE 0 END), 2) AS capital_parado_d,
              ROUND(SUM(lote_vencendo_90d_rs), 2) AS lotes_vencendo_90d_rs,
              ROUND(SUM(lote_vencido_qtd * custo_unit), 2) AS lotes_vencidos_rs,
              ROUND(SUM(venda_perdida_est_rs), 2) AS venda_perdida_est_rs,
              COUNT(DISTINCT CASE WHEN excecoes_json LIKE '%FLAG_MEDICAMENTO_INCORRETO%' THEN produto_id END) AS divergencia_flag_med
       FROM engine_sku_results
       WHERE run_id = ?${filialWhere}`
    )
    .get(runId);

  // 5. Ranking de Excecoes IA detectadas
  const excRows = db
    .prepare(`SELECT excecoes_json, sugestao_compra_rs FROM engine_sku_results WHERE run_id = ? AND excecoes_json <> '[]'${filialWhere}`)
    .all(runId);

  const excCounter = new Map();
  for (const row of excRows) {
    const arr = JSON.parse(row.excecoes_json || '[]');
    for (const code of arr) {
      if (!excCounter.has(code)) excCounter.set(code, { code, skus: 0, compra_rs: 0 });
      const item = excCounter.get(code);
      item.skus += 1;
      item.compra_rs = round2(item.compra_rs + Number(row.sugestao_compra_rs || 0));
    }
  }
  const exceptionsBreakdown = [...excCounter.values()].sort((a, b) => b.skus - a.skus);

  // 6. Disponibilidade e Rupturas dos Mais Vendidos (Curva A - Nível de Serviço) (REV-009)
  const curvaARow = db
    .prepare(
      `SELECT COUNT(*) AS total_skus,
              SUM(CASE WHEN estoque_atual > 0 THEN 1 ELSE 0 END) AS com_estoque,
              SUM(CASE WHEN estoque_atual <= 0 THEN 1 ELSE 0 END) AS em_ruptura,
              ROUND(SUM(CASE WHEN estoque_atual <= 0 THEN venda_perdida_est_rs ELSE 0 END), 2) AS perda_ruptura_rs,
              ROUND(100.0 * SUM(CASE WHEN estoque_atual > 0 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) AS nivel_servico_pct
       FROM engine_sku_results
       WHERE run_id = ? AND abc_class = 'A'${filialWhere}`
    )
    .get(runId);

  // 7. Oportunidades de Troca por Fabricante Mais Rentável em Genéricos e Similares (REV-009)
  const genericOpportunities = db
    .prepare(
      `SELECT molecule_key,
              COUNT(DISTINCT labora) AS labs_count,
              ROUND(MIN(custo_unit), 2) AS menor_custo,
              ROUND(MAX(custo_unit), 2) AS maior_custo,
              ROUND(MAX(custo_unit) - MIN(custo_unit), 2) AS dif_custo_un,
              ROUND(SUM(sugestao_compra_un), 0) AS total_sug_un,
              ROUND(SUM(sugestao_compra_un) * (MAX(custo_unit) - MIN(custo_unit)), 2) AS economia_potencial_rs
       FROM engine_sku_results
       WHERE run_id = ? AND molecule_key IS NOT NULL AND custo_unit > 0
         AND (macro_categoria = 'MEDICAMENTO' OR grupo_nome LIKE '%GENERICO%' OR grupo_nome LIKE '%SIMILAR%')${filialWhere}
       GROUP BY molecule_key
       HAVING labs_count > 1 AND dif_custo_un > 0.50 AND total_sug_un > 0
       ORDER BY economia_potencial_rs DESC
       LIMIT 10`
    )
    .all(runId);

  const capitalTotal = Number(capRow?.capital_total_estoque || 0);
  const capitalExcesso = Number(capRow?.capital_excesso_max ?? (summary.capitalExcessoAcimaMaxRs || 0));
  const capitalParadoD = Number(capRow?.capital_parado_d ?? (summary.capitalParadoCurvaDRs || 0));
  const capitalRiscoVal = Number(capRow?.lotes_vencendo_90d_rs || 0) + Number(capRow?.lotes_vencidos_rs || 0);
  const capitalSaudavel = Math.max(0, round2(capitalTotal - capitalExcesso - capitalParadoD));

  return {
    capitalHealth: {
      capitalTotal,
      capitalSaudavel,
      capitalExcesso,
      capitalParadoD,
      capitalRiscoVal,
      vendaPerdida91d: Number(capRow?.venda_perdida_est_rs ?? (summary.vendaPerdidaEstimadaRs91d || 0)),
    },
    iaImpact: {
      economiaMoleculaRs: Number(summary.economiaMoleculaRs || 0),
      economiaMoleculaUn: Number(summary.economiaMoleculaUn || 0),
      economiaMensalPbmRs: Number(capRow?.economia_mensal_pbm_rs || 0),
      economiaMensalPbmUn: Number(capRow?.economia_mensal_pbm_un || 0),
      skusMonitorados: Number(summary.totalSkusAnalisados || 0),
    },
    byMacro,
    matrix,
    topSuppliers,
    exceptionsBreakdown,
    curvaAAvailability: curvaARow || { total_skus: 0, com_estoque: 0, em_ruptura: 0, perda_ruptura_rs: 0, nivel_servico_pct: 100 },
    genericOpportunities,
  };
}


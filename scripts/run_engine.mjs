import { getClientProfile, upsertClientProfile, getAnalyticsDb } from '../src/store/analyticsDb.mjs';
import { syncBigClientData } from '../src/engine/syncClientData.mjs';
import { runPurchasingEngine } from '../src/engine/purchasingEngine.mjs';

async function main() {
  let profile = getClientProfile('bandeirante');
  if (!profile) {
    profile = upsertClientProfile({
      code: 'bandeirante',
      name: 'Drogaria Bandeirante (Backup)',
      db_host: '127.0.0.1',
      db_port: 3306,
      db_name: 'bandeirante',
      buyer_filial_id: 1,
      active_sales_filials: [2],
      ignored_filials: [3],
      service_profile: 'equilibrado',
      default_weeks: 13,
      recent_entries_limit: 5,
      allow_pack_tolerance: true,
      open_order_cutoff_days: 30,
    });
  }

  console.log(`Sincronizando ${profile.name} (Read-Only)...`);
  const raw = await syncBigClientData(profile);
  console.log(`Sync concluido em ${(raw.elapsedMs / 1000).toFixed(2)}s | Data ref: ${raw.referenceDate} | Produtos: ${raw.products.length}`);

  const { runId, summary } = runPurchasingEngine(profile, raw, {
    weeksWindow: profile.default_weeks,
    serviceProfile: profile.service_profile,
    recentEntriesLimit: profile.recent_entries_limit,
  });

  console.log(`\n=== MOTOR CONCLUIDO (runId=${runId} em ${(summary.elapsedMs / 1000).toFixed(2)}s) ===`);
  console.log(JSON.stringify(summary, null, 2));

  const db = getAnalyticsDb();
  const topBuy = db
    .prepare(
      `SELECT produto_id, descricao, macro_categoria, abc_class || xyz_class AS cls,
              estoque_atual, ddv_projetada, lead_time_dias, estoque_min, estoque_max,
              sugestao_compra_un, sugestao_compra_rs, justificativa_ia
       FROM engine_sku_results
       WHERE run_id = ? AND sugestao_compra_un > 0
       ORDER BY sugestao_compra_rs DESC
       LIMIT 10`
    )
    .all(runId);
  console.log('\n=== TOP 10 SUGESTOES DE COMPRA (100% MIX) ===');
  console.table(topBuy);

  const topPbm = db
    .prepare(
      `SELECT produto_id, descricao, estoque_atual, vendas_13s, vendas_pbm_13s,
              ddv_ajustada, ddv_pbm_auto, ddv_projetada, sugestao_compra_un, justificativa_ia
       FROM engine_sku_results
       WHERE run_id = ? AND vendas_pbm_13s > 0
       ORDER BY vendas_pbm_13s DESC
       LIMIT 10`
    )
    .all(runId);
  console.log('\n=== TOP 10 PRODUTOS PBM (ABATIDOS DA REPOSICAO COMUM) ===');
  console.table(topPbm);

  const topMol = db
    .prepare(
      `SELECT molecule_key, skus_count, labs_count, estoque_total, cobertura_molecula_dias,
              sugestao_sku_soma, necessidade_liquida_molecula, economia_un_evitada, economia_rs_evitada
       FROM engine_molecule_summary
       WHERE run_id = ? AND economia_rs_evitada > 0
       ORDER BY economia_rs_evitada DESC
       LIMIT 10`
    )
    .all(runId);
  console.log('\n=== TOP 10 ECONOMIAS POR COMPRA DE MOLECULA ===');
  console.table(topMol);
}

main().catch((err) => {
  console.error('Erro no motor:', err);
  process.exit(1);
});


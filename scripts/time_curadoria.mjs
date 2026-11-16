import { getAnalyticsDb, getFilialPolicies, getActiveSkuSuspensions } from '../src/store/analyticsDb.mjs';

async function test() {
  const db = getAnalyticsDb();
  const clientCode = 'bandeirante';
  console.log('1. start');
  let t = Date.now();
  const latestRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);
  console.log('2. latestRun:', Date.now() - t, 'ms');
  
  t = Date.now();
  const clientPolicies = getFilialPolicies(clientCode);
  console.log('3. clientPolicies:', Date.now() - t, 'ms');

  t = Date.now();
  const activeSuspensions = getActiveSkuSuspensions(clientCode);
  console.log('4. activeSuspensions:', Date.now() - t, 'ms');

  t = Date.now();
  const pendingMols = db.prepare(`
    SELECT molecule_key, substancia, concentracao, forma, pack_bucket,
           labs_count, skus_count, estoque_total, sugestao_sku_soma,
           economia_rs_evitada, melhor_sku_id, melhor_sku_desc, melhor_custo_unit
    FROM engine_molecule_summary
    WHERE run_id = ? AND labs_count > 1 AND sugestao_sku_soma > 0
      AND molecule_key NOT IN (
        SELECT DISTINCT molecule_key FROM buyer_learning_log
        WHERE client_code = ? AND molecule_key IS NOT NULL AND molecule_key <> ''
      )
    ORDER BY sugestao_sku_soma DESC
    LIMIT 40
  `).all(latestRun.id, clientCode);
  console.log('5. pendingMols:', Date.now() - t, 'ms');

  t = Date.now();
  const stmt = db.prepare(`
    SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome,
           abc_class, xyz_class, curva_erp_ranking, curva_erp_classe,
           preco_venda, custo_unit, margem_pct,
           estoque_atual, transito_real, ddv_projetada, cobertura_dias,
           sugestao_compra_un, sugestao_compra_rs, justificativa_ia
    FROM engine_sku_results
    WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1
    ORDER BY produto_id ASC, filial_id ASC
  `);
  for (const m of pendingMols) {
    stmt.all(latestRun.id, m.molecule_key);
  }
  console.log('6. 40 matricial queries with cached stmt:', Date.now() - t, 'ms');

  t = Date.now();
  for (const m of pendingMols) {
    db.prepare(`
      SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome,
             abc_class, xyz_class, curva_erp_ranking, curva_erp_classe,
             preco_venda, custo_unit, margem_pct,
             estoque_atual, transito_real, ddv_projetada, cobertura_dias,
             sugestao_compra_un, sugestao_compra_rs, justificativa_ia
      FROM engine_sku_results
      WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1
      ORDER BY produto_id ASC, filial_id ASC
    `).all(latestRun.id, m.molecule_key);
  }
  console.log('7. 40 matricial queries preparing every time:', Date.now() - t, 'ms');
}

test().catch(console.error);

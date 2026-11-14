import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/analytics.db');
const latest = db.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get();
console.log('Latest Run ID:', latest.id);

// 1. Árvore
const treeEticos = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN 1 ELSE 0 END) as buy_skus,
    ROUND(SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN sugestao_compra_rs ELSE 0 END), 2) as buy_rs
  FROM engine_sku_results
  WHERE run_id = ? AND COALESCE(grupo_pai_nome, 'OUTROS') = 'ÉTICOS'
`).get(latest.id);
console.log('Tree ÉTICOS:', treeEticos);

// 2. Filtro Tab Buy sem grupo_filho
const tabBuyEticos = db.prepare(`
  SELECT 
    COUNT(*) as filtered_total,
    ROUND(SUM(sugestao_compra_rs), 2) as sum_rs
  FROM engine_sku_results
  WHERE run_id = ? AND dismissed = 0 AND sugestao_compra_un > 0 AND grupo_pai_nome = 'ÉTICOS'
`).get(latest.id);
console.log('Tab Buy ÉTICOS (grupo_pai_nome = ÉTICOS):', tabBuyEticos);

// 3. E para cada subgrupo:
const children = db.prepare(`
  SELECT 
    COALESCE(grupo_filho_nome, grupo_nome, 'OUTROS') AS filho,
    grupo_pai_nome,
    grupo_id,
    COUNT(*) as total,
    SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN 1 ELSE 0 END) as buy_skus,
    ROUND(SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN sugestao_compra_rs ELSE 0 END), 2) as buy_rs
  FROM engine_sku_results
  WHERE run_id = ? AND COALESCE(grupo_pai_nome, 'OUTROS') = 'ÉTICOS'
  GROUP BY filho, grupo_pai_nome, grupo_id
`).all(latest.id);

for (const ch of children) {
  console.log('\nChild in Tree:', ch.filho, 'Code:', ch.grupo_id, 'buy_skus:', ch.buy_skus, 'buy_rs:', ch.buy_rs);
  
  // Agora como o /api/skus filtra:
  const filterSql = db.prepare(`
    SELECT COUNT(*) as filtered_total, ROUND(SUM(sugestao_compra_rs), 2) as sum_rs
    FROM engine_sku_results
    WHERE run_id = ? AND dismissed = 0 AND sugestao_compra_un > 0 
      AND grupo_pai_nome = ? 
      AND (grupo_filho_nome = ? OR grupo_nome = ?)
  `).get(latest.id, 'ÉTICOS', ch.filho, ch.filho);
  console.log('   Filtered by server (exact name match):', filterSql);
  
  // E se filtrar por grupo_id?
  const filterByGroupId = db.prepare(`
    SELECT COUNT(*) as filtered_total, ROUND(SUM(sugestao_compra_rs), 2) as sum_rs
    FROM engine_sku_results
    WHERE run_id = ? AND dismissed = 0 AND sugestao_compra_un > 0 
      AND grupo_id = ?
  `).get(latest.id, ch.grupo_id);
  console.log('   Filtered by grupo_id (' + ch.grupo_id + '):', filterByGroupId);
}

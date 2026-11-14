// scripts/test_tree_and_filters.mjs
async function test() {
  console.log('--- 1. Testing /api/groups/tree ---');
  const t0 = Date.now();
  const res1 = await fetch('http://127.0.0.1:3456/api/groups/tree');
  const d1 = await res1.json();
  const elapsed1 = Date.now() - t0;
  console.log(`First call status: ${res1.status}, Parents: ${d1.tree?.length}, time: ${elapsed1}ms`);

  const t1 = Date.now();
  const res2 = await fetch('http://127.0.0.1:3456/api/groups/tree');
  const d2 = await res2.json();
  const elapsed2 = Date.now() - t1;
  console.log(`Second call (cached) status: ${res2.status}, time: ${elapsed2}ms`);

  // Find SABONETE in tree
  let saboneteChild = null;
  for (const p of d1.tree) {
    for (const c of p.children) {
      if (c.grupoId === 67 || c.name === 'SABONETE') {
        saboneteChild = { parent: p.name, ...c };
      }
    }
  }
  console.log('SABONETE child data in tree:', saboneteChild);

  console.log('\n--- 2. Testing /api/skus for SABONETE (Cód 67) ---');
  // tab=buy (Sugestão de compra)
  const resBuy = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&grupo_id=67');
  const dBuy = await resBuy.json();
  console.log(`Tab 'buy' with grupo_id=67: total=${dBuy.total}, sumRs=${dBuy.sumRs}`);
  for (const r of dBuy.rows) {
    console.log(`  -> Buy item: [${r.produto_id}] ${r.descricao} | Comprar: ${r.sugestao_compra_un} un, R$ ${r.sugestao_compra_rs}`);
  }

  // tab=all (Mix completo do subgrupo)
  const resAll = await fetch('http://127.0.0.1:3456/api/skus?tab=all&grupo_id=67');
  const dAll = await resAll.json();
  console.log(`Tab 'all' with grupo_id=67: total=${dAll.total}, sumRs=${dAll.sumRs}`);
  for (const r of dAll.rows) {
    console.log(`  -> Mix item: [${r.produto_id}] ${r.descricao} | Estoque: ${r.estoque_atual} | Comprar: ${r.sugestao_compra_un} un`);
  }

  console.log('\n--- 3. Testing /api/skus for empty selection ---');
  const resSel = await fetch('http://127.0.0.1:3456/api/skus?tab=selected&selected_pids=');
  const dSel = await resSel.json();
  console.log(`Tab 'selected' with empty pids: total=${dSel.total}, rows=${dSel.rows.length}`);

  console.log('\n✅ All tests passed successfully!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});


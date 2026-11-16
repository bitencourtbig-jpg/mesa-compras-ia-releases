async function test() {
  console.log('--- 1. TEST BUDGET OVERVIEW ---');
  const bAll = await fetch('http://127.0.0.1:3456/api/budget/overview').then(r => r.json());
  console.log('Consolidated dotacao_ajustada:', bAll.dotacao_ajustada, '| consumido:', bAll.consumido_compras_rs, '| dims:', bAll.dimensions?.length);
  
  const bF2 = await fetch('http://127.0.0.1:3456/api/budget/overview?filial_id=2').then(r => r.json());
  console.log('Filial 2 dotacao_ajustada:', bF2.dotacao_ajustada, '| consumido:', bF2.consumido_compras_rs, '| dims:', bF2.dimensions?.length);

  console.log('\n--- 2. TEST CURADORIA OPPORTUNITIES ---');
  const cur = await fetch('http://127.0.0.1:3456/api/curadoria/opportunities').then(r => r.json());
  console.log('Curadoria ok:', cur.ok, '| Molecules count:', cur.count, '| Total Eco:', cur.totalEconomiaRs);
  if (cur.molecules && cur.molecules.length > 0) {
    const m1 = cur.molecules[0];
    console.log('First Molecule:', m1.substancia, m1.concentracao, m1.forma);
    console.log(' - Target:', m1.targetSku?.labora, m1.targetSku?.descricao, 'Sug un:', m1.targetSku?.total_sugestao_un);
    console.log(' - Cheapest:', m1.cheapestSku?.labora, m1.cheapestSku?.descricao, 'Custo:', m1.cheapestSku?.custo_unit);
    console.log(' - Advice Title:', m1.iaAdvice?.title);
    console.log(' - Competitors in matrix:', m1.skus?.length);
  }

  console.log('\n--- 3. TEST SKUS TAB BUY ---');
  const skus = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&limit=5').then(r => r.json());
  console.log('Total buy items:', skus.total, '| Rows returned:', skus.rows?.length, '| Sum:', skus.sumRs);
}
test().catch(console.error);

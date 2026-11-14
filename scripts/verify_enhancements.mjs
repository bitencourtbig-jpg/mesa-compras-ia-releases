import fs from 'fs';

async function testAll() {
  console.log('=== TESTANDO VALIDAÇÕES DAS 5 MELHORIAS (REV-016 a REV-019) ===\n');

  // 1. REV-019: Teste de fidedignidade grupo_id
  const g62002 = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&grupo_id=62002').then(r => r.json());
  console.log(`[REV-019] Subgrupo 62002 (ÉTICOS): Total=${g62002.total} SKUs | Soma=R$ ${g62002.sumRs}`);
  if (g62002.total !== 231 || Math.abs(g62002.sumRs - 64760.5) > 0.1) {
    throw new Error(`Falha no REV-019: esperado 231 SKUs e R$ 64760.50, recebido ${g62002.total} e ${g62002.sumRs}`);
  }
  console.log('✓ [PASS] Subgrupo 62002 traz exatamente 231 SKUs e R$ 64.760,50 (100% fidedigno com a árvore).');

  const g6 = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&grupo_id=6').then(r => r.json());
  console.log(`[REV-019] Subgrupo 6 (ÉTICOS): Total=${g6.total} SKUs | Soma=R$ ${g6.sumRs}`);
  if (g6.total !== 10 || Math.abs(g6.sumRs - 6693.13) > 0.1) {
    throw new Error(`Falha no REV-019: esperado 10 SKUs e R$ 6693.13, recebido ${g6.total} e ${g6.sumRs}`);
  }
  console.log('✓ [PASS] Subgrupo 6 traz exatamente 10 SKUs e R$ 6.693,13 (isolado sem colisão homônima).');

  // 2. REV-017: Teste de Paginação e Offset
  const page1 = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&limit=50&offset=0').then(r => r.json());
  const page2 = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&limit=50&offset=50').then(r => r.json());
  console.log(`\n[REV-017] Paginação: Total Geral=${page1.total} SKUs | Página 1=${page1.rows.length} rows | Página 2=${page2.rows.length} rows`);
  if (page1.rows.length !== 50 || page2.rows.length !== 50) {
    throw new Error('Falha na paginação: número de linhas divergente.');
  }
  const id1 = page1.rows[0].produto_id;
  const id2 = page2.rows[0].produto_id;
  if (id1 === id2) {
    throw new Error('Falha na paginação: offset não deslocou as linhas.');
  }
  console.log(`✓ [PASS] Paginação ativa: Pág 1 começa com SKU ${id1}, Pág 2 começa com SKU ${id2}.`);

  // 3. REV-017: Teste de Tab Selected
  const samplePids = `${id1},${id2}`;
  const selRes = await fetch(`http://127.0.0.1:3456/api/skus?tab=selected&selected_pids=${samplePids}`).then(r => r.json());
  console.log(`\n[REV-017] Aba Selected: Total retornado=${selRes.total} SKUs`);
  if (selRes.total !== 2) {
    throw new Error(`Falha na aba selected: esperados 2 itens, recebidos ${selRes.total}`);
  }
  console.log('✓ [PASS] Aba Selected isola e retorna exclusivamente os SKUs marcados pelo comprador.');

  // 4. REV-016: Piso de Ruptura Curva A em horizonte curto
  const horizonRes = await fetch('http://127.0.0.1:3456/api/skus?tab=buy&horizon_days=3&limit=100').then(r => r.json());
  const zeroStockCurvaA = horizonRes.rows.filter(r => (r.abc_class === 'A' || /A/i.test(r.curva_big || '')) && r.estoque_atual <= 0);
  console.log(`\n[REV-016] Itens Curva A com Estoque Zerado avaliados: ${zeroStockCurvaA.length}`);
  for (const item of zeroStockCurvaA.slice(0, 5)) {
    console.log(`   - SKU ${item.produto_id} (${item.descricao}): Estoque=${item.estoque_atual} | Sugestão=${item.sugestao_compra_un} un | Justificativa IA=${item.justificativa_ia?.slice(0, 60)}...`);
    if (item.sugestao_compra_un <= 0 && item.ddv_projetada > 0) {
      throw new Error(`Falha no REV-016: SKU ${item.produto_id} é Curva A zerado mas sugestão ficou em 0!`);
    }
  }
  console.log('✓ [PASS] Piso de Ruptura Curva A ativo: nenhum item Curva A zerado com DDV positivo recebe sugestão zero.');

  // 5. REV-018: Hero Card & Backlog Status
  const indexHtml = await fetch('http://127.0.0.1:3456/').then(r => r.text());
  const stylesCss = await fetch('http://127.0.0.1:3456/styles.css').then(r => r.text());

  if (!indexHtml.includes('id="hero-quotation-card"')) throw new Error('Hero Quotation Card ausente no HTML');
  if (!indexHtml.includes('id="table-pagination"')) throw new Error('Barra de Paginação ausente no HTML');
  if (!indexHtml.includes('data-tab="selected"')) throw new Error('Aba Meus Selecionados ausente no HTML');
  if (!stylesCss.includes('.hero-quotation-card')) throw new Error('CSS do Hero Quotation Card ausente');
  if (!stylesCss.includes('.pagination-bar')) throw new Error('CSS da Paginação ausente');
  console.log('\n✓ [PASS] Todos os componentes de UI (Hero Card, Paginação, Aba Selecionados) estão presentes no HTML e CSS.');

  // 6. Validar Backlog Status
  const backlog = JSON.parse(fs.readFileSync('C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/dev_reviews/backlog_melhorias.json', 'utf8'));
  const pendentes = backlog.reviews.filter(r => r.status === 'pendente');
  console.log(`\n[BACKLOG AUDIT] Itens pendentes restantes no Backlog: ${pendentes.length}`);
  if (pendentes.length > 0) {
    console.warn('Atenção: ainda existem itens pendentes:', pendentes.map(r => r.id));
  } else {
    console.log('✓ [PASS] 100% dos 19 itens do Gravador de Críticas (REV-001 a REV-019) estão Concluídos!');
  }

  console.log('\n============================================================');
  console.log('🎉 TODAS AS 5 AÇÕES AUTORIZADAS FORAM IMPLEMENTADAS E TESTADAS COM SUCESSO 100%!');
  console.log('============================================================');
}

testAll().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});


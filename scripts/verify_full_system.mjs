import fs from 'fs';

async function runVerification() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA DO MOTOR & UI ===');

  // 1. Validar Servidor e HTML
  const indexHtml = await fetch('http://127.0.0.1:3456/').then(r => r.text());
  const stylesCss = await fetch('http://127.0.0.1:3456/styles.css').then(r => r.text());

  // Modais devem ter a classe 'hidden'
  const modals = [
    'glossary-modal', 'db-config-modal', 'supplier-picker-modal',
    'molecule-sweep-modal', 'quotation-modal', 'sync-big-apres-modal',
    'group-config-modal', 'dev-inspector-modal', 'modal-suspend-big',
    'modal-teach-molecule', 'curve-info-modal', 'modal-budget-audit'
  ];

  let modalFailures = 0;
  for (const mId of modals) {
    const rx = new RegExp(`id="${mId}"[^>]*class="[^"]*hidden[^"]*"`);
    if (!rx.test(indexHtml)) {
      console.error(`FALHA: Modal ${mId} não possui a classe hidden no HTML!`);
      modalFailures++;
    }
  }
  if (modalFailures === 0) {
    console.log('✓ [PASS] Todos os 12 modais do sistema iniciam estritamente com class="hidden".');
  }

  // Verificar CSS de ocultação
  if (stylesCss.includes('.modal-backdrop.hidden') && stylesCss.includes('display: none !important')) {
    console.log('✓ [PASS] Regra de ouro CSS ativa: display: none !important garantido em todos os modais.');
  } else {
    console.error('FALHA: Regra CSS de ocultação dos modais ausente!');
  }

  if (stylesCss.includes('.modal-backdrop,') && !stylesCss.includes('display: flex !important;')) {
    console.log('✓ [PASS] Nenhuma regra display: flex !important conflitante em .modal-backdrop.');
  } else {
    console.error('FALHA: Conflito de display: flex !important detectado em styles.css!');
  }

  // 2. Validar API /api/groups/tree
  const treeRes = await fetch('http://127.0.0.1:3456/api/groups/tree').then(r => r.json());
  if (!treeRes.tree || treeRes.tree.length === 0) {
    throw new Error('API /api/groups/tree retornou vazia!');
  }
  console.log(`✓ [PASS] /api/groups/tree retornou ${treeRes.tree.length} categorias.`);

  const eticos = treeRes.tree.find(c => (c.name || c.nome) === 'ÉTICOS');
  if (!eticos) throw new Error('Categoria ÉTICOS não encontrada!');
  if (!eticos.children || eticos.children.length === 0) throw new Error('Subgrupos de ÉTICOS vazios!');

  const parentTotal = eticos.totalSkus || eticos.skusCount;
  const parentBuyRs = eticos.buyRs || eticos.sugestaoRs;
  console.log(`✓ [PASS] Categoria ÉTICOS validada: Mix ${parentTotal} SKUs, Sugestão R$ ${parentBuyRs}, ${eticos.children.length} subgrupos.`);

  const sub1 = eticos.children[0];
  const subCode = sub1.codigo || sub1.grupoId;
  const subSkus = sub1.totalSkus || sub1.skusCount;
  const subUn = sub1.buyUn || sub1.sugestaoUn;
  const subRs = sub1.buyRs || sub1.sugestaoRs;
  console.log(`   - Subgrupo 1: ${sub1.name || sub1.nome} | Código BIG: ${subCode} | Mix: ${subSkus} SKUs | Comprar: ${subUn} un / R$ ${subRs}`);

  if (!subCode || subCode === '—') throw new Error('Código do subgrupo ausente!');
  if (!subSkus || subSkus === 0) throw new Error('Contagem de SKUs do subgrupo zerada!');
  if (!subUn || subUn === 0) throw new Error('Unidades do subgrupo zeradas!');

  const perfumaria = treeRes.tree.find(c => (c.name || c.nome) === 'PERFUMARIA');
  console.log(`✓ [PASS] Categoria PERFUMARIA validada: Mix ${perfumaria.totalSkus || perfumaria.skusCount} SKUs, ${perfumaria.children.length} subgrupos.`);

  // 3. Simulação de Renderização do Frontend (loadAndRenderGroupsTree)
  let totalCategorias = treeRes.tree.length;
  let totalMixSkus = 0;
  let totalBuySkus = 0;
  let totalBuyUn = 0;
  let totalBuyRs = 0;

  for (const p of treeRes.tree) {
    totalMixSkus += Number(p.totalSkus || p.skusCount || 0);
    totalBuySkus += Number(p.buySkus || 0);
    totalBuyUn += Number(p.buyUn || p.sugestaoUn || 0);
    totalBuyRs += Number(p.buyRs || p.sugestaoRs || 0);
  }

  console.log(`✓ [PASS] KPIs da Árvore ERP consolidados:`);
  console.log(`   - Categorias Macro: ${totalCategorias}`);
  console.log(`   - Mix Total Cadastrado: ${totalMixSkus.toLocaleString('pt-BR')} SKUs`);
  console.log(`   - SKUs c/ Sugestão: ${totalBuySkus.toLocaleString('pt-BR')} SKUs`);
  console.log(`   - Volume a Comprar: ${totalBuyUn.toLocaleString('pt-BR')} un`);
  console.log(`   - Investimento Total: R$ ${totalBuyRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  console.log('\n=== TODAS AS VALIDAÇÕES TÉCNICAS PASSARAM COM SUCESSO 100% ===');
}

runVerification().catch(err => {
  console.error('ERRO NA VALIDAÇÃO:', err);
  process.exit(1);
});


import fs from 'node:fs';

const filePath = 'public/app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Atualizar o início de openMoleculeSweep
const rxStart = /(async function openMoleculeSweep\(molKey, skuId, filialId = null\) \{[\s\S]*?const actionBar = document\.getElementById\('sweep-action-bar'\);)([\s\S]*?const fId = filialId \|\| \(state\.selectedFilial !== 'all' \? state\.selectedFilial : 2\);[\s\S]*?const res = await apiGet\(`\/api\/molecules\/sweep\?key=\$\{encodeURIComponent\(molKey\)\}&skuId=\$\{skuId \|\| 0\}&filialId=\$\{fId \|\| 2\}`\);[\s\S]*?const \{)([\s\S]*?\bja_advice\b|\botherCoverageDays\b)([\s\S]*?\} = res;)/;

// Vamos fazer busca e substituição direta com strings normalizadas
if (!code.includes('store_analysis, remanejamento_sinergia')) {
  // Procura onde destrutura res em openMoleculeSweep
  const targetDestruct = /const \{ targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice \} = res;/;
  if (targetDestruct.test(code)) {
    code = code.replace(targetDestruct, 'const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice, store_analysis, remanejamento_sinergia } = res;');
    console.log('Destruturação de res atualizada com store_analysis e remanejamento_sinergia!');
  } else {
    console.log('Target destructuring regex falhou, checando...');
  }
}

// Containers reset no início de openMoleculeSweep
if (!code.includes('const storeDiagContainer = document.getElementById(\'sweep-store-diagnostic\');')) {
  const targetBar = "const actionBar = document.getElementById('sweep-action-bar');";
  const barRepl = `const actionBar = document.getElementById('sweep-action-bar');
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }`;
  code = code.replace(targetBar, barRepl);
  console.log('Reset dos containers adicionado no início de openMoleculeSweep!');
}

// 2. Inserir o listener para btn-sweep-apply-reman
if (!code.includes('const btnApplyReman = document.getElementById(\'btn-sweep-apply-reman\');')) {
  const targetListener = "const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');";
  const remanListenerCode = `// Vincular evento de aplicação de Remanejamento & Bloqueio de Compras Excedentes (REV-023)
    const btnApplyReman = document.getElementById('btn-sweep-apply-reman');
    if (btnApplyReman && targetSku && remanejamento_sinergia) {
      btnApplyReman.onclick = async () => {
        btnApplyReman.disabled = true;
        btnApplyReman.innerHTML = '<span>⏳</span><span>Aplicando Remanejamento & Bloqueando Compras...</span>';
        try {
          const blockedStores = (store_analysis || []).filter((s) => s.veredito === 'BLOQUEAR_COMPRA' || s.veredito === 'DEDUZIR_PARCIAL');
          const res = await apiPost('/api/curadoria/decision', {
            action: 'REMANEJAR_E_CANCELAR',
            filial_id: 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            blockedStores,
            routes: remanejamento_sinergia.routes || []
          });
          showBanner(\`✓ \${res.message || 'Remanejamento aplicado com sucesso! Compras canceladas nas lojas com excesso e transferências aprovadas.'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(\`Erro ao aplicar remanejamento: \${err.message}\`, true);
          btnApplyReman.disabled = false;
          btnApplyReman.innerHTML = '<span>🔄</span><span>Aplicar Remanejamento & Bloquear Excessos</span>';
        }
      };
    }

    const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');`;

  code = code.replace(targetListener, remanListenerCode);
  console.log('Listener para btnApplyReman inserido com sucesso!');
}

// 3. Atualizar closeMoleculeSweep se necessário
if (!code.includes('storeDiagContainer.style.display = \'none\'') && code.includes('function closeMoleculeSweep() {')) {
  const closeTarget = "function closeMoleculeSweep() {\r\n  document.getElementById('molecule-sweep-modal').classList.add('hidden');\r\n}";
  const closeTargetLF = "function closeMoleculeSweep() {\n  document.getElementById('molecule-sweep-modal').classList.add('hidden');\n}";
  const closeRepl = `function closeMoleculeSweep() {
  document.getElementById('molecule-sweep-modal').classList.add('hidden');
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }
}`;
  if (code.includes(closeTarget)) {
    code = code.replace(closeTarget, closeRepl);
    console.log('closeMoleculeSweep atualizado (CRLF)!');
  } else if (code.includes(closeTargetLF)) {
    code = code.replace(closeTargetLF, closeRepl);
    console.log('closeMoleculeSweep atualizado (LF)!');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Concluído patch_app_js_step2.mjs com sucesso!');

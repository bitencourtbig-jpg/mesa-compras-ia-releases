import fs from 'fs';
import path from 'path';

const appJsPath = path.resolve('public/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

const newInit = `(async function init() {
  bindEvents();
  await Promise.all([loadGlossary(), loadOverview(), loadBudget().catch(() => {})]);
  try {
    const res = await apiGet('/api/curadoria/opportunities');
    const el = document.getElementById('curadoria-tab-count');
    if (el && res && res.count !== undefined) el.textContent = res.count;
  } catch {}

  const urlParams = new URLSearchParams(window.location.search);
  const targetView = urlParams.get('view') || 'home';
  const targetTab = urlParams.get('tab');
  const openSweep = urlParams.get('openSweep');
  const targetFilial = urlParams.get('filial');

  if (targetFilial) {
    state.selectedFilial = targetFilial;
    renderMultilojaBar();
    renderKpiStrip(state.selectedFilial);
    if (typeof updateCockpitBudgetPillForFilial === 'function') {
      updateCockpitBudgetPillForFilial(state.selectedFilial);
    }
  }

  switchView(targetView);
  if (targetTab && targetView === 'cockpit') {
    switchSkuTab(targetTab);
  }

  if (openSweep && targetTab === 'curadoria') {
    setTimeout(async () => {
      const res = await apiGet('/api/curadoria/opportunities');
      if (res.molecules && res.molecules.length > 0) {
        const first = res.molecules[0];
        openMoleculeSweep(first.molecule_key, first.targetSku?.produto_id || 0, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    }, 600);
  }
})();
`;

const idx = content.indexOf('(async function init()');
if (idx !== -1) {
  content = content.substring(0, idx) + newInit;
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log('init updated successfully in public/app.js!');
} else {
  console.error('init not found');
  process.exit(1);
}

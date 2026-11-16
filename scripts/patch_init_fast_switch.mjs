import fs from 'fs';

let code = fs.readFileSync('public/app.js', 'utf8');

const oldInit = `(async function init() {
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

  switchView(targetView);`;

const newInit = `(async function init() {
  bindEvents();

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

  await Promise.all([loadGlossary(), loadOverview(), loadBudget().catch(() => {})]);
  try {
    const res = await apiGet('/api/curadoria/opportunities');
    const el = document.getElementById('curadoria-tab-count');
    if (el && res && res.count !== undefined) el.textContent = res.count;
  } catch {}`;

const normCode = code.replace(/\r\n/g, '\n');
if (normCode.includes(oldInit)) {
  const replaced = normCode.replace(oldInit, newInit);
  fs.writeFileSync('public/app.js', replaced.replace(/\n/g, '\r\n'), 'utf8');
  console.log('init() atualizado para troca imediata de view!');
} else {
  console.error('Falha ao localizar oldInit');
}

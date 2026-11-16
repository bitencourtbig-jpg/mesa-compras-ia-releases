import fs from 'fs';

const filePath = 'public/app.js';
let code = fs.readFileSync(filePath, 'utf8');

const oldFn = `function openWelcomeGate(forceBlocking = false) {
  const modal = document.getElementById('modal-welcome-gate');
  const closeBtn = document.getElementById('btn-close-welcome-gate');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (state.licenseStatus) {
    updateLicenseBadge(state.licenseStatus);
  }
  if (forceBlocking) {
    if (closeBtn) closeBtn.style.display = 'none';
  } else {
    if (closeBtn) closeBtn.style.display = '';
  }
}`;

const newFn = `async function openWelcomeGate(forceBlocking = false) {
  const modal = document.getElementById('modal-welcome-gate');
  const closeBtn = document.getElementById('btn-close-welcome-gate');
  if (!modal) return;
  modal.classList.remove('hidden');

  try {
    const res = await apiGet('/api/license/status');
    if (res && res.ok) state.licenseStatus = res;
  } catch {}

  if (state.licenseStatus) {
    updateLicenseBadge(state.licenseStatus);
  }
  if (forceBlocking) {
    if (closeBtn) closeBtn.style.display = 'none';
  } else {
    if (closeBtn) closeBtn.style.display = '';
  }
}`;

const normCode = code.replace(/\r\n/g, '\n');
if (normCode.includes(oldFn.replace(/\r\n/g, '\n'))) {
  const replaced = normCode.replace(oldFn.replace(/\r\n/g, '\n'), newFn.replace(/\r\n/g, '\n'));
  fs.writeFileSync(filePath, replaced.replace(/\n/g, '\r\n'), 'utf8');
  console.log('openWelcomeGate atualizada para carregar status fresco via /api/license/status!');
} else {
  console.error('Falha ao localizar oldFn em public/app.js');
}

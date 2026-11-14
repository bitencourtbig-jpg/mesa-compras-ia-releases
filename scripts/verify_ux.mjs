import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');

const tests = [
  { name: 'Curve Info Modal in HTML', pass: html.includes('id="curve-info-modal"') },
  { name: 'Operation Mode select in HTML', pass: html.includes('id="cfg-operation-mode"') },
  { name: 'Skeleton CSS shimmer', pass: css.includes('.skeleton-shimmer') },
  { name: 'Sticky header elevation CSS', pass: css.includes('box-shadow: 0 3px 6px -2px') },
  { name: 'Micro-action buttons CSS', pass: css.includes('.btn-micro-action') },
  { name: 'Curve info button CSS', pass: css.includes('.btn-curve-info') },
  { name: 'Tabular-nums CSS', pass: css.includes('font-variant-numeric: tabular-nums') },
  { name: 'Empty state with clear filters button in JS', pass: js.includes('btn-empty-clear-filters') },
  { name: 'Escape key modal dismiss in JS', pass: js.includes("e.key === 'Escape'") },
  { name: 'Backdrop click dismiss in JS', pass: js.includes("e.target === backdrop") },
  { name: 'showCurveInfoModal in JS', pass: js.includes('function showCurveInfoModal') },
  { name: 'Micro action buttons in row rendering', pass: js.includes('row-actions-micro') }
];

console.log('=== VERIFICAÇÃO DE REQUISITOS UX & ARQUITETURA ===');
let allOk = true;
for (const t of tests) {
  console.log((t.pass ? '✅ PASS: ' : '❌ FAIL: ') + t.name);
  if (!t.pass) allOk = false;
}
console.log('\nResultado Final:', allOk ? '100% DAS VERIFICAÇÕES APROVADAS' : 'HOUVE FALHA');


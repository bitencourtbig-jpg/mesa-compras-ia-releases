import fs from 'fs';

let code = fs.readFileSync('public/app.js', 'utf8');

const oldFn = `function badgeForException(code) {
  if (code.startsWith('RUPTURA_') || code === 'LOTE_VENCIDO') return \`<span class="badge badge-danger">\${esc(code)}</span>\`;
  if (code.includes('PBM') || code.includes('MOLECULA')) return \`<span class="badge badge-info">\${esc(code)}</span>\`;
  if (code.includes('LOTE') || code.includes('PERDA') || code.includes('ALTA_CUSTO') || code.includes('NEGATIVO'))
    return \`<span class="badge badge-warn">\${esc(code)}</span>\`;
  if (code.includes('REMANEJAMENTO')) return \`<span class="badge badge-success">\${esc(code)}</span>\`;
  return \`<span class="badge badge-neutral">\${esc(code)}</span>\`;
}`;

const newFn = `function badgeForException(code) {
  if (!code) return '<span class="badge badge-neutral">—</span>';
  const str = String(code);
  if (str.startsWith('RUPTURA_') || str === 'LOTE_VENCIDO') return \`<span class="badge badge-danger">\${esc(str)}</span>\`;
  if (str.includes('PBM') || str.includes('MOLECULA')) return \`<span class="badge badge-info">\${esc(str)}</span>\`;
  if (str.includes('LOTE') || str.includes('PERDA') || str.includes('ALTA_CUSTO') || str.includes('NEGATIVO'))
    return \`<span class="badge badge-warn">\${esc(str)}</span>\`;
  if (str.includes('REMANEJAMENTO')) return \`<span class="badge badge-success">\${esc(str)}</span>\`;
  return \`<span class="badge badge-neutral">\${esc(str)}</span>\`;
}`;

const normCode = code.replace(/\r\n/g, '\n');
if (normCode.includes(oldFn)) {
  const replaced = normCode.replace(oldFn, newFn);
  fs.writeFileSync('public/app.js', replaced.replace(/\n/g, '\r\n'), 'utf8');
  console.log('badgeForException atualizada com sucesso!');
} else {
  console.error('Falha ao localizar oldFn');
}

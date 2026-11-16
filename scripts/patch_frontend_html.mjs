import fs from 'node:fs';

const htmlPath = 'public/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const targetHtml = `<div id="sweep-ia-banner" class="sweep-banner">
          <!-- Preenchido via JS com recomendação e análise de estoque -->
        </div>`;

const additionHtml = `<div id="sweep-ia-banner" class="sweep-banner">
          <!-- Preenchido via JS com recomendação e análise de estoque -->
        </div>

        <!-- Diagnóstico Filial a Filial: Onde NÃO Comprar e Onde Comprar (REV-023) -->
        <div id="sweep-store-diagnostic" style="display:none; flex-direction:column; gap:10px;"></div>

        <!-- Sinergia com Remanejamento Inteligente: Transfer-First (REV-023) -->
        <div id="sweep-reman-synergy" style="display:none; flex-direction:column; gap:10px;"></div>`;

if (!html.includes('id="sweep-store-diagnostic"')) {
  // Tratar CRLF ou LF
  const normalizedHtml = html.replace(/\r\n/g, '\n');
  const normalizedTarget = targetHtml.replace(/\r\n/g, '\n');
  if (normalizedHtml.includes(normalizedTarget)) {
    const isCRLF = html.includes('\r\n');
    const repl = additionHtml.replace(/\r\n/g, '\n');
    const updated = normalizedHtml.replace(normalizedTarget, repl);
    fs.writeFileSync(htmlPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
    console.log('public/index.html atualizado com sweep-store-diagnostic e sweep-reman-synergy');
  } else {
    console.error('Target não encontrado em public/index.html');
  }
} else {
  console.log('public/index.html já continha sweep-store-diagnostic');
}

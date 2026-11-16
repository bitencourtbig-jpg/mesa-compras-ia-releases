import fs from 'node:fs';

const htmlPath = 'public/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Substituir a div da tabela crua por uma seção de auditoria com toggle limpo
const oldTableDiv = `        <!-- Tabela comparativa dos Laboratórios da Molécula com coluna por filial -->
        <div style="border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; max-height: 420px; background: var(--bg-card);">
          <table class="table" style="font-size: 11.5px; margin: 0; min-width: 980px;">
            <thead id="sweep-thead">
              <!-- Gerado dinamicamente com as lojas reais do cliente conectado -->
            </thead>
            <tbody id="sweep-tbody">
              <!-- Linhas de SKUs preenchidas dinamicamente -->
            </tbody>
          </table>
        </div>`;

const newTableDiv = `        <!-- Seção de Auditoria & Matriz Comparativa (Opcional - Expansível) (REV-024) -->
        <div style="border: 1.5px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--bg-card); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div id="sweep-matrix-header" style="background: var(--bg-subtle); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 12.5px; color: var(--text);">📊 Auditoria Detalhada: Matriz de Fabricantes por Loja</span>
              <span id="sweep-matrix-count-badge" class="badge badge-neutral" style="font-size: 10px;">0 marcas</span>
              <span class="muted" style="font-size: 11px;">(Use para auditar estoque de cada fabricante ou trocar laboratório)</span>
            </div>
            <button id="btn-toggle-matrix" class="btn btn-ghost btn-sm" type="button" style="font-weight: 700; font-size: 11.5px; color: var(--accent); display: flex; align-items: center; gap: 4px;">
              <span id="btn-toggle-matrix-icon">▶</span>
              <span id="btn-toggle-matrix-text">Ver Matriz Completa</span>
            </button>
          </div>
          <div id="sweep-matrix-container" style="display: none; overflow-x: auto; max-height: 380px;">
            <table class="table" style="font-size: 11.5px; margin: 0; min-width: 980px;">
              <thead id="sweep-thead">
                <!-- Gerado dinamicamente com as lojas reais do cliente conectado -->
              </thead>
              <tbody id="sweep-tbody">
                <!-- Linhas de SKUs preenchidas dinamicamente -->
              </tbody>
            </table>
          </div>
        </div>`;

const normHtml = html.replace(/\r\n/g, '\n');
const normOld = oldTableDiv.replace(/\r\n/g, '\n');
const normNew = newTableDiv.replace(/\r\n/g, '\n');

if (normHtml.includes(normOld)) {
  const isCRLF = html.includes('\r\n');
  const updated = normHtml.replace(normOld, normNew);
  fs.writeFileSync(htmlPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
  console.log('public/index.html atualizado com sweep-matrix-container expansível!');
} else {
  console.log('AVISO: oldTableDiv não encontrado em public/index.html');
}

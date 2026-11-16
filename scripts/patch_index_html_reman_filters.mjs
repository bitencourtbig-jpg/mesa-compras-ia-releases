import fs from 'node:fs';

const htmlPath = 'public/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const targetKpi = `<div id="transfers-kpi-strip" class="kpi-strip" style="margin-bottom:18px;">
          <!-- Preenchido via JS: Rotas, Unidades, Economia, Guias Emitidas -->
        </div>`;

const filterBarHtml = `<div id="transfers-kpi-strip" class="kpi-strip" style="margin-bottom:18px;">
          <!-- Preenchido via JS: Rotas, Unidades, Economia, Guias Emitidas -->
        </div>

        <!-- PAINEL DE FILTROS & CONTROLE OPERACIONAL DE REMANEJAMENTO (REV-025) -->
        <div class="panel" style="background:var(--card-bg); border:1.5px solid var(--border); border-radius:12px; padding:14px 18px; margin-bottom:20px; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <div style="font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:8px;">
              <span>🔍 Filtros de Remanejamento &amp; Doação de Excesso</span>
            </div>
            <div id="reman-filter-summary" style="font-size:11.5px; color:var(--muted); font-weight:600;">
              Carregando filtros...
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            <!-- Busca por texto -->
            <div style="flex:1; min-width:220px; display:flex; align-items:center; gap:6px; background:var(--bg-subtle); padding:6px 12px; border-radius:8px; border:1px solid var(--border);">
              <span>🔍</span>
              <input type="text" id="reman-search-input" placeholder="Buscar produto, código BIG, EAN, laboratório..." style="border:none; outline:none; background:transparent; width:100%; font-size:12px; color:var(--text);" />
            </div>

            <!-- Filtro de Tipo / Motivo -->
            <select id="reman-filter-tipo" class="select-sm" style="font-size:12px; font-weight:700; min-width:180px;">
              <option value="ALL">📦 Todos os Tipos de Oportunidade</option>
              <option value="FEFO_VALIDADE">⏳ FEFO / Validade Curta (&le; 90d)</option>
              <option value="EXCESSO">📦 Doação de Excesso (Acima do Teto)</option>
              <option value="PARADO">💤 Estoque Parado sem Giro</option>
              <option value="CURADORIA_IA">🧬 Curadoria IA • Transfer-First</option>
            </select>

            <!-- Filtro de Curva ABC -->
            <select id="reman-filter-curva" class="select-sm" style="font-size:12px; font-weight:600;">
              <option value="ALL">Curva ABC: Todas</option>
              <option value="A">Curva A (Alto Giro)</option>
              <option value="B">Curva B (Médio Giro)</option>
              <option value="C">Curva C (Baixo Giro)</option>
              <option value="D">Curva D (Giro Crítico)</option>
            </select>

            <!-- Filtro de Filial Origem (Doadora) -->
            <select id="reman-filter-origem" class="select-sm" style="font-size:12px; font-weight:600; min-width:150px;">
              <option value="ALL">Loja Origem: Todas</option>
            </select>

            <!-- Filtro de Filial Destino (Receptora) -->
            <select id="reman-filter-destino" class="select-sm" style="font-size:12px; font-weight:600; min-width:150px;">
              <option value="ALL">Loja Destino: Todas</option>
            </select>

            <!-- Filtro de Impacto Financeiro Mínimo -->
            <select id="reman-filter-min-val" class="select-sm" style="font-size:12px; font-weight:600;">
              <option value="0">Qualquer Valor</option>
              <option value="20">&ge; R$ 20,00 por item</option>
              <option value="50">&ge; R$ 50,00 por item (Alto Impacto)</option>
              <option value="100">&ge; R$ 100,00 por item (Prioridade)</option>
            </select>

            <!-- Botão Limpar Filtros -->
            <button id="btn-reman-clear-filters" class="btn btn-ghost btn-sm" type="button" style="font-size:11.5px; font-weight:600;">
              ✕ Limpar
            </button>
          </div>
        </div>`;

const normHtml = html.replace(/\r\n/g, '\n');
const normTarget = targetKpi.replace(/\r\n/g, '\n');
const normRepl = filterBarHtml.replace(/\r\n/g, '\n');

if (normHtml.includes(normTarget)) {
  const isCRLF = html.includes('\r\n');
  const updated = normHtml.replace(normTarget, normRepl);
  fs.writeFileSync(htmlPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
  console.log('public/index.html atualizado com a Barra de Filtros de Remanejamento!');
} else {
  console.log('AVISO: targetKpi não encontrado em public/index.html');
}

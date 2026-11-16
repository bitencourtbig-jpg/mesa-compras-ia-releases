import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');

const targetSectionOld = `<section id="view-transfers" class="view-section hidden">
        <div class="transfers-header-strip" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;margin:0 0 4px 0;">
              <span>🔄 Central de Remanejamento &amp; Transferências Entre Lojas</span>
              <span class="badge badge-accent">Transfer-First Inteligente</span>
            </h2>
            <div class="muted" style="font-size:12.5px;">
              O motor resgata excessos e lotes curtos (FEFO) entre filiais maduras, protegendo lojas recém-inauguradas e reduzindo compras desnecessárias em distribuidores.
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button id="btn-refresh-transfers" class="btn btn-secondary btn-sm" type="button">🔄 Atualizar Rotas</button>
          </div>
        </div>

        <div id="transfers-kpi-strip" class="kpi-strip" style="margin-bottom:18px;">
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
        </div>

        <!-- ROTAS SUGERIDAS (AGRUPADAS) -->
        <div class="panel" style="margin-bottom:24px;">
          <div class="panel-head">
            <h3 style="margin:0;font-size:14px;font-weight:700;">🚚 Rotas de Transferência Sugeridas para a Rodada</h3>
            <span id="transfer-routes-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div id="transfer-routes-container" class="transfer-routes-container" style="padding:16px;display:flex;flex-direction:column;gap:16px;">
            <!-- Preenchido via JS com cards de rotas -->
          </div>
        </div>

        <!-- ORDENS DE TRANSFERÊNCIA ATIVAS NO MOTOR -->
        <div class="panel" style="margin-bottom:24px;">
          <div class="panel-head">
            <h3 style="margin:0;font-size:14px;font-weight:700;">📋 Guias de Transferência Emitidas (Trânsito Interno no Motor)</h3>
            <span id="active-transfers-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Origem ➔ Destino</th>
                  <th>Emissão</th>
                  <th class="num">Itens</th>
                  <th class="num">Qtd (un)</th>
                  <th class="num">Valor (R$)</th>
                  <th>Status</th>
                  <th>Ações Operacionais</th>
                </tr>
              </thead>
              <tbody id="motor-transfers-tbody">
                <!-- Preenchido via JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- PAINEL FEFO / LOTES CRÍTICOS -->
        <div class="panel">
          <div class="panel-head">
            <h3 style="margin:0;font-size:14px;font-weight:700;">⏳ Lotes Críticos / FEFO (&le; 90d) ou Vencidos em \`lote_novo\`</h3>
            <span id="expiring-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Produto</th>
                  <th class="num">Menor Validade</th>
                  <th class="num">Vencendo 90d</th>
                  <th class="num">Vencido</th>
                  <th class="num">Risco (R$)</th>
                  <th class="num">Margem / Ação Recomendada</th>
                </tr>
              </thead>
              <tbody id="expiring-tbody"></tbody>
            </table>
          </div>
        </div>
      </section>`;

const targetSectionNew = `<section id="view-transfers" class="view-section hidden">
        <div class="transfers-header-strip" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;margin:0 0 4px 0;">
              <span>🔄 Central de Remanejamento &amp; Transferências Entre Lojas</span>
              <span class="badge badge-accent">Transfer-First Inteligente</span>
            </h2>
            <div class="muted" style="font-size:12.5px;">
              Prioridade máxima para decisões do comprador na Curadoria IA (cancelamento de compras externas), seguida pelo fluxo mensal de remanejamento logístico e controle FEFO.
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button id="btn-refresh-transfers" class="btn btn-secondary btn-sm" type="button">🔄 Atualizar Central</button>
          </div>
        </div>

        <div id="transfers-kpi-strip" class="kpi-strip" style="margin-bottom:18px;">
          <!-- Preenchido via JS: Rotas, Unidades, Economia, Guias Emitidas -->
        </div>

        <!-- ========================================================================= -->
        <!-- SEÇÃO 1 (TOPO - PRIORIDADE MÁXIMA): DECISÕES DA RODADA DO COMPRADOR       -->
        <!-- ========================================================================= -->
        <div id="curadoria-priority-panel" class="panel" style="background:linear-gradient(180deg, #fbfaff 0%, #ffffff 100%); border:2px solid #a78bfa; border-radius:12px; padding:16px 20px; margin-bottom:24px; box-shadow:0 4px 14px rgba(124, 58, 237, 0.08);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px; border-bottom:1.5px solid #ede9fe; padding-bottom:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:18px;">🎯</span>
                <h3 style="margin:0; font-size:15px; font-weight:800; color:#4c1d95;">
                  Decisões da Rodada do Comprador • Curadoria IA &amp; Abatimentos Imediatos
                </h3>
                <span class="badge" style="background:#7c3aed; color:#fff; font-weight:800; font-size:10px; padding:2px 8px; border-radius:12px;">PRIORIDADE MÁXIMA DA COMPRA</span>
              </div>
              <div style="font-size:12px; color:#6d28d9; margin-top:3px;">
                Produtos que você homologou na Curadoria cancelando compras externas para desovar estoques da rede ou abater do pedido.
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button id="btn-emit-all-curadoria-transfers" class="btn btn-primary btn-sm" type="button" style="background:#7c3aed; border-color:#6d28d9; font-weight:700; display:flex; align-items:center; gap:6px;">
                <span>🚀 Emitir Guias das Decisões Pendentes</span>
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr style="background:#f5f3ff;">
                  <th style="color:#5b21b6;">Produto Demandado (Compra Cancelada)</th>
                  <th style="color:#5b21b6;">Molécula Ativa</th>
                  <th style="color:#5b21b6;">Lojas Onde a Compra Foi Cancelada</th>
                  <th style="color:#5b21b6;">Lojas com Estoque Concorrente (Doadoras)</th>
                  <th class="num" style="color:#5b21b6;">Qtd Abatida</th>
                  <th class="num" style="color:#5b21b6;">Economia Caixa</th>
                  <th style="color:#5b21b6; text-align:center;">Ação Imediata</th>
                </tr>
              </thead>
              <tbody id="curadoria-decisions-tbody">
                <!-- Preenchido via JS com decisões da Curadoria -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- SEÇÃO 2: GUIAS DE TRANSFERÊNCIA & ROMANEIOS EMITIDOS (TRÂNSITO NO MOTOR)  -->
        <!-- ========================================================================= -->
        <div class="panel" style="margin-bottom:24px;">
          <div class="panel-head" style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">
              <span>📋 Guias de Transferência &amp; Romaneios Emitidos</span>
              <span class="badge badge-accent">Trânsito Interno</span>
            </h3>
            <span id="active-transfers-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Origem ➔ Destino</th>
                  <th>Emissão</th>
                  <th class="num">Itens</th>
                  <th class="num">Qtd (un)</th>
                  <th class="num">Valor (R$)</th>
                  <th>Status</th>
                  <th style="text-align:center;">Ações Operacionais &amp; Romaneio</th>
                </tr>
              </thead>
              <tbody id="motor-transfers-tbody">
                <!-- Preenchido via JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- SEÇÃO 3: REMANEJAMENTO ESTRATÉGICO MENSAL DA REDE (ROTAS ENTRE FILIAIS)   -->
        <!-- ========================================================================= -->
        <div class="panel" style="margin-bottom:24px;">
          <div style="padding:14px 18px; background:var(--bg-subtle); border-bottom:1px solid var(--border); border-radius:12px 12px 0 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="margin:0;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">
                  <span>⚖️ Remanejamento Estratégico da Rede</span>
                  <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;font-size:10px;">Planejamento Periódico (1x a 2x ao Mês)</span>
                </h3>
                <div class="muted" style="font-size:11.5px; margin-top:2px;">
                  Otimização de carga e equipe de transporte. Use o corte de valor mínimo para focar apenas em cargas consolidadas que compensem o custo de combustível/frete.
                </div>
              </div>
            </div>
          </div>

          <!-- PAINEL DE FILTROS & CONTROLE OPERACIONAL -->
          <div style="padding:14px 18px; border-bottom:1px solid var(--border); background:var(--card-bg);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
              <div style="font-size:12.5px; font-weight:700; color:var(--text);">
                <span>🔍 Filtros de Rota &amp; Doação de Excesso</span>
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
                <option value="CURADORIA_IA">🧬 Curadoria IA • Transfer-First</option>
                <option value="FEFO_VALIDADE">⏳ FEFO / Validade Curta (&le; 90d)</option>
                <option value="EXCESSO">📦 Doação de Excesso (Acima do Teto)</option>
                <option value="PARADO">💤 Estoque Parado sem Giro</option>
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
                <option value="50">&ge; R$ 50,00 (Alto Impacto)</option>
                <option value="100">&ge; R$ 100,00 (Prioridade Carga)</option>
              </select>

              <!-- Botão Limpar Filtros -->
              <button id="btn-reman-clear-filters" class="btn btn-ghost btn-sm" type="button" style="font-size:11.5px; font-weight:600;">
                ✕ Limpar
              </button>
            </div>
          </div>

          <div class="panel-head" style="border:none; padding:12px 18px 4px 18px;">
            <h4 style="margin:0;font-size:13px;font-weight:700;color:var(--text);">🚚 Rotas de Transferência Sugeridas para a Carga</h4>
            <span id="transfer-routes-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div id="transfer-routes-container" class="transfer-routes-container" style="padding:16px;display:flex;flex-direction:column;gap:16px;">
            <!-- Preenchido via JS com cards de rotas -->
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- SEÇÃO 4: PREVENÇÃO DE PERDAS • LOTES CRÍTICOS & FEFO                      -->
        <!-- ========================================================================= -->
        <div class="panel">
          <div class="panel-head">
            <h3 style="margin:0;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">
              <span>⏳ Prevenção de Perdas • Lotes Críticos / FEFO (&le; 90d) ou Vencidos em \`lote_novo\`</span>
              <span class="badge badge-danger">Ação Imediata</span>
            </h3>
            <span id="expiring-count" class="muted" style="font-size:12px;"></span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Produto</th>
                  <th class="num">Menor Validade</th>
                  <th class="num">Vencendo 90d</th>
                  <th class="num">Vencido</th>
                  <th class="num">Risco (R$)</th>
                  <th style="text-align:center;">Ações Operacionais Recomendadas</th>
                </tr>
              </thead>
              <tbody id="expiring-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- MODAL: DETALHES DOS ITENS DA GUIA DE TRANSFERÊNCIA -->
        <div id="modal-transfer-items" class="modal-backdrop hidden" style="position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(3px);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;">
          <div class="modal-card" style="background:var(--card-bg);width:100%;max-width:850px;max-height:88vh;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.25);border:1.5px solid var(--border);display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:16px 20px;background:var(--bg-subtle);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h3 id="modal-trf-title" style="margin:0;font-size:15px;font-weight:800;color:var(--text);">📦 Guia de Transferência TRF-XXXX</h3>
                <div id="modal-trf-sub" class="muted" style="font-size:12px;margin-top:2px;">Origem ➔ Destino</div>
              </div>
              <button id="btn-close-modal-trf" class="btn btn-ghost btn-sm" type="button" style="font-size:16px;">✕</button>
            </div>
            <div style="padding:16px 20px;overflow-y:auto;flex:1;">
              <div id="modal-trf-meta" style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"></div>
              <div class="table-wrap">
                <table class="data-table" style="font-size:12px;">
                  <thead>
                    <tr>
                      <th>Cód BIG</th>
                      <th>EAN</th>
                      <th>Descrição</th>
                      <th>Laboratório</th>
                      <th class="num">Qtd (un)</th>
                      <th class="num">Custo Unit</th>
                      <th class="num">Total (R$)</th>
                      <th>Motivo da Decisão</th>
                    </tr>
                  </thead>
                  <tbody id="modal-trf-tbody"></tbody>
                </table>
              </div>
            </div>
            <div style="padding:12px 20px;background:var(--bg-subtle);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <a id="btn-modal-trf-download" href="#" class="btn btn-secondary btn-sm" style="font-weight:700;">📥 Baixar Romaneio Excel</a>
              <button id="btn-close-modal-trf-bottom" class="btn btn-primary btn-sm" type="button">Fechar</button>
            </div>
          </div>
        </div>
      </section>`;

if (html.includes(targetSectionOld)) {
  html = html.replace(targetSectionOld, targetSectionNew);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('✓ Successfully patched view-transfers in public/index.html');
} else {
  console.error('Target section not found exactly in index.html, checking fuzzy match...');
}

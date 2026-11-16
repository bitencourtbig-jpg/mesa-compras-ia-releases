import fs from 'node:fs';

const filePath = 'public/app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Inserir estado de filtros de remanejamento no objeto global state se não existir
if (!code.includes('remanFilters:')) {
  const stateStart = 'const state = {';
  const stateRepl = `const state = {
  remanFilters: {
    search: '',
    tipo: 'ALL',
    curva: 'ALL',
    origem: 'ALL',
    destino: 'ALL',
    minValor: 0,
  },`;
  code = code.replace(stateStart, stateRepl);
  console.log('state.remanFilters adicionado ao state');
}

// 2. Localizar loadTransfers em public/app.js e substituí-lo pela versão com filtros e badges de Curadoria IA
const startMarker = 'async function loadTransfers() {';
const endMarker = 'async function openFiliaisPoliciesModal() {';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Falha ao localizar loadTransfers ou openFiliaisPoliciesModal em public/app.js');
  process.exit(1);
}

const newLoadTransfersCode = `async function loadTransfers() {
  if (!state.remanFilters) {
    state.remanFilters = { search: '', tipo: 'ALL', curva: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0 };
  }

  const rf = state.remanFilters;
  const params = new URLSearchParams();
  if (state.selectedFilial && state.selectedFilial !== 'all') params.append('filial_id', state.selectedFilial);
  if (rf.origem && rf.origem !== 'ALL') params.append('origem', rf.origem);
  if (rf.destino && rf.destino !== 'ALL') params.append('destino', rf.destino);
  if (rf.tipo && rf.tipo !== 'ALL') params.append('tipo', rf.tipo);
  if (rf.curva && rf.curva !== 'ALL') params.append('curva', rf.curva);
  if (rf.minValor && Number(rf.minValor) > 0) params.append('min_valor', rf.minValor);
  if (rf.search && rf.search.trim()) params.append('search', rf.search.trim());

  const queryStr = params.toString() ? \`?\${params.toString()}\` : '';

  const [routesData, remanData] = await Promise.all([
    apiGet(\`/api/remanejamento/routes\${queryStr}\`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [] })),
    apiGet(\`/api/remanejamento\${state.selectedFilial && state.selectedFilial !== 'all' ? \`?filial_id=\${state.selectedFilial}\` : ''}\`).catch(() => ({ transfers: [], expiringLots: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  const expiringLots = remanData.expiringLots || [];
  const summary = routesData.summary || {};
  const filiaisList = routesData.filiais || [];

  // Popular dropdowns de filiais caso ainda não estejam populados
  const selOrigem = document.getElementById('reman-filter-origem');
  const selDestino = document.getElementById('reman-filter-destino');
  if (selOrigem && selOrigem.options.length <= 1 && filiaisList.length > 0) {
    selOrigem.innerHTML = '<option value="ALL">Loja Origem (Doadora): Todas</option>' + filiaisList.map((f) => \`<option value="\${f.filial_id}">\${esc(f.label || f.short || \`Loja \${f.filial_id}\`)}</option>\`).join('');
    selOrigem.value = rf.origem || 'ALL';
  }
  if (selDestino && selDestino.options.length <= 1 && filiaisList.length > 0) {
    selDestino.innerHTML = '<option value="ALL">Loja Destino (Receptora): Todas</option>' + filiaisList.map((f) => \`<option value="\${f.filial_id}">\${esc(f.label || f.short || \`Loja \${f.filial_id}\`)}</option>\`).join('');
    selDestino.value = rf.destino || 'ALL';
  }

  // Atualizar resumo do filtro
  const filterSummaryEl = document.getElementById('reman-filter-summary');
  if (filterSummaryEl) {
    filterSummaryEl.innerHTML = \`
      Exibindo <strong>\${num(routesData.totalItens || 0)} produtos</strong> em <strong>\${num(routes.length)} rotas</strong> &bull; Economia de Compras: <strong style="color:#047857;">\${brl(routesData.totalGeralRs || 0)}</strong>
    \`;
  }

  // KPI Strip
  const kpiEl = document.getElementById('transfers-kpi-strip');
  if (kpiEl) {
    kpiEl.innerHTML = \`
      <div class="kpi-cell">
        <div class="kpi-label">Rotas de Remanejamento</div>
        <div class="kpi-val kpi-accent">\${num(routes.length)}</div>
        <div class="kpi-sub">\${num(routesData.totalItens || 0)} produtos mapeados</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Peças a Transferir</div>
        <div class="kpi-val kpi-accent">\${num(routesData.totalGeralUnidades || 0)} un</div>
        <div class="kpi-sub">
          \${summary.curadoriaCount > 0 ? \`<span style="color:#7c3aed;font-weight:700;">🧬 \${num(summary.curadoriaCount)} Curadoria IA</span> &bull; \` : ''}
          \${num(summary.excessoCount || 0)} excessos &bull; \${num(summary.fefoCount || 0)} FEFO
        </div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Economia Gerada em Compras</div>
        <div class="kpi-val kpi-success" style="color:#047857;">\${brl(routesData.totalGeralRs || 0)}</div>
        <div class="kpi-sub">Compras evitadas em distribuidores</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Guias Emitidas no Motor</div>
        <div class="kpi-val">\${num(activeTransfers.length)}</div>
        <div class="kpi-sub">\${activeTransfers.filter(t => t.status === 'PENDENTE_SEPARACAO').length} aguardando separação</div>
      </div>
    \`;
  }

  // Rotas Container com Renderização Leve e Paginação por Rota (REV-025)
  const routesContainer = document.getElementById('transfer-routes-container');
  const routesCount = document.getElementById('transfer-routes-count');
  if (routesCount) routesCount.textContent = \`\${routes.length} rotas (\${num(routesData.totalItens || 0)} itens)\`;

  if (routesContainer) {
    if (routes.length === 0) {
      routesContainer.innerHTML = \`
        <div class="empty-state-box" style="padding:36px 20px; text-align:center; background:var(--card-bg); border:1px solid var(--border); border-radius:10px;">
          <div style="font-size:32px; margin-bottom:8px;">🚚✨</div>
          <div style="font-weight:700; font-size:14px; color:var(--text);">Nenhuma rota encontrada com os filtros selecionados</div>
          <div class="muted" style="font-size:12px; margin-top:4px;">Tente alterar os filtros de filial, tipo de oportunidade ou zerar o valor mínimo.</div>
        </div>
      \`;
    } else {
      routesContainer.innerHTML = routes.map((r, idx) => {
        // Exibir os primeiros 25 itens da rota para não travar o DOM
        const displayLimit = 25;
        const visibleItems = r.items.slice(0, displayLimit);
        const hasMore = r.items.length > displayLimit;

        return \`
          <div class="transfer-route-card" data-route-idx="\${idx}" style="background:var(--card-bg); border:1.5px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
            <div class="transfer-route-header" style="padding:14px 18px; background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border);">
              <div>
                <div class="transfer-route-title" style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:#0f172a;">
                  <span>🚚 Rota \${idx + 1}: <strong>\${esc(r.filialOrigemNome)}</strong></span>
                  <span style="color:#0f766e;font-size:16px;">➔</span>
                  <span><strong>\${esc(r.filialDestinoNome)}</strong></span>
                </div>
                <div class="transfer-route-meta" style="margin-top:4px; font-size:12px; color:#475569; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span><strong>\${num(r.totalItens)} produtos</strong></span> &bull;
                  <span><strong>\${num(r.totalUnidades)} un a transferir</strong></span> &bull;
                  <span>Economia de Compra: <strong style="color:#047857;">\${brl(r.valorTotalRs)}</strong></span>
                  <div style="display:flex; gap:4px; margin-left:6px;">
                    \${r.countCuradoria > 0 ? \`<span class="badge" style="background:#ede9fe; color:#5b21b6; font-size:9.5px; font-weight:800;">🧬 \${r.countCuradoria} Curadoria IA</span>\` : ''}
                    \${r.countFefo > 0 ? \`<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:9.5px; font-weight:700;">⏳ \${r.countFefo} FEFO</span>\` : ''}
                    \${r.countExcesso > 0 ? \`<span class="badge" style="background:#dbeafe; color:#1e40af; font-size:9.5px; font-weight:700;">📦 \${r.countExcesso} Excesso</span>\` : ''}
                  </div>
                </div>
              </div>
              <div class="transfer-route-actions" style="display:flex; gap:8px; align-items:center;">
                <a href="/api/remanejamento/export-excel?origem=\${r.filialOrigem}&destino=\${r.filialDestino}" class="btn btn-secondary btn-sm" style="font-weight:600; font-size:11.5px;" title="Baixar Guia de Separação em Excel desta rota">
                  📥 Baixar Guia (Excel)
                </a>
                <button class="btn btn-primary btn-sm btn-approve-route" data-route-idx="\${idx}" type="button" style="background:#0f766e; border-color:#0f766e; font-weight:700; font-size:11.5px;">
                  ✓ Aprovar Transferência da Rota
                </button>
              </div>
            </div>

            <div class="transfer-items-table" style="overflow-x:auto;">
              <table class="data-table" style="font-size:11.5px; margin:0; width:100%;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="min-width:65px;">Código</th>
                    <th style="min-width:95px;">Barras</th>
                    <th style="min-width:220px;">Produto / Descrição</th>
                    <th style="min-width:140px;">Tipo &amp; Origem</th>
                    <th style="min-width:60px;">Curva</th>
                    <th class="num" style="min-width:90px;">Qtd Transferir</th>
                    <th class="num" style="min-width:85px;">Custo Unit</th>
                    <th class="num" style="min-width:90px;">Total R$</th>
                    <th style="min-width:200px;">Motivo Operacional</th>
                  </tr>
                </thead>
                <tbody>
                  \${visibleItems.map((it) => {
                    const isCuradoriaItem = it.isCuradoria || it.tipo === 'CURADORIA_IA' || (it.motivo && it.motivo.includes('Curadoria'));
                    return \`
                      <tr class="\${isCuradoriaItem ? 'reman-curadoria-row' : ''}">
                        <td><code>\${it.produto_id}</code></td>
                        <td><code>\${esc(it.barras || '—')}</code></td>
                        <td>
                          <div class="sku-title" style="font-weight:700; font-size:12px; color:#0f172a;">\${esc(it.descricao)}</div>
                          <div class="sku-sub" style="font-size:10.5px; color:#64748b;">\${esc(it.labora || '')}</div>
                        </td>
                        <td>
                          \${isCuradoriaItem ? \`
                            <span class="badge" style="background:#ede9fe; color:#5b21b6; border:1px solid #ddd6fe; font-weight:800; font-size:9.5px; padding:2px 6px;">
                              🧬 CURADORIA IA &bull; TRANSFER-FIRST
                            </span>
                          \` : it.tipo === 'FEFO_VALIDADE' ? \`
                            <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:700; font-size:9.5px;">
                              ⏳ FEFO (\${it.validade_prioritaria || 'Curto'})
                            </span>
                          \` : it.tipo === 'EXCESSO' ? \`
                            <span class="badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700; font-size:9.5px;">
                              📦 Doação Excesso
                            </span>
                          \` : \`
                            <span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; font-size:9.5px;">
                              💤 Estoque Parado
                            </span>
                          \`}
                        </td>
                        <td>
                          <span class="badge badge-neutral" style="font-size:9.5px; font-weight:700;">Curva \${it.abc_class || 'A'}</span>
                        </td>
                        <td class="num"><strong>\${num(it.qtd_sugerida)} un</strong></td>
                        <td class="num">\${brl(it.custo_unit)}</td>
                        <td class="num"><strong style="color:#047857;">\${brl(it.valor_total)}</strong></td>
                        <td class="sku-sub" style="font-size:11px; line-height:1.35; color:#334155;">\${esc(it.motivo)}</td>
                      </tr>
                    \`;
                  }).join('')}
                </tbody>
              </table>

              \${hasMore ? \`
                <div style="padding:10px 16px; background:#f8fafc; text-align:center; border-top:1px solid #e2e8f0; font-size:11.5px; color:#64748b;">
                  Mostrando os 25 itens com maior impacto financeiro desta rota (Total de \${r.items.length} itens). Use os filtros acima para refinar por laboratório ou valor mínimo.
                </div>
              \` : ''}
            </div>
          </div>
        \`;
      }).join('');

      routesContainer.querySelectorAll('.btn-approve-route').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rIdx = Number(btn.dataset.routeIdx);
          const route = routes[rIdx];
          if (!route) return;

          btn.disabled = true;
          btn.textContent = 'Aprovando...';
          try {
            const approveRes = await apiPost('/api/remanejamento/approve', {
              filialOrigem: route.filialOrigem,
              filialDestino: route.filialDestino,
              filialOrigemNome: route.filialOrigemNome,
              filialDestinoNome: route.filialDestinoNome,
              items: route.items,
              observacao: \`Aprovado pelo comprador via Cockpit (\${route.totalUnidades} un)\`,
            });
            showBanner(\`✓ Transferência \${approveRes.codigoTransferencia} criada com sucesso! Sugestão de compra deduzida no motor.\`, false);
            await loadTransfers();
          } catch (err) {
            showBanner(\`Falha ao aprovar transferência: \${err.message}\`, true);
            btn.disabled = false;
            btn.textContent = '✓ Aprovar Transferência da Rota';
          }
        });
      });
    }
  }

  // Tabela de Guias Emitidas com Sinalização de Curadoria IA (REV-025)
  const activeCountEl = document.getElementById('active-transfers-count');
  if (activeCountEl) activeCountEl.textContent = \`\${activeTransfers.length} guias registradas\`;

  const motorTbody = document.getElementById('motor-transfers-tbody');
  if (motorTbody) {
    if (activeTransfers.length === 0) {
      motorTbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhuma transferência emitida ainda. Aprove uma das rotas acima para emitir a guia.</td></tr>';
    } else {
      motorTbody.innerHTML = activeTransfers.map((t) => {
        let statusBadge = \`<span class="badge badge-warn">\${t.status}</span>\`;
        if (t.status === 'EM_TRANSITO') statusBadge = '<span class="badge badge-info">🚚 EM TRÂNSITO</span>';
        if (t.status === 'RECEBIDA') statusBadge = '<span class="badge badge-success">✅ RECEBIDA</span>';
        if (t.status === 'CANCELADA') statusBadge = '<span class="badge badge-neutral">✕ CANCELADA</span>';

        const isCuradoriaTransfer = t.observacao && t.observacao.includes('Curadoria IA');

        let nextActionBtn = '';
        if (t.status === 'PENDENTE_SEPARACAO') {
          nextActionBtn = \`<button class="btn btn-secondary btn-xs btn-change-status" data-id="\${t.id}" data-status="EM_TRANSITO">🚚 Despachar</button>\`;
        } else if (t.status === 'EM_TRANSITO') {
          nextActionBtn = \`<button class="btn btn-secondary btn-xs btn-change-status" data-id="\${t.id}" data-status="RECEBIDA" style="color:#047857;font-weight:700;">✅ Receber</button>\`;
        }

        return \`
          <tr>
            <td>
              <code>\${esc(t.codigo_transferencia)}</code>
              \${isCuradoriaTransfer ? \`<span class="badge" style="background:#ede9fe; color:#5b21b6; font-size:9px; font-weight:800; display:block; margin-top:2px;">🧬 Curadoria IA</span>\` : ''}
            </td>
            <td><strong>\${esc(t.filial_origem_nome || \`Loja \${t.filial_origem}\`)}</strong> ➔ <strong>\${esc(t.filial_destino_nome || \`Loja \${t.filial_destino}\`)}</strong></td>
            <td><span class="muted" style="font-size:11px;">\${esc(t.data_emissao ? t.data_emissao.slice(0, 16) : '—')}</span></td>
            <td class="num">\${num(t.total_itens)}</td>
            <td class="num"><strong>\${num(t.total_unidades)} un</strong></td>
            <td class="num"><strong style="color:#047857;">\${brl(t.valor_total_rs)}</strong></td>
            <td>\${statusBadge}</td>
            <td style="display:flex;gap:6px;align-items:center;">
              \${nextActionBtn}
              <button class="btn btn-ghost btn-xs btn-view-transfer-items" data-id="\${t.id}" title="Ver itens desta guia">📦 Itens</button>
            </td>
          </tr>
        \`;
      }).join('');

      motorTbody.querySelectorAll('.btn-change-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = Number(btn.dataset.id);
          const nextStatus = btn.dataset.status;
          btn.disabled = true;
          try {
            await apiPost('/api/remanejamento/status', { id: tId, status: nextStatus });
            showBanner(\`Status da transferência atualizado para \${nextStatus}!\`);
            await loadTransfers();
          } catch (err) {
            showBanner(\`Erro ao atualizar status: \${err.message}\`, true);
            btn.disabled = false;
          }
        });
      });

      motorTbody.querySelectorAll('.btn-view-transfer-items').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = Number(btn.dataset.id);
          openTransferItemsModal(tId);
        });
      });
    }
  }

  // Tabela FEFO
  const expiringCountEl = document.getElementById('expiring-count');
  if (expiringCountEl) expiringCountEl.textContent = \`\${expiringLots.length} lotes críticos mapeados\`;

  const expTbody = document.getElementById('expiring-tbody');
  if (expTbody) {
    if (expiringLots.length === 0) {
      expTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px;">Nenhum lote crítico com vencimento próximo no momento.</td></tr>';
    } else {
      expTbody.innerHTML = expiringLots.map(l => \`
        <tr>
          <td><span class="badge badge-neutral">Loja \${l.filial_id}</span></td>
          <td>
            <div class="sku-title" style="font-weight:600;">\${esc(l.descricao || \`Produto \${l.produto_id}\`)}</div>
            <div class="sku-sub">Cód BIG: \${l.produto_id}</div>
          </td>
          <td class="num"><code>\${l.menor_validade || '—'}</code></td>
          <td class="num">\${num(l.qtd_vencendo_90d)} un</td>
          <td class="num"><strong style="color:var(--danger);">\${num(l.qtd_vencido)} un</strong></td>
          <td class="num"><strong>\${brl(l.valor_risco_rs)}</strong></td>
          <td class="num">\${badgeForException(l.acao_recomendada)}</td>
        </tr>
      \`).join('');
    }
  }

  // Vincular eventos dos filtros de remanejamento (apenas uma vez)
  bindRemanFilterEvents();
}

let remanEventsBound = false;
function bindRemanFilterEvents() {
  if (remanEventsBound) return;
  remanEventsBound = true;

  const searchInput = document.getElementById('reman-search-input');
  const selTipo = document.getElementById('reman-filter-tipo');
  const selCurva = document.getElementById('reman-filter-curva');
  const selOrigem = document.getElementById('reman-filter-origem');
  const selDestino = document.getElementById('reman-filter-destino');
  const selMinVal = document.getElementById('reman-filter-min-val');
  const btnClear = document.getElementById('btn-reman-clear-filters');

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.remanFilters.search = searchInput.value;
        loadTransfers();
      }, 350);
    });
  }

  const triggerReload = () => {
    if (selTipo) state.remanFilters.tipo = selTipo.value;
    if (selCurva) state.remanFilters.curva = selCurva.value;
    if (selOrigem) state.remanFilters.origem = selOrigem.value;
    if (selDestino) state.remanFilters.destino = selDestino.value;
    if (selMinVal) state.remanFilters.minValor = Number(selMinVal.value || 0);
    loadTransfers();
  };

  if (selTipo) selTipo.addEventListener('change', triggerReload);
  if (selCurva) selCurva.addEventListener('change', triggerReload);
  if (selOrigem) selOrigem.addEventListener('change', triggerReload);
  if (selDestino) selDestino.addEventListener('change', triggerReload);
  if (selMinVal) selMinVal.addEventListener('change', triggerReload);

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      state.remanFilters = { search: '', tipo: 'ALL', curva: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0 };
      if (searchInput) searchInput.value = '';
      if (selTipo) selTipo.value = 'ALL';
      if (selCurva) selCurva.value = 'ALL';
      if (selOrigem) selOrigem.value = 'ALL';
      if (selDestino) selDestino.value = 'ALL';
      if (selMinVal) selMinVal.value = '0';
      loadTransfers();
    });
  }
}

`;

const updatedCode = code.slice(0, startIdx) + newLoadTransfersCode + code.slice(endIdx);
fs.writeFileSync(filePath, updatedCode, 'utf8');
console.log('public/app.js atualizado com sucesso com loadTransfers filtrado e de alta performance!');

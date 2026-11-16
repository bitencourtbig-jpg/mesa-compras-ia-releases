import fs from 'fs';
import path from 'path';

const appJsPath = path.resolve('public/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Substituir loadAndRenderCuradoria e bindCuradoriaActions com a nova lista executiva
const startCuradoria = content.indexOf('async function loadAndRenderCuradoria() {');
const endCuradoria = content.indexOf('async function openDesovaItemsModal() {');

if (startCuradoria === -1 || endCuradoria === -1) {
  console.error('Could not find curadoria boundary in app.js');
  process.exit(1);
}

const newCuradoriaCode = `async function loadAndRenderCuradoria() {
  const container = document.getElementById('view-curadoria-container');
  if (!container) return;
  container.innerHTML = '<div class="muted" style="text-align:center;padding:40px;"><div style="font-size:32px;margin-bottom:12px;">🧬</div>Carregando Lista Executiva de Curadoria IA &amp; Oportunidades...</div>';

  try {
    const fId = state.selectedFilial || 'all';
    const res = await apiGet(\`/api/curadoria/opportunities?filial_id=\${fId}\`);
    const molecules = res.molecules || [];
    const totalEco = res.totalEconomiaRs || 0;

    const curBadge = document.getElementById('curadoria-tab-count');
    if (curBadge) curBadge.textContent = molecules.length;

    if (molecules.length === 0) {
      container.innerHTML = \`
        <div class="empty-state-box" style="padding:48px 24px; text-align:center; background:var(--card-bg); border:1.5px solid var(--border); border-radius:14px; margin-top:12px;">
          <div style="font-size:42px; margin-bottom:12px;">🧬✨</div>
          <div style="font-size:18px; font-weight:800; color:var(--text-primary);">Nenhum produto pendente de curadoria de moléculas</div>
          <div class="muted" style="font-size:13.5px; margin-top:6px; max-width:620px; margin-left:auto; margin-right:auto; line-height:1.5;">
            Todos os produtos demandados com concorrência já foram homologados, ajustados pelo menor custo ou não possuem compras pendentes. Todos os itens validados já estão liberados para cotação na Sugestão de Compra!
          </div>
          <div style="display:flex; justify-content:center; gap:12px; margin-top:20px; flex-wrap:wrap;">
            <button class="btn btn-primary" type="button" style="font-weight:700;" onclick="switchSkuTab('buy')">
              🛒 Ir para Sugestão de Compra
            </button>
            <button class="btn btn-secondary" type="button" onclick="openDesovaItemsModal()">
              📦 Ver Produtos em Desova no Balcão
            </button>
            <button class="btn btn-secondary" type="button" onclick="openCuradoriaLearningLogModal()">
              📜 Ver Log de Aprendizado da IA
            </button>
          </div>
        </div>
      \`;
      return;
    }

    container.innerHTML = \`
      <!-- BARRA DE CONTROLE EXECUTIVO DA CURADORIA -->
      <div style="background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border:1.5px solid #86efac; border-radius:14px; padding:18px 24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
        <div>
          <div style="font-size:16px; font-weight:800; color:#166534; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span>🧬 Pré-Tela de Curadoria IA • Oportunidades de Substituição &amp; Desova</span>
            <span class="badge" style="background:#bbf7d0; color:#14532d; font-size:12px; font-weight:800;">\${molecules.length} Produtos com Concorrência</span>
            \${totalEco > 0 ? \`<span class="badge badge-accent" style="font-size:12px; font-weight:800;">Economia Projetada: \${brl(totalEco)}</span>\` : ''}
          </div>
          <div style="font-size:13px; color:#15803d; margin-top:4px; max-width:850px; line-height:1.4;">
            Lista executiva dos produtos sugeridos para compra com concorrência ou estoque parado. <strong>Clique no produto</strong> ou no botão para abrir a tela com as moléculas por loja e definir a ação (suspender para balcão, deduzir estoque ou trocar fabricante) antes de liberar para a Sugestão de Compra.
          </div>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button id="btn-approve-all-curadoria" class="btn btn-primary btn-sm" type="button" style="font-weight:700; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            ⚡ Homologar Todas as Trocas
          </button>
          <button id="btn-view-desova-items" class="btn btn-secondary btn-sm" type="button" style="font-weight:600;">
            📦 Ver Itens em Desova
          </button>
          <button id="btn-view-learning-log" class="btn btn-secondary btn-sm" type="button" style="font-weight:600;">
            📜 Log de Aprendizado da IA
          </button>
          <button class="btn btn-secondary btn-sm" type="button" style="font-weight:700; border-color:#86efac; color:#166534;" onclick="switchSkuTab('buy')">
            🛒 Avançar p/ Sugestão de Compra ➔
          </button>
        </div>
      </div>

      <!-- BARRA DE FILTRO RÁPIDO -->
      <div style="margin-bottom:14px; display:flex; align-items:center; gap:12px; background:var(--card-bg); padding:10px 16px; border:1px solid var(--border); border-radius:10px;">
        <span style="font-size:16px;">🔍</span>
        <input type="text" id="curadoria-filter-input" placeholder="Filtrar por produto, código BIG, EAN, princípio ativo ou fabricante..." style="border:none; outline:none; background:transparent; width:100%; font-size:13.5px; color:var(--text-primary);" />
        <span id="curadoria-filter-count" class="muted" style="font-size:12px; white-space:nowrap;">Mostrando \${molecules.length} de \${molecules.length} produtos</span>
      </div>

      <!-- TABELA EXECUTIVA DE PRODUTOS DEMANDADOS (LISTA) -->
      <div class="table-wrap" style="box-shadow:0 2px 6px rgba(0,0,0,0.03); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
        <table class="data-table" style="font-size:12.5px; margin:0;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="min-width:260px;">Produto Demandado (Sugerido p/ Compra)</th>
              <th style="min-width:210px;">Princípio Ativo &amp; Apresentação</th>
              <th class="num" style="min-width:120px;">Último Custo</th>
              <th class="num" style="min-width:125px;">Demanda Sugerida</th>
              <th style="min-width:250px;">Diagnóstico IA (Motivo da Retenção)</th>
              <th style="text-align:center; min-width:145px;">Ação</th>
            </tr>
          </thead>
          <tbody id="curadoria-table-body">
            \${molecules.map((mol) => {
              const target = mol.targetSku || {};
              const cheapest = mol.cheapestSku || {};
              const adv = mol.iaAdvice || {};
              const deadStocks = adv.deadStocks || [];
              const deadTotalQty = adv.deadTotalQty || deadStocks.reduce((a, s) => a + (s.estoque || 0), 0);
              const deadLabsList = adv.deadLabsList || Array.from(new Set(deadStocks.map(s => s.labora || 'Outro'))).join(', ');
              const diffUnit = adv.diffUnit || (target.custo_unit && cheapest.custo_unit ? (target.custo_unit - cheapest.custo_unit).toFixed(2) : 0);
              const economiaTotal = adv.economiaTotal || (Number(diffUnit) > 0 ? Math.round(Number(diffUnit) * (target.total_sugestao_un || 0) * 100) / 100 : 0);
              const otherStockTotal = mol.otherStockTotal || 0;
              const otherCoverageDays = mol.otherCoverageDays || 0;
              const searchText = \`\${target.descricao || ''} \${target.produto_id || ''} \${target.barras || ''} \${target.labora || ''} \${mol.substancia || ''} \${mol.concentracao || ''} \${mol.forma || ''}\`.toLowerCase();

              return \`
                <tr class="curadoria-product-row" data-mol-key="\${esc(mol.molecule_key)}" data-pid="\${target.produto_id || 0}" data-search="\${esc(searchText)}" title="Clique para abrir a visão matricial das lojas com todos os fabricantes desta molécula">
                  <td>
                    <div style="font-weight:700; color:#0f172a; font-size:13px;">\${esc(target.descricao || 'Produto Sem Descrição')}</div>
                    <div class="muted" style="font-size:11px; margin-top:2px;">
                      Cód BIG: <strong>\${target.produto_id || '—'}</strong> &bull; EAN \${esc(target.barras || '—')}
                    </div>
                    <div style="margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span class="badge" style="background:#f1f5f9; color:#334155; font-size:10.5px; font-weight:700;">🏭 \${esc(target.labora || 'Fabricante')}</span>
                      <span class="badge badge-neutral" style="font-size:10px;">Curva \${esc(target.abc_class || 'A')}</span>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:700; color:#1e293b; font-size:12.5px;">🔬 \${esc(toTitleCase(mol.substancia || ''))} \${esc(mol.concentracao || '')}</div>
                    <div class="muted" style="font-size:11px; margin-top:2px;">\${esc(mol.forma || '')} &bull; \${esc(mol.pack_bucket || '')}</div>
                    <div style="margin-top:3px;">
                      <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:11px;">🏷️ \${mol.labs_count || 1} Labs Concorrentes</span>
                    </div>
                  </td>
                  <td class="num">
                    <div style="font-weight:700; font-size:13px; color:#0f172a;">\${brl(target.custo_unit || 0)}</div>
                    \${cheapest && cheapest.produto_id !== target.produto_id && cheapest.custo_unit < target.custo_unit ? \`
                      <div style="font-size:11px; color:#059669; font-weight:600; margin-top:2px;" title="Fabricante com menor custo nesta molécula">
                        Menor Custo: <strong>\${brl(cheapest.custo_unit)}</strong> <span class="muted">(\${esc(cheapest.labora)})</span>
                      </div>
                    \` : ''}
                  </td>
                  <td class="num">
                    <div style="font-weight:800; font-size:13.5px; color:#0f172a;">\${num(target.total_sugestao_un || 0)} un</div>
                    <div style="font-weight:700; font-size:12px; color:var(--accent);">\${brl(target.total_sugestao_rs || 0)}</div>
                  </td>
                  <td>
                    \${adv.type === 'DEAD_STOCK_WARNING' ? \`
                      <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ \${deadTotalQty} un Curva D Parado
                      </span>
                      <div style="font-size:11px; color:#991b1b; line-height:1.3;">
                        \${esc(deadLabsList)} sem giro. Priorizar desova no balcão antes de comprar!
                      </div>
                    \` : adv.type === 'MARGIN_OPPORTUNITY' ? \`
                      <span class="badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        💡 Troca Menor Custo (\${esc(cheapest.labora)})
                      </span>
                      <div style="font-size:11px; color:#047857; font-weight:600; line-height:1.3;">
                        Economia de \${brl(diffUnit)}/un &bull; \${brl(economiaTotal)} no pedido!
                      </div>
                    \` : adv.type === 'ENOUGH_STOCK_WARNING' ? \`
                      <span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ \${otherStockTotal} un de Outros Labs em Estoque
                      </span>
                      <div style="font-size:11px; color:#92400e; line-height:1.3;">
                        \${otherCoverageDays}d de cobertura em marcas alternativas na rede.
                      </div>
                    \` : \`
                      <span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ✓ Validar Fornecedor
                      </span>
                      <div class="muted" style="font-size:11px;">Molécula equilibrada na rede.</div>
                    \`}
                  </td>
                  <td style="text-align:center;">
                    <button class="btn btn-primary btn-sm btn-open-mol-modal" data-mol-key="\${esc(mol.molecule_key)}" data-pid="\${target.produto_id || 0}" type="button" style="font-weight:700; padding:6px 14px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; gap:6px;">
                      🔬 Analisar Molécula
                    </button>
                  </td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      </div>
    \`;

    bindCuradoriaActions();
  } catch (err) {
    container.innerHTML = \`<div class="banner error">Erro ao carregar Pré-Tela de Curadoria: \${esc(err.message)}</div>\`;
  }
}

function bindCuradoriaActions() {
  // Filtro Rápido em Tempo Real
  const filterInput = document.getElementById('curadoria-filter-input');
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.toLowerCase().trim();
      const rows = document.querySelectorAll('.curadoria-product-row');
      let visible = 0;
      rows.forEach(row => {
        const text = row.dataset.search || '';
        const match = !q || text.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      const countEl = document.getElementById('curadoria-filter-count');
      if (countEl) countEl.textContent = \`Mostrando \${visible} de \${rows.length} produtos\`;
    });
  }

  // Clique na Linha ou no Botão "🔬 Analisar Molécula" abre a Modal com a visão matricial das lojas
  document.querySelectorAll('.curadoria-product-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const molKey = row.dataset.molKey;
      const pid = Number(row.dataset.pid || 0);
      if (molKey) {
        openMoleculeSweep(molKey, pid, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    });
  });

  document.querySelectorAll('.btn-open-mol-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const molKey = btn.dataset.molKey;
      const pid = Number(btn.dataset.pid || 0);
      if (molKey) {
        openMoleculeSweep(molKey, pid, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    });
  });

  // Homologar Todas as Trocas
  const btnAll = document.getElementById('btn-approve-all-curadoria');
  if (btnAll) {
    btnAll.addEventListener('click', async () => {
      if (!window.confirm('Deseja homologar em lote todas as moléculas pendentes? Os itens validados serão liberados imediatamente para a Sugestão de Compra.')) return;
      btnAll.disabled = true;
      btnAll.textContent = 'Homologando...';
      try {
        const res = await apiPost('/api/curadoria/decision', { action: 'APPROVE_ALL' });
        showBanner(\`✓ \${res.message || 'Todas as moléculas homologadas com sucesso!'}\`);
        await loadAndRenderCuradoria();
      } catch (e) {
        showBanner(\`Erro na homologação em lote: \${e.message}\`, true);
        btnAll.disabled = false;
        btnAll.textContent = '⚡ Homologar Todas as Trocas';
      }
    });
  }

  // Ver Itens em Desova
  const btnDesova = document.getElementById('btn-view-desova-items');
  if (btnDesova) {
    btnDesova.addEventListener('click', openDesovaItemsModal);
  }

  // Ver Log de Aprendizado da IA
  const btnLog = document.getElementById('btn-view-learning-log');
  if (btnLog) {
    btnLog.addEventListener('click', openCuradoriaLearningLogModal);
  }
}

`;

content = content.substring(0, startCuradoria) + newCuradoriaCode + content.substring(endCuradoria);

// 2. Atualizar os botões dentro de openMoleculeSweep para executarem as decisões de curadoria
const oldSweepButtonsBlock = `    // Vincular evento de suspensão preventiva para priorizar o balcão (REV-020)
    const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');
    if (btnSuspendDead && targetSku) {
      btnSuspendDead.onclick = async () => {
        btnSuspendDead.disabled = true;
        try {
          await apiPost('/api/skus/suspend-big', {
            filialId: targetSku.filial_id || fId || 2,
            produtoId: targetSku.produto_id,
            days: 30,
            motivo: 'IA Molécula: Priorizar desova de marcas/laboratórios de baixo giro (Curva D) existentes em estoque.',
            target: 'motor'
          });
          showBanner(\`✓ Compra de \${targetSku.descricao} suspensa no Motor por 30 dias para priorizar o balcão!\`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao suspender compra: \${err.message}\`, true);
          btnSuspendDead.disabled = false;
        }
      };
    }
    actionBar.innerHTML = actionsHtml;

    // Vincular eventos dos botões de ação
    const btnDiscount = document.getElementById('btn-sweep-discount');
    if (btnDiscount && targetSku) {
      btnDiscount.onclick = async () => {
        btnDiscount.disabled = true;
        try {
          await apiPost('/api/molecules/action/discount', { skuId: targetSku.produto_id, filialId: fId || 2 });
          showBanner(\`✓ Compra de \${targetSku.descricao} cancelada! Economia de \${brl(targetSugRs)} confirmada aproveitando o estoque existente de outros laboratórios.\`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao descontar produto: \${err.message}\`, true);
        }
      };
    }

    const btnSwitchCheapest = document.getElementById('btn-sweep-switch-cheapest');
    if (btnSwitchCheapest && targetSku && cheapestSku) {
      btnSwitchCheapest.onclick = async () => {
        btnSwitchCheapest.disabled = true;
        try {
          await apiPost('/api/molecules/action/switch-lab', {
            sourceSkuId: targetSku.produto_id,
            targetSkuId: cheapestSku.produto_id,
            qty: targetSugUn,
            filialId: fId || 2,
          });
          showBanner(\`✓ Compra transferida de \${targetSku.descricao} para \${cheapestSku.descricao} (\${cheapestSku.labora}) pelo menor custo!\`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao transferir compra: \${err.message}\`, true);
        }
      };
    }

    tbody.querySelectorAll('.btn-action-switch').forEach((btn) => {
      btn.onclick = async () => {
        const sourceId = Number(btn.dataset.sourceId);
        const targetId = Number(btn.dataset.targetId);
        const qty = Number(btn.dataset.qty);
        const targetName = btn.dataset.targetName;
        try {
          await apiPost('/api/molecules/action/switch-lab', {
            sourceSkuId: sourceId,
            targetSkuId: targetId,
            qty: qty || targetSugUn || 1,
            filialId: fId || 2,
          });
          showBanner(\`✓ Compra transferida para \${targetName}!\`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao transferir compra: \${err.message}\`, true);
        }
      };
    });

    const btnKeep = document.getElementById('btn-sweep-keep');
    if (btnKeep) btnKeep.onclick = closeMoleculeSweep;`;

const newSweepButtonsBlock = `    // Vincular evento de suspensão preventiva para priorizar o balcão (REV-020 & Curadoria IA)
    const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');
    if (btnSuspendDead && targetSku) {
      btnSuspendDead.onclick = async () => {
        btnSuspendDead.disabled = true;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'SUSPEND',
            filial_id: targetSku.filial_id || fId || 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            motivo: 'Suspenso para priorizar desova de Curva D no balcão das lojas (Curadoria IA)'
          });
          showBanner(\`✓ \${res.message || 'Compra suspensa temporariamente para priorizar desova no balcão!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
        } catch (err) {
          showBanner(\`Erro ao suspender compra: \${err.message}\`, true);
          btnSuspendDead.disabled = false;
        }
      };
    }

    // Vincular eventos dos botões de ação (Decisões com Aprendizado da IA)
    const btnDiscount = document.getElementById('btn-sweep-discount');
    if (btnDiscount && targetSku) {
      btnDiscount.onclick = async () => {
        btnDiscount.disabled = true;
        try {
          const dedQty = Math.min(otherStockTotal, targetSugUn);
          const res = await apiPost('/api/curadoria/decision', {
            action: 'DEDUCT',
            filial_id: targetSku.filial_id || fId || 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            deduct_qty: dedQty,
            motivo: \`Abatidas \${dedQty} un considerando estoque alternativo da molécula na rede\`
          });
          showBanner(\`✓ \${res.message || 'Estoque alternativo abatido do pedido com sucesso!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
        } catch (err) {
          showBanner(\`Erro ao descontar produto: \${err.message}\`, true);
          btnDiscount.disabled = false;
        }
      };
    }

    const btnSwitchCheapest = document.getElementById('btn-sweep-switch-cheapest');
    if (btnSwitchCheapest && targetSku && cheapestSku) {
      btnSwitchCheapest.onclick = async () => {
        btnSwitchCheapest.disabled = true;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'SWITCH',
            filial_id: fId || 2,
            produto_id: targetSku.produto_id,
            target_sku_id: cheapestSku.produto_id,
            qty: targetSugUn,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            labora_origem: targetSku.labora,
            labora_proposto: cheapestSku.labora,
            motivo: \`Troca para fabricante de menor custo (\${cheapestSku.labora})\`
          });
          showBanner(\`✓ \${res.message || 'Troca para fabricante de menor custo homologada com sucesso!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
        } catch (err) {
          showBanner(\`Erro ao transferir compra: \${err.message}\`, true);
          btnSwitchCheapest.disabled = false;
        }
      };
    }

    tbody.querySelectorAll('.btn-action-switch').forEach((btn) => {
      btn.onclick = async () => {
        const sourceId = Number(btn.dataset.sourceId);
        const targetId = Number(btn.dataset.targetId);
        const qty = Number(btn.dataset.qty);
        const targetName = btn.dataset.targetName;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'SWITCH',
            filial_id: fId || 2,
            produto_id: sourceId,
            target_sku_id: targetId,
            qty: qty || targetSugUn || 1,
            molecule_key: molKey,
            descricao: targetSku?.descricao || '',
            labora_proposto: targetName,
            motivo: \`Troca manual para \${targetName} na análise da molécula\`
          });
          showBanner(\`✓ \${res.message || 'Compra transferida com sucesso!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
        } catch (err) {
          showBanner(\`Erro ao transferir compra: \${err.message}\`, true);
        }
      };
    });

    const btnKeep = document.getElementById('btn-sweep-keep');
    if (btnKeep) {
      btnKeep.onclick = async () => {
        btnKeep.disabled = true;
        try {
          if (targetSku && targetSugUn > 0) {
            const res = await apiPost('/api/curadoria/decision', {
              action: 'KEEP',
              molecule_key: molKey,
              produto_id: targetSku.produto_id,
              filial_id: targetSku.filial_id || fId || 0,
              descricao: targetSku.descricao,
              motivo: 'Comprador validou e manteve a marca sugerida originalmente'
            });
            showBanner(\`✓ Compra de \${targetSku.descricao} homologada e liberada para Sugestão de Compra!\`);
          }
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
        } catch (err) {
          showBanner(\`Erro ao homologar: \${err.message}\`, true);
          btnKeep.disabled = false;
        }
      };
    }`;

if (content.includes(oldSweepButtonsBlock)) {
  content = content.replace(oldSweepButtonsBlock, newSweepButtonsBlock);
  console.log('Replaced oldSweepButtonsBlock successfully');
} else {
  console.warn('Warning: oldSweepButtonsBlock not found exactly');
}

// 3. Atualizar loadBudget para ler res.data || res.budget || res
const oldLoadBudgetLine = `    const d = res.data || res;
    state.budgetSummary = d;`;
const newLoadBudgetLine = `    const d = res.data || res.budget || res;
    state.budgetSummary = d;`;
if (content.includes(oldLoadBudgetLine)) {
  content = content.replace(oldLoadBudgetLine, newLoadBudgetLine);
  console.log('Replaced oldLoadBudgetLine successfully');
}

// 4. Adicionar updateCockpitBudgetPillForFilial e chamar nos cliques de filial
if (!content.includes('async function updateCockpitBudgetPillForFilial')) {
  const helperCode = `
async function updateCockpitBudgetPillForFilial(filialId = 'all') {
  try {
    const fIdParam = filialId && filialId !== 'all' ? \`?filial_id=\${filialId}\` : '';
    const res = await apiGet(\`/api/budget/overview\${fIdParam}\`);
    const d = res.data || res.budget || res;
    updateCockpitBudgetPill(d);
  } catch (err) {
    console.warn('Erro ao atualizar pílula de saldo OTB:', err);
  }
}
`;
  content = content.replace('function updateCockpitBudgetPill(d) {', helperCode + '\nfunction updateCockpitBudgetPill(d) {');
  console.log('Inserted updateCockpitBudgetPillForFilial helper');
}

// Chamar updateCockpitBudgetPillForFilial no clique de filial
const oldChipClick = `      renderMultilojaBar();
      renderKpiStrip(state.selectedFilial);
      state.offset = 0;
      state.page = 1;
      refreshActiveView();`;

const newChipClick = `      renderMultilojaBar();
      renderKpiStrip(state.selectedFilial);
      updateCockpitBudgetPillForFilial(state.selectedFilial);
      state.offset = 0;
      state.page = 1;
      refreshActiveView();`;

if (content.includes(oldChipClick)) {
  content = content.replace(oldChipClick, newChipClick);
  console.log('Updated filial chip click listener with budget pill refresh');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('SUCCESS: public/app.js updated successfully!');

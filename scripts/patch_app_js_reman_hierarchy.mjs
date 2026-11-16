import fs from 'fs';

const filePath = 'public/app.js';
let content = fs.readFileSync(filePath, 'utf8');

// Function openTransferItemsModal
const modalFuncCode = `
let currentActiveTransfers = [];

function openTransferItemsModal(transferId) {
  const modalEl = document.getElementById('modal-transfer-items');
  if (!modalEl) return;

  const t = currentActiveTransfers.find(x => Number(x.id) === Number(transferId));
  if (!t) {
    showBanner('Guia de transferência não encontrada.', true);
    return;
  }

  const titleEl = document.getElementById('modal-trf-title');
  const subEl = document.getElementById('modal-trf-sub');
  const metaEl = document.getElementById('modal-trf-meta');
  const tbodyEl = document.getElementById('modal-trf-tbody');
  const dlBtn = document.getElementById('btn-modal-trf-download');

  if (titleEl) titleEl.textContent = \`📦 Guia de Transferência \${t.codigo_transferencia || \`TRF-\${t.id}\`}\`;
  if (subEl) subEl.textContent = \`Origem: \${t.filial_origem_nome || \`Loja \${t.filial_origem}\`} ➔ Destino: \${t.filial_destino_nome || \`Loja \${t.filial_destino}\`}\`;

  if (dlBtn) dlBtn.href = \`/api/remanejamento/export-excel?transferId=\${t.id}\`;

  if (metaEl) {
    metaEl.innerHTML = \`
      <div><strong>Emissão:</strong> \${t.data_emissao ? t.data_emissao.slice(0, 16) : '—'}</div>
      <div><strong>Status:</strong> <span class="badge badge-accent">\${t.status}</span></div>
      <div><strong>Total:</strong> \${num(t.total_itens)} itens &bull; <strong>\${num(t.total_unidades)} un</strong> &bull; <strong style="color:#047857;">\${brl(t.valor_total_rs)}</strong></div>
      \${t.observacao ? \`<div style="width:100%;margin-top:4px;color:#6b21a8;font-weight:600;">\${esc(t.observacao)}</div>\` : ''}
    \`;
  }

  const items = t.itens || [];
  if (tbodyEl) {
    if (items.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhum item registrado nesta guia.</td></tr>';
    } else {
      tbodyEl.innerHTML = items.map(it => \`
        <tr>
          <td><code>\${it.produto_id}</code></td>
          <td><code>\${esc(it.barras || '—')}</code></td>
          <td><strong>\${esc(it.descricao)}</strong></td>
          <td><span class="muted">\${esc(it.labora || '—')}</span></td>
          <td class="num"><strong>\${num(it.qtd_solicitada)} un</strong></td>
          <td class="num">\${brl(it.custo_unit)}</td>
          <td class="num"><strong style="color:#047857;">\${brl(it.valor_total)}</strong></td>
          <td style="font-size:11px;color:#475569;">\${esc(it.motivo_decisao || it.motivo || '—')}</td>
        </tr>
      \`).join('');
    }
  }

  modalEl.style.display = 'flex';
  modalEl.classList.remove('hidden');

  const closeBtn = document.getElementById('btn-close-modal-trf');
  const closeBtnBottom = document.getElementById('btn-close-modal-trf-bottom');
  const closeModal = () => {
    modalEl.style.display = 'none';
    modalEl.classList.add('hidden');
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeBtnBottom) closeBtnBottom.onclick = closeModal;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal();
  };
}
`;

// Replace loadTransfers body parts
const oldTransfersFetchAnchor = `const [routesData, remanData] = await Promise.all([
    apiGet(\`/api/remanejamento/routes\${queryStr}\`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [] })),
    apiGet(\`/api/remanejamento\${state.selectedFilial && state.selectedFilial !== 'all' ? \`?filial_id=\${state.selectedFilial}\` : ''}\`).catch(() => ({ transfers: [], expiringLots: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  const expiringLots = remanData.expiringLots || [];
  const summary = routesData.summary || {};
  const filiaisList = routesData.filiais || [];`;

const newTransfersFetchAnchor = `const [routesData, remanData] = await Promise.all([
    apiGet(\`/api/remanejamento/routes\${queryStr}\`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [] })),
    apiGet(\`/api/remanejamento\${state.selectedFilial && state.selectedFilial !== 'all' ? \`?filial_id=\${state.selectedFilial}\` : ''}\`).catch(() => ({ transfers: [], expiringLots: [], curadoriaDecisions: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  currentActiveTransfers = activeTransfers;
  const expiringLots = remanData.expiringLots || [];
  const curadoriaDecisions = remanData.curadoriaDecisions || [];
  const summary = routesData.summary || {};
  const filiaisList = routesData.filiais || [];`;

if (content.includes(oldTransfersFetchAnchor)) {
  content = content.replace(oldTransfersFetchAnchor, newTransfersFetchAnchor);
  console.log('✓ Updated transfers fetch to include curadoriaDecisions and currentActiveTransfers');
}

// Render Curadoria Decisions Table (SEÇÃO 1)
const curadoriaRenderBlock = `
  // Renderizar SEÇÃO 1: Decisões da Rodada do Comprador (Curadoria IA & Abatimentos)
  const curadoriaTbody = document.getElementById('curadoria-decisions-tbody');
  if (curadoriaTbody) {
    if (curadoriaDecisions.length === 0) {
      curadoriaTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px;">Nenhuma decisão de curadoria registrada nesta rodada. Ao analisar as moléculas na Pré-Tela e deduzir compras ou autorizar remanejamentos, elas aparecerão listadas aqui com prioridade máxima.</td></tr>';
    } else {
      curadoriaTbody.innerHTML = curadoriaDecisions.map(d => {
        const lojasCancStr = d.lojas_canceladas && d.lojas_canceladas.length > 0
          ? d.lojas_canceladas.map(l => \`<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:9.5px;font-weight:700;">\${esc(l.nome)}</span>\`).join(' ')
          : '<span class="muted" style="font-size:11px;">Rede toda (rateio)</span>';

        const lojasDoadStr = d.lojas_doadoras && d.lojas_doadoras.length > 0
          ? d.lojas_doadoras.slice(0, 3).map(l => \`<span class="badge" style="background:#ede9fe;color:#5b21b6;font-size:9.5px;font-weight:600;" title="\${esc(l.descricao)}">\${esc(l.nome)}: \${l.estoque_atual} un (\${esc(l.labora)})</span>\`).join(' ') + (d.lojas_doadoras.length > 3 ? \`<span class="muted" style="font-size:10px;">+\${d.lojas_doadoras.length - 3}</span>\` : '')
          : '<span class="muted" style="font-size:11px;">Sem doador externo</span>';

        let actionCell = '';
        if (d.transfer_emitted) {
          actionCell = \`
            <span class="badge" style="background:#ede9fe;color:#5b21b6;font-weight:800;font-size:10px;">
              ✓ Guia \${esc(d.transfer_emitted.codigo)}
            </span>
          \`;
        } else if (d.lojas_doadoras && d.lojas_doadoras.length > 0) {
          actionCell = \`
            <button class="btn btn-primary btn-xs btn-emit-curadoria-single" data-pid="\${d.produto_id}" style="background:#7c3aed;border-color:#6d28d9;font-weight:700;">
              📄 Emitir Guia
            </button>
          \`;
        } else {
          actionCell = '<span class="badge badge-success" style="font-size:10px;">✓ Abatimento no Balcão</span>';
        }

        return \`
          <tr>
            <td>
              <div style="font-weight:700;color:#0f172a;">\${esc(d.descricao)}</div>
              <div style="font-size:11px;color:#64748b;">Cód BIG: \${d.produto_id} \${d.barras ? \`&bull; EAN: \${esc(d.barras)}\` : ''} &bull; \${esc(d.labora || '—')}</div>
            </td>
            <td>
              <span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600;font-size:10px;">\${esc(d.molecule_key || '—')}</span>
            </td>
            <td>\${lojasCancStr}</td>
            <td>\${lojasDoadStr}</td>
            <td class="num"><strong style="color:#4c1d95;font-size:13px;">\${num(d.total_un_abatidas)} un</strong></td>
            <td class="num"><strong style="color:#047857;font-size:13px;">\${brl(d.economia_rs)}</strong></td>
            <td style="text-align:center;">\${actionCell}</td>
          </tr>
        \`;
      }).join('');

      // Eventos dos botões de emitir guia da curadoria
      curadoriaTbody.querySelectorAll('.btn-emit-curadoria-single').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pId = Number(btn.dataset.pid);
          btn.disabled = true;
          btn.textContent = 'Emitindo...';
          try {
            const res = await apiPost('/api/curadoria/emit-transfer', { produto_id: pId });
            showBanner(res.message || 'Guia de transferência emitida com sucesso!');
            await loadTransfers();
          } catch (err) {
            showBanner(\`Erro ao emitir guia: \${err.message}\`, true);
            btn.disabled = false;
            btn.textContent = '📄 Emitir Guia';
          }
        });
      });
    }
  }

  // Botão Emitir Todas as Guias Pendentes
  const btnEmitAll = document.getElementById('btn-emit-all-curadoria-transfers');
  if (btnEmitAll) {
    btnEmitAll.onclick = async () => {
      btnEmitAll.disabled = true;
      btnEmitAll.textContent = 'Emitindo guias...';
      try {
        const res = await apiPost('/api/curadoria/emit-transfer', { all: true });
        showBanner(res.message || 'Guias emitidas com sucesso!');
        await loadTransfers();
      } catch (err) {
        showBanner(\`Erro ao emitir guias: \${err.message}\`, true);
        btnEmitAll.disabled = false;
        btnEmitAll.textContent = '🚀 Emitir Guias das Decisões Pendentes';
      }
    };
  }
`;

// Replace motor-transfers-tbody rendering to add Romaneio Excel button
const oldMotorTbodyAnchor = `return \`
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
        \`;`;

const newMotorTbodyAnchor = `return \`
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
            <td style="display:flex;gap:6px;align-items:center;justify-content:center;">
              <a href="/api/remanejamento/export-excel?transferId=\${t.id}" class="btn btn-secondary btn-xs" style="color:#0f766e;font-weight:700;" title="Baixar Romaneio de Carga e Separação em Excel para Linx BIG">📥 Romaneio Excel</a>
              \${nextActionBtn}
              <button class="btn btn-ghost btn-xs btn-view-transfer-items" data-id="\${t.id}" title="Ver itens desta carga">📦 Ver Itens</button>
            </td>
          </tr>
        \`;`;

if (content.includes(oldMotorTbodyAnchor)) {
  content = content.replace(oldMotorTbodyAnchor, newMotorTbodyAnchor);
  console.log('✓ Updated motor transfers rows with Romaneio Excel download button');
}

// Replace expiring-tbody rendering to fix aliases, dates and operational action buttons
const oldExpiringAnchor = `expTbody.innerHTML = expiringLots.map(l => \`
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
      \`).join('');`;

const newExpiringAnchor = `expTbody.innerHTML = expiringLots.map(l => {
        const dVal = l.menor_validade ? l.menor_validade.split('-').reverse().join('/') : '—';
        const isVencido = Number(l.qtd_vencido || 0) > 0;
        const isVencendo = Number(l.qtd_vencendo_90d || 0) > 0;

        let opActions = '';
        if (isVencido) {
          opActions = \`
            <span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:800;font-size:9.5px;">🚨 LOTE VENCIDO</span>
            <button class="btn btn-secondary btn-xs btn-fefo-op" data-id="\${l.produto_id}" data-filial="\${l.filial_id}" data-desc="\${esc(l.descricao)}" data-acao="SEGREGA_DEVOLUCAO" style="color:#991b1b;font-weight:700;margin-left:4px;">
              🚫 Segregar p/ Devolução
            </button>
          \`;
        } else if (isVencendo) {
          opActions = \`
            <span class="badge" style="background:#fef3c7;color:#92400e;font-weight:700;font-size:9.5px;">⚠️ VENCE &le; 90d</span>
            <button class="btn btn-secondary btn-xs btn-fefo-op" data-id="\${l.produto_id}" data-filial="\${l.filial_id}" data-desc="\${esc(l.descricao)}" data-acao="DESOVA_BALCAO" style="color:#92400e;font-weight:700;margin-left:4px;">
              🏷️ Desovar no Balcão
            </button>
          \`;
        } else {
          opActions = '<span class="badge badge-neutral">FEFO Normal</span>';
        }

        return \`
          <tr>
            <td><span class="badge badge-neutral">Loja \${l.filial_id}</span></td>
            <td>
              <div class="sku-title" style="font-weight:600;">\${esc(l.descricao || \`Produto \${l.produto_id}\`)}</div>
              <div class="sku-sub">Cód BIG: \${l.produto_id} &bull; Curva \${esc(l.abc_class || '—')}</div>
            </td>
            <td class="num"><code style="font-weight:700;\${isVencido ? 'color:#dc2626;' : ''}">\${dVal}</code></td>
            <td class="num"><strong style="\${isVencendo ? 'color:#b45309;' : ''}">\${num(l.qtd_vencendo_90d)} un</strong></td>
            <td class="num"><strong style="\${isVencido ? 'color:#dc2626;font-size:13px;' : 'color:#94a3b8;'}">\${num(l.qtd_vencido)} un</strong></td>
            <td class="num"><strong style="color:#b91c1c;font-size:13px;">\${brl(l.valor_risco_rs)}</strong></td>
            <td style="text-align:center;">\${opActions}</td>
          </tr>
        \`;
      }).join('');

      expTbody.querySelectorAll('.btn-fefo-op').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pId = Number(btn.dataset.id);
          const fId = Number(btn.dataset.filial);
          const acao = btn.dataset.acao;
          const desc = btn.dataset.desc;
          btn.disabled = true;
          try {
            await apiPost('/api/remanejamento/fefo-action', { produto_id: pId, filial_id: fId, acao, descricao: desc });
            showBanner(acao === 'SEGREGA_DEVOLUCAO'
              ? \`✓ Lote de \${desc} (Loja \${fId}) marcado para segregação e devolução ao fornecedor!\`
              : \`✓ Ação de desova rápida no balcão ativada para \${desc} (Loja \${fId})!\`
            );
            btn.textContent = '✓ Registrado';
          } catch (err) {
            showBanner(\`Erro ao registrar ação FEFO: \${err.message}\`, true);
            btn.disabled = false;
          }
        });
      });`;

if (content.includes(oldExpiringAnchor)) {
  content = content.replace(oldExpiringAnchor, newExpiringAnchor);
  console.log('✓ Updated expiringLots table with formatted dates and operational buttons');
}

// Inject curadoriaRenderBlock and openTransferItemsModal
if (!content.includes('openTransferItemsModal(transferId)')) {
  // Inject right before loadTransfers definition
  content = content.replace(
    'async function loadTransfers() {',
    `${modalFuncCode}\nasync function loadTransfers() {`
  );
  console.log('✓ Injected openTransferItemsModal function');
}

// Inject curadoriaRenderBlock right after kpiEl rendering
const kpiRenderAnchor = `// Rotas Container com Renderização Leve e Paginação por Rota (REV-025)`;
if (content.includes(kpiRenderAnchor) && !content.includes('curadoria-decisions-tbody')) {
  content = content.replace(kpiRenderAnchor, `${curadoriaRenderBlock}\n\n  ${kpiRenderAnchor}`);
  console.log('✓ Injected curadoriaRenderBlock in loadTransfers');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done patching public/app.js!');

import fs from 'node:fs';

const filePath = 'public/app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Atualizar openMoleculeSweep para resetar os novos containers e extrair store_analysis e remanejamento_sinergia
const startOld = `async function openMoleculeSweep(molKey, skuId, filialId = null) {
  const modal = document.getElementById('molecule-sweep-modal');
  modal.classList.remove('hidden');

  const banner = document.getElementById('sweep-ia-banner');
  const tbody = document.getElementById('sweep-tbody');
  const actionBar = document.getElementById('sweep-action-bar');

  banner.className = 'sweep-banner info';
  banner.innerHTML = '<strong>Consultando laboratórios, fabricantes e curvas da molécula em tempo real...</strong>';
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;" class="muted">Carregando dados da molécula...</td></tr>';
  actionBar.innerHTML = '';

  const fId = filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2);

  try {
    const res = await apiGet(\`/api/molecules/sweep?key=\${encodeURIComponent(molKey)}&skuId=\${skuId || 0}&filialId=\${fId || 2}\`);
    const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice } = res;`;

const startNew = `async function openMoleculeSweep(molKey, skuId, filialId = null) {
  const modal = document.getElementById('molecule-sweep-modal');
  modal.classList.remove('hidden');

  const banner = document.getElementById('sweep-ia-banner');
  const tbody = document.getElementById('sweep-tbody');
  const actionBar = document.getElementById('sweep-action-bar');
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');

  banner.className = 'sweep-banner info';
  banner.innerHTML = '<strong>Consultando laboratórios, fabricantes e curvas da molécula em tempo real...</strong>';
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;" class="muted">Carregando dados da molécula...</td></tr>';
  actionBar.innerHTML = '';
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }

  const fId = filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2);

  try {
    const res = await apiGet(\`/api/molecules/sweep?key=\${encodeURIComponent(molKey)}&skuId=\${skuId || 0}&filialId=\${fId || 2}\`);
    const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice, store_analysis, remanejamento_sinergia } = res;`;

if (code.includes(startOld)) {
  code = code.replace(startOld, startNew);
  console.log('Início de openMoleculeSweep atualizado.');
} else {
  console.log('AVISO: startOld não encontrado, tentando versão com CRLF/LF...');
}

// 2. Inserir a renderização de sweep-store-diagnostic e sweep-reman-synergy após o banner (antes de renderizar a tabela)
const bannerEndMarker = `      banner.className = 'sweep-banner';
      banner.style = \`background:\${bgCard}; border:1.5px solid \${borderColor}; border-radius:12px; padding:16px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.04);\`;
      banner.innerHTML = \`
        <div style="font-size:15px; font-weight:800; color:\${titleColor}; display:flex; align-items:center; gap:8px;">
          \${ia_advice.title}
        </div>
        \${ia_advice.headline ? \`<div style="font-weight:700; color:\${titleColor}; font-size:13px; margin:6px 0 4px 0;">\${esc(ia_advice.headline)}</div>\` : ''}
        <div style="font-size:12.5px; line-height:1.5; color:#1e293b; margin-top:4px;">
          \${esc(ia_advice.message).replace(/\\\\n/g, '<br>')}
        </div>
        \${guidanceHtml}
      \`;
    } else {
      banner.className = 'sweep-banner success';
      banner.innerHTML = \`
        <div style="font-size:14px; font-weight:700;">✓ Varredura da Molécula Concluída</div>
        <div>
          Total de <strong>\${skus.length} produtos</strong> ativos nesta molécula. Estoque somado: <strong>\${summary.estoque_total} un</strong> (Cobertura média: <strong>\${summary.cobertura_molecula_dias} dias</strong>).
        </div>
      \`;
    }`;

const storeAndRemanRenderCode = `
    // =========================================================================
    // SEÇÃO 1: DIAGNÓSTICO FILIAL A FILIAL (ONDE NÃO COMPRAR E ONDE REPOR) (REV-023)
    // =========================================================================
    if (storeDiagContainer && store_analysis && store_analysis.length > 0) {
      storeDiagContainer.style.display = 'flex';
      const blockedStores = store_analysis.filter((s) => s.veredito === 'BLOQUEAR_COMPRA');
      const deduzirStores = store_analysis.filter((s) => s.veredito === 'DEDUZIR_PARCIAL');
      const doadoraStores = store_analysis.filter((s) => s.veredito === 'DOADORA_EXCESSO');
      const rupturaStores = store_analysis.filter((s) => s.veredito === 'RUPTURA_REAL');

      const isMulti = store_analysis.length > 1;

      storeDiagContainer.innerHTML = \`
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:14px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <div>
              <div style="font-size:13.5px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>🏢 \${isMulti ? 'Diagnóstico Filial a Filial: Onde NÃO Comprar e Onde Repor' : 'Diagnóstico da Loja: Situação de Estoque e Alternativas'}</span>
              </div>
              <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
                \${isMulti ? 'Varredura detalhada por loja do estoque de marcas concorrentes, giro e necessidade real de compra' : 'Varredura da loja atual para proteção de capital e desova de balcão'}
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              \${blockedStores.length > 0 ? \`<span style="background:#fee2e2; color:#991b1b; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; border:1px solid #fecaca;">🛑 \${blockedStores.length} \${blockedStores.length > 1 ? 'Lojas com Compra Bloqueada' : 'Loja com Compra Bloqueada'}</span>\` : ''}
              \${deduzirStores.length > 0 ? \`<span style="background:#fef3c7; color:#92400e; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; border:1px solid #fde68a;">📉 \${deduzirStores.length} \${deduzirStores.length > 1 ? 'Lojas p/ Descontar' : 'Loja p/ Descontar'}</span>\` : ''}
              \${doadoraStores.length > 0 ? \`<span style="background:#ede9fe; color:#5b21b6; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; border:1px solid #ddd6fe;">🚚 \${doadoraStores.length} \${doadoraStores.length > 1 ? 'Lojas Doadoras' : 'Loja Doadora'}</span>\` : ''}
              \${rupturaStores.length > 0 ? \`<span style="background:#eff6ff; color:#1e40af; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; border:1px solid #bfdbfe;">🛒 \${rupturaStores.length} \${rupturaStores.length > 1 ? 'Lojas com Demanda Real' : 'Loja com Demanda Real'}</span>\` : ''}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:10px;">
            \${store_analysis.map((st) => {
              const isBlock = st.veredito === 'BLOQUEAR_COMPRA';
              const isDeduct = st.veredito === 'DEDUZIR_PARCIAL';
              const isDonor = st.veredito === 'DOADORA_EXCESSO';
              const isDesova = st.veredito === 'DESOVAR_BALCAO';
              const isRupture = st.veredito === 'RUPTURA_REAL';

              const cardBg = isBlock ? '#fff5f5' : isDeduct ? '#fffbeb' : isDonor ? '#faf5ff' : isDesova ? '#fff7ed' : isRupture ? '#eff6ff' : '#f8fafc';
              const cardBorder = isBlock ? '#fca5a5' : isDeduct ? '#fde68a' : isDonor ? '#c4b5fd' : isDesova ? '#fdba74' : isRupture ? '#93c5fd' : '#e2e8f0';
              const badgeBg = isBlock ? '#dc2626' : isDeduct ? '#d97706' : isDonor ? '#7c3aed' : isDesova ? '#ea580c' : isRupture ? '#2563eb' : '#64748b';

              return \`
                <div style="background:\${cardBg}; border:1.5px solid \${cardBorder}; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                      <span style="font-weight:800; font-size:12px; color:#0f172a;">\${esc(st.full_label || st.label)}</span>
                      <span style="background:\${badgeBg}; color:#ffffff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; text-transform:uppercase;">
                        \${st.tituloVeredito}
                      </span>
                    </div>

                    <div style="display:flex; justify-content:space-between; font-size:11px; background:rgba(255,255,255,0.6); padding:4px 8px; border-radius:6px; margin-bottom:6px;">
                      <div>Sugestão Item: <strong style="color:\${st.targetSug > 0 ? '#b91c1c' : '#334155'};">\${st.targetSug} un</strong> \${st.sugRs > 0 ? \`(\${brl(st.sugRs)})\` : ''}</div>
                      <div>Alt. Estoque: <strong>\${st.altEstTotal} un</strong> <span class="muted">(\${st.cobAltMedia >= 999 ? '999+d' : st.cobAltMedia + 'd'})</span></div>
                    </div>

                    <div style="font-size:11.5px; line-height:1.4; color:#1e293b;">
                      \${esc(st.orientacao)}
                    </div>
                  </div>

                  <div style="margin-top:8px; padding:6px 8px; background:rgba(255,255,255,0.85); border-radius:6px; border:1px dashed \${cardBorder}; font-size:11px; font-weight:700; color:#0f172a; display:flex; align-items:center; gap:4px;">
                    <span>💡</span>
                    <span>\${esc(st.acaoSugerida)}</span>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }

    // =========================================================================
    // SEÇÃO 2: SINERGIA COM REMANEJAMENTO INTELIGENTE (TRANSFER-FIRST) (REV-023)
    // =========================================================================
    if (remanSynergyContainer && remanejamento_sinergia && remanejamento_sinergia.hasOpportunities) {
      remanSynergyContainer.style.display = 'flex';
      const routes = remanejamento_sinergia.routes || [];

      remanSynergyContainer.innerHTML = \`
        <div style="background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border:1.5px solid #a78bfa; border-radius:12px; padding:14px 16px; box-shadow:0 2px 6px rgba(124,58,237,0.06);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; border-bottom:1px solid #ddd6fe; padding-bottom:8px;">
            <div>
              <div style="font-size:14px; font-weight:800; color:#5b21b6; display:flex; align-items:center; gap:8px;">
                <span>🔄 Sinergia com Remanejamento Inteligente: Transfer-First (Custo Zero de Compra)</span>
              </div>
              <div style="font-size:11.5px; color:#6d28d9; margin-top:2px;">
                Abastecimento prioritário entre lojas da rede: o motor identificou transferências que cobrem a demanda das filiais sem compras externas
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="background:#7c3aed; color:#ffffff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px;">
                \${routes.length} \${routes.length > 1 ? 'Rotas de Transferência Ativas' : 'Rota de Transferência Ativa'}
              </span>
              <span style="background:#15803d; color:#ffffff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px;">
                💰 Economia Total: \${brl(remanejamento_sinergia.economiaRemanejamentoRs)}
              </span>
            </div>
          </div>

          <div style="font-size:12px; color:#4c1d95; line-height:1.45; margin-bottom:10px;">
            💡 <strong>Estratégia do Motor:</strong> Em vez de emitir pedido externo na distribuidora gastando orçamento de compras, as filiais com excesso ou com lotes próximos ao vencimento (FEFO) transferem diretamente para as filiais necessitadas, preservando o caixa da rede!
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(310px, 1fr)); gap:10px;">
            \${routes.map((r) => {
              const isFefo = r.tipo === 'FEFO_VALIDADE';
              return \`
                <div style="background:#ffffff; border:1px solid #c4b5fd; border-radius:8px; padding:10px 12px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                      <div style="font-size:12px; font-weight:800; color:#4338ca; display:flex; align-items:center; gap:6px;">
                        <span>🚚 \${esc(r.from_label)}</span>
                        <span style="color:#6366f1;">➔</span>
                        <span style="color:#1e40af;">\${esc(r.to_label)}</span>
                      </div>
                      <span class="badge" style="font-size:9.5px; font-weight:800; \${isFefo ? 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;' : 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;'}">
                        \${isFefo ? '⏳ FEFO Validade' : '📦 Excesso Estoque'}
                      </span>
                    </div>

                    <div style="font-size:12px; font-weight:700; color:#0f172a;">
                      \${r.qty} un &bull; \${esc(r.produto_desc || r.labora)}
                    </div>
                    <div style="font-size:11px; color:#475569; margin-top:3px; line-height:1.35;">
                      \${esc(r.motivo)}
                    </div>
                  </div>

                  <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #e2e8f0; font-size:11px; font-weight:700; color:#15803d; display:flex; justify-content:space-between; align-items:center;">
                    <span>Economia no Pedido:</span>
                    <span style="font-size:12.5px; font-weight:800;">\${brl(r.economia_rs)}</span>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }
`;

if (code.includes(bannerEndMarker)) {
  code = code.replace(bannerEndMarker, `${bannerEndMarker}\n${storeAndRemanRenderCode}`);
  console.log('Renderização de store-diagnostic e reman-synergy inserida.');
} else {
  console.log('AVISO: bannerEndMarker não encontrado.');
}

// 3. Adicionar botão btn-sweep-apply-reman na barra de ações
const actionsBarOld = `          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            \${ia_advice && ia_advice.canSuspend ? \`
              <button id="btn-sweep-suspend-dead" class="btn btn-danger btn-sm" type="button" style="font-weight:700; background:#dc2626; color:#ffffff; border:none; padding:8px 16px; box-shadow:0 1px 3px rgba(220,38,38,0.3); border-radius:8px;" title="Trava a reposição por 30 dias na rede para que as lojas vendam o estoque parado antes de vencer">
                🚫 Suspender Compra (Priorizar Giro no Balcão)
              </button>
            \` : ''}`;

const actionsBarNew = `          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            \${remanejamento_sinergia && remanejamento_sinergia.hasOpportunities ? \`
              <button id="btn-sweep-apply-reman" class="btn btn-sm" type="button" style="font-weight:800; background:linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color:#ffffff; border:none; padding:8px 18px; box-shadow:0 2px 5px rgba(109,40,217,0.35); border-radius:8px; display:inline-flex; align-items:center; gap:6px;" title="Aprova as transferências entre lojas e cancela compras externas das lojas com sobre-estoque">
                <span>🔄</span>
                <span>Aplicar Remanejamento & Bloquear Excessos (\${brl(remanejamento_sinergia.economiaRemanejamentoRs)})</span>
              </button>
            \` : ''}
            \${ia_advice && ia_advice.canSuspend ? \`
              <button id="btn-sweep-suspend-dead" class="btn btn-danger btn-sm" type="button" style="font-weight:700; background:#dc2626; color:#ffffff; border:none; padding:8px 16px; box-shadow:0 1px 3px rgba(220,38,38,0.3); border-radius:8px;" title="Trava a reposição por 30 dias na rede para que as lojas vendam o estoque parado antes de vencer">
                🚫 Suspender Compra (Priorizar Giro no Balcão)
              </button>
            \` : ''}`;

if (code.includes(actionsBarOld)) {
  code = code.replace(actionsBarOld, actionsBarNew);
  console.log('Botão btn-sweep-apply-reman inserido na barra de ações.');
} else {
  console.log('AVISO: actionsBarOld não encontrado.');
}

// 4. Inserir o listener de clique para btn-sweep-apply-reman
const listenerMarker = `    // Vincular evento de suspensão preventiva para priorizar o balcão (REV-020)
    const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');`;

const remanListenerCode = `    // Vincular evento de aplicação de Remanejamento & Bloqueio de Compras Excedentes (REV-023)
    const btnApplyReman = document.getElementById('btn-sweep-apply-reman');
    if (btnApplyReman && targetSku && remanejamento_sinergia) {
      btnApplyReman.onclick = async () => {
        btnApplyReman.disabled = true;
        btnApplyReman.innerHTML = '<span>⏳</span><span>Aplicando Remanejamento & Cancelando...</span>';
        try {
          const blockedStores = (store_analysis || []).filter((s) => s.veredito === 'BLOQUEAR_COMPRA' || s.veredito === 'DEDUZIR_PARCIAL');
          const res = await apiPost('/api/curadoria/decision', {
            action: 'REMANEJAR_E_CANCELAR',
            filial_id: 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            blockedStores,
            routes: remanejamento_sinergia.routes || []
          });
          showBanner(\`✓ \${res.message || 'Remanejamento aplicado com sucesso! Compras canceladas nas lojas com excesso e transferências aprovadas.'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(\`Erro ao aplicar remanejamento: \${err.message}\`, true);
          btnApplyReman.disabled = false;
          btnApplyReman.innerHTML = '<span>🔄</span><span>Aplicar Remanejamento & Bloquear Excessos</span>';
        }
      };
    }

    ${listenerMarker}`;

if (code.includes(listenerMarker)) {
  code = code.replace(listenerMarker, remanListenerCode);
  console.log('Listener para btn-sweep-apply-reman inserido com sucesso.');
} else {
  console.log('AVISO: listenerMarker não encontrado.');
}

// 5. Atualizar closeMoleculeSweep para limpar e ocultar os novos containers
const closeOld = `function closeMoleculeSweep() {
  document.getElementById('molecule-sweep-modal').classList.add('hidden');
}`;

const closeNew = `function closeMoleculeSweep() {
  document.getElementById('molecule-sweep-modal').classList.add('hidden');
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }
}`;

if (code.includes(closeOld)) {
  code = code.replace(closeOld, closeNew);
  console.log('closeMoleculeSweep atualizado.');
}

// 6. Atualizar a coluna de Diagnóstico IA na lista executiva de curadoria para destacar remanejamento
const curadoriaTableDiagOld = `                  <td>
                    \${adv.type === 'DEAD_STOCK_WARNING' ? \`
                      <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ \${deadTotalQty} un Curva D Parado
                      </span>
                      <div style="font-size:11px; color:#991b1b; line-height:1.3;">
                        \${esc(deadLabsList)} sem giro. Priorizar desova no balcão antes de comprar!
                      </div>
                    \` : adv.type === 'MARGIN_OPPORTUNITY' ? \``;

const curadoriaTableDiagNew = `                  <td>
                    \${mol.remanejamento_sinergia && mol.remanejamento_sinergia.hasOpportunities ? \`
                      <span class="badge" style="background:#ede9fe; color:#5b21b6; border:1px solid #ddd6fe; font-weight:800; font-size:11px; display:inline-block; margin-bottom:3px;">
                        🔄 \${mol.remanejamento_sinergia.routes.length} Rotas de Remanejamento (\${brl(mol.remanejamento_sinergia.economiaRemanejamentoRs)})
                      </span>
                      <div style="font-size:11px; color:#5b21b6; font-weight:600; line-height:1.3;">
                        Transfer-First disponível entre lojas. \${deadTotalQty > 0 ? \`(\${deadTotalQty} un Curva D paradas)\` : ''}
                      </div>
                    \` : adv.type === 'DEAD_STOCK_WARNING' ? \`
                      <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ \${deadTotalQty} un Curva D Parado
                      </span>
                      <div style="font-size:11px; color:#991b1b; line-height:1.3;">
                        \${esc(deadLabsList)} sem giro. Priorizar desova no balcão antes de comprar!
                      </div>
                    \` : adv.type === 'MARGIN_OPPORTUNITY' ? \``;

if (code.includes(curadoriaTableDiagOld)) {
  code = code.replace(curadoriaTableDiagOld, curadoriaTableDiagNew);
  console.log('Coluna de Diagnóstico IA na tabela de curadoria atualizada com destaque de Remanejamento.');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Patch aplicado com sucesso em public/app.js!');

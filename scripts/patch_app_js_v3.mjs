import fs from 'node:fs';

const filePath = 'public/app.js';
let code = fs.readFileSync(filePath, 'utf8');

// Localizar os limites de openMoleculeSweep
const startMarker = 'async function openMoleculeSweep(molKey, skuId, filialId = null) {';
const endMarker = 'function closeMoleculeSweep() {';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Falha ao localizar openMoleculeSweep em public/app.js');
  process.exit(1);
}

const newOpenMoleculeSweepCode = `async function openMoleculeSweep(molKey, skuId, filialId = null) {
  const modal = document.getElementById('molecule-sweep-modal');
  modal.classList.remove('hidden');

  const banner = document.getElementById('sweep-ia-banner');
  const tbody = document.getElementById('sweep-tbody');
  const actionBar = document.getElementById('sweep-action-bar');
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');
  const matrixContainer = document.getElementById('sweep-matrix-container');
  const matrixHeader = document.getElementById('sweep-matrix-header');
  const matrixCountBadge = document.getElementById('sweep-matrix-count-badge');
  const toggleIcon = document.getElementById('btn-toggle-matrix-icon');
  const toggleText = document.getElementById('btn-toggle-matrix-text');

  // Reset visual do modal
  banner.className = 'sweep-banner info';
  banner.style = '';
  banner.innerHTML = '<strong>Consultando laboratórios, fabricantes e curvas da molécula em tempo real...</strong>';
  tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;" class="muted">Carregando dados da molécula...</td></tr>';
  actionBar.innerHTML = '';
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }
  if (matrixContainer) { matrixContainer.style.display = 'none'; }
  if (toggleIcon) toggleIcon.textContent = '▶';
  if (toggleText) toggleText.textContent = 'Ver Matriz Completa';

  const fId = filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2);

  try {
    const res = await apiGet(\`/api/molecules/sweep?key=\${encodeURIComponent(molKey)}&skuId=\${skuId || 0}&filialId=\${fId || 2}\`);
    const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice, store_analysis, remanejamento_sinergia } = res;

    // 1. Atualizar Título da Modal
    document.getElementById('sweep-modal-title').innerHTML = \`
      <span>🔬 \${esc(toTitleCase(substancia))} \${esc(concentracao)}</span>
      <span class="badge badge-accent">\${esc(forma)} &bull; \${esc(packBucket)}</span>
    \`;

    // Atualizar badge da matriz de fabricantes
    if (matrixCountBadge) matrixCountBadge.textContent = \`\${skus.length} \${skus.length > 1 ? 'marcas' : 'marca'}\`;

    const targetSugUn = Number(targetSku?.total_sugestao_un || targetSku?.sugestao_compra_un || 0);
    const targetSugRs = Number(targetSku?.total_sugestao_rs || targetSku?.sugestao_compra_rs || 0);
    const hasReman = remanejamento_sinergia && remanejamento_sinergia.hasOpportunities;
    const isDeadStock = ia_advice?.type === 'DEAD_STOCK_WARNING';
    const isEnoughStock = ia_advice?.type === 'ENOUGH_STOCK_WARNING';
    const isMargin = ia_advice?.type === 'MARGIN_OPPORTUNITY';

    // 2. Banner Executivo com Ação de 1 Clique (REV-024)
    let masterActionTitle = '';
    let masterActionBtnText = '';
    let masterActionType = '';
    let ecoHighlight = 0;

    if (hasReman) {
      ecoHighlight = remanejamento_sinergia.economiaRemanejamentoRs || targetSugRs;
      masterActionTitle = '🔄 A IA recomenda REMANEJAR INTERNAMENTE (Transfer-First)';
      masterActionBtnText = \`⚡ 1-Clique: Aplicar Remanejamento & Bloquear Compras (\${brl(ecoHighlight)})\`;
      masterActionType = 'REMAN';
    } else if (isDeadStock) {
      ecoHighlight = targetSugRs > 0 ? targetSugRs : (ia_advice.ecoDead || 0);
      masterActionTitle = '🛑 A IA recomenda NÃO COMPRAR na distribuidora agora';
      masterActionBtnText = \`⚡ 1-Clique: Bloquear Compras & Desovar Balcão (\${brl(ecoHighlight)})\`;
      masterActionType = 'BLOCK_ALL';
    } else if (isMargin && cheapestSku) {
      ecoHighlight = ia_advice.economiaTotal || 0;
      masterActionTitle = \`🟢 A IA recomenda TROCAR para \${esc(cheapestSku.labora)} (Menor Custo)\`;
      masterActionBtnText = \`⚡ 1-Clique: Trocar Fabricante (Economizar \${brl(ecoHighlight)})\`;
      masterActionType = 'SWITCH';
    } else if (isEnoughStock) {
      ecoHighlight = ia_advice.ecoDeducao || targetSugRs;
      masterActionTitle = '📉 A IA recomenda DESCONTAR ESTOQUE ALTERNATIVO do pedido';
      masterActionBtnText = \`⚡ 1-Clique: Abater Estoque Existente (\${brl(ecoHighlight)})\`;
      masterActionType = 'DEDUCT';
    } else {
      masterActionTitle = '✓ Molécula Equilibrada na Rede';
      masterActionBtnText = '✓ Liberar Compra Homologada';
      masterActionType = 'KEEP';
    }

    banner.className = 'sweep-banner';
    banner.style = 'background:linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%); border:1.5px solid #f87171; border-radius:12px; padding:14px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.03);';
    if (!isDeadStock && !hasReman && isMargin) {
      banner.style = 'background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border:1.5px solid #60a5fa; border-radius:12px; padding:14px 18px;';
    } else if (!isDeadStock && !hasReman && !isMargin) {
      banner.style = 'background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1.5px solid #86efac; border-radius:12px; padding:14px 18px;';
    }

    banner.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; width:100%;">
        <div style="flex:1; min-width:300px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:14.5px; font-weight:800; color:#0f172a;">\${masterActionTitle}</span>
            \${ecoHighlight > 0 ? \`<span style="background:#15803d; color:#ffffff; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px;">Economia: \${brl(ecoHighlight)}</span>\` : ''}
            \${targetSugUn > 0 ? \`<span style="background:#f1f5f9; color:#334155; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px;">Pedido: \${targetSugUn} un (\${brl(targetSugRs)})</span>\` : ''}
          </div>
          <div style="font-size:12px; color:#334155; margin-top:5px; line-height:1.45;">
            \${isDeadStock ? \`Existem <strong>\${ia_advice.deadTotalQty} un de Curva D (\${esc(ia_advice.deadLabsList)})</strong> paradas na rede e lojas com marcas concorrentes. A prioridade da IA é desovar no balcão e proteger o capital de giro!\`
              : hasReman ? \`O motor localizou estoques excedentes e lotes com validade próxima em lojas doadoras que cobrem a demanda das filiais sem comprar de distribuidoras!\`
              : isMargin ? \`Existe opção idêntica de menor custo homologada (\${esc(cheapestSku.labora)}) gerando economia imediata no pedido.\`
              : 'Estoque distribuído em conformidade com as políticas da rede.'}
          </div>
        </div>

        \${targetSugUn > 0 ? \`
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="btn-master-ia-1click" class="btn btn-primary" type="button" style="font-weight:800; font-size:13px; padding:10px 20px; border-radius:8px; border:none; box-shadow:0 2px 6px rgba(0,0,0,0.15); display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Executa a decisão recomendada da IA para toda a rede em 1 clique">
              <span>\${masterActionBtnText}</span>
            </button>
          </div>
        \` : ''}
      </div>
    \`;

    // 3. Renderizar Filiais com Ação Requerida (MOSTRAR APENAS O QUE DÁ PRA SER FEITO) (REV-024)
    if (storeDiagContainer && store_analysis && store_analysis.length > 0) {
      storeDiagContainer.style.display = 'flex';

      // Filtra estritamente as filiais que têm algo a ser feito
      const actionableStores = store_analysis.filter((st) =>
        st.targetSug > 0 ||
        st.deadEstTotal > 0 ||
        st.veredito === 'DOADORA_EXCESSO' ||
        st.veredito === 'RUPTURA_REAL' ||
        st.veredito === 'BLOQUEAR_COMPRA' ||
        st.veredito === 'DEDUZIR_PARCIAL'
      );
      const neutralStores = store_analysis.filter((st) => !actionableStores.includes(st));

      const isMulti = store_analysis.length > 1;

      storeDiagContainer.innerHTML = \`
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:14px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <div>
              <div style="font-size:13.5px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>🏢 \${isMulti ? 'Filiais que Requerem Ação Direta do Comprador' : 'Diagnóstico da Filial: Ação Recomendada'}</span>
                <span class="badge badge-accent" style="font-size:10.5px;">\${actionableStores.length} \${actionableStores.length > 1 ? 'Lojas com Ação' : 'Loja com Ação'}</span>
              </div>
              <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
                Mostrando apenas lojas com compras sugeridas, excedente ou itens parados. Você pode clicar no botão de cada card ou usar a ação master acima.
              </div>
            </div>
            \${neutralStores.length > 0 ? \`
              <div style="font-size:11px; color:#64748b; background:#f8fafc; padding:4px 10px; border-radius:999px; border:1px solid #e2e8f0;">
                ✓ \${neutralStores.length} \${neutralStores.length > 1 ? 'outras filiais estão equilibradas' : 'outra filial está equilibrada'} (\${neutralStores.map(n => n.short || n.label).join(', ')})
              </div>
            \` : ''}
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:10px;">
            \${actionableStores.map((st) => {
              const isBlock = st.veredito === 'BLOQUEAR_COMPRA';
              const isDeduct = st.veredito === 'DEDUZIR_PARCIAL';
              const isDonor = st.veredito === 'DOADORA_EXCESSO';
              const isDesova = st.veredito === 'DESOVAR_BALCAO';
              const isRupture = st.veredito === 'RUPTURA_REAL';

              const cardBg = isBlock ? '#fff5f5' : isDeduct ? '#fffbeb' : isDonor ? '#faf5ff' : isDesova ? '#fff7ed' : isRupture ? '#eff6ff' : '#f8fafc';
              const cardBorder = isBlock ? '#fca5a5' : isDeduct ? '#fde68a' : isDonor ? '#c4b5fd' : isDesova ? '#fdba74' : isRupture ? '#93c5fd' : '#e2e8f0';
              const badgeBg = isBlock ? '#dc2626' : isDeduct ? '#d97706' : isDonor ? '#7c3aed' : isDesova ? '#ea580c' : isRupture ? '#2563eb' : '#64748b';

              return \`
                <div class="store-action-card" id="card-store-\${st.filial_id}" style="background:\${cardBg}; border:1.5px solid \${cardBorder}; border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                      <span style="font-weight:800; font-size:12.5px; color:#0f172a;">\${esc(st.full_label || st.label)}</span>
                      <span style="background:\${badgeBg}; color:#ffffff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; text-transform:uppercase;">
                        \${st.tituloVeredito}
                      </span>
                    </div>

                    <div style="display:flex; justify-content:space-between; font-size:11px; background:rgba(255,255,255,0.7); padding:5px 8px; border-radius:6px; margin-bottom:6px;">
                      <div>Sugestão: <strong style="color:\${st.targetSug > 0 ? '#b91c1c' : '#334155'};">\${st.targetSug} un</strong> \${st.sugRs > 0 ? \`(\${brl(st.sugRs)})\` : ''}</div>
                      <div>Alt. Estoque: <strong>\${st.altEstTotal} un</strong> <span class="muted">(\${st.cobAltMedia >= 999 ? '999+d' : st.cobAltMedia + 'd'})</span></div>
                    </div>

                    <div style="font-size:11.5px; line-height:1.4; color:#1e293b; margin-bottom:8px;">
                      \${esc(st.orientacao)}
                    </div>
                  </div>

                  <!-- BOTÃO DE AÇÃO DIRETA DENTRO DO CARD -->
                  \${st.targetSug > 0 ? \`
                    <button class="btn btn-sm btn-cancel-card-purchase" data-filial-id="\${st.filial_id}" data-pid="\${targetSku.produto_id}" data-un="\${st.targetSug}" data-rs="\${st.sugRs}" style="width:100%; margin-top:4px; font-weight:700; font-size:11px; padding:6px 10px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:6px; cursor:pointer;" type="button" title="Cancela a compra exclusivamente nesta loja">
                      🚫 Cancelar Compra Desta Filial (-\${st.targetSug} un &bull; Salvar \${brl(st.sugRs)})
                    </button>
                  \` : isDonor ? \`
                    <div style="padding:5px 8px; background:rgba(255,255,255,0.85); border-radius:6px; border:1px dashed #c4b5fd; font-size:11px; font-weight:700; color:#5b21b6; text-align:center;">
                      🚚 Loja disponível para transferir até \${st.surplus || st.altEstTotal} un
                    </div>
                  \` : \`
                    <div style="padding:5px 8px; background:rgba(255,255,255,0.85); border-radius:6px; border:1px dashed \${cardBorder}; font-size:11px; font-weight:700; color:#334155; text-align:center;">
                      💡 Priorizar venda das \${st.deadEstTotal} un no balcão
                    </div>
                  \`}
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }

    // 4. Renderizar Sinergia com Remanejamento (Transfer-First) se houver
    if (remanSynergyContainer && hasReman) {
      remanSynergyContainer.style.display = 'flex';
      const routes = remanejamento_sinergia.routes || [];

      remanSynergyContainer.innerHTML = \`
        <div style="background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border:1.5px solid #a78bfa; border-radius:12px; padding:12px 16px; box-shadow:0 2px 5px rgba(124,58,237,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="font-size:13.5px; font-weight:800; color:#5b21b6; display:flex; align-items:center; gap:8px;">
              <span>🔄 Oportunidades de Remanejamento Interno: Transfer-First</span>
              <span class="badge" style="background:#7c3aed; color:#fff; font-size:10px;">\${routes.length} Rotas</span>
            </div>
            <span style="background:#15803d; color:#ffffff; font-size:11px; font-weight:800; padding:2px 10px; border-radius:999px;">
              Economia: \${brl(remanejamento_sinergia.economiaRemanejamentoRs)}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:8px;">
            \${routes.map((r) => \`
              <div style="background:#ffffff; border:1px solid #c4b5fd; border-radius:8px; padding:8px 10px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:800; color:#4338ca;">🚚 \${esc(r.from_label)} ➔ \${esc(r.to_label)}</div>
                  <div style="color:#0f172a; margin-top:2px;"><strong>\${r.qty} un</strong> &bull; \${esc(r.produto_desc || r.labora)}</div>
                  <div class="muted" style="font-size:10.5px;">\${esc(r.motivo)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:800; color:#15803d;">\${brl(r.economia_rs)}</div>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    // 5. Configurar Toggle da Matriz de Auditoria (Expansível / Accordion)
    if (matrixHeader && matrixContainer) {
      matrixHeader.onclick = () => {
        const isHidden = matrixContainer.style.display === 'none';
        matrixContainer.style.display = isHidden ? 'block' : 'none';
        if (toggleIcon) toggleIcon.textContent = isHidden ? '▼' : '▶';
        if (toggleText) toggleText.textContent = isHidden ? 'Ocultar Matriz' : 'Ver Matriz Completa';
      };
    }

    // 6. Preencher a Matriz de Laboratórios (Tabela Completa de Auditoria)
    const activeFiliaisList = (res.filiais && res.filiais.length > 0)
      ? res.filiais
      : (state.overview?.filiaisPolicies || []).filter((p) => Number(p.filial_id) !== 1).map((p) => ({
          filial_id: Number(p.filial_id),
          label: formatFilialTag(p.filial_id, p.nome_reduz, p.nome_loja),
          short: \`L\${String(p.filial_id).padStart(2, '0')} (\${p.nome_reduz || \`F\${p.filial_id}\`})\`
        }));

    const isMultiStore = activeFiliaisList.length > 1;
    const thead = document.getElementById('sweep-thead');

    if (thead) {
      let storeColsHeader = '';
      if (isMultiStore) {
        storeColsHeader = activeFiliaisList.map((f, i) => {
          const bg = i === 0 ? '#eff6ff' : i === 1 ? '#f5f3ff' : '#fefce8';
          const color = i === 0 ? '#1e40af' : i === 1 ? '#5b21b6' : '#854d0e';
          return \`<th class="num" style="background:\${bg}; color:\${color}; min-width:90px;">\${esc(f.short || f.label)}</th>\`;
        }).join('') + \`<th class="num" style="background:#f1f5f9; color:#0f172a; font-weight:700; border-right:1px solid #cbd5e1; min-width:100px;">TOTAL REDE</th>\`;
      } else {
        const s = activeFiliaisList[0];
        storeColsHeader = \`<th class="num" style="background:#eff6ff; color:#1e40af; min-width:115px;">Estoque (\${esc(s.short || s.label)})</th>\`;
      }

      thead.innerHTML = \`
        <tr style="background: var(--bg-subtle);">
          <th style="min-width:140px;">Laboratório</th>
          <th style="min-width:210px;">Apresentação</th>
          <th style="min-width:105px;">Curva &amp; Giro</th>
          \${storeColsHeader}
          <th class="num" style="min-width:85px;">Último Custo</th>
          <th style="text-align:center; min-width:110px;">Ação</th>
        </tr>
      \`;
    }

    tbody.innerHTML = skus.map((s) => {
      const isTarget = targetSku && s.produto_id === targetSku.produto_id;
      const isCheapest = cheapestSku && s.produto_id === cheapestSku.produto_id;
      const isCurvaD = s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '');
      const isCurvaA = s.abc_class === 'A' || /A/i.test(s.curva_erp_classe || '');
      const isCurvaB = s.abc_class === 'B' || /B/i.test(s.curva_erp_classe || '');
      const badgeStyle = isCurvaA ? 'background:#dcfce7;color:#15803d;' : isCurvaB ? 'background:#e0f2fe;color:#0369a1;' : isCurvaD ? 'background:#fee2e2;color:#b91c1c;' : 'background:#fef3c7;color:#92400e;';
      const badgeLabel = \`Curva \${s.abc_class || 'D'}\`;
      const giroLabel = Number(s.total_ddv) > 0 ? \`\${num(s.total_ddv, 2)}/d\` : 'Sem Giro';
      const isDead = isCurvaD && Number(s.total_estoque) > 0;
      const cobStr = (d) => (Number(d) >= 999 ? '999+d' : \`\${num(d, 1)}d\`);

      const storeCellsHtml = activeFiliaisList.map((f, i) => {
        const l = (s.lojas && s.lojas[f.filial_id]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0 };
        const bg = i === 0 ? 'rgba(239,246,255,0.4)' : i === 1 ? 'rgba(245,243,255,0.4)' : 'rgba(254,252,232,0.4)';
        return \`
          <td class="num" style="background:\${bg}; font-size:11px;">
            <div><strong>\${num(l.estoque_atual)} un</strong> <span class="muted" style="font-size:9.5px;">(\${cobStr(l.cobertura_dias)})</span></div>
            \${l.sugestao_compra_un > 0 ? \`<div style="color:var(--accent);font-weight:700;font-size:9.5px;margin-top:1px;">🛒 \${num(l.sugestao_compra_un)} un</div>\` : ''}
          </td>
        \`;
      }).join('');

      const totalRedeCell = isMultiStore
        ? \`
          <td class="num" style="background:#f8fafc; font-weight:700; border-right:1px solid #cbd5e1; font-size:11.5px;">
            <div>\${num(s.total_estoque)} un</div>
            <div class="muted" style="font-size:9.5px; font-weight:normal;">(\${cobStr(s.cobertura_rede)})</div>
            \${s.total_sugestao_un > 0 ? \`<div style="color:var(--accent);font-weight:700;font-size:10px;">🛒 \${num(s.total_sugestao_un)} un</div>\` : ''}
          </td>
        \`
        : '';

      return \`
        <tr class="sweep-sku-row \${isTarget ? 'is-target' : ''} \${isCheapest ? 'is-cheapest' : ''} \${isDead ? 'is-dead' : ''}">
          <td>
            <div style="font-weight:700; color:#0f172a;">\${esc(s.labora || 'Outro')}</div>
            <div style="margin-top:1px;">
              \${isTarget ? ' <span class="badge badge-accent" style="font-size:9px;padding:1px 4px;">Item Alvo</span>' : ''}
              \${isCheapest ? ' <span class="badge badge-success" style="font-size:9px;padding:1px 4px;">Menor Custo</span>' : ''}
            </div>
          </td>
          <td>
            <div style="font-weight:600; color:#1e293b; font-size:11.5px;">\${esc(s.descricao)}</div>
            <div class="muted" style="font-size:10px;">Cód BIG: \${s.produto_id} &bull; EAN \${esc(s.barras || '—')}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span class="badge" style="font-size:9.5px;font-weight:700;\${badgeStyle}">\${badgeLabel}</span>
              \${isDead ? '<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:8.5px;font-weight:700;">💤 Parado</span>' : ''}
            </div>
          </td>
          \${storeCellsHtml}
          \${totalRedeCell}
          <td class="num">
            <div style="font-weight:700; font-size:11.5px;">\${brl(s.custo_unit)}</div>
          </td>
          <td style="text-align:center;">
            \${!isTarget && s.custo_unit > 0 && targetSku && targetSugUn > 0 ? \`
              <button class="btn btn-secondary btn-sm btn-action-switch" data-source-id="\${targetSku.produto_id}" data-target-id="\${s.produto_id}" data-qty="\${targetSugUn}" data-target-name="\${esc(s.descricao)}" type="button" style="padding:3px 7px;font-size:10.5px;font-weight:600;">
                Trocar p/ Este
              </button>
            \` : isDead ? \`
              <span class="badge" style="background:#fee2e2;color:#991b1b;font-size:9px;">Desovar Balcão</span>
            \` : isTarget ? \`
              <span class="badge badge-accent" style="font-size:9px;">Item Demandado</span>
            \` : '—'}
          </td>
        </tr>
      \`;
    }).join('');

    // 7. Barra Inferior de Opções Adicionais
    actionBar.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:700; color:var(--text);">Opções Complementares:</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          \${(ia_advice && ia_advice.canDiscount && otherStockTotal > 0) ? \`
            <button id="btn-sweep-discount" class="btn btn-secondary btn-sm" type="button" style="font-weight:600; font-size:11.5px;" title="Abate as unidades existentes da sugestão do pedido">
              📉 Abater Apenas Unidades Paradas
            </button>
          \` : ''}
          <button id="btn-sweep-keep" class="btn btn-ghost btn-sm" type="button" style="font-weight:600; font-size:11.5px; border:1px solid #cbd5e1; border-radius:6px;" title="Mantém a compra do produto original homologado e o libera para a Sugestão de Compra">
            ⚪ Manter Compra Original
          </button>
          <button id="btn-sweep-teach-ia" class="btn btn-secondary btn-sm" type="button" style="padding:6px 10px; font-size:11px;" title="Corrigir apresentação farmacológica ou princípio ativo desta molécula">
            🧠 Ensinar IA
          </button>
        </div>
      </div>
    \`;

    // 8. Vincular Ação Master 1-Clique
    const btnMaster1Click = document.getElementById('btn-master-ia-1click');
    if (btnMaster1Click && targetSku) {
      btnMaster1Click.onclick = async () => {
        btnMaster1Click.disabled = true;
        btnMaster1Click.innerHTML = '<span>⏳</span><span>Executando Solução da IA...</span>';
        try {
          const blockedStores = (store_analysis || []).filter((s) => s.veredito === 'BLOQUEAR_COMPRA' || s.veredito === 'DEDUZIR_PARCIAL');
          const res = await apiPost('/api/curadoria/decision', {
            action: 'EXECUTE_IA_1CLICK',
            filial_id: 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            blockedStores,
            routes: remanejamento_sinergia?.routes || [],
            deductQty: ia_advice?.dedQty || 0,
            target_sku_id: cheapestSku?.produto_id || null,
          });
          showBanner(\`✓ \${res.message || 'Solução da IA executada com sucesso em 1 clique!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(\`Erro ao executar solução da IA: \${err.message}\`, true);
          btnMaster1Click.disabled = false;
        }
      };
    }

    // 9. Vincular Ações Diretas em Cada Card de Loja (REV-024)
    document.querySelectorAll('.btn-cancel-card-purchase').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const fIdTarget = Number(btn.dataset.filialId);
        const pIdTarget = Number(btn.dataset.pid);
        const un = btn.dataset.un;
        const rs = btn.dataset.rs;
        btn.disabled = true;
        btn.textContent = 'Cancelando...';
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'CANCEL_STORE_PURCHASE',
            filial_id: fIdTarget,
            produto_id: pIdTarget,
            molecule_key: molKey,
            descricao: targetSku?.descricao,
            motivo: \`Cancelada compra de \${un} un (R$ \${rs}) da filial \${fIdTarget} via card de curadoria\`
          });
          showBanner(\`✓ \${res.message || 'Compra da filial cancelada com sucesso!'}\`);
          const card = document.getElementById(\`card-store-\${fIdTarget}\`);
          if (card) {
            card.style.background = '#f0fdf4';
            card.style.borderColor = '#86efac';
            card.innerHTML = \`
              <div style="font-weight:800; color:#15803d; font-size:12px; display:flex; align-items:center; gap:6px;">
                <span>✓ Compra Cancelada com Sucesso</span>
              </div>
              <div style="font-size:11px; color:#166534; margin-top:4px;">
                A compra de \${un} un desta filial foi zerada. Economia de R$ \${Number(rs).toFixed(2)} garantida no caixa!
              </div>
            \`;
          }
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(\`Erro ao cancelar compra da filial: \${err.message}\`, true);
          btn.disabled = false;
          btn.textContent = 'Tentar Novamente';
        }
      };
    });

    // 10. Vincular Botões Secundários
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
        } catch (err) {
          showBanner(\`Erro ao descontar: \${err.message}\`, true);
          btnDiscount.disabled = false;
        }
      };
    }

    const btnKeep = document.getElementById('btn-sweep-keep');
    if (btnKeep && targetSku) {
      btnKeep.onclick = async () => {
        btnKeep.disabled = true;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'KEEP',
            filial_id: targetSku.filial_id || fId || 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            motivo: 'Comprador manteve compra original homologada'
          });
          showBanner(\`✓ \${res.message || 'Compra homologada e liberada para Sugestão de Compra!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao homologar: \${err.message}\`, true);
          btnKeep.disabled = false;
        }
      };
    }

    const btnTeachIa = document.getElementById('btn-sweep-teach-ia');
    if (btnTeachIa) {
      btnTeachIa.onclick = () => {
        closeMoleculeSweep();
        openTeachMoleculeModal({
          produto_id: targetSku?.produto_id || 0,
          descricao: targetSku?.descricao || '',
          substancia: substancia || '',
          concentracao: concentracao || '',
          forma: forma || 'CPR',
          pack_bucket: packBucket || '30UN',
        });
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
            qty,
            molecule_key: molKey,
            descricao: targetSku?.descricao,
            labora_origem: targetSku?.labora,
            labora_proposto: targetName,
            motivo: \`Troca homologada para laboratório \${targetName}\`
          });
          showBanner(\`✓ \${res.message || 'Troca de laboratório realizada com sucesso!'}\`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
        } catch (err) {
          showBanner(\`Erro ao trocar laboratório: \${err.message}\`, true);
        }
      };
    });

  } catch (err) {
    banner.className = 'sweep-banner error';
    banner.innerHTML = \`<strong>Erro ao carregar molécula:</strong> \${esc(err.message)}\`;
    tbody.innerHTML = \`<tr><td colspan="12" style="text-align:center;color:var(--danger);padding:24px;">\${esc(err.message)}</td></tr>\`;
  }
}

`;

const updatedCode = code.slice(0, startIdx) + newOpenMoleculeSweepCode + code.slice(endIdx);
fs.writeFileSync(filePath, updatedCode, 'utf8');
console.log('public/app.js atualizado com sucesso com o novo openMoleculeSweep!');

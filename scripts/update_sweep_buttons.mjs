import fs from 'fs';
import path from 'path';

const appJsPath = path.resolve('public/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

const idx = content.indexOf('const btnSuspendDead = document.getElementById');
const idxTeach = content.indexOf('const btnTeachIa = document.getElementById(\'btn-sweep-teach-ia\');');

if (idx === -1 || idxTeach === -1) {
  console.error('Could not find buttons block in openMoleculeSweep');
  process.exit(1);
}

const newButtons = `const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');
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
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
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
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
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
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
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
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
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
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(\`Erro ao homologar: \${err.message}\`, true);
          btnKeep.disabled = false;
        }
      };
    }

    `;

content = content.substring(0, idx) + newButtons + content.substring(idxTeach);
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('SUCCESS: sweep buttons updated with curadoria decisions!');

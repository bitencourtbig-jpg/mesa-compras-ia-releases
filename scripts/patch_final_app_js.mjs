import fs from 'fs';

const filePath = 'public/app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. In fetch of loadTransfers:
content = content.replace(
  `const [routesData, remanData] = await Promise.all([
    apiGet(\`/api/remanejamento/routes\${queryStr}\`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [] })),
    apiGet(\`/api/remanejamento\${state.selectedFilial && state.selectedFilial !== 'all' ? \`?filial_id=\${state.selectedFilial}\` : ''}\`).catch(() => ({ transfers: [], expiringLots: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  const expiringLots = remanData.expiringLots || [];`,
  `const [routesData, remanData] = await Promise.all([
    apiGet(\`/api/remanejamento/routes\${queryStr}\`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [] })),
    apiGet(\`/api/remanejamento\${state.selectedFilial && state.selectedFilial !== 'all' ? \`?filial_id=\${state.selectedFilial}\` : ''}\`).catch(() => ({ transfers: [], expiringLots: [], curadoriaDecisions: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  currentActiveTransfers = activeTransfers;
  const expiringLots = remanData.expiringLots || [];
  const curadoriaDecisions = remanData.curadoriaDecisions || [];`
);

// 2. In motor-transfers-tbody:
content = content.replace(
  `<td style="display:flex;gap:6px;align-items:center;">
              \${nextActionBtn}
              <button class="btn btn-ghost btn-xs btn-view-transfer-items" data-id="\${t.id}" title="Ver itens desta guia">📦 Itens</button>
            </td>`,
  `<td style="display:flex;gap:6px;align-items:center;justify-content:center;">
              <a href="/api/remanejamento/export-excel?transferId=\${t.id}" class="btn btn-secondary btn-xs" style="color:#0f766e;font-weight:700;" title="Baixar Romaneio de Separação e Carga em Excel">📥 Romaneio Excel</a>
              \${nextActionBtn}
              <button class="btn btn-ghost btn-xs btn-view-transfer-items" data-id="\${t.id}" title="Ver itens desta carga">📦 Ver Itens</button>
            </td>`
);

// 3. In expiring-tbody:
const targetExpOld = `expTbody.innerHTML = expiringLots.map(l => \`
        <tr>
          <td><span class="badge badge-neutral">Loja \${l.filial_id}</span></td>
          <td>
            <div class="sku-title" style="font-weight:600;">\${esc(l.descricao || \`Produto \${l.produto_id}\`)}</div>
            <div class="sku-sub">Cód BIG: \${l.produto_id}</div>
          </td>
          <td class="num"><code>\${l.menor_validade || '—'}</code></td>
          <td class="num">\${num(l.qtd_vencendo_90d)} un</td>
          <td class="num"><strong style="color:var(--danger);">${'${num(l.qtd_vencido)}'} un</strong></td>
          <td class="num"><strong>\${brl(l.valor_risco_rs)}</strong></td>
          <td class="num">\${badgeForException(l.acao_recomendada)}</td>
        </tr>
      \`).join('');`;

const targetExpNew = `expTbody.innerHTML = expiringLots.map(l => {
        const dVal = l.menor_validade ? l.menor_validade.split('-').reverse().join('/') : '—';
        const isVencido = Number(l.qtd_vencido || 0) > 0;
        const isVencendo = Number(l.qtd_vencendo_90d || 0) > 0;

        let opActions = '';
        if (isVencido) {
          opActions = \`
            <span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:800;font-size:9.5px;">🚨 LOTE VENCIDO</span>
            <button class="btn btn-secondary btn-xs btn-fefo-op" data-id="\${l.produto_id}" data-filial="\${l.filial_id}" data-desc="\${esc(l.descricao)}" data-acao="SEGREGA_DEVOLUCAO" style="color:#991b1b;font-weight:700;margin-left:4px;">
              🚫 Segregar Devolução
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

content = content.replace(targetExpOld, targetExpNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done updating public/app.js with final reman fixes!');

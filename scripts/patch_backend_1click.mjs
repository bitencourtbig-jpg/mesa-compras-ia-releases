import fs from 'node:fs';

const filePath = 'src/server.mjs';
let code = fs.readFileSync(filePath, 'utf8');

const targetBeforeSwitch = `      if (action === 'SWITCH') {`;

const newActionsCode = `      // REV-024: Ação direta em card individual de filial
      if (action === 'CANCEL_STORE_PURCHASE') {
        const pId = Number(produto_id);
        const fId = Number(filial_id);
        const reason = motivo || 'Compra da filial cancelada na Curadoria IA por estoque concorrente existente';

        db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ? AND filial_id = ?')
          .run(reason, latestRun.id, pId, fId);

        recordSkuSuspension(clientCode, fId, pId, {
          descricao: descricao || '',
          motivo: reason,
          days: 30,
          origem: 'CURADORIA_CARD_CANCEL',
          moleculeKey: molecule_key,
          gatilhoCobertura: 7.0,
        });

        recordBuyerLearning(clientCode, {
          filial_id: fId,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL',
          motivo: reason,
          acao_futura: 'BLOQUEAR_COMPRA_FILIAL',
        });

        return sendJson(res, 200, {
          ok: true,
          message: \`Compra da filial L0\${fId} cancelada com sucesso! Economia de caixa garantida.\`
        });
      }

      // REV-024: Master Ação da IA em 1 Clique
      if (action === 'EXECUTE_IA_1CLICK') {
        const pId = Number(produto_id);
        const { blockedStores = [], routes = [], deductQty = 0, target_sku_id = null } = body;
        let totalCanceladoUn = 0;
        let totalEconomizadoRs = 0;

        db.exec('BEGIN');
        try {
          // 1. Se houver lojas bloqueadas por excesso de concorrentes
          for (const b of blockedStores) {
            const bFId = Number(b.filial_id);
            const r = db.prepare('SELECT sugestao_compra_un, sugestao_compra_rs FROM engine_sku_results WHERE run_id = ? AND produto_id = ? AND filial_id = ?').get(latestRun.id, pId, bFId);
            if (r) {
              totalCanceladoUn += Number(r.sugestao_compra_un || 0);
              totalEconomizadoRs += Number(r.sugestao_compra_rs || 0);
            }
            db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ? AND filial_id = ?')
              .run(\`Solução IA 1-Clique: Compra cancelada (estoque de concorrente ou Curva D parado na rede)\`, latestRun.id, pId, bFId);

            recordSkuSuspension(clientCode, bFId, pId, {
              descricao: descricao || '',
              motivo: \`Solução IA 1-Clique: compra cancelada para priorizar desova e proteger caixa\`,
              days: 30,
              origem: 'CURADORIA_1CLICK_ACTION',
              moleculeKey: molecule_key,
              gatilhoCobertura: 7.0,
            });
          }

          // 2. Se houver rotas de remanejamento
          for (const r of routes) {
            const destFId = Number(r.to_filial_id);
            const qty = Number(r.qty || 0);
            if (qty > 0) {
              db.prepare(\`
                UPDATE engine_sku_results
                SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
                    sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
                    justificativa_ia = ?
                WHERE run_id = ? AND produto_id = ? AND filial_id = ?
              \`).run(qty, qty, \`Suprido via Remanejamento 1-Clique (\${qty} un de \${r.from_label}) - Transfer-First\`, latestRun.id, pId, destFId);
            }
          }

          // 3. Se for apenas dedução simples de estoque parado
          if (blockedStores.length === 0 && routes.length === 0 && deductQty > 0) {
            const sugRows = db.prepare('SELECT filial_id, sugestao_compra_un, custo_unit FROM engine_sku_results WHERE run_id = ? AND produto_id = ? AND sugestao_compra_un > 0').all(latestRun.id, pId);
            let remToDeduct = deductQty;
            for (const row of sugRows) {
              if (remToDeduct <= 0) break;
              const d = Math.min(remToDeduct, row.sugestao_compra_un);
              const newSug = row.sugestao_compra_un - d;
              const newRs = Math.round(newSug * row.custo_unit * 100) / 100;
              db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = ?, sugestao_compra_rs = ?, justificativa_ia = ? WHERE run_id = ? AND produto_id = ? AND filial_id = ?')
                .run(newSug, newRs, \`Abatidas \${d} un via Solução IA 1-Clique considerando produto alternativo parado\`, latestRun.id, pId, row.filial_id);
              remToDeduct -= d;
              totalCanceladoUn += d;
              totalEconomizadoRs += Math.round(d * row.custo_unit * 100) / 100;
            }
          }

          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }

        recordBuyerLearning(clientCode, {
          filial_id: 0,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'EXECUTOU_SOLUCAO_IA_1CLIQUE',
          motivo: \`Executada recomendação completa da IA em 1 clique (Cancelou \${totalCanceladoUn} un, Economizou R$ \${totalEconomizadoRs.toFixed(2)})\`,
          acao_futura: 'SEMPRE_SEGUIR_IA_REMANEJAMENTO_E_SOBREESTOQUE',
        });

        return sendJson(res, 200, {
          ok: true,
          message: \`Solução da IA executada com sucesso em 1 clique! Economia de R$ \${totalEconomizadoRs.toFixed(2)} retida no caixa.\`,
          totalCanceladoUn,
          totalEconomizadoRs
        });
      }

      if (action === 'SWITCH') {`;

if (!code.includes("action === 'CANCEL_STORE_PURCHASE'")) {
  code = code.replace(targetBeforeSwitch, newActionsCode);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('src/server.mjs atualizado com CANCEL_STORE_PURCHASE e EXECUTE_IA_1CLICK!');
} else {
  console.log('src/server.mjs já continha CANCEL_STORE_PURCHASE');
}

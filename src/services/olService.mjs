import { getAnalyticsDb, getOlFabricantes, upsertOlFabricante, getLatestBudgetSummary } from '../store/analyticsDb.mjs';

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

/**
 * Retorna todos os fabricantes configurados com OL para o cliente.
 */
export function listOlFabricantes(clientCode) {
  return getOlFabricantes(clientCode);
}

/**
 * Salva ou atualiza a política comercial de uma OL de fabricante.
 */
export function saveOlFabricante(clientCode, data) {
  return upsertOlFabricante(clientCode, data);
}

/**
 * Retorna visão consolidada de todas as OLs para o Dashboard dedicado de Operações Logísticas:
 * Status de atingimento de pedido mínimo, valor atual de sugestão do motor e oportunidades de complementação.
 */
export function getOlDashboardOverview(clientCode, filialId = null) {
  const olList = getOlFabricantes(clientCode);
  const db = getAnalyticsDb();
  const lastRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);

  const budget = getLatestBudgetSummary(clientCode);
  const saldoLivreOtb = Number(budget?.saldo_livre_rs || 0);

  const hasFilial = filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0;
  const filialWhere = hasFilial ? ` AND filial_id = ${Number(filialId)}` : '';

  // Mapeia totais sugeridos por laboratório no último run
  const labTotals = new Map();
  if (lastRun) {
    const rows = db.prepare(`
      SELECT UPPER(COALESCE(labora, '')) as lab,
             COUNT(*) as skus_total,
             SUM(CASE WHEN sugestao_compra_un > 0 THEN 1 ELSE 0 END) as skus_comprar,
             SUM(CASE WHEN sugestao_compra_un > 0 THEN sugestao_compra_rs ELSE 0 END) as total_sugerido_rs
      FROM engine_sku_results
      WHERE run_id = ?${filialWhere}
      GROUP BY lab
    `).all(lastRun.id);

    for (const r of rows) {
      labTotals.set(r.lab, {
        skus_total: Number(r.skus_total || 0),
        skus_comprar: Number(r.skus_comprar || 0),
        total_sugerido_rs: round2(r.total_sugerido_rs || 0)
      });
    }
  }

  const items = [];
  let prontosCount = 0;
  let complementaveisCount = 0;
  let semDemandaCount = 0;
  let economiaTotalEstimada = 0;

  for (const ol of olList) {
    const fabUpper = (ol.fabricante_nome || '').toUpperCase();
    let totalSugerido = 0;
    let skusComprar = 0;

    for (const [lab, data] of labTotals.entries()) {
      if (lab.includes(fabUpper) || fabUpper.includes(lab)) {
        totalSugerido += data.total_sugerido_rs;
        skusComprar += data.skus_comprar;
      }
    }
    totalSugerido = round2(totalSugerido);

    const minRs = Number(ol.pedido_minimo_rs || 3000);
    const atingiu = totalSugerido >= minRs;
    const faltamRs = Math.max(0, round2(minRs - totalSugerido));

    let status = 'SEM_DEMANDA';
    if (atingiu) {
      status = 'MINIMO_ATINGIDO';
      prontosCount++;
      economiaTotalEstimada += round2(totalSugerido * (Number(ol.desconto_extra_pct || 10) / 100));
    } else if (totalSugerido > 0 || (minRs > 0 && faltamRs <= minRs * 0.75)) {
      status = 'COMPLEMENTAVEL';
      complementaveisCount++;
    } else {
      semDemandaCount++;
    }

    items.push({
      id: ol.id,
      fabricante: ol.fabricante_nome,
      tipo_canal: ol.tipo_canal || 'OL',
      categoria: ol.observacao || 'Medicamentos & Mix Farma',
      pedido_minimo_rs: minRs,
      desconto_extra_pct: Number(ol.desconto_extra_pct || 10),
      prazo_medio_dias: Number(ol.prazo_medio_dias || 45),
      lead_time_dias: Number(ol.lead_time_dias || 14),
      horizonte_cobertura_dias: Number(ol.horizonte_cobertura_dias || 21),
      ativo: Boolean(ol.ativo),
      total_sugerido_rs: totalSugerido,
      skus_comprar: skusComprar,
      atingiu_minimo: atingiu,
      faltam_rs: faltamRs,
      status
    });
  }

  const order = { 'MINIMO_ATINGIDO': 1, 'COMPLEMENTAVEL': 2, 'SEM_DEMANDA': 3 };
  items.sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9) || b.total_sugerido_rs - a.total_sugerido_rs);

  return {
    items,
    kpis: {
      totalAtivos: olList.filter(o => o.ativo).length,
      prontos: prontosCount,
      complementaveis: complementaveisCount,
      semDemanda: semDemandaCount,
      economiaTotalEstimada: round2(economiaTotalEstimada),
      saldoLivreOtb
    }
  };
}

/**
 * Motor Consultor de Compras OL com Inteligência Artificial:
 * Avalia se o fabricante selecionado opera via OL, confere se atinge o pedido mínimo,
 * calcula a complementação cirúrgica em produtos de alto giro sem gerar excesso de estoque,
 * e valida a trava da dotação orçamentária (OTB).
 */
export function analyzeOlOpportunity(clientCode, { fabricante, runId = null, filialId = null }) {
  const db = getAnalyticsDb();
  const fabNorm = String(fabricante || '').trim().toUpperCase();
  if (!fabNorm) {
    return { hasOl: false, message: 'Nenhum fabricante especificado.' };
  }

  // 1. Busca configuração da OL
  const olList = getOlFabricantes(clientCode);
  const olConfig = olList.find(
    (o) => o.ativo && (o.fabricante_nome.toUpperCase() === fabNorm || fabNorm.includes(o.fabricante_nome.toUpperCase()) || o.fabricante_nome.toUpperCase().includes(fabNorm))
  );

  if (!olConfig) {
    return {
      hasOl: false,
      fabricante: fabNorm,
      message: `Fabricante ${fabNorm} não possui política de OL cadastrada.`
    };
  }

  // 2. Busca último run se não fornecido
  let targetRunId = runId;
  if (!targetRunId) {
    const lastRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);
    if (!lastRun) return { hasOl: true, olConfig, error: 'Nenhuma execução do motor encontrada.' };
    targetRunId = lastRun.id;
  }

  const hasFilial = filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0;
  const filialWhere = hasFilial ? ` AND filial_id = ${Number(filialId)}` : '';

  // 3. Busca os SKUs do fabricante nesta execução
  const skus = db.prepare(`
    SELECT produto_id, filial_id, descricao, barras, labora, macro_categoria,
           abc_class, xyz_class, preco_venda, custo_unit, estoque_atual, estoque_max,
           ddv_projetada, sugestao_compra_un, sugestao_compra_rs, transito_real,
           cobertura_dias
    FROM engine_sku_results
    WHERE run_id = ? AND UPPER(COALESCE(labora, '')) LIKE ?${filialWhere}
  `).all(targetRunId, `%${olConfig.fabricante_nome}%`);

  if (skus.length === 0) {
    return {
      hasOl: true,
      olConfig,
      totalSugeridoRs: 0,
      atingiuMinimo: false,
      faltamRs: Number(olConfig.pedido_minimo_rs),
      message: `Nenhum SKU encontrado no mix para o fabricante ${olConfig.fabricante_nome}.`
    };
  }

  // 4. Calcula total de compra sugerido originalmente pelo motor
  const skusComSugestao = skus.filter(s => Number(s.sugestao_compra_un) > 0);
  const totalSugeridoRs = round2(skusComSugestao.reduce((acc, s) => acc + Number(s.sugestao_compra_rs || 0), 0));
  const pedidoMinimoRs = Number(olConfig.pedido_minimo_rs || 3000);
  const atingiuMinimo = totalSugeridoRs >= pedidoMinimoRs;
  const faltamRs = Math.max(0, round2(pedidoMinimoRs - totalSugeridoRs));

  // 5. Complementação Cirúrgica IA (se faltar verba para atingir o mínimo)
  const itensComplemento = [];
  let valorComplementadoRs = 0;

  if (faltamRs > 0) {
    // Candidatos: Curva A primeiro, depois B, depois C; com giro (ddv > 0) e espaço abaixo do estoque máximo
    const candidatos = skus
      .map(s => {
        const estAtual = Number(s.estoque_atual || 0);
        const sugAtual = Number(s.sugestao_compra_un || 0);
        const transito = Number(s.transito_real || 0);
        const estMax = Number(s.estoque_max || 0);
        const espaco = Math.max(0, estMax - (estAtual + sugAtual + transito));
        const ddv = Number(s.ddv_projetada || 0);
        const custo = Number(s.custo_unit || 0);
        return {
          ...s,
          espaco_estoque: espaco,
          ddv,
          custo,
          curvaWeight: s.abc_class === 'A' ? 3 : (s.abc_class === 'B' ? 2 : 1)
        };
      })
      .filter(c => c.custo > 0 && c.ddv > 0 && c.espaco_estoque >= 1)
      .sort((a, b) => b.curvaWeight - a.curvaWeight || b.ddv - a.ddv || a.cobertura_dias - b.cobertura_dias);

    let restanteParaAtingir = faltamRs;

    for (const cand of candidatos) {
      if (restanteParaAtingir <= 0) break;

      // Limita ao espaço máximo seguro de estoque
      const qtdNecessaria = Math.ceil(restanteParaAtingir / cand.custo);
      const qtdComplemento = Math.min(cand.espaco_estoque, qtdNecessaria);

      if (qtdComplemento > 0) {
        const valComp = round2(qtdComplemento * cand.custo);
        valorComplementadoRs = round2(valorComplementadoRs + valComp);
        restanteParaAtingir = round2(restanteParaAtingir - valComp);

        itensComplemento.push({
          produto_id: cand.produto_id,
          filial_id: cand.filial_id,
          descricao: cand.descricao,
          barras: cand.barras,
          abc_class: cand.abc_class,
          custo_unit: cand.custo,
          ddv_projetada: cand.ddv,
          estoque_atual: cand.estoque_atual,
          estoque_max: cand.estoque_max,
          unidades_original: cand.sugestao_compra_un,
          unidades_complemento: qtdComplemento,
          unidades_total_ol: cand.sugestao_compra_un + qtdComplemento,
          valor_complemento_rs: valComp,
          valor_total_ol_rs: round2((cand.sugestao_compra_un + qtdComplemento) * cand.custo)
        });
      }
    }
  }

  // 6. Trava de Dotação Orçamentária (OTB)
  const budget = getLatestBudgetSummary(clientCode);
  const totalPedidoOlRs = round2(totalSugeridoRs + valorComplementadoRs);
  let otbSeguro = true;
  let saldoLivreGeral = 0;
  if (budget) {
    saldoLivreGeral = Number(budget.saldo_livre_rs || 0);
    if (totalPedidoOlRs > saldoLivreGeral) {
      otbSeguro = false;
    }
  }

  // 7. Estimativa de Economia Adicional vs Distribuidora
  const economiaAdicionalRs = round2(totalPedidoOlRs * (Number(olConfig.desconto_extra_pct || 10) / 100));

  // 8. Mensagem do Consultor IA
  let recomendacaoIa = '';
  if (atingiuMinimo) {
    recomendacaoIa = `✓ Pedido Mínimo da OL atingido diretamente! A sugestão natural de compra atinge R$ ${totalSugeridoRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, gerando uma economia estimada de R$ ${economiaAdicionalRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+${olConfig.desconto_extra_pct}% de margem) frente à distribuidora.`;
  } else if (valorComplementadoRs >= faltamRs) {
    recomendacaoIa = `💡 Oportunidade Estratégica OL: A compra natural somava R$ ${totalSugeridoRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (faltavam R$ ${faltamRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para o mínimo de R$ ${pedidoMinimoRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). A IA selecionou cirurgicamente ${itensComplemento.length} produtos de Curva A/B com giro imediato para atingir o mínimo SEM ultrapassar o estoque máximo das lojas.`;
  } else {
    recomendacaoIa = `⚠️ Demanda atual insuficiente para OL: Faltam R$ ${faltamRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e o mix ativo com espaço seguro em estoque permite complementar apenas R$ ${valorComplementadoRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Recomenda-se comprar via distribuidora ou aguardar o próximo ciclo quinzenal para evitar excesso.`;
  }

  return {
    hasOl: true,
    olConfig,
    totalSugeridoRs,
    pedidoMinimoRs,
    atingiuMinimo,
    faltamRs,
    itensComplemento,
    valorComplementadoRs,
    totalFinalOlRs: totalPedidoOlRs,
    economiaAdicionalRs,
    otbSeguro,
    saldoLivreOtb: saldoLivreGeral,
    recomendacaoIa
  };
}

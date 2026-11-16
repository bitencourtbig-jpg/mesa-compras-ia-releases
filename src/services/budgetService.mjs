import { createReadOnlyConnection } from '../../db/client.mjs';
import { getAnalyticsDb, getClientProfile, upsertBudgetSummary, getLatestBudgetSummary } from '../store/analyticsDb.mjs';

/**
 * Mapeia grupo_id / grupo_nome / desc_arvore para as 5 Dimensões Oficiais do Varejo Farma
 * (Éticos, Genéricos, Perfumaria/HPC, Similares, Não-Medicamentos/Outros)
 */
export function classifyDimension(grupoNome, medicamentoFlag, tipoProdutoCmed) {
  const gNome = String(grupoNome || '').toUpperCase();
  const cmedTipo = String(tipoProdutoCmed || '').toUpperCase();

  if (gNome.includes('GENERICO') || cmedTipo === 'GENERICO') return 'Genéricos';
  if (gNome.includes('SIMILAR') || cmedTipo === 'SIMILAR') return 'Similares';
  if (gNome.includes('ETICO') || gNome.includes('REFERENCIA') || gNome.includes('MEDICAMENTO') || cmedTipo === 'NOVO' || cmedTipo === 'BIOLOGICO') {
    return 'Éticos';
  }
  if (gNome.includes('PERFUMARIA') || gNome.includes('COSMETICO') || gNome.includes('HIGIENE') || gNome.includes('DERMOCOSMETICO') || gNome.includes('BELEZA')) {
    return 'Perfumaria';
  }
  return 'Não-Medicamentos';
}

/**
 * Calcula os scores de dias do mês somando peso 1 para dias úteis (Seg-Sex)
 * e o peso calibrado da farmácia para Sábados e Domingos.
 */
function calculateMonthScore(year, month1Based, pesoSabado, pesoDomingo) {
  const totalDays = new Date(year, month1Based, 0).getDate();
  let score = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayOfWeek = new Date(year, month1Based - 1, d).getDay(); // 0=Dom, 6=Sab
    if (dayOfWeek === 0) {
      score += pesoDomingo;
    } else if (dayOfWeek === 6) {
      score += pesoSabado;
    } else {
      score += 1.0;
    }
  }
  return Number(score.toFixed(3));
}

/**
 * Motor de Cálculo da Dotação Orçamentária & Open-to-Buy (Governança Orçamentária).
 * Lê o Linx Farma BIG de forma 100% Read-Only e consolida os indicadores em SQLite.
 */
const _budgetFilialCache = new Map();

export async function calculateBudgetOverview(clientCode, { forceRefresh = false, filialId = null } = {}) {
  const isConsolidated = !filialId || filialId === 'all';
  const cacheKey = `${clientCode}|${isConsolidated ? 'all' : filialId}`;

  if (!forceRefresh && _budgetFilialCache.has(cacheKey)) {
    return _budgetFilialCache.get(cacheKey);
  }

  // Se não foi solicitado recálculo forçado e for visão consolidada, tenta recuperar do SQLite se válido
  if (!forceRefresh && isConsolidated) {
    const cached = getLatestBudgetSummary(clientCode);
    if (cached && Number(cached.dotacao_ajustada || 0) > 0) {
      _budgetFilialCache.set(cacheKey, cached);
      return cached;
    }
  }

  const profile = getClientProfile(clientCode) || {};
  const conn = await createReadOnlyConnection({
    host: profile.db_host || '127.0.0.1',
    port: profile.db_port || 3306,
    user: profile.db_user || 'root',
    password: profile.db_password || '',
    database: profile.db_name || 'bandeirante'
  });

  try {
    // 1. Identificar Filiais Ativas (respeitando seletor de filial ou loja única)
    const [filiaisRows] = await conn.query("SELECT filial_id, nome, reduz, cgc, escritorio FROM filial WHERE apagado = 'N'");
    let validFiliais = filiaisRows.filter(f => f.escritorio !== 'S');
    if (filialId && filialId !== 'all') {
      const specific = validFiliais.filter(f => Number(f.filial_id) === Number(filialId));
      if (specific.length > 0) validFiliais = specific;
    }
    const filialIds = validFiliais.map(f => Number(f.filial_id));
    const filiaisIn = filialIds.length ? filialIds.join(',') : '1';

    // 2. Data de Referência do Banco (última data de venda registrada no BIG)
    const [ultVendaRows] = await conn.query(`
      SELECT DATE(MAX(ultvenda)) AS max_ult
      FROM estoque_minimo
      WHERE filial_id IN (${filiaisIn}) AND apagado = 'N' AND ultvenda IS NOT NULL
    `);
    const refDateStr = ultVendaRows[0]?.max_ult || new Date().toISOString().slice(0, 10);
    const refDate = new Date(refDateStr + 'T12:00:00Z');
    
    const curYear = refDate.getUTCFullYear();
    const curMonthNum = refDate.getUTCMonth() + 1; // 1..12
    const curDay = refDate.getUTCDate();
    const curMonthStr = `${curYear}-${String(curMonthNum).padStart(2, '0')}`;

    // Mês Anterior
    const prevDate = new Date(Date.UTC(curYear, curMonthNum - 2, 1));
    const prevYear = prevDate.getUTCFullYear();
    const prevMonthNum = prevDate.getUTCMonth() + 1;
    const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    // 3. Calibração do Score de Dias (últimos 3 meses fechados antes do mês anterior)
    // Para calcular a relação faturamento Sáb/Dom vs Seg-Sex
    const histStart = new Date(Date.UTC(prevYear, prevMonthNum - 4, 1)).toISOString().slice(0, 10);
    const histEnd = new Date(Date.UTC(prevYear, prevMonthNum - 1, 0)).toISOString().slice(0, 10);

    const [diasSemanaRows] = await conn.query(`
      SELECT DAYOFWEEK(m.data_hora) as dia_num,
             COUNT(DISTINCT DATE(m.data_hora)) as total_dias,
             SUM(ABS(m.valor_tot)) as total_fat
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${filiaisIn})
        AND m.data_hora >= '${histStart} 00:00:00'
        AND m.data_hora <= '${histEnd} 23:59:59'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
      GROUP BY dia_num
    `);

    let fatDiasUteis = 0, countDiasUteis = 0;
    let fatSabado = 0, countSabado = 0;
    let fatDomingo = 0, countDomingo = 0;

    for (const r of diasSemanaRows) {
      const dNum = Number(r.dia_num);
      const fat = Number(r.total_fat || 0);
      const dias = Number(r.total_dias || 1);
      if (dNum === 1) { // Domingo
        fatDomingo += fat; countDomingo += dias;
      } else if (dNum === 7) { // Sábado
        fatSabado += fat; countSabado += dias;
      } else { // 2 a 6: Seg a Sex
        fatDiasUteis += fat; countDiasUteis += dias;
      }
    }

    const mediaUteis = countDiasUteis > 0 ? (fatDiasUteis / countDiasUteis) : 10000;
    const mediaSab = countSabado > 0 ? (fatSabado / countSabado) : (mediaUteis * 0.85);
    const mediaDom = countDomingo > 0 ? (fatDomingo / countDomingo) : (mediaUteis * 0.55);

    const pesoSabado = Number(Math.max(0.2, Math.min(2.5, mediaSab / mediaUteis)).toFixed(3));
    const pesoDomingo = Number(Math.max(0.1, Math.min(2.0, mediaDom / mediaUteis)).toFixed(3));

    // 4. Scores dos Meses
    const scoreMesAnterior = calculateMonthScore(prevYear, prevMonthNum, pesoSabado, pesoDomingo);
    const scoreMesAtual = calculateMonthScore(curYear, curMonthNum, pesoSabado, pesoDomingo);

    // 5. CMV e Faturamento Líquido do Mês Anterior por Dimensão
    // Mapeamento dos grupos do BIG
    const [gruposRows] = await conn.query("SELECT grupo_id, descricao FROM grupo WHERE apagado = 'N'");
    const grupoNomeMap = new Map(gruposRows.map(g => [Number(g.grupo_id), g.descricao]));

    const prevMonthStart = `${prevMonthStr}-01 00:00:00`;
    const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonthNum, 0)).toISOString().slice(0, 10) + ' 23:59:59';

    const [vendasMesAnt] = await conn.query(`
      SELECT p.grupo_id,
             p.medicamento,
             SUM(ABS(m.valor_tot)) as fat_liquido,
             SUM(ABS(m.quanti_uni) * COALESCE(p.preco_cmp, 0)) as cmv
      FROM movment m FORCE INDEX (data_hora)
      JOIN produto p ON p.produto_id = m.produto_id
      WHERE m.filial_id IN (${filiaisIn})
        AND m.data_hora >= '${prevMonthStart}'
        AND m.data_hora <= '${prevMonthEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
      GROUP BY p.grupo_id, p.medicamento
    `);

    const dimData = {
      'Éticos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Genéricos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Similares': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Perfumaria': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Não-Medicamentos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 }
    };

    let cmvTotalAnt = 0;
    let fatTotalAnt = 0;

    for (const r of vendasMesAnt) {
      const gNome = grupoNomeMap.get(Number(r.grupo_id)) || '';
      const dim = classifyDimension(gNome, r.medicamento);
      const c = Number(r.cmv || 0);
      const f = Number(r.fat_liquido || 0);
      dimData[dim].cmvAnt += c;
      dimData[dim].fatAnt += f;
      cmvTotalAnt += c;
      fatTotalAnt += f;
    }

    // 6. Faturamento do Mês Atual (Total e Variação D1..Hoje vs D1..MesmoDia Mês Anterior)
    const curMonthStart = `${curMonthStr}-01 00:00:00`;
    const curRefEnd = `${refDateStr} 23:59:59`;
    const prevCompEnd = `${prevMonthStr}-${String(curDay).padStart(2, '0')} 23:59:59`;

    const [fatAtualRows] = await conn.query(`
      SELECT SUM(ABS(m.valor_tot)) as fat_atual
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${filiaisIn})
        AND m.data_hora >= '${curMonthStart}'
        AND m.data_hora <= '${curRefEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
    `);
    const fatLiquidoAtualAteHoje = Number(fatAtualRows[0]?.fat_atual || 0);

    const [fatAntCompRows] = await conn.query(`
      SELECT SUM(ABS(m.valor_tot)) as fat_ant_comp
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${filiaisIn})
        AND m.data_hora >= '${prevMonthStart}'
        AND m.data_hora <= '${prevCompEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
    `);
    const fatLiquidoAntComp = Number(fatAntCompRows[0]?.fat_ant_comp || 0);

    // Variação de tendência (aplicada com cautela a partir do 8º dia)
    let varFatPct = 0;
    if (curDay >= 8 && fatLiquidoAntComp > 0) {
      varFatPct = Number(((fatLiquidoAtualAteHoje / fatLiquidoAntComp) - 1).toFixed(4));
    }

    // 7. Dotação Inicial e Ajustada
    const ratioScore = scoreMesAnterior > 0 ? (scoreMesAtual / scoreMesAnterior) : 1.0;
    const dotacaoInicialTotal = cmvTotalAnt * ratioScore;
    const dotacaoAjustadaTotal = Number((dotacaoInicialTotal * (1 + varFatPct)).toFixed(2));

    // 8. Consumido de Compras no Mês Atual (NFs de entradas líquidas)
    const [entradasRows] = await conn.query(`
      SELECT p.grupo_id,
             p.medicamento,
             SUM(e.valorit) as total_comprado
      FROM entradas e
      JOIN produto p ON p.produto_id = e.produto_id
      WHERE e.filial_id IN (${filiaisIn})
        AND e.datanota >= '${curMonthStr}-01'
        AND e.datanota <= '${refDateStr}'
        AND e.apagado = 'N'
        AND COALESCE(e.veiofilial, 0) = 0
      GROUP BY p.grupo_id, p.medicamento
    `);

    let consumidoTotal = 0;
    for (const r of entradasRows) {
      const gNome = grupoNomeMap.get(Number(r.grupo_id)) || '';
      const dim = classifyDimension(gNome, r.medicamento);
      const val = Number(r.total_comprado || 0);
      dimData[dim].consumido += val;
      consumidoTotal += val;
    }

    // 9. Compras Não Otimizadas (Sem Demanda e Excesso) a partir do último resultado do motor
    const unoptimizedProducts = [];
    const db = getAnalyticsDb();
    const lastRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);
    if (lastRun) {
      const auditSkus = db.prepare(`
        SELECT produto_id, macro_categoria, ddv_projetada, estoque_atual, estoque_max, sugestao_compra_un
        FROM engine_sku_results
        WHERE run_id = ?
      `).all(lastRun.id);

      const auditMap = new Map(auditSkus.map(s => [s.produto_id, s]));

      const [recentEntradas] = await conn.query(`
        SELECT e.filial_id, e.produto_id, p.descricao, p.barras, p.grupo_id, p.medicamento, SUM(e.valorit) as valor, SUM(e.quantiuni) as qtd
        FROM entradas e
        JOIN produto p ON p.produto_id = e.produto_id
        WHERE e.filial_id IN (${filiaisIn})
          AND e.datanota >= '${curMonthStr}-01'
          AND e.apagado = 'N' AND COALESCE(e.veiofilial, 0) = 0
        GROUP BY e.filial_id, e.produto_id, p.descricao, p.barras, p.grupo_id, p.medicamento
      `);

      for (const ent of recentEntradas) {
        const skuInfo = auditMap.get(Number(ent.produto_id));
        const gNome = grupoNomeMap.get(Number(ent.grupo_id)) || '';
        const dim = classifyDimension(gNome, ent.medicamento);
        const val = Number(ent.valor || 0);

        let classificacao = null;
        if (skuInfo) {
          if (Number(skuInfo.ddv_projetada) <= 0) {
            dimData[dim].comprasSemDemanda += val;
            classificacao = 'Sem demanda';
          } else if (Number(skuInfo.estoque_atual) > Number(skuInfo.estoque_max)) {
            dimData[dim].comprasExcesso += val;
            classificacao = 'Excesso';
          }
        }

        if (classificacao) {
          unoptimizedProducts.push({
            loja: `Loja ${ent.filial_id}`,
            cod_barras: ent.barras || '—',
            cod_interno: ent.produto_id,
            produto: ent.descricao || '—',
            entrada: Number(ent.qtd || 0),
            saida: Math.round(Number(skuInfo?.ddv_projetada || 0) * 30),
            limite_excesso: Number(skuInfo?.estoque_max || 0),
            evolucao_pct: Number(skuInfo?.estoque_max || 0) > 0 ? Math.round((Number(ent.qtd || 0) / Number(skuInfo.estoque_max)) * 100) : 0,
            compras_nao_otimizadas_rs: Number(val.toFixed(2)),
            classificacao
          });
        }
      }
      unoptimizedProducts.sort((a, b) => b.compras_nao_otimizadas_rs - a.compras_nao_otimizadas_rs);
    }

    let remanejamentoEconomizadoRs = 0;
    try {
      const transfRow = db.prepare(`SELECT SUM(valor_total) as tot FROM motor_transferencias WHERE client_code = ?`).get(clientCode);
      remanejamentoEconomizadoRs = Number(transfRow?.tot || 0);
    } catch (_e) {}

    // 10. Consolidação por Dimensão
    const dimensionsList = [];
    let totSemDemanda = 0;
    let totExcesso = 0;

    for (const [dimName, d] of Object.entries(dimData)) {
      const dotInicial = Number((d.cmvAnt * ratioScore).toFixed(2));
      const dotAjustada = Number((dotInicial * (1 + varFatPct)).toFixed(2));
      const consumido = Number(d.consumido.toFixed(2));
      const saldoLivre = Math.max(0, Number((dotAjustada - consumido).toFixed(2)));
      const pctConsumido = dotAjustada > 0 ? Number(((consumido / dotAjustada) * 100).toFixed(2)) : 0;
      
      const semDemandaRs = Number(d.comprasSemDemanda.toFixed(2));
      const semDemandaPct = consumido > 0 ? Number(((semDemandaRs / consumido) * 100).toFixed(2)) : 0;

      const excessoRs = Number(d.comprasExcesso.toFixed(2));
      const excessoPct = consumido > 0 ? Number(((excessoRs / consumido) * 100).toFixed(2)) : 0;

      const naoOtimizadasRs = Number((semDemandaRs + excessoRs).toFixed(2));
      const iec = Math.max(0, Math.min(100, Number((100 - (semDemandaPct + excessoPct)).toFixed(2))));

      totSemDemanda += semDemandaRs;
      totExcesso += excessoRs;

      dimensionsList.push({
        dimensao: dimName,
        cmv_mes_anterior: Number(d.cmvAnt.toFixed(2)),
        dotacao_inicial: dotInicial,
        dotacao_ajustada: dotAjustada,
        consumido_rs: consumido,
        consumido_pct: pctConsumido,
        saldo_livre_rs: saldoLivre,
        fator_tendencia_pct: Number((varFatPct * 100).toFixed(2)),
        compras_sem_demanda_rs: semDemandaRs,
        compras_sem_demanda_pct: semDemandaPct,
        compras_excesso_rs: excessoRs,
        compras_excesso_pct: excessoPct,
        compras_nao_otimizadas_rs: naoOtimizadasRs,
        iec_pct: iec
      });
    }

    // Ordenação canônica das 5 dimensões estratégicas farmacêuticas: Éticos, Genéricos, Perfumaria, Similares, Não-Medicamentos
    const orderMap = { 'Éticos': 1, 'Genéricos': 2, 'Perfumaria': 3, 'Similares': 4, 'Não-Medicamentos': 5 };
    dimensionsList.sort((a, b) => (orderMap[a.dimensao] || 99) - (orderMap[b.dimensao] || 99));

    // Totais Gerais
    consumidoTotal = Number(consumidoTotal.toFixed(2));
    const saldoLivreTotal = Math.max(0, Number((dotacaoAjustadaTotal - consumidoTotal).toFixed(2)));
    const consumidoPctTotal = dotacaoAjustadaTotal > 0 ? Number(((consumidoTotal / dotacaoAjustadaTotal) * 100).toFixed(2)) : 0;
    const compraXVendaPct = fatLiquidoAtualAteHoje > 0 ? Number(((consumidoTotal / fatLiquidoAtualAteHoje) * 100).toFixed(2)) : 0;
    
    totSemDemanda = Number(totSemDemanda.toFixed(2));
    totExcesso = Number(totExcesso.toFixed(2));
    const totNaoOtimizadas = Number((totSemDemanda + totExcesso).toFixed(2));
    const semDemandaPctTotal = consumidoTotal > 0 ? Number(((totSemDemanda / consumidoTotal) * 100).toFixed(2)) : 0;
    const excessoPctTotal = consumidoTotal > 0 ? Number(((totExcesso / consumidoTotal) * 100).toFixed(2)) : 0;
    const iecGeral = Math.max(0, Math.min(100, Number((100 - (semDemandaPctTotal + excessoPctTotal)).toFixed(2))));

    // 11. Montagem do Resumo Final
    const summary = {
      client_code: clientCode,
      reference_month: curMonthStr,
      reference_date: refDateStr,
      dias_correntes: curDay,
      cmv_mes_anterior: Number(cmvTotalAnt.toFixed(2)),
      score_mes_anterior: scoreMesAnterior,
      score_mes_atual: scoreMesAtual,
      peso_sabado: pesoSabado,
      peso_domingo: pesoDomingo,
      dotacao_inicial: Number(dotacaoInicialTotal.toFixed(2)),
      var_faturamento_pct: Number((varFatPct * 100).toFixed(2)),
      dotacao_ajustada: dotacaoAjustadaTotal,
      consumido_compras_rs: consumidoTotal,
      saldo_livre_rs: saldoLivreTotal,
      consumido_pct: consumidoPctTotal,
      faturamento_liquido_mes: Number(fatLiquidoAtualAteHoje.toFixed(2)),
      compra_x_venda_pct: compraXVendaPct,
      compras_sem_demanda_rs: totSemDemanda,
      compras_sem_demanda_pct: semDemandaPctTotal,
      compras_excesso_rs: totExcesso,
      compras_excesso_pct: excessoPctTotal,
      compras_nao_otimizadas_rs: totNaoOtimizadas,
      compras_nao_otimizadas_pct: Number((semDemandaPctTotal + excessoPctTotal).toFixed(2)),
      iec_eficiencia_pct: iecGeral,
      remanejamento_economizado_rs: remanejamentoEconomizadoRs,
      unoptimized_products: unoptimizedProducts.slice(0, 100),
      dimensions: dimensionsList,
      filiais: validFiliais.map(f => ({
        filial_id: Number(f.filial_id),
        nome: f.nome,
        reduz: f.reduz,
        cgc: f.cgc
      }))
    };

    // Salva no SQLite local apenas se for a visão consolidada da rede (evita sobrescrever com dados de uma filial)
    if (isConsolidated) {
      upsertBudgetSummary(clientCode, summary);
    }
    _budgetFilialCache.set(cacheKey, summary);

    return summary;
  } finally {
    await conn.end();
  }
}

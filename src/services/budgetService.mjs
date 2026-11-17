import { createReadOnlyConnection } from '../../db/client.mjs';
import {
  getAnalyticsDb,
  getClientProfile,
  upsertBudgetSummary,
  getLatestBudgetSummary,
  getFilialBudgetSummary,
  upsertFilialBudgetSummary,
  getAllFilialBudgetSummaries
} from '../store/analyticsDb.mjs';

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
 * Constrói o objeto de resumo de orçamento para uma filial específica ou consolidado da rede.
 */
function buildBudgetSummaryObject({
  clientCode,
  referenceMonth,
  referenceDate,
  diasCorrentes,
  pesoSabado,
  pesoDomingo,
  scoreMesAnterior,
  scoreMesAtual,
  ratioScore,
  cmvTotalAnt,
  fatAntComp,
  fatAtual,
  dimData,
  unoptimizedProducts,
  remanejamentoEconomizadoRs,
  filiaisMeta,
  filialId = null,
  nomeLoja = null,
  nomeReduz = null
}) {
  let varFatPct = 0;
  if (diasCorrentes >= 8 && fatAntComp > 0) {
    varFatPct = Number(((fatAtual / fatAntComp) - 1).toFixed(4));
  }

  const dotacaoInicialTotal = cmvTotalAnt * ratioScore;
  const dotacaoAjustadaTotal = Number((dotacaoInicialTotal * (1 + varFatPct)).toFixed(2));

  // Consolidação por dimensão
  const dimensionsList = [];
  let totSemDemanda = 0;
  let totExcesso = 0;
  let consumidoTotal = 0;

  for (const [dimName, d] of Object.entries(dimData)) {
    const dotInicial = Number((d.cmvAnt * ratioScore).toFixed(2));
    const dotAjustada = Number((dotInicial * (1 + varFatPct)).toFixed(2));
    const consumido = Number(d.consumido.toFixed(2));
    consumidoTotal += consumido;
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

  const orderMap = { 'Éticos': 1, 'Genéricos': 2, 'Perfumaria': 3, 'Similares': 4, 'Não-Medicamentos': 5 };
  dimensionsList.sort((a, b) => (orderMap[a.dimensao] || 99) - (orderMap[b.dimensao] || 99));

  consumidoTotal = Number(consumidoTotal.toFixed(2));
  const saldoLivreTotal = Math.max(0, Number((dotacaoAjustadaTotal - consumidoTotal).toFixed(2)));
  const consumidoPctTotal = dotacaoAjustadaTotal > 0 ? Number(((consumidoTotal / dotacaoAjustadaTotal) * 100).toFixed(2)) : 0;
  const compraXVendaPct = fatAtual > 0 ? Number(((consumidoTotal / fatAtual) * 100).toFixed(2)) : 0;

  totSemDemanda = Number(totSemDemanda.toFixed(2));
  totExcesso = Number(totExcesso.toFixed(2));
  const totNaoOtimizadas = Number((totSemDemanda + totExcesso).toFixed(2));
  const semDemandaPctTotal = consumidoTotal > 0 ? Number(((totSemDemanda / consumidoTotal) * 100).toFixed(2)) : 0;
  const excessoPctTotal = consumidoTotal > 0 ? Number(((totExcesso / consumidoTotal) * 100).toFixed(2)) : 0;
  const iecGeral = Math.max(0, Math.min(100, Number((100 - (semDemandaPctTotal + excessoPctTotal)).toFixed(2))));

  unoptimizedProducts.sort((a, b) => b.compras_nao_otimizadas_rs - a.compras_nao_otimizadas_rs);

  return {
    client_code: clientCode,
    filial_id: filialId,
    nome_loja: nomeLoja,
    nome_reduz: nomeReduz,
    reference_month: referenceMonth,
    reference_date: referenceDate,
    dias_correntes: diasCorrentes,
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
    faturamento_liquido_mes: Number(fatAtual.toFixed(2)),
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
    filiais: filiaisMeta
  };
}

/**
 * Cache em memória RAM para aceleração sub-milissegundo (< 1ms).
 */
const _budgetFilialCache = new Map();

export function invalidateBudgetCache() {
  _budgetFilialCache.clear();
}

/**
 * Motor de Cálculo da Dotação Orçamentária & Open-to-Buy (Governança Orçamentária).
 * Lê o Linx Farma BIG de forma 100% Read-Only e consolida os indicadores em SQLite.
 * Apura a rede consolidada E todas as lojas individuais simultaneamente, garantindo
 * troca instantânea (< 1ms) sem lentidão de banco de dados.
 */
export async function calculateBudgetOverview(clientCode, { forceRefresh = false, filialId = null } = {}) {
  const isConsolidated = !filialId || filialId === 'all';
  const targetFId = !isConsolidated ? Number(filialId) : null;
  const cacheKey = `${clientCode}|${isConsolidated ? 'all' : targetFId}`;

  // 1. Resposta ultra-rápida de memória RAM
  if (!forceRefresh && _budgetFilialCache.has(cacheKey)) {
    return _budgetFilialCache.get(cacheKey);
  }

  // 2. Resposta rápida de SQLite (< 1ms)
  if (!forceRefresh) {
    if (isConsolidated) {
      const cached = getLatestBudgetSummary(clientCode);
      if (cached && Number(cached.dotacao_ajustada || 0) > 0) {
        _budgetFilialCache.set(cacheKey, cached);
        return cached;
      }
    } else {
      const cachedFilial = getFilialBudgetSummary(clientCode, targetFId);
      if (cachedFilial && Number(cachedFilial.dotacao_ajustada || 0) > 0) {
        _budgetFilialCache.set(cacheKey, cachedFilial);
        return cachedFilial;
      }
    }
  }

  // 3. Apuração real no Linx Farma BIG (MariaDB Read-Only)
  const profile = getClientProfile(clientCode) || {};
  const conn = await createReadOnlyConnection({
    host: profile.db_host || '127.0.0.1',
    port: profile.db_port || 3306,
    user: profile.db_user || 'root',
    password: profile.db_password || '',
    database: profile.db_name || 'bandeirante'
  });

  try {
    // 3.1 Identificar TODAS as filiais operacionais da rede (exclui escritório filial_id = 1)
    const [filiaisRows] = await conn.query("SELECT filial_id, nome, reduz, cgc, escritorio FROM filial WHERE apagado = 'N'");
    const allActiveFiliais = filiaisRows.filter(f => f.escritorio !== 'S');
    const allFilialIds = allActiveFiliais.map(f => Number(f.filial_id));
    const allFiliaisIn = allFilialIds.length ? allFilialIds.join(',') : '1';

    // 3.2 Data de Referência do Banco (última data de venda registrada no BIG)
    const [ultVendaRows] = await conn.query(`
      SELECT DATE(MAX(ultvenda)) AS max_ult
      FROM estoque_minimo
      WHERE filial_id IN (${allFiliaisIn}) AND apagado = 'N' AND ultvenda IS NOT NULL
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

    // 3.3 Calibração do Score de Dias (últimos 3 meses fechados)
    const histStart = new Date(Date.UTC(prevYear, prevMonthNum - 4, 1)).toISOString().slice(0, 10);
    const histEnd = new Date(Date.UTC(prevYear, prevMonthNum - 1, 0)).toISOString().slice(0, 10);

    const [diasSemanaRows] = await conn.query(`
      SELECT DAYOFWEEK(m.data_hora) as dia_num,
             COUNT(DISTINCT DATE(m.data_hora)) as total_dias,
             SUM(ABS(m.valor_tot)) as total_fat
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${allFiliaisIn})
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

    // 3.4 Scores dos Meses
    const scoreMesAnterior = calculateMonthScore(prevYear, prevMonthNum, pesoSabado, pesoDomingo);
    const scoreMesAtual = calculateMonthScore(curYear, curMonthNum, pesoSabado, pesoDomingo);
    const ratioScore = scoreMesAnterior > 0 ? (scoreMesAtual / scoreMesAnterior) : 1.0;

    // 3.5 Mapeamento de grupos do BIG
    const [gruposRows] = await conn.query("SELECT grupo_id, descricao FROM grupo WHERE apagado = 'N'");
    const grupoNomeMap = new Map(gruposRows.map(g => [Number(g.grupo_id), g.descricao]));

    const prevMonthStart = `${prevMonthStr}-01 00:00:00`;
    const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonthNum, 0)).toISOString().slice(0, 10) + ' 23:59:59';
    const curMonthStart = `${curMonthStr}-01 00:00:00`;
    const curRefEnd = `${refDateStr} 23:59:59`;
    const prevCompEnd = `${prevMonthStr}-${String(curDay).padStart(2, '0')} 23:59:59`;

    // 3.6 Consultas agrupadas por filial para apurar toda a rede em UMA ÚNICA chamada otimizada
    const [vendasMesAnt] = await conn.query(`
      SELECT m.filial_id,
             p.grupo_id,
             p.medicamento,
             SUM(ABS(m.valor_tot)) as fat_liquido,
             SUM(ABS(m.quanti_uni) * COALESCE(p.preco_cmp, 0)) as cmv
      FROM movment m FORCE INDEX (data_hora)
      JOIN produto p ON p.produto_id = m.produto_id
      WHERE m.filial_id IN (${allFiliaisIn})
        AND m.data_hora >= '${prevMonthStart}'
        AND m.data_hora <= '${prevMonthEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
      GROUP BY m.filial_id, p.grupo_id, p.medicamento
    `);

    const [fatAtualRows] = await conn.query(`
      SELECT m.filial_id, SUM(ABS(m.valor_tot)) as fat_atual
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${allFiliaisIn})
        AND m.data_hora >= '${curMonthStart}'
        AND m.data_hora <= '${curRefEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
      GROUP BY m.filial_id
    `);

    const [fatAntCompRows] = await conn.query(`
      SELECT m.filial_id, SUM(ABS(m.valor_tot)) as fat_ant_comp
      FROM movment m FORCE INDEX (data_hora)
      WHERE m.filial_id IN (${allFiliaisIn})
        AND m.data_hora >= '${prevMonthStart}'
        AND m.data_hora <= '${prevCompEnd}'
        AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
      GROUP BY m.filial_id
    `);

    const [entradasRows] = await conn.query(`
      SELECT e.filial_id,
             p.grupo_id,
             p.medicamento,
             SUM(e.valorit) as total_comprado
      FROM entradas e
      JOIN produto p ON p.produto_id = e.produto_id
      WHERE e.filial_id IN (${allFiliaisIn})
        AND e.datanota >= '${curMonthStr}-01'
        AND e.datanota <= '${refDateStr}'
        AND e.apagado = 'N'
        AND COALESCE(e.veiofilial, 0) = 0
      GROUP BY e.filial_id, p.grupo_id, p.medicamento
    `);

    // 3.7 Auditoria de Compras Não Otimizadas (do último motor run)
    const db = getAnalyticsDb();
    const lastRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);
    let auditMap = new Map();
    if (lastRun) {
      const auditSkus = db.prepare(`
        SELECT filial_id, produto_id, macro_categoria, ddv_projetada, estoque_atual, estoque_max, sugestao_compra_un
        FROM engine_sku_results
        WHERE run_id = ?
      `).all(lastRun.id);
      for (const s of auditSkus) {
        auditMap.set(`${s.filial_id}_${s.produto_id}`, s);
        if (!auditMap.has(`0_${s.produto_id}`)) auditMap.set(`0_${s.produto_id}`, s);
      }
    }

    const [recentEntradas] = await conn.query(`
      SELECT e.filial_id, e.produto_id, p.descricao, p.barras, p.grupo_id, p.medicamento,
             SUM(e.valorit) as valor, SUM(e.quantiuni) as qtd
      FROM entradas e
      JOIN produto p ON p.produto_id = e.produto_id
      WHERE e.filial_id IN (${allFiliaisIn})
        AND e.datanota >= '${curMonthStr}-01'
        AND e.apagado = 'N' AND COALESCE(e.veiofilial, 0) = 0
      GROUP BY e.filial_id, e.produto_id, p.descricao, p.barras, p.grupo_id, p.medicamento
    `);

    let remanejamentoEconomizadoRs = 0;
    try {
      const transfRow = db.prepare(`SELECT SUM(valor_total) as tot FROM motor_transferencias WHERE client_code = ?`).get(clientCode);
      remanejamentoEconomizadoRs = Number(transfRow?.tot || 0);
    } catch (_e) {}

    const filiaisMeta = allActiveFiliais.map(f => ({
      filial_id: Number(f.filial_id),
      nome: f.nome,
      reduz: f.reduz,
      cgc: f.cgc
    }));

    // Função de criação de estrutura dimensional vazia
    const createEmptyDimData = () => ({
      'Éticos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Genéricos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Similares': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Perfumaria': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 },
      'Não-Medicamentos': { cmvAnt: 0, fatAnt: 0, consumido: 0, comprasSemDemanda: 0, comprasExcesso: 0 }
    });

    // 3.8 Separa dados por filial e constrói resumo de cada loja
    const filialSummaries = [];
    const filialDimDataMap = new Map();
    const filialUnoptimizedMap = new Map();
    const filialCmvTotalMap = new Map();
    const filialFatAtualMap = new Map();
    const filialFatAntCompMap = new Map();

    for (const f of allActiveFiliais) {
      const fId = Number(f.filial_id);
      filialDimDataMap.set(fId, createEmptyDimData());
      filialUnoptimizedMap.set(fId, []);
      filialCmvTotalMap.set(fId, 0);
      filialFatAtualMap.set(fId, 0);
      filialFatAntCompMap.set(fId, 0);
    }

    // Preenche CMV Mês Anterior
    const consolidatedDimData = createEmptyDimData();
    let consolidatedCmvTotalAnt = 0;

    for (const r of vendasMesAnt) {
      const fId = Number(r.filial_id);
      const gNome = grupoNomeMap.get(Number(r.grupo_id)) || '';
      const dim = classifyDimension(gNome, r.medicamento);
      const c = Number(r.cmv || 0);
      const f = Number(r.fat_liquido || 0);

      consolidatedDimData[dim].cmvAnt += c;
      consolidatedDimData[dim].fatAnt += f;
      consolidatedCmvTotalAnt += c;

      if (filialDimDataMap.has(fId)) {
        const fDim = filialDimDataMap.get(fId);
        fDim[dim].cmvAnt += c;
        fDim[dim].fatAnt += f;
        filialCmvTotalMap.set(fId, filialCmvTotalMap.get(fId) + c);
      }
    }

    // Preenche Faturamento Atual
    let consolidatedFatAtual = 0;
    for (const r of fatAtualRows) {
      const fId = Number(r.filial_id);
      const fat = Number(r.fat_atual || 0);
      consolidatedFatAtual += fat;
      if (filialFatAtualMap.has(fId)) {
        filialFatAtualMap.set(fId, fat);
      }
    }

    // Preenche Faturamento Anterior Comparativo
    let consolidatedFatAntComp = 0;
    for (const r of fatAntCompRows) {
      const fId = Number(r.filial_id);
      const fat = Number(r.fat_ant_comp || 0);
      consolidatedFatAntComp += fat;
      if (filialFatAntCompMap.has(fId)) {
        filialFatAntCompMap.set(fId, fat);
      }
    }

    // Preenche Entradas de Compras
    for (const r of entradasRows) {
      const fId = Number(r.filial_id);
      const gNome = grupoNomeMap.get(Number(r.grupo_id)) || '';
      const dim = classifyDimension(gNome, r.medicamento);
      const val = Number(r.total_comprado || 0);

      consolidatedDimData[dim].consumido += val;
      if (filialDimDataMap.has(fId)) {
        const fDim = filialDimDataMap.get(fId);
        fDim[dim].consumido += val;
      }
    }

    // Preenche Compras Não Otimizadas (Sem Demanda e Excesso)
    const consolidatedUnoptimized = [];
    for (const ent of recentEntradas) {
      const fId = Number(ent.filial_id);
      const skuInfo = auditMap.get(`${fId}_${ent.produto_id}`) || auditMap.get(`0_${ent.produto_id}`);
      const gNome = grupoNomeMap.get(Number(ent.grupo_id)) || '';
      const dim = classifyDimension(gNome, ent.medicamento);
      const val = Number(ent.valor || 0);

      let classificacao = null;
      if (skuInfo) {
        if (Number(skuInfo.ddv_projetada || 0) <= 0) {
          classificacao = 'Sem demanda';
          consolidatedDimData[dim].comprasSemDemanda += val;
          if (filialDimDataMap.has(fId)) {
            filialDimDataMap.get(fId)[dim].comprasSemDemanda += val;
          }
        } else if (Number(skuInfo.estoque_atual || 0) > Number(skuInfo.estoque_max || 0)) {
          classificacao = 'Excesso';
          consolidatedDimData[dim].comprasExcesso += val;
          if (filialDimDataMap.has(fId)) {
            filialDimDataMap.get(fId)[dim].comprasExcesso += val;
          }
        }
      }

      if (classificacao) {
        const item = {
          loja: `Loja ${fId}`,
          filial_id: fId,
          cod_barras: ent.barras || '—',
          cod_interno: ent.produto_id,
          produto: ent.descricao || '—',
          entrada: Number(ent.qtd || 0),
          saida: Math.round(Number(skuInfo?.ddv_projetada || 0) * 30),
          limite_excesso: Number(skuInfo?.estoque_max || 0),
          evolucao_pct: Number(skuInfo?.estoque_max || 0) > 0 ? Math.round((Number(ent.qtd || 0) / Number(skuInfo.estoque_max)) * 100) : 0,
          compras_nao_otimizadas_rs: Number(val.toFixed(2)),
          classificacao
        };
        consolidatedUnoptimized.push(item);
        if (filialUnoptimizedMap.has(fId)) {
          filialUnoptimizedMap.get(fId).push(item);
        }
      }
    }

    // 3.9 Constrói e persiste o resumo de cada filial no SQLite
    if (isConsolidated && allFilialIds.length > 0) {
      try {
        const db = getAnalyticsDb();
        db.prepare(`DELETE FROM budget_filial_summary WHERE client_code = ? AND filial_id NOT IN (${allFiliaisIn})`).run(clientCode);
      } catch (err) {
        console.warn('[BUDGET] Aviso ao purgar filiais obsoletas de budget_filial_summary:', err.message);
      }
    }

    for (const f of allActiveFiliais) {
      const fId = Number(f.filial_id);
      const fSummary = buildBudgetSummaryObject({
        clientCode,
        referenceMonth: curMonthStr,
        referenceDate: refDateStr,
        diasCorrentes: curDay,
        pesoSabado,
        pesoDomingo,
        scoreMesAnterior,
        scoreMesAtual,
        ratioScore,
        cmvTotalAnt: filialCmvTotalMap.get(fId) || 0,
        fatAntComp: filialFatAntCompMap.get(fId) || 0,
        fatAtual: filialFatAtualMap.get(fId) || 0,
        dimData: filialDimDataMap.get(fId),
        unoptimizedProducts: filialUnoptimizedMap.get(fId) || [],
        remanejamentoEconomizadoRs: 0,
        filiaisMeta,
        filialId: fId,
        nomeLoja: f.nome,
        nomeReduz: f.reduz
      });

      upsertFilialBudgetSummary(clientCode, fId, fSummary);
      _budgetFilialCache.set(`${clientCode}|${fId}`, fSummary);
      filialSummaries.push({
        filial_id: fId,
        nome_loja: f.nome,
        nome_reduz: f.reduz,
        dotacao_ajustada: fSummary.dotacao_ajustada,
        consumido_compras_rs: fSummary.consumido_compras_rs,
        saldo_livre_rs: fSummary.saldo_livre_rs,
        consumido_pct: fSummary.consumido_pct,
        faturamento_liquido_mes: fSummary.faturamento_liquido_mes,
        compra_x_venda_pct: fSummary.compra_x_venda_pct,
        compras_nao_otimizadas_rs: fSummary.compras_nao_otimizadas_rs,
        iec_eficiencia_pct: fSummary.iec_eficiencia_pct
      });
    }

    // 3.10 Constrói e persiste o resumo consolidado no SQLite
    const consolidatedSummary = buildBudgetSummaryObject({
      clientCode,
      referenceMonth: curMonthStr,
      referenceDate: refDateStr,
      diasCorrentes: curDay,
      pesoSabado,
      pesoDomingo,
      scoreMesAnterior,
      scoreMesAtual,
      ratioScore,
      cmvTotalAnt: consolidatedCmvTotalAnt,
      fatAntComp: consolidatedFatAntComp,
      fatAtual: consolidatedFatAtual,
      dimData: consolidatedDimData,
      unoptimizedProducts: consolidatedUnoptimized,
      remanejamentoEconomizadoRs,
      filiaisMeta,
      filialId: null,
      nomeLoja: 'Rede Consolidada',
      nomeReduz: 'REDE'
    });

    consolidatedSummary.filiais_summary = filialSummaries;
    upsertBudgetSummary(clientCode, consolidatedSummary);
    _budgetFilialCache.set(`${clientCode}|all`, consolidatedSummary);

    // Retorna o resumo solicitado (específico da loja ou consolidado)
    if (!isConsolidated && targetFId) {
      return _budgetFilialCache.get(`${clientCode}|${targetFId}`) || consolidatedSummary;
    }
    return consolidatedSummary;
  } finally {
    await conn.end();
  }
}

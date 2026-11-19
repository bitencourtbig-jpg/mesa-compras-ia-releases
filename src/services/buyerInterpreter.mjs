/**
 * Motor de interpretacao direta e transparente para tomada de decisao do comprador.
 * Converte numeros tecnicos do motor em parecer acionavel, nivel de confianca e preco-alvo de cotacao.
 */

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
const fmtBrl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v, d = 1) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function analyzeEntries(entries = [], fallbackCost = 0) {
  const valid = entries
    .map((e) => ({
      datanota: e.datanota || '',
      numnota: e.numnota || '',
      fornecedor: e.fornecedor_nome || 'Fornecedor S/N',
      custo: Number(e.custo_item || e.precouni || 0),
      quantiuni: Number(e.quantiuni || 0),
      reposicaoPbm: e.reposicao_pbm === 'S',
    }))
    .filter((e) => e.custo > 0);

  if (valid.length === 0) {
    return {
      melhorCusto: round2(fallbackCost),
      melhorFornecedor: '',
      melhorData: '',
      ultimoCusto: round2(fallbackCost),
      ultimoFornecedor: '',
      ultimaData: '',
      totalEntradas: entries.length,
    };
  }

  const ultimo = valid[0];
  let melhor = valid[0];
  for (const e of valid) {
    if (e.custo < melhor.custo) melhor = e;
  }

  return {
    melhorCusto: round2(melhor.custo),
    melhorFornecedor: melhor.fornecedor,
    melhorData: melhor.datanota,
    ultimoCusto: round2(ultimo.custo),
    ultimoFornecedor: ultimo.fornecedor,
    ultimaData: ultimo.datanota,
    totalEntradas: entries.length,
  };
}

/**
 * Gera analise explicativa estruturada a partir do registro persistido em engine_sku_results.
 */
export function buildBuyerDecisionAnalysis(row) {
  const excecoes = Array.isArray(row.excecoes)
    ? row.excecoes
    : JSON.parse(row.excecoes_json || '[]');
  let entries = [];
  if (Array.isArray(row.ultimas_entradas)) {
    entries = row.ultimas_entradas;
  } else {
    try {
      const parsed = JSON.parse(row.ultimas_entradas_json || '[]');
      entries = Array.isArray(parsed) ? parsed : (parsed?.list || []);
    } catch {}
  }

  const buyQty = row.budget_qtd !== undefined ? Number(row.budget_qtd) : Number(row.sugestao_compra_un || 0);
  const buyRs = row.budget_rs !== undefined ? Number(row.budget_rs) : Number(row.sugestao_compra_rs || 0);
  const estoque = Number(row.estoque_atual || 0);
  const transito = Number(row.transito_real || 0);
  const cob = Number(row.cobertura_dias || 0);
  const lt = Number(row.lead_time_dias || 0);
  const ddvBruta = Number(row.ddv_bruta || 0);
  const ddvAjust = Number(row.ddv_ajustada || 0);
  const ddvPbm = Number(row.ddv_pbm_auto || 0);
  const ddvLiq = Number(row.ddv_liquida || 0);
  const ddvProj = Number(row.ddv_projetada || 0);
  const saz = Number(row.indice_sazonalidade || 1);
  const vendas13s = Number(row.vendas_13s || 0);
  const vendas6s = Number(row.vendas_6s || 0);
  const vendasPbm = Number(row.vendas_pbm_13s || 0);
  const diasSemEst = Number(row.dias_sem_estoque_13s || 0);
  const minEst = Number(row.estoque_min || 0);
  const maxEst = Number(row.estoque_max || 0);
  const segEst = Number(row.estoque_seg || 0);
  const custoVar = Number(row.custo_variacao_pct || 0);
  const venc90 = Number(row.lote_vencendo_90d_qtd || 0);
  const vencido = Number(row.lote_vencido_qtd || 0);

  const entryStats = analyzeEntries(entries, Number(row.custo_unit || 0));

  // 1. Veredito direto para o comprador saber o que fazer de imediato
  let acaoCodigo = 'NAO_COMPRAR';
  let acaoLabel = 'NÃO COMPRAR';
  let acaoTom = 'neutral'; // danger | warn | success | info | neutral
  let parecerCurto = '';

  const hasMolCovered = excecoes.includes('MOLECULA_COBERTA_OUTRO_LAB');
  const hasNegStock = estoque < 0 && vendas13s > 0;
  const hasShortLot = venc90 > 0 || vencido > 0;

  if (buyQty > 0) {
    if (hasNegStock) {
      acaoCodigo = 'CONFERIR_E_COTAR';
      acaoLabel = 'CONFERIR SALDO & COTAR';
      acaoTom = 'warn';
      parecerCurto = `Saldo negativo (${estoque}) com giro de ${fmtNum(ddvProj, 2)}/dia: confirme inventario/NF pendente antes de fechar ${buyQty} un.`;
    } else if (hasMolCovered) {
      acaoCodigo = 'AVALIAR_MOLECULA';
      acaoLabel = 'AVALIAR SUBSTITUTO ANTES';
      acaoTom = 'info';
      parecerCurto = `Sugeriu ${buyQty} un para esta marca, mas outro lab da mesma molecula ja tem cobertura >= 15d na loja.`;
    } else if (cob <= lt || estoque <= 0) {
      acaoCodigo = 'COMPRAR_URGENTE';
      acaoLabel = 'COMPRAR URGENTE';
      acaoTom = 'danger';
      parecerCurto =
        estoque <= 0
          ? `Em ruptura (saldo ${estoque}) com demanda de ${fmtNum(ddvProj, 2)}/dia (Curva ${row.abc_class}${row.xyz_class}): cotar ${buyQty} un imediatamente.`
          : `Cobertura atual (${fmtNum(cob, 1)}d) menor que o prazo de entrega (${fmtNum(lt, 1)}d): pedir ${buyQty} un para evitar falta.`;
    } else {
      acaoCodigo = 'COMPRAR_REPOR';
      acaoLabel = 'INCLUIR NA COTAÇÃO';
      acaoTom = 'success';
      const resVal = Number(row.estoque_reserva || 0);
      const dispEfetivo = estoque - resVal + transito;
      const resDesc = resVal > 0 ? ` [${estoque} est - ${resVal} res]` : '';
      if (row.is_custom_horizon) {
        const hDias = row.horizon_dias || 7;
        parecerCurto = `Horizonte ${hDias}d (${dispEfetivo} disp.${resDesc} vs ${minEst} mín): repor ${buyQty} un para cobrir ciclo até ${maxEst} un.`;
      } else {
        parecerCurto = `Padrão BIG (${dispEfetivo} disp.${resDesc} vs ${minEst} mín): repor ${buyQty} un para cobrir ${fmtNum(lt, 0)}d de entrega + ciclo até ${maxEst} un.`;
      }
    }
  } else if (ddvPbm > 0 && ddvProj === 0) {
    acaoCodigo = 'BLOQUEADO_PBM';
    acaoLabel = 'COBERTO POR PBM AUTO';
    acaoTom = 'info';
    parecerCurto = `Nao comprar: ${Math.round(vendasPbm)} das ${Math.round(vendas13s)} vendas vieram por PBM com reposicao automatica.`;
  } else if (hasShortLot && estoque > 0) {
    acaoCodigo = 'BLOQUEADO_VALIDADE';
    acaoLabel = 'GIRAR LOTE CURTO';
    acaoTom = 'warn';
    parecerCurto = `Nao comprar agora: ha ${venc90 + vencido} un em alerta de validade (menor: ${row.lote_menor_validade || '—'}).`;
  } else if (estoque > maxEst && maxEst > 0) {
    acaoCodigo = 'EXCESSO';
    acaoLabel = 'ESTOQUE ACIMA DO MÁX.';
    acaoTom = 'neutral';
    parecerCurto = `Nao comprar: saldo de ${estoque} un supera o maximo de ${maxEst} un (cobertura de ${cob >= 999 ? '999+' : fmtNum(cob, 0)}d).`;
  } else if (vendas13s === 0 && estoque > 0) {
    acaoCodigo = 'PARADO_D';
    acaoLabel = 'SEM GIRO (CURVA D)';
    acaoTom = 'neutral';
    parecerCurto = `Nao comprar: 0 vendas em 91 dias com ${estoque} un paradas (${fmtBrl(estoque * Number(row.custo_unit || 0))}).`;
  } else {
    parecerCurto = `Estoque equilibrado (${estoque} un, cobertura de ${cob >= 999 ? '999+' : fmtNum(cob, 1)}d para meta minima de ${minEst} un).`;
  }

  // 2. Nivel de Confianca da recomendacao (0 - 100)
  let score = 90;
  const motivosConfianca = [];

  if (row.xyz_class === 'X') {
    score += 6;
    motivosConfianca.push('Demanda muito estavel (Classe X)');
  } else if (row.xyz_class === 'Y') {
    score -= 4;
    motivosConfianca.push('Oscilacao moderada entre semanas (Classe Y)');
  } else {
    score -= 16;
    motivosConfianca.push('Demanda irregular/picos semanais (Classe Z — confirmar se houve venda atipica)');
  }

  if (hasNegStock) {
    score -= 24;
    motivosConfianca.push(`Saldo negativo (${estoque}) reduz confiabilidade do estoque no sistema`);
  }
  if (entryStats.totalEntradas === 0) {
    score -= 12;
    motivosConfianca.push('Sem entrada de NF nos ultimos 18 meses para validar custo');
  } else if (entryStats.totalEntradas >= 2) {
    score += 2;
  }
  if (custoVar >= 15) {
    score -= 10;
    motivosConfianca.push(`Custo subiu +${fmtNum(custoVar, 1)}% na ultima NF — cotar em mais fornecedores`);
  }
  if (excecoes.includes('FLAG_MEDICAMENTO_INCORRETO')) {
    score -= 8;
    motivosConfianca.push('Divergencia de flag medicamento entre BIG e CMED');
  }

  score = Math.max(35, Math.min(98, score));
  const confiancaNivel = score >= 80 ? 'ALTA' : score >= 62 ? 'MÉDIA' : 'ATENÇÃO';

  // 3. Explicacao estruturada em 4 etapas dos fluxos e numeros
  const passoDemanda = [];
  passoDemanda.push(`Vendeu ${Math.round(vendas13s)} un em 13 semanas (${Math.round(vendas6s)} nas ultimas 6 semanas), ritmo bruto de ${fmtNum(ddvBruta, 2)}/dia.`);
  if (diasSemEst > 0) {
    passoDemanda.push(`Ruptura silenciosa detectada em ${diasSemEst} dias no periodo -> demanda corrigida para ${fmtNum(ddvAjust, 2)}/dia.`);
  }
  if (vendasPbm > 0) {
    passoDemanda.push(`Abatidas ${Math.round(vendasPbm)} un de PBM auto-reposto (${fmtNum(ddvPbm, 2)}/dia) -> giro loja: ${fmtNum(ddvLiq, 2)}/dia.`);
  }
  if (saz !== 1) {
    passoDemanda.push(`Sazonalidade YoY de ${fmtNum(saz, 2)}x aplicada -> DDV Projetada final de ${fmtNum(ddvProj, 2)}/dia.`);
  } else {
    passoDemanda.push(`Sazonalidade neutra (1,00x) -> DDV Projetada final de ${fmtNum(ddvProj, 2)}/dia.`);
  }

  const ritmoReal6s = vendas6s > 0 ? (vendas6s / 42) : 0;
  const projFutura6s = Math.round(ddvProj * 42);

  const linhasDemanda = [
    {
      icone: '📈',
      rotulo: 'Histórico de Saídas (PDV)',
      valor: `${Math.round(vendas13s)} un (13 sem)`,
      sub: `${Math.round(vendas6s)} un nas últimas 6 sem (${fmtNum(ritmoReal6s, 2)}/dia) • Ponderado: ${fmtNum(ddvBruta, 2)}/dia`,
      tom: 'neutral'
    }
  ];

  if (diasSemEst > 0) {
    linhasDemanda.push({
      icone: '🚨',
      rotulo: 'Ruptura Silenciosa',
      valor: `${diasSemEst} dias sem estoque`,
      sub: `Demanda real corrigida para ${fmtNum(ddvAjust, 2)}/dia`,
      tom: 'danger'
    });
  }

  if (vendasPbm > 0) {
    linhasDemanda.push({
      icone: '💊',
      rotulo: 'Dedução Reposição PBM',
      valor: `-${Math.round(vendasPbm)} un bonificadas`,
      sub: `-${fmtNum(ddvPbm, 2)}/dia deduzido • Giro Loja: ${fmtNum(ddvLiq, 2)}/dia`,
      tom: 'info'
    });
  }

  if (saz !== 1) {
    linhasDemanda.push({
      icone: '🌤️',
      rotulo: 'Sazonalidade YoY',
      valor: `${fmtNum(saz, 2)}x aplicado`,
      sub: `Fator sazonal histórico sobre o giro`,
      tom: 'neutral'
    });
  }

  linhasDemanda.push({
    icone: '🎯',
    rotulo: 'DDV Projetada Final',
    valor: `${fmtNum(ddvProj, 2)} un/dia`,
    sub: `Projeção próx. 6 sem: ${projFutura6s} un (${saz !== 1 ? `c/ sazonalidade ${fmtNum(saz, 2)}x` : 'sazonalidade neutra'})`,
    destaque: true,
    tom: 'accent'
  });

  const passoPolitica = `Lead Time ${fmtNum(lt, 1)} dias + Seguranca (${segEst} un) definem ponto de pedido Minimo de ${minEst} un e teto Maximo de ${maxEst} un.`;
  const linhasPolitica = [
    {
      icone: '⏱️',
      rotulo: 'Lead Time (Prazo)',
      valor: `${fmtNum(lt, 1)} dias`,
      sub: 'Prazo médio de entrega do fornecedor'
    },
    {
      icone: '🛡️',
      rotulo: 'Estoque de Segurança',
      valor: `${segEst} un`,
      sub: 'Buffer protetor contra atrasos de entrega'
    },
    {
      icone: '📍',
      rotulo: 'Ponto de Pedido (Mínimo)',
      valor: `${minEst} un`,
      sub: 'Gatilho de reposição no BIG'
    },
    {
      icone: '🔝',
      rotulo: 'Teto Máximo Alvo',
      valor: `${maxEst} un`,
      sub: 'Limite superior de cobertura',
      destaque: true
    }
  ];

  const passoSaldo =
    `Posicao atual: ${estoque} un em loja${transito > 0 ? ` + ${transito} un em pedido aberto (transito)` : ''} = ${cob >= 999 ? '999+' : fmtNum(cob, 1)}d de cobertura. ` +
    (buyQty > 0
      ? `Resultado: comprar ${buyQty} un (${fmtBrl(buyRs)} estimados).`
      : 'Nao gera compra liquida neste ciclo.');

  const linhasSaldo = [
    {
      icone: '🏬',
      rotulo: 'Saldo Físico em Loja',
      valor: `${estoque} un`,
      sub: `Cobertura atual: ${cob >= 999 ? '999+' : fmtNum(cob, 1)} dias`,
      tom: estoque <= 0 ? 'danger' : 'neutral'
    },
    {
      icone: '🚚',
      rotulo: 'Pedidos em Trânsito',
      valor: `${transito} un`,
      sub: transito > 0 ? 'Já faturado/a caminho' : 'Nenhum pedido em aberto'
    },
    {
      icone: '🛒',
      rotulo: 'Sugestão Efetiva',
      valor: buyQty > 0 ? `${buyQty} un (${fmtBrl(buyRs)})` : '0 un (Não Comprar)',
      sub: buyQty > 0 ? 'Necessidade líquida calculada' : 'Estoque suficiente para o ciclo',
      destaque: true,
      tom: buyQty > 0 ? 'success' : 'neutral'
    }
  ];

  const passoCotacao =
    entryStats.totalEntradas > 0
      ? `Ultima absorvida: ${fmtBrl(entryStats.ultimoCusto)} (${entryStats.ultimoFornecedor} em ${entryStats.ultimaData}). Menor custo recente: ${fmtBrl(entryStats.melhorCusto)} (${entryStats.melhorFornecedor}).`
      : `Sem historico de NF recente; referencia de cadastro ${fmtBrl(row.custo_unit)}.`;

  const linhasCotacao = [
    {
      icone: '🏷️',
      rotulo: 'Última NF Absorvida',
      valor: entryStats.totalEntradas > 0 ? fmtBrl(entryStats.ultimoCusto) : fmtBrl(row.custo_unit),
      sub: entryStats.totalEntradas > 0 ? `${entryStats.ultimoFornecedor} (${entryStats.ultimaData})` : 'Custo de referência no BIG'
    }
  ];

  if (entryStats.melhorCusto) {
    linhasCotacao.push({
      icone: '⭐',
      rotulo: 'Menor Custo Recente',
      valor: fmtBrl(entryStats.melhorCusto),
      sub: `${entryStats.melhorFornecedor} (${entryStats.melhorData})`,
      tom: 'success'
    });
  }

  if (custoVar !== 0) {
    linhasCotacao.push({
      icone: custoVar > 0 ? '📈' : '📉',
      rotulo: 'Variação Última NF',
      valor: `${custoVar > 0 ? '+' : ''}${fmtNum(custoVar, 1)}%`,
      sub: custoVar > 0 ? 'Custo subiu na última compra' : 'Custo caiu na última compra',
      tom: custoVar > 0 ? 'warn' : 'success'
    });
  }

  const isHorizon = Boolean(row.is_custom_horizon);
  const diasCobAlvo = isHorizon ? Number(row.horizon_dias || 7) : (row.dias_estoque_max || (row.abc_class === 'A' ? 12 : row.abc_class === 'B' ? 15 : 20));
  const consumoAlvo = round2(ddvProj * diasCobAlvo);
  const reservaEst = Number(row.estoque_reserva || 0);
  const dispTotal = estoque + transito - reservaEst;
  const resFmt = reservaEst > 0 ? ` - ${reservaEst} res` : '';

  let formulaTexto = '';
  if (isHorizon) {
    formulaTexto = `Horizonte ${diasCobAlvo}d: (${fmtNum(ddvProj, 2)} un/dia × ${diasCobAlvo}d = ${fmtNum(consumoAlvo, 1)} un) + Seg ${segEst} un = Alvo ${maxEst} un | Menos Disp ${dispTotal} un (${estoque} est${resFmt} + ${transito} tr) = ${buyQty} un a comprar (${fmtBrl(buyRs)})`;
  } else {
    formulaTexto = `Padrão BIG: Disp ${dispTotal} un (${estoque} est${resFmt} + ${transito} tr) <= Mín ${minEst} un -> Repor ${buyQty} un até o Máximo de ${maxEst} un (${fmtBrl(buyRs)}) | Cobertura Alvo: ${diasCobAlvo}d`;
  }

  const memoriaCalculo = {
    ddvDiaria: round2(ddvProj),
    diasAlvo: diasCobAlvo,
    consumoAlvoPeriodo: consumoAlvo,
    estoqueSeguranca: segEst,
    estoqueMaximoAlvo: maxEst,
    estoqueFisico: estoque,
    estoqueReserva: reservaEst,
    pedidosTransito: transito,
    disponivelTotal: dispTotal,
    sugestaoLiquida: buyQty,
    custoUnit: Number(row.custo_unit || 0),
    valorTotalRs: buyRs,
    isCustomHorizon: isHorizon,
    estoqueMin: minEst,
    formulaTexto
  };

  return {
    acaoCodigo,
    acaoLabel,
    acaoTom,
    parecerCurto,
    confiancaScore: score,
    confiancaNivel,
    confiancaMotivo: motivosConfianca.join(' | '),
    precoAlvoCotacao: entryStats.melhorCusto,
    melhorFornecedorRecente: entryStats.melhorFornecedor,
    melhorDataRecente: entryStats.melhorData,
    memoriaCalculo,
    passos: [
      { titulo: '1. Fluxo de Demanda & PBM', texto: passoDemanda.join(' '), linhas: linhasDemanda },
      { titulo: '2. Parâmetros de Estoque', texto: passoPolitica, linhas: linhasPolitica },
      { titulo: '3. Decisão Líquida', texto: passoSaldo, linhas: linhasSaldo },
      { titulo: '4. Referência de Negociação', texto: passoCotacao, linhas: linhasCotacao },
    ],
  };
}


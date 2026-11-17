import { getAnalyticsDb, getGroupCoverageConfigs, saveGroupCoverageConfigs, getActiveSkuSuspensions, removeSkuSuspension, recordBuyerLearning, pruneOldEngineRuns } from '../store/analyticsDb.mjs';
import { getCachedCmedMaps, lookupCmedCascade } from '../services/cmedService.mjs';
import { buildPresentationSignature } from '../../lib/moleculeNormalizer.mjs';

const NON_BUYABLE_PATTERNS = /\b(TAXA\s+DE\s+ENTREGA|TAXA\s+ENT|FRETE|PROVADOR|AMOSTRA\s+GRATIS|SACOLA\s+PLAST|SACOLA|EMBALAGEM\s+PRESENTE|SERVICO|UNIFORME|BOBINA|CAIXA\s+PAPELAO)\b/i;
const MED_GROUP_PATTERNS = /\b(ETICO|ÉTICO|GENERICO|GENÉRICO|SIMILAR|PSICO|ANTIMICROB|ANTICONCEPCIONAL|HORMON|TERMO)\b/i;

export const PERFUMARIA_HPC_PATTERNS = /\b(SHAMPOO|SHAMP|CONDICIONADOR|CONDIC|SABONETE|SABON|SAB|DESODORANTE|DESOD|ANTITRANSPIRANTE|FRALDA|FRALDAS|ABSORVENTE|ABSORV|ESCOVA|ESCOVAS|FIO\s*DENTAL|CREME\s*DENTAL|PASTA\s*DENTE|ENXAGUANTE|ENXAGUATORIO|TINTURA|COLORACAO|ESMALTE|ACETONA|ALGODAO|COTONETE|HASTE\s*FLEXIVEL|PERFUME|COLONIA|DEO\s*COLONIA|BODY\s*SPLASH|HIDRATANTE|LOCAO|PROTETOR\s*SOLAR|BLOQUEADOR|BRONZEADOR|REPELENTE|LENCO\s*UMEDECIDO|CHUPETA|MAMADEIRA|MORDEDOR|PRESERVATIVO|CAMISINHA|LUBRIFICANTE|APARELHO\s*BARBEAR|LAMINA|CARGA\s*BARBEAR|ESPUMA\s*BARBEAR|GEL\s*CABELO|POMADA\s*CABELO|CERA\s*DEPILATORIA|FOLHA\s*DEPILATORIA|LIXA|CORTADOR\s*UNHA|PINCA|TOALHA|CURATIVO|BAND-AID|BAND\s*AID|GAZE|ESPARADRAPO|SORO\s*FISIOLOGICO|AGUA\s*OXIGENADA|ALCOOL\s*70|ALCOOL\s*ETILICO|BELEZA|COSMETICO|MAKE\s*UP|MAQUIAGEM)\b/i;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function addDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

function diffDaysIso(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

function classifyMacroCategory(grupoNome, descricao, medEfetivo) {
  const text = `${grupoNome || ''} ${descricao || ''}`.toUpperCase();
  if (/SUPLEMENT|VITAM|NUTRI|LEITE|CREATINA|WHEY|COLAGENO|MELATONINA/.test(text)) return 'SUPLEMENTO_VITAMINA';
  if (/DERMO|PELE|SOLAR|FACIAL|ANTI-?IDADE|SERUM|MICELAR/.test(text)) return 'DERMOCOSMETICO';
  if (PERFUMARIA_HPC_PATTERNS.test(text)) return 'PERFUMARIA_HPC';
  if (medEfetivo) return 'MEDICAMENTO';
  return 'CONVENIENCIA_VAREJO';
}

function getProfileParams(serviceProfile) {
  const map = {
    enxuto: {
      zByKey: { AX: 1.96, AY: 1.65, AZ: 1.28, BX: 1.65, BY: 1.28, BZ: 0.84, CX: 1.0, CY: 0.84, CZ: 0.5 },
      cycleMed: { A: 7, B: 10, C: 14, D: 0 },
      cycleNonMed: { A: 14, B: 21, C: 21, D: 0 },
    },
    alta: {
      zByKey: { AX: 2.58, AY: 2.05, AZ: 1.65, BX: 2.05, BY: 1.65, BZ: 1.28, CX: 1.65, CY: 1.28, CZ: 0.84 },
      cycleMed: { A: 14, B: 21, C: 25, D: 0 },
      cycleNonMed: { A: 21, B: 30, C: 30, D: 0 },
    },
    equilibrado: {
      zByKey: { AX: 2.33, AY: 1.88, AZ: 1.44, BX: 1.88, BY: 1.44, BZ: 1.04, CX: 1.28, CY: 1.04, CZ: 0.67 },
      cycleMed: { A: 10, B: 14, C: 18, D: 0 },
      cycleNonMed: { A: 18, B: 24, C: 28, D: 0 },
    },
  };
  return map[serviceProfile] || map.equilibrado;
}

/**
 * Reconstroi dias de ruptura silenciosa na janela [startIso..refIso] a partir de estoque_posterior.
 * Ignora dias em que houve venda com saldo negativo (furo de estoque) e respeita dias com venda ativa.
 */
function computeStockoutDays(events, startIso, refIso, currentStock, saleDays13, vendas13s) {
  if (vendas13s <= 0) return 0;
  const maxPossibleZero = Math.max(0, 91 - saleDays13);
  if (maxPossibleZero === 0) return 0;
  if (!events || events.length === 0) {
    return currentStock === 0 ? Math.min(maxPossibleZero, 30) : 0;
  }
  let zeroDays = 0;
  for (let i = 0; i < events.length; i += 1) {
    const cur = events[i];
    const next = events[i + 1];
    // Conta ruptura silenciosa quando zerou/negativou e houve pausa sem vendas (gap >= 2d ou fim da janela com saldo 0)
    if (cur.min_est <= 0) {
      if (next) {
        const gap = diffDaysIso(cur.dt, next.dt);
        if (gap >= 2) zeroDays += gap - 1;
      } else if (currentStock === 0) {
        zeroDays += Math.max(0, diffDaysIso(cur.dt, refIso));
      }
    }
  }
  return Math.min(zeroDays, maxPossibleZero);
}

/**
 * Sincroniza regras PBM descobertas e devolve mapa operadora|projeto -> fator de auto-reposicao (0, 0.5, 1).
 */
function syncAndGetPbmRules(clientCode, pbmItems91) {
  const db = getAnalyticsDb();
  const agg = new Map();
  for (const row of pbmItems91) {
    const key = `${row.operadora || ''}|${row.projeto || ''}`;
    if (!agg.has(key)) agg.set(key, { operadora: row.operadora || '', projeto: row.projeto || '', tx: 0, un: 0 });
    const a = agg.get(key);
    a.tx += Number(row.cupons || 0);
    a.un += Number(row.qty_pbm || 0);
  }

  const upsert = db.prepare(`
    INSERT INTO pbm_program_rules (client_code, operadora, projeto, auto_reposicao, tx_count_91d, unidades_91d, updated_at)
    VALUES (?, ?, ?, 'S', ?, ?, datetime('now'))
    ON CONFLICT(client_code, operadora, projeto) DO UPDATE SET
      tx_count_91d = excluded.tx_count_91d,
      unidades_91d = excluded.unidades_91d,
      updated_at = datetime('now')
  `);
  for (const a of agg.values()) {
    upsert.run(clientCode, a.operadora, a.projeto, a.tx, a.un);
  }

  const rules = db.prepare('SELECT operadora, projeto, auto_reposicao FROM pbm_program_rules WHERE client_code = ?').all(clientCode);
  const factorMap = new Map();
  for (const r of rules) {
    const f = r.auto_reposicao === 'S' ? 1 : r.auto_reposicao === 'P' ? 0.5 : 0;
    factorMap.set(`${r.operadora}|${r.projeto}`, f);
  }
  return factorMap;
}

/**
 * Calcula estatisticas de Lead Time (media e desvio padrao) por fornecedor e por grupo.
 */
function buildLeadTimeStats(leadTimeRows) {
  const byForn = new Map();
  const byGrupo = new Map();

  for (const r of leadTimeRows) {
    const lt = Number(r.lt_dias);
    if (!Number.isFinite(lt) || lt < 0) continue;
    if (r.fornece_id) {
      if (!byForn.has(r.fornece_id)) byForn.set(r.fornece_id, []);
      byForn.get(r.fornece_id).push(lt);
    }
    if (r.grupo_id) {
      if (!byGrupo.has(r.grupo_id)) byGrupo.set(r.grupo_id, []);
      byGrupo.get(r.grupo_id).push(lt);
    }
  }

  const summarize = (arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, arr.length);
    return { mean: round2(mean), std: round2(Math.sqrt(variance)), n: arr.length };
  };

  const fornMap = new Map();
  for (const [id, arr] of byForn) if (arr.length >= 3) fornMap.set(id, summarize(arr));
  const grupoMap = new Map();
  for (const [id, arr] of byGrupo) if (arr.length >= 3) grupoMap.set(id, summarize(arr));
  return { fornMap, grupoMap };
}

/**
 * Sincroniza configuracoes de cobertura (dias min/max por grupo e curva).
 * Se o cliente ainda nao tiver configurado, popula com os dados nativos do Linx BIG
 * ou com defaults inteligentes farmaceuticos (A: 3-12d, B: 7-15d, C: 10-20d, D: 0-0d).
 */
function syncAndGetGroupCoverageConfig(clientCode, gruposList = []) {
  let existing = getGroupCoverageConfigs(clientCode);
  const existingMap = new Map(existing.map((g) => [g.grupo_id, g]));

  const toUpsert = [];
  for (const g of gruposList) {
    const existingRow = existingMap.get(g.grupo_id);
    const gName = g.grupo_nome || '';
    const isPerfumaria = PERFUMARIA_HPC_PATTERNS.test(gName);
    const isMed = MED_GROUP_PATTERNS.test(gName) || !isPerfumaria;
    const macro = isMed ? 'MEDICAMENTO' : isPerfumaria ? 'PERFUMARIA_HPC' : 'OUTROS';

    const hasBigDays = Number(g.min_a) > 0 || Number(g.max_a) > 0;
    const diasMinA = existingRow ? existingRow.dias_min_a : (hasBigDays ? Number(g.min_a) : (isMed ? 3 : 5));
    const diasMaxA = existingRow ? existingRow.dias_max_a : (hasBigDays ? Number(g.max_a) : (isMed ? 12 : 15));
    const diasMinB = existingRow ? existingRow.dias_min_b : (hasBigDays ? Number(g.min_b) : (isMed ? 7 : 10));
    const diasMaxB = existingRow ? existingRow.dias_max_b : (hasBigDays ? Number(g.max_b) : (isMed ? 15 : 20));
    const diasMinC = existingRow ? existingRow.dias_min_c : (hasBigDays ? Number(g.min_c) : (isMed ? 10 : 15));
    const diasMaxC = existingRow ? existingRow.dias_max_c : (hasBigDays ? Number(g.max_c) : (isMed ? 20 : 25));
    const diasMinD = existingRow ? existingRow.dias_min_d : (hasBigDays ? Number(g.min_d) : 0);
    const diasMaxD = existingRow ? existingRow.dias_max_d : (hasBigDays ? Number(g.max_d) : 0);

    toUpsert.push({
      grupo_id: g.grupo_id,
      grupo_nome: gName,
      codigo: g.codigo || '',
      desc_arvore: g.desc_arvore || '',
      grupo_pai_nome: g.grupo_pai_nome || 'OUTROS',
      grupo_filho_nome: g.grupo_filho_nome || gName,
      macro_categoria: macro,
      total_produtos: Number(g.total_produtos ?? g.total_prods ?? 0),
      dias_min_a: diasMinA,
      dias_max_a: diasMaxA,
      dias_min_b: diasMinB,
      dias_max_b: diasMaxB,
      dias_min_c: diasMinC,
      dias_max_c: diasMaxC,
      dias_min_d: diasMinD,
      dias_max_d: diasMaxD,
      source: existingRow?.source || (hasBigDays ? 'LINX_BIG_GRUPO' : 'SMART_AI_DEFAULT'),
    });
  }

  if (toUpsert.length > 0) {
    saveGroupCoverageConfigs(clientCode, toUpsert);
    existing = getGroupCoverageConfigs(clientCode);
  }

  return new Map(existing.map((g) => [g.grupo_id, g]));
}

/**
 * Executa o motor matematico completo em cima dos dados extraidos do BIG
 * e grava o resultado completo no SQLite analitico (`engine_runs`, `engine_sku_results`, `engine_remanejamento`, `engine_molecule_summary`).
 */
export function runPurchasingEngine(profile, rawData, { weeksWindow = profile.default_weeks || 13, serviceProfile = profile.service_profile || 'equilibrado', recentEntriesLimit = profile.recent_entries_limit || 5 } = {}) {
  const t0 = Date.now();
  const db = getAnalyticsDb();
  const cmedMaps = getCachedCmedMaps();
  const profParams = getProfileParams(serviceProfile);
  const { referenceDate: refDate, start91, salesFilials, allScopeFilials } = rawData;

  const groupConfigMap = syncAndGetGroupCoverageConfig(profile.code, rawData.gruposList || []);
  const pbmRuleFactor = syncAndGetPbmRules(profile.code, rawData.pbmItems91);
  const { fornMap: ltByForn, grupoMap: ltByGrupo } = buildLeadTimeStats(rawData.leadTimeHistory);

  // Carrega De->Para manual salvo no SQLite
  const deParaRows = db.prepare('SELECT * FROM molecule_de_para WHERE client_code = ?').all(profile.code);
  const deParaMap = new Map(deParaRows.map((r) => [r.produto_id, r]));

  // Carrega repositório global de conhecimento aprendido com compradores especialistas (REV-006)
  let globalKnowledgeRows = [];
  try {
    globalKnowledgeRows = db.prepare('SELECT * FROM global_molecule_knowledge').all();
  } catch {}
  const globalByEan = new Map();
  const globalByPid = new Map();
  for (const k of globalKnowledgeRows) {
    if (k.barras) globalByEan.set(k.barras, k);
    if (k.produto_id) globalByPid.set(k.produto_id, k);
  }

  // Mapas de acesso rapido
  const prodMap = new Map();
  const cmedAuditStats = { matched: 0, viaProdBarras: 0, viaExtraBarras: 0, viaRegFallback: 0, eanMsDivergent: 0, flagMedIncorreta: 0 };

  for (const p of rawData.products) {
    const isBuyable = p.taxa_entrega !== 'S' && !NON_BUYABLE_PATTERNS.test(p.descricao);
    const extraUnit = p.extra_barras_unit ? p.extra_barras_unit.split(',') : [];
    const extraMaster = p.extra_barras_master ? p.extra_barras_master.split(',') : [];

    // Protecao estrita contra perfumaria/higiene/correlatos serem confundidos com medicamentos
    const isPerfumariaOrNonMed = PERFUMARIA_HPC_PATTERNS.test(p.descricao) || PERFUMARIA_HPC_PATTERNS.test(p.grupo_nome);
    const looksLikeMedGroup = !isPerfumariaOrNonMed && MED_GROUP_PATTERNS.test(p.grupo_nome);

    const cmedLookup = isPerfumariaOrNonMed
      ? { hit: null, source: null, eanMsDivergent: false }
      : lookupCmedCascade(
          { prodBarras: p.prod_barras, extraBarrasUnit: extraUnit, gtin14: p.gtin14, extraBarrasMaster: extraMaster, registroMs: p.registro_ms },
          cmedMaps
        );

    const isMedEffective = !isPerfumariaOrNonMed && (p.medicamento === 'S' || looksLikeMedGroup || Boolean(cmedLookup.hit) || p.produto_apresentacao_id > 0);
    if (isMedEffective && p.medicamento !== 'S' && isBuyable) {
      cmedAuditStats.flagMedIncorreta += 1;
    }

    if (cmedLookup.hit) {
      cmedAuditStats.matched += 1;
      if (cmedLookup.source === 'produto.barras') cmedAuditStats.viaProdBarras += 1;
      else if (cmedLookup.source?.startsWith('barras')) cmedAuditStats.viaExtraBarras += 1;
      else if (cmedLookup.source === 'registro_ms') cmedAuditStats.viaRegFallback += 1;
      if (cmedLookup.eanMsDivergent) cmedAuditStats.eanMsDivergent += 1;
    }

    // Chave canonica de molecula apenas para medicamentos efetivos estritos (NUNCA perfumaria)
    let moleculeKey = null;
    let tipoProdutoCmed = '';
    const customDePara = deParaMap.get(p.produto_id);
    const globalLearned = !customDePara ? (globalByPid.get(p.produto_id) || (p.prod_barras ? globalByEan.get(p.prod_barras) : null)) : null;

    if (!isPerfumariaOrNonMed && customDePara && customDePara.status === 'approved') {
      moleculeKey = customDePara.canon_key;
      tipoProdutoCmed = customDePara.tipo_produto || '';
    } else if (!isPerfumariaOrNonMed && globalLearned) {
      moleculeKey = globalLearned.canon_key;
      tipoProdutoCmed = 'Medicamento (Aprendido IA)';
    } else if (isMedEffective && isBuyable && !isPerfumariaOrNonMed) {
      if (cmedLookup.hit?.sigKey) {
        moleculeKey = cmedLookup.hit.sigKey;
        tipoProdutoCmed = cmedLookup.hit.tipoProduto || '';
      } else {
        const sig = buildPresentationSignature({
          substancia: p.princ_big || p.pap_subst || '',
          textoFonte: p.descricao,
          isCmed: false,
          allowTolerance: Boolean(profile.allow_pack_tolerance),
        });
        if (sig.isReliable) {
          moleculeKey = sig.key;
        }
      }
    }

    const macroCategoria = classifyMacroCategory(p.grupo_nome, p.descricao, isMedEffective);
    prodMap.set(p.produto_id, {
      ...p,
      isBuyable,
      isMedEffective,
      flagMedIncorreta: isMedEffective && p.medicamento !== 'S' && isBuyable,
      macroCategoria,
      cmedHit: cmedLookup.hit,
      cmedSource: cmedLookup.source,
      eanMsDivergent: cmedLookup.eanMsDivergent,
      moleculeKey,
      tipoProdutoCmed,
    });
  }

  // Mapeamento EAN -> produto_id para vincular itens de NFe sem produto_id preenchido
  const prodByEan = new Map();
  for (const [pId, p] of prodMap) {
    if (p.barras) prodByEan.set(String(p.barras).trim(), pId);
  }

  const stockMap = new Map();
  for (const s of rawData.stockRows) {
    stockMap.set(`${s.filial_id}|${s.produto_id}`, s);
  }
  const suspendedSet = new Set(rawData.suspendedRows.map((r) => `${r.filial_id}|${r.produto_id}`));
  const clientCode = profile.code || 'bandeirante';
  const motorSuspensions = getActiveSkuSuspensions(clientCode);
  for (const ms of motorSuspensions) {
    suspendedSet.add(`${ms.filial_id}|${ms.produto_id}`);
  }

  // Ultimas N entradas por produto (global / por filial) + entregas por fornecedor para abater transito
  const entriesByProd = new Map();
  const entriesSinceByKey = new Map();
  for (const e of rawData.entries) {
    if (!entriesByProd.has(e.produto_id)) entriesByProd.set(e.produto_id, []);
    entriesByProd.get(e.produto_id).push(e);
    const ek = `${e.filial_id}|${e.produto_id}|${e.fornece_id}`;
    if (!entriesSinceByKey.has(ek)) entriesSinceByKey.set(ek, []);
    entriesSinceByKey.get(ek).push({ datanota: e.datanota, qty: Number(e.quantiuni || 0) });
  }

  // Transito real confiavel (pedidos em aberto + NFe faturadas aguardando conferencia física)
  const transitMap = new Map();
  const nfeInvoicedMap = new Map();
  for (const ped of rawData.openOrders) {
    const ek = `${ped.filial_id}|${ped.produto_id}|${ped.fornece_id}`;
    const receivedAfter = (entriesSinceByKey.get(ek) || [])
      .filter((en) => en.datanota >= ped.dt_pedido)
      .reduce((acc, en) => acc + en.qty, 0);
    const pending = Math.max(0, Number(ped.qty_pedida || 0) - receivedAfter);
    if (pending > 0) {
      const k = `${ped.filial_id}|${ped.produto_id}`;
      transitMap.set(k, (transitMap.get(k) || 0) + pending);
    }
  }

  // 8.1 Transito Faturado em NFe (caminhão na estrada, importada = 'N' em nfe_cab)
  for (const nfe of rawData.unimportedNfe || []) {
    let pId = Number(nfe.produto_id || 0);
    if (!pId && nfe.barras) {
      pId = prodByEan.get(String(nfe.barras).trim()) || 0;
    }
    if (!pId) continue;
    const qty = Number(nfe.qty_faturada || 0);
    if (qty <= 0) continue;
    const k = `${nfe.filial_id}|${pId}`;
    transitMap.set(k, (transitMap.get(k) || 0) + qty);
    nfeInvoicedMap.set(k, (nfeInvoicedMap.get(k) || 0) + qty);
  }

  // Agrupa vendas semanais por (filial_id, produto_id)
  const salesMap = new Map();
  for (const w of rawData.weeklySales) {
    const k = `${w.filial_id}|${w.produto_id}`;
    if (!salesMap.has(k)) {
      salesMap.set(k, { weeks: new Array(13).fill(0), rev13: 0, saleDays13: 0 });
    }
    const obj = salesMap.get(k);
    const wi = Number(w.week_idx);
    if (wi >= 0 && wi < 13) obj.weeks[wi] += Number(w.qty || 0);
    obj.rev13 += Number(w.revenue || 0);
    obj.saleDays13 += Number(w.sale_days || 0);
  }

  // Validação inteligente de reativação de suspensões de desova (REV-021 corrigido)
  // Utiliza prodMap com moleculeKey resolvida, stockMap real da filial e vendas do salesMap
  for (const ms of motorSuspensions) {
    if (ms.origem === 'CURADORIA_DESOVA' || (ms.motivo && ms.motivo.toLowerCase().includes('desova'))) {
      const molKey = ms.molecule_key;
      if (molKey) {
        const competitors = Array.from(prodMap.values()).filter((p) => p.moleculeKey === molKey && p.produto_id !== ms.produto_id);
        if (competitors.length > 0) {
          let compStockTotal = 0;
          let compSales13Total = 0;
          for (const comp of competitors) {
            const skKey = `${ms.filial_id}|${comp.produto_id}`;
            const st = stockMap.get(skKey);
            const sl = salesMap.get(skKey);
            compStockTotal += Number(st?.estoque || 0);
            if (sl) compSales13Total += sl.weeks.reduce((a, b) => a + b, 0);
          }
          const compDdvTotal = compSales13Total / (13 * 7);
          const compCoverage = compDdvTotal > 0 ? (compStockTotal / compDdvTotal) : (compStockTotal > 0 ? 999 : 0);
          const threshold = Number(ms.gatilho_cobertura_limite || 7.0);

          // Só reativa se o concorrente zerou o estoque físico OU a cobertura caiu para <= limite seguro (ex: 7d)
          if (compStockTotal === 0 || (compDdvTotal > 0 && compCoverage <= threshold)) {
            removeSkuSuspension(clientCode, ms.filial_id, ms.produto_id);
            suspendedSet.delete(`${ms.filial_id}|${ms.produto_id}`);
            recordBuyerLearning(clientCode, {
              filial_id: ms.filial_id,
              produto_id: ms.produto_id,
              molecule_key: ms.molecule_key,
              descricao: ms.descricao,
              tipo_evento: 'REATIVACAO_AUTOMATICA_DESOVA',
              motivo: `Estoque de marcas concorrentes atingiu ${compCoverage.toFixed(1)}d (limite seguro <= ${threshold}d). Compra reativada automaticamente sem ruptura!`,
              acao_futura: 'LIBERAR_COMPRA',
            });
          }
        }
      }
    }
  }

  const yoyMap = new Map(rawData.yoySales.map((r) => [`${r.filial_id}|${r.produto_id}`, r]));
  const epMap = new Map();
  for (const ep of rawData.epDaily) {
    const k = `${ep.filial_id}|${ep.produto_id}`;
    if (!epMap.has(k)) epMap.set(k, []);
    epMap.get(k).push(ep);
  }
  const manualLostMap = new Map(rawData.manualLostSales.map((r) => [`${r.filial_id}|${r.produto_id}`, Number(r.qty_perdida || 0)]));

  // Lotes por (filial_id, produto_id) ordenados pela menor validade
  const lotsMap = new Map();
  const limit90d = addDaysIso(refDate, 90);
  for (const l of rawData.lots) {
    const k = `${l.filial_id}|${l.produto_id}`;
    if (!lotsMap.has(k)) lotsMap.set(k, []);
    lotsMap.get(k).push({ ...l, qty: Number(l.qty || 0) });
  }
  for (const arr of lotsMap.values()) arr.sort((a, b) => a.validade.localeCompare(b.validade));

  const lossMap = new Map(rawData.losses.map((r) => [`${r.filial_id}|${r.produto_id}`, r]));

  // PBM por (filial_id, produto_id)
  const pbmProdMap = new Map();
  for (const row of rawData.pbmItems91) {
    const k = `${row.filial_id}|${row.produto_id}`;
    if (!pbmProdMap.has(k)) pbmProdMap.set(k, { totalPbm: 0, autoPbm: 0, labels: [] });
    const pObj = pbmProdMap.get(k);
    const qty = Number(row.qty_pbm || 0);
    const factor = pbmRuleFactor.get(`${row.operadora || ''}|${row.projeto || ''}`) ?? 1;
    pObj.totalPbm += qty;
    pObj.autoPbm += qty * factor;
    if (row.projeto || row.operadora) pObj.labels.push(`${row.projeto || `OP ${row.operadora}`} (${qty})`);
  }

  // Passo A: Montar registros por (filial de venda ativo, produto) e calcular Pareto ABC
  const filiaisMetaMap = new Map((rawData.filiaisMetadata || []).map((f) => [f.filial_id, f]));
  const incomingTransfers = rawData.pendingTransfers?.incomingMap || new Map();
  const outgoingTransfers = rawData.pendingTransfers?.outgoingMap || new Map();

  // Curva de vendas da rede madura para validação cruzada de compras da loja nova
  const matureNetworkSales = new Map();
  for (const w of rawData.weeklySales) {
    const fMeta = filiaisMetaMap.get(Number(w.filial_id));
    if (fMeta && !fMeta.emCarencia) {
      const pId = Number(w.produto_id);
      matureNetworkSales.set(pId, (matureNetworkSales.get(pId) || 0) + Number(w.qty || 0));
    }
  }

  const computedRows = [];
  for (const filialId of allScopeFilials) {
    const isSalesFilial = salesFilials.includes(filialId);
    const fMeta = filiaisMetaMap.get(filialId) || {};
    const filialNome = fMeta.nome || `Filial ${filialId}`;
    const filialReduz = fMeta.reduz || `L${String(filialId).padStart(2, '0')}`;
    const emCarencia = Boolean(fMeta.emCarencia);
    const diasCarencia = Number(fMeta.diasCarencia || 90);
    const bloquearDoacao = Boolean(fMeta.bloquearDoacao);
    const tipoReposicao = fMeta.tipoReposicao || (emCarencia ? 'sellout_1to1' : 'curva_motor');
    const diasOperacao = Number(fMeta.diasOperacao || 999);

    for (const [produtoId, p] of prodMap) {
      const skKey = `${filialId}|${produtoId}`;
      const st = stockMap.get(skKey);
      const sl = salesMap.get(skKey);
      if (!st && !sl && !lotsMap.has(skKey)) continue;

      const transitoRemanejamento = incomingTransfers.get(skKey) || 0;
      const reservaRemanejamento = outgoingTransfers.get(skKey) || 0;
      const estoqueAtual = Number(st?.estoque || 0);
      const estoqueReserva = Number(st?.estoque_reserva || 0) + reservaRemanejamento;
      const transitoReal = (transitMap.get(skKey) || 0) + transitoRemanejamento;
      const allEntries = entriesByProd.get(produtoId) || [];
      const lastEntries = allEntries.slice(0, Math.max(1, recentEntriesLimit));
      const latestEntry = lastEntries[0] || null;

      // Fornecedor mais barato nos ultimos 30 dias (ou fallback para ultima compra)
      const entries30d = allEntries.filter((e) => {
        if (!e.datanota) return false;
        const dDiff = (new Date(refDate) - new Date(e.datanota)) / (1000 * 60 * 60 * 24);
        return dDiff >= 0 && dDiff <= 30 && (Number(e.custo_item) > 0 || Number(e.precouni) > 0);
      });

      let bestSupplier30d = null;
      if (entries30d.length > 0) {
        entries30d.sort((a, b) => {
          const costA = Number(a.custo_item) > 0 ? Number(a.custo_item) : Number(a.precouni);
          const costB = Number(b.custo_item) > 0 ? Number(b.custo_item) : Number(b.precouni);
          return costA - costB;
        });
        const best = entries30d[0];
        const cost = Number(best.custo_item) > 0 ? Number(best.custo_item) : Number(best.precouni);
        bestSupplier30d = {
          fornece_id: Number(best.fornece_id || 0),
          fornecedor_nome: String(best.fornecedor_nome || 'DESCONHECIDO'),
          fornecedor_cnpj: String(best.fornecedor_cnpj || ''),
          menor_custo: round2(cost),
          datanota: best.datanota,
          origem: 'ULTIMOS_30D',
        };
      } else if (latestEntry) {
        const lastCost = Number(latestEntry.custo_item) > 0 ? Number(latestEntry.custo_item) : Number(latestEntry.precouni);
        bestSupplier30d = {
          fornece_id: Number(latestEntry.fornece_id || 0),
          fornecedor_nome: String(latestEntry.fornecedor_nome || 'DESCONHECIDO'),
          fornecedor_cnpj: String(latestEntry.fornecedor_cnpj || ''),
          menor_custo: round2(lastCost),
          datanota: latestEntry.datanota,
          origem: 'ULTIMA_COMPRA',
        };
      }

      const weeks = sl ? sl.weeks : new Array(13).fill(0);
      const vendas6s = weeks.slice(0, 6).reduce((a, b) => a + b, 0);
      const vendas9s = weeks.slice(0, 9).reduce((a, b) => a + b, 0);
      const vendas13s = weeks.reduce((a, b) => a + b, 0);
      const rev13 = sl ? sl.rev13 : 0;
      const saleDays13 = sl?.saleDays13 || 0;

      // Custo unitario real (nunca usar preco_cmp de caixa fechado!)
      const pmcAtual = Number(st?.pmc_atual || 0);
      const custoUltEnt = Number(latestEntry?.custo_item || 0);
      const custoUnit = round2(pmcAtual > 0 ? pmcAtual : custoUltEnt > 0 ? custoUltEnt : Number(p.preco_cmp || 0) / p.qt_fr);
      const precoFilial = Number(st?.preco_filial || 0);
      const prodPrecoVnd = Number(p.prod_preco_vnd || 0);
      const avgStreetPrice = vendas13s > 0 && rev13 > 0 ? rev13 / vendas13s : 0;
      const precoVenda = round2(avgStreetPrice > 0 ? avgStreetPrice : precoFilial > 0 ? precoFilial : prodPrecoVnd);
      const margemPct = precoVenda > 0 && custoUnit > 0 ? round2(((precoVenda - custoUnit) / precoVenda) * 100) : 0;

      // Variacao de custo ultima entrada vs media anteriores
      let custoVariacaoPct = 0;
      if (lastEntries.length >= 2 && Number(lastEntries[0].custo_item) > 0) {
        const prevValid = lastEntries.slice(1).map((x) => Number(x.custo_item)).filter((v) => v > 0);
        if (prevValid.length > 0) {
          const avgPrev = prevValid.reduce((a, b) => a + b, 0) / prevValid.length;
          custoVariacaoPct = round2(((Number(lastEntries[0].custo_item) - avgPrev) / avgPrev) * 100);
        }
      }

      const grossProfit13 = rev13 > 0 ? Math.max(0, rev13 - vendas13s * custoUnit) : 0;

      // Media ponderada semanal de acordo com janela selecionada (6, 9 ou 13 semanas)
      let weightedDaily = 0;
      const activeWeeksSlice = weeks.slice(0, weeksWindow);
      if (weeksWindow === 13) {
        const wRecent = weeks.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
        const wMid = weeks.slice(4, 9).reduce((a, b) => a + b, 0) / 5;
        const wOld = weeks.slice(9, 13).reduce((a, b) => a + b, 0) / 4;
        weightedDaily = (wRecent * 0.5 + wMid * 0.3 + wOld * 0.2) / 7;
      } else if (weeksWindow === 9) {
        const wRecent = weeks.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
        const wOld = weeks.slice(4, 9).reduce((a, b) => a + b, 0) / 5;
        weightedDaily = (wRecent * 0.6 + wOld * 0.4) / 7;
      } else {
        const wRecent = weeks.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const wOld = weeks.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
        weightedDaily = (wRecent * 0.65 + wOld * 0.35) / 7;
      }

      // CV semanal para XYZ
      const meanW = activeWeeksSlice.reduce((a, b) => a + b, 0) / activeWeeksSlice.length;
      const stdW = Math.sqrt(activeWeeksSlice.reduce((a, b) => a + (b - meanW) ** 2, 0) / activeWeeksSlice.length);
      const cv = meanW > 0 ? stdW / meanW : 9.99;
      const xyzClass = meanW === 0 ? 'Z' : cv <= 0.5 ? 'X' : cv <= 1.0 ? 'Y' : 'Z';

      // Dias sem estoque e demanda ajustada pela ruptura
      const diasSemEstoque = isSalesFilial ? computeStockoutDays(epMap.get(skKey), start91, refDate, estoqueAtual, saleDays13, vendas13s) : 0;
      const ddvBruta = isSalesFilial ? weightedDaily : 0;
      const diasExpostos = Math.max(14, 91 - diasSemEstoque);
      const fatorRuptura = Math.min(2.5, 91 / diasExpostos);
      const ddvAjustada = isSalesFilial ? ddvBruta * fatorRuptura : 0;

      const manualLost = manualLostMap.get(skKey) || 0;
      const vendaPerdidaEstUn = round2(ddvAjustada * diasSemEstoque + manualLost);
      const vendaPerdidaEstRs = round2(vendaPerdidaEstUn * precoVenda);

      // Sazonalidade YoY
      const yoy = yoyMap.get(skKey);
      let idxSaz = 1.0;
      if (yoy && Number(yoy.next30_ly) + Number(yoy.prev60_ly) >= 6 && Number(yoy.prev60_ly) > 0) {
        const rawIdx = (Number(yoy.next30_ly) / 30) / (Number(yoy.prev60_ly) / 60);
        idxSaz = round2(Math.max(0.6, Math.min(2.2, rawIdx)));
      }

      // PBM auto-reposicao (usa proporcao real PBM sobre o volume total para nao inflar com ruptura)
      const pbmInfo = pbmProdMap.get(skKey) || { totalPbm: 0, autoPbm: 0, labels: [] };
      const pbmShare = vendas13s > 0 ? Math.min(1, pbmInfo.autoPbm / vendas13s) : 0;
      const ddvPbmAuto = ddvAjustada * pbmShare;
      const ddvLiquida = Math.max(0, ddvAjustada * (1 - pbmShare));
      const ddvProjetada = ddvLiquida * idxSaz;

      // Lotes e perdas com blindagem contra estoques fantasmas
      const skuLots = lotsMap.get(skKey) || [];
      let loteVencendo90dQtd = 0;
      let loteVencidoQtd = 0;
      let loteMenorValidade = skuLots[0]?.validade || null;
      for (const lt of skuLots) {
        if (lt.validade < refDate) loteVencidoQtd += lt.qty;
        else if (lt.validade <= limit90d) loteVencendo90dQtd += lt.qty;
      }
      // Blindagem estrita: quantidade total em risco não pode exceder o estoque físico atual da loja
      if (estoqueAtual <= 0) {
        loteVencendo90dQtd = 0;
        loteVencidoQtd = 0;
      } else {
        loteVencidoQtd = Math.min(loteVencidoQtd, estoqueAtual);
        loteVencendo90dQtd = Math.min(loteVencendo90dQtd, Math.max(0, estoqueAtual - loteVencidoQtd));
      }
      const loteVencendo90dRs = round2(loteVencendo90dQtd * custoUnit);
      const lossInfo = lossMap.get(skKey);
      const erpRanking = String(st?.curvaabc_raw || p.prod_curvaabc || '').trim();
      let erpClasse = '';
      if (erpRanking) {
        const m = erpRanking.match(/^([ABCD])/i);
        if (m) erpClasse = m[1].toUpperCase();
      }

      computedRows.push({
        filialId,
        isSalesFilial,
        produtoId,
        p,
        st,
        curvaErpRanking: erpRanking,
        curvaErpClasse: erpClasse,
        diasEstoqueMin: 0,
        diasEstoqueMax: 0,
        estoqueAtual,
        estoqueReserva,
        transitoReal,
        custoUnit,
        precoVenda,
        margemPct,
        custoVariacaoPct,
        latestEntry,
        lastEntries,
        bestSupplier30d,
        vendas6s,
        vendas9s,
        vendas13s,
        rev13,
        grossProfit13,
        saleDays13: sl?.saleDays13 || 0,
        xyzClass,
        stdDaily: (stdW / Math.sqrt(7)) * fatorRuptura * (1 - pbmShare),
        diasSemEstoque,
        vendaPerdidaEstUn,
        vendaPerdidaEstRs,
        ddvBruta,
        ddvAjustada,
        ddvPbmAuto,
        ddvLiquida,
        idxSaz,
        ddvProjetada,
        vendasPbm13s: pbmInfo.totalPbm,
        pbmLabels: pbmInfo.labels,
        loteVencendo90dQtd,
        loteVencendo90dRs,
        loteVencidoQtd,
        loteMenorValidade,
        perda2026Un: Number(lossInfo?.qty_perda || 0),
        perda2026Rs: Number(lossInfo?.val_perda || 0),
        abcClass: 'D',
        isTrafficBuilder: false,
        necessidadeBruta: 0,
        remanEntrada: 0,
        remanSaida: 0,
        filialNome,
        filialReduz,
        emCarencia,
        diasCarencia,
        bloquearDoacao,
        tipoReposicao,
        diasOperacao,
        transitoRemanejamento,
        suspended:
          suspendedSet.has(skKey) || st?.compra_suspensa === 'S' || st?.pf_compra_suspensa === 'S' || !p.isBuyable,
      });
    }
  }

  // Passo B: Pareto ABC Economico calculado pelo Motor (Metodologia de Representatividade por Faturamento da Planilha)
  // A curva do ERP (curvaErpRanking / curvaErpClasse) e mantida para comparacao e auditoria do comprador
  for (const filialId of salesFilials) {
    const withSales = computedRows
      .filter((r) => r.filialId === filialId && r.p.isBuyable && r.vendas13s > 0)
      .map((r) => ({ r, score: Math.max(0, Number(r.rev13 || 0)) }))
      .sort((a, b) => b.score - a.score);

    const totalScore = withSales.reduce((acc, x) => acc + x.score, 0) || 1;
    let accum = 0;
    for (let i = 0; i < withSales.length; i += 1) {
      const item = withSales[i];
      accum += item.score;
      const pct = accum / totalScore;
      // Regra estrita da planilha: Curva A ~55%, Curva B ~35% (acumulado até 90%), Curva C restante 10%
      let abc = pct <= 0.55 ? 'A' : pct <= 0.90 ? 'B' : 'C';

      // Preserva percentual acumulado do Pareto para exibição e auditoria
      item.r.paretoPct = Math.round(pct * 1000) / 10;

      // Regra Traffic Builders (presenca frequente no balcao >= 35 dias -> minimo B)
      if (item.r.saleDays13 >= 35 && abc === 'C') {
        abc = 'B';
        item.r.isTrafficBuilder = true;
      }

      // Curva primária calculada pela inteligência do Motor
      item.r.abcClass = abc;
    }

    // Itens sem vendas no período ativo recebem Curva D no Motor (parados/sem giro recente)
    for (const r of computedRows) {
      if (r.filialId === filialId && r.vendas13s <= 0) {
        r.abcClass = 'D';
        r.paretoPct = 100.0;
      }
    }
  }

  // Passo C: Calcular Lead Time, Minimo, Seguranca, Maximo e Ponto de Pedido por Grupo/Curva
  for (const r of computedRows) {
    const fornId = r.latestEntry?.fornece_id || 0;
    const ltStat =
      ltByForn.get(fornId) ||
      ltByGrupo.get(r.p.grupo_id) ||
      (r.p.macroCategoria === 'MEDICAMENTO'
        ? { mean: 4, std: 1.5 }
        : r.p.macroCategoria === 'CONVENIENCIA_VAREJO'
          ? { mean: 7, std: 2 }
          : { mean: 15, std: 5 });

    r.leadTimeDias = ltStat.mean;
    r.ltStd = ltStat.std;

    // Resgata dias de cobertura configurados por Grupo e Curva
    const grpCfg = groupConfigMap.get(r.p.grupo_id);
    let diasMin = 0;
    let diasMax = 0;
    if (r.abcClass === 'A') {
      diasMin = grpCfg?.dias_min_a ?? 3;
      diasMax = grpCfg?.dias_max_a ?? 12;
    } else if (r.abcClass === 'B') {
      diasMin = grpCfg?.dias_min_b ?? 7;
      diasMax = grpCfg?.dias_max_b ?? 15;
    } else if (r.abcClass === 'C') {
      diasMin = grpCfg?.dias_min_c ?? 10;
      diasMax = grpCfg?.dias_max_c ?? 20;
    } else {
      diasMin = grpCfg?.dias_min_d ?? 0;
      diasMax = grpCfg?.dias_max_d ?? 0;
    }
    if (diasMax < diasMin) diasMax = diasMin + 2;

    r.diasEstoqueMin = diasMin;
    r.diasEstoqueMax = diasMax;

    if (!r.isSalesFilial || !r.p.isBuyable || r.abcClass === 'D' || r.ddvProjetada <= 0 || r.suspended) {
      r.estoqueSeg = 0;
      r.estoqueMin = 0;
      r.estoqueMax = 0;
      r.coberturaDias = r.ddvProjetada > 0 ? round2(r.estoqueAtual / r.ddvProjetada) : r.estoqueAtual > 0 ? 999 : 0;
      r.necessidadeBruta = 0;
      continue;
    }

    // Calculo calibrado de Ponto de Pedido (estoqueMin) e Teto (estoqueMax) baseado nos dias do grupo
    r.estoqueMin = Math.max(1, Math.ceil(r.ddvProjetada * diasMin));
    let estMax = Math.max(r.estoqueMin, Math.ceil(r.ddvProjetada * diasMax));

    // Faceamento minimo de gondola em Perfumaria/Dermo/Suplemento
    const isNonMedLongCycle = ['PERFUMARIA_HPC', 'DERMOCOSMETICO', 'SUPLEMENTO_VITAMINA'].includes(r.p.macroCategoria);
    const faceFloor = isNonMedLongCycle ? (r.abcClass === 'A' ? 3 : 2) : r.abcClass === 'A' ? 2 : 1;
    estMax = Math.max(estMax, faceFloor);

    // Freio automatico se SKU tem historico relevante de perda por vencimento/avaria
    if (r.perda2026Un >= Math.max(3, r.vendas13s * 0.25)) {
      estMax = Math.min(estMax, Math.max(faceFloor, Math.ceil(r.ddvProjetada * 15)));
    }

    r.estoqueMax = Math.max(r.estoqueMin, estMax);
    r.estoqueSeg = Math.max(0, r.estoqueMin - Math.ceil(r.ddvProjetada * ltStat.mean));
    r.coberturaDias = round2(r.estoqueAtual / r.ddvProjetada);

    const disponivel = r.estoqueAtual - r.estoqueReserva + r.transitoReal;
    let nec = 0;

    if (r.emCarencia && r.tipoReposicao === 'sellout_1to1') {
      // LOJA RECÉM-INAUGURADA EM CARÊNCIA (Sell-Out 1:1 Validado com a Rede Madura)
      const matSales = matureNetworkSales.get(r.produtoId) || 0;
      const soldInStore = r.vendas13s || 0;
      if (soldInStore > 0 && disponivel <= 0 && !r.suspended) {
        if (matSales >= 15 || r.abcClass === 'A' || r.abcClass === 'B') {
          nec = Math.min(Math.ceil(soldInStore), 3);
          r.justificativaIa = `🐣 Reposição Loja Nova (Carência ${r.diasOperacao}d): Reposição Sell-Out 1:1 (${nec} un) validada na rede madura (Curva A/B com ${matSales} un vendidas).`;
          r.excecaoLojaNova = 'REPOSICAO_SELLOUT_VALIDADA_REDE';
        } else {
          nec = 1;
          r.justificativaIa = `⚠️ Reposição Cautelosa Loja Nova: Teve saída (${soldInStore} un), porém na rede madura é Curva C/D (${matSales} un). Compra unitária preventiva sugerida.`;
          r.excecaoLojaNova = 'REPOSICAO_AVALIAR_REDE';
        }
      } else {
        nec = 0;
      }
    } else {
      // GATILHO ESTRITO DE PONTO DE PEDIDO (Lojas Maduras)
      if (disponivel <= r.estoqueMin && r.ddvProjetada > 0 && r.abcClass !== 'D' && !r.suspended) {
        nec = Math.max(0, r.estoqueMax - disponivel);
      }
      const isCurvaA = r.abcClass === 'A' || /A/i.test(r.curvaErpClasse || '');
      if (isCurvaA && disponivel <= 0 && nec === 0 && r.ddvProjetada > 0 && !r.suspended) {
        nec = Math.max(1, r.estoqueMin || 1);
      }
    }

    // Trava/reducao se houver lote curto perto do vencimento cobrindo demanda imediata
    if (r.loteVencendo90dQtd > 0 && r.ddvProjetada * 45 <= r.loteVencendo90dQtd) {
      nec = 0;
    }
    if (r.suspended) nec = 0;

    r.necessidadeBruta = Math.ceil(nec);
    r.remanEntrada = 0;
    r.remanSaida = 0;
  }

  // Passo D: Cascata de Remanejamento Multi-Loja (Transfer-First + FEFO antes de comprar na distribuidora)
  const remanejamentos = [];
  if (allScopeFilials.length > 1) {
    const byProd = new Map();
    for (const r of computedRows) {
      if (!byProd.has(r.produtoId)) byProd.set(r.produtoId, []);
      byProd.get(r.produtoId).push(r);
    }

    for (const [produtoId, list] of byProd) {
      const deficits = list.filter((x) => x.necessidadeBruta > 0).sort((a, b) => b.necessidadeBruta - a.necessidadeBruta);
      if (deficits.length === 0) continue;

      // Doadores: prioridade 1 = lote curto (FEFO) / parado (demanda 0); prioridade 2 = excesso acima do maximo
      // Lojas em carência com trava de doação NUNCA podem ceder seu estoque de abertura
      const donors = list
        .map((x) => {
          const isProtectedDonor = x.emCarencia || x.bloquearDoacao || (x.diasOperacao <= (x.diasCarencia || 90));
          if (isProtectedDonor) {
            return { x, excesso: 0, isParado: false, hasShortLot: false };
          }
          const livre = Math.max(0, x.estoqueAtual - x.estoqueReserva - x.remanSaida);
          const isParado = !x.isSalesFilial || x.ddvProjetada <= 0;
          const excesso = isParado ? livre : Math.max(0, livre - x.estoqueMax);
          return { x, excesso, isParado, hasShortLot: x.loteVencendo90dQtd > 0 };
        })
        .filter((d) => d.excesso > 0)
        .sort((a, b) => Number(b.hasShortLot) - Number(a.hasShortLot) || Number(b.isParado) - Number(a.isParado) || b.excesso - a.excesso);

      for (const dest of deficits) {
        let missing = dest.necessidadeBruta - dest.remanEntrada;
        for (const d of donors) {
          if (missing <= 0) break;
          if (d.x.filialId === dest.filialId || d.excesso <= 0) continue;
          const qtd = Math.min(missing, Math.floor(d.excesso));
          if (qtd <= 0) continue;

          d.excesso -= qtd;
          d.x.remanSaida += qtd;
          dest.remanEntrada += qtd;
          missing -= qtd;

          const tipo = d.hasShortLot ? 'FEFO_VALIDADE' : d.isParado ? 'PARADO' : 'EXCESSO';
          remanejamentos.push({
            produtoId,
            descricao: dest.p.descricao,
            filialOrigem: d.x.filialId,
            filialDestino: dest.filialId,
            tipo,
            qtdSugerida: qtd,
            custoUnit: dest.custoUnit,
            valorTotal: round2(qtd * dest.custoUnit),
            validadePrioritaria: d.x.loteMenorValidade,
            motivo:
              tipo === 'FEFO_VALIDADE'
                ? `Lote curto (${d.x.loteMenorValidade}) na filial ${d.x.filialId} transferido para giro na filial ${dest.filialId}`
                : tipo === 'PARADO'
                  ? `Estoque parado na filial ${d.x.filialId} resgatado antes da compra`
                  : `Excesso acima do maximo na filial ${d.x.filialId}`,
          });
        }
      }
    }
  }

  // Passo E: Necessidade liquida pos-remanejamento + Consolidacao por Molecula + Excecoes e Justificativa IA
  const molBuckets = new Map();
  for (const r of computedRows) {
    const sugFinal = Math.max(0, r.necessidadeBruta - r.remanEntrada);
    r.sugestaoCompraUn = sugFinal;
    r.sugestaoCompraRs = round2(sugFinal * r.custoUnit);
    const lucroUnit = Math.max(0.01, r.precoVenda - r.custoUnit);
    r.roiMarginal = r.custoUnit > 0 ? round2((r.ddvProjetada * lucroUnit) / r.custoUnit) : 0;

    if (r.p.moleculeKey && r.isSalesFilial) {
      const isRef = /NOVO|BIOLOGICO|ESPECIFICO/i.test(r.p.tipoProdutoCmed || '') ? 1 : 0;
      const mKey = `${r.p.moleculeKey}|${isRef}`;
      if (!molBuckets.has(mKey)) {
        molBuckets.set(mKey, {
          moleculeKey: r.p.moleculeKey,
          ehReferencia: isRef,
          items: [],
        });
      }
      molBuckets.get(mKey).items.push(r);
    }
  }

  const molSummaries = [];
  const coveredMoleculeAlert = new Set();
  for (const b of molBuckets.values()) {
    const items = b.items;
    if (items.length < 2) continue; // Consolida moleculas com 2+ SKUs ativos na rede
    const labs = new Set(items.map((i) => i.p.labora.trim()).filter(Boolean));
    const estoqueTotal = items.reduce((a, i) => a + Math.max(0, i.estoqueAtual), 0);
    const transitoTotal = items.reduce((a, i) => a + i.transitoReal, 0);
    const ddvProjTotal = items.reduce((a, i) => a + i.ddvProjetada, 0);
    const maxTotal = items.reduce((a, i) => a + i.estoqueMax, 0);
    const sugSkuSoma = items.reduce((a, i) => a + i.sugestaoCompraUn, 0);
    const cobMol = ddvProjTotal > 0 ? round2(estoqueTotal / ddvProjTotal) : estoqueTotal > 0 ? 999 : 0;
    const necLiquidaMol = Math.max(0, Math.ceil(maxTotal - (estoqueTotal + transitoTotal)));
    const econUn = Math.max(0, sugSkuSoma - necLiquidaMol);

    // Melhor SKU pelo menor custo unitario valido com entrada recente
    const withCost = [...items].filter((i) => i.custoUnit > 0).sort((a, b) => a.custoUnit - b.custoUnit);
    const best = withCost[0] || items[0];
    const avgCost = withCost.length > 0 ? withCost.reduce((a, x) => a + x.custoUnit, 0) / withCost.length : best.custoUnit;
    const econRs = round2(econUn * avgCost);

    if (econUn > 0 && cobMol >= 15) {
      for (const i of items) {
        if (i.sugestaoCompraUn > 0) coveredMoleculeAlert.add(`${i.filialId}|${i.produtoId}`);
      }
    }

    const [substancia, concentracao, forma, packBucket] = b.moleculeKey.split('|');
    molSummaries.push({
      moleculeKey: b.moleculeKey,
      substancia,
      concentracao,
      forma,
      packBucket,
      ehReferencia: b.ehReferencia,
      skusCount: items.length,
      labsCount: labs.size,
      estoqueTotal: round2(estoqueTotal),
      transitoTotal: round2(transitoTotal),
      ddvProjTotal: round2(ddvProjTotal),
      coberturaMoleculaDias: cobMol,
      sugestaoSkuSoma: sugSkuSoma,
      necessidadeLiquidaMolecula: necLiquidaMol,
      economiaUnEvitada: econUn,
      economiaRsEvitada: econRs,
      melhorSkuId: best.produtoId,
      melhorSkuDesc: best.p.descricao,
      melhorCustoUnit: best.custoUnit,
      detalheSkus: items
        .sort((a, c) => c.ddvProjetada - a.ddvProjetada)
        .map((i) => ({
          produto_id: i.produtoId,
          descricao: i.p.descricao,
          labora: i.p.labora,
          estoque: i.estoqueAtual,
          ddv: round2(i.ddvProjetada),
          custo_unit: i.custoUnit,
          sug_individual: i.sugestaoCompraUn,
        })),
    });
  }

  // Gerar excecoes e justificativa explicavel por IA em cada linha
  for (const r of computedRows) {
    const ex = [];
    const reasons = [];
    const skKey = `${r.filialId}|${r.produtoId}`;

    if (r.estoqueAtual <= 0 && r.ddvProjetada > 0 && (r.abcClass === 'A' || r.abcClass === 'B')) {
      ex.push(`RUPTURA_${r.abcClass}`);
      reasons.push(`Saldo ${r.estoqueAtual} com giro de ${round2(r.ddvProjetada)}/dia`);
    }
    if (r.estoqueAtual < 0 && r.vendas13s > 0) {
      ex.push('ESTOQUE_NEGATIVO_DIVERGENTE');
      reasons.push(`Saldo negativo (${r.estoqueAtual}) com vendas recentes — conferir inventario/NF`);
    }
    if (r.vendasPbm13s > 0 && r.ddvPbmAuto >= r.ddvAjustada * 0.4) {
      ex.push('PBM_AUTO_REPOSICAO');
      reasons.push(`${round2(r.vendasPbm13s)} un no PBM auto-reposto (${r.pbmLabels.slice(0, 2).join(', ')})`);
    }
    if (coveredMoleculeAlert.has(skKey)) {
      ex.push('MOLECULA_COBERTA_OUTRO_LAB');
      reasons.push('Outro laboratorio da mesma molecula ja cobre a demanda');
    }
    if (r.loteVencendo90dQtd > 0) {
      ex.push('LOTE_CURTO_90D');
      reasons.push(`${r.loteVencendo90dQtd} un vencendo ate +90d (${r.loteMenorValidade})`);
    }
    if (r.loteVencidoQtd > 0) {
      ex.push('LOTE_VENCIDO');
      reasons.push(`${r.loteVencidoQtd} un vencidas em lote_novo`);
    }
    if (r.custoVariacaoPct >= 15) {
      ex.push('ALTA_CUSTO_ENTRADA');
      reasons.push(`Custo subiu +${r.custoVariacaoPct}% na ultima entrada`);
    }
    if (r.perda2026Un >= 3 && r.perda2026Un >= r.vendas13s * 0.25) {
      ex.push('HISTORICO_PERDA_ALTO');
      reasons.push(`Teto reduzido por historico de perda (${r.perda2026Un} un)`);
    }
    if (r.p.flagMedIncorreta) {
      ex.push('FLAG_MEDICAMENTO_INCORRETO');
    }
    if (nfeInvoicedMap.has(skKey)) {
      ex.push('NFE_FATURADA_EM_TRANSITO');
      reasons.push(`${nfeInvoicedMap.get(skKey)} un faturadas em NFe aguardando conferência`);
    }
    if (r.remanEntrada > 0) {
      ex.push('ATENDIDO_REMANEJAMENTO');
      reasons.push(`${r.remanEntrada} un supridas por transferencia interna`);
    }
    if (r.idxSaz >= 1.2) {
      ex.push('ALTA_SAZONAL');
      reasons.push(`Sazonalidade YoY ${r.idxSaz}x aplicada`);
    }
    if (r.excecaoLojaNova) {
      ex.push(r.excecaoLojaNova);
      reasons.unshift(r.justificativaIa);
    }

    r.excecoes = ex;
    const disponivel = r.estoqueAtual - r.estoqueReserva + r.transitoReal;
    const isCurvaA = r.abcClass === 'A' || /A/i.test(r.curvaErpClasse || '');
    if (r.sugestaoCompraUn > 0) {
      if (isCurvaA && disponivel <= 0) {
        reasons.unshift(
          `🚨 Ruptura Crítica Curva A: Estoque zerado em produto de alto giro -> repor ${r.sugestaoCompraUn} un imediatamente para evitar perda de clientes`
        );
      } else {
        reasons.unshift(
          `Ponto de Pedido atingido (disp. ${disponivel} un <= mín ${r.estoqueMin} un | ${r.coberturaDias}d) -> repor ${r.sugestaoCompraUn} un até máx ${r.estoqueMax} un (${r.diasEstoqueMax}d)`
        );
      }
    } else if (r.ddvProjetada > 0) {
      if ((r.abcClass === 'D' || r.abcClass === 'C') && disponivel <= 0) {
        reasons.unshift(`Item Curva ${r.abcClass} sem estoque: Sugerida compra sob demanda de balcão`);
      } else if (disponivel > r.estoqueMin && disponivel <= r.estoqueMax) {
        reasons.unshift(
          `Estoque saudável (disp. ${disponivel} un > mín ${r.estoqueMin} un | cob. ${r.coberturaDias}d cobrindo ${r.diasEstoqueMin}d mín)`
        );
      } else if (disponivel > r.estoqueMax && r.estoqueMax > 0) {
        reasons.unshift(`Excesso acima do máximo (${disponivel} un vs máx ${r.estoqueMax} un | cob. ${r.coberturaDias}d)`);
      }
    }
    r.justificativaIa = reasons.join(' | ');
  }

  // Passo F: Sumario executivo e KPIs mensuraveis + Gravacao no SQLite
  const salesRows = computedRows.filter((r) => r.isSalesFilial && r.p.isBuyable);
  const summary = {
    elapsedMs: Date.now() - t0,
    syncElapsedMs: rawData.elapsedMs,
    referenceDate: refDate,
    start91,
    weeksWindow,
    serviceProfile,
    totalSkusAnalisados: salesRows.length,
    totalMed: salesRows.filter((r) => r.p.isMedEffective).length,
    totalNaoMed: salesRows.filter((r) => !r.p.isMedEffective).length,
    rupturasCurvaA: salesRows.filter((r) => r.abcClass === 'A' && r.estoqueAtual <= 0).length,
    rupturasCurvaB: salesRows.filter((r) => r.abcClass === 'B' && r.estoqueAtual <= 0).length,
    vendaPerdidaEstimadaRs91d: round2(salesRows.reduce((a, r) => a + r.vendaPerdidaEstRs, 0)),
    capitalExcessoAcimaMaxRs: round2(
      salesRows.filter((r) => r.estoqueMax > 0 && r.estoqueAtual > r.estoqueMax).reduce((a, r) => a + (r.estoqueAtual - r.estoqueMax) * r.custoUnit, 0)
    ),
    capitalParadoCurvaDRs: round2(
      salesRows.filter((r) => r.abcClass === 'D' && r.estoqueAtual > 0).reduce((a, r) => a + r.estoqueAtual * r.custoUnit, 0)
    ),
    skusSugestaoCompra: salesRows.filter((r) => r.sugestaoCompraUn > 0).length,
    totalSugestaoCompraRs: round2(salesRows.reduce((a, r) => a + r.sugestaoCompraRs, 0)),
    economiaMoleculaUn: molSummaries.reduce((a, m) => a + m.economiaUnEvitada, 0),
    economiaMoleculaRs: round2(molSummaries.reduce((a, m) => a + m.economiaRsEvitada, 0)),
    totalRemanejamentoRs: round2(remanejamentos.reduce((a, rm) => a + rm.valorTotal, 0)),
    lotesVencendo90dRs: round2(salesRows.reduce((a, r) => a + r.loteVencendo90dRs, 0)),
    lotesVencidosRs: round2(salesRows.reduce((a, r) => a + r.loteVencidoQtd * r.custoUnit, 0)),
    skusComExcecao: salesRows.filter((r) => r.excecoes.length > 0).length,
    cmedAudit: cmedAuditStats,
  };

  db.exec('BEGIN');
  try {
    const runRes = db
      .prepare('INSERT INTO engine_runs (client_code, reference_date, weeks_window, service_profile, summary_json) VALUES (?, ?, ?, ?, ?)')
      .run(profile.code, refDate, weeksWindow, serviceProfile, JSON.stringify(summary));
    const runId = Number(runRes.lastInsertRowid);

    const insSku = db.prepare(`
      INSERT INTO engine_sku_results (
        run_id, filial_id, produto_id, descricao, barras, labora, fornecedor_id, fornecedor_nome,
        grupo_id, grupo_nome, grupo_pai_nome, grupo_filho_nome, macro_categoria, medicamento_flag, medicamento_efetivo, molecule_key, tipo_produto_cmed,
        abc_class, xyz_class, is_traffic_builder, preco_venda, custo_unit, margem_pct,
        estoque_atual, estoque_reserva, transito_real, vendas_6s, vendas_9s, vendas_13s, vendas_pbm_13s,
        dias_sem_estoque_13s, venda_perdida_est_un, venda_perdida_est_rs, ddv_bruta, ddv_ajustada, ddv_pbm_auto,
        ddv_liquida, indice_sazonalidade, ddv_projetada, lead_time_dias, estoque_min, estoque_seg, estoque_max,
        cobertura_dias, lote_vencendo_90d_qtd, lote_vencendo_90d_rs, lote_vencido_qtd, lote_menor_validade,
        perda_2026_un, perda_2026_rs, remanejamento_entrada, remanejamento_saida, sugestao_compra_un, sugestao_compra_rs,
        roi_marginal, custo_variacao_pct, excecoes_json, justificativa_ia, ultimas_entradas_json,
        curva_erp_ranking, curva_erp_classe, dias_estoque_min, dias_estoque_max, pareto_pct,
        filial_nome, filial_reduz, transito_remanejamento
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const r of computedRows) {
      insSku.run(
        runId,
        r.filialId,
        r.produtoId,
        r.p.descricao,
        r.p.prod_barras,
        r.p.labora,
        r.latestEntry?.fornece_id || 0,
        r.latestEntry?.fornecedor_nome || '',
        r.p.grupo_id,
        r.p.grupo_nome,
        r.p.grupo_pai_nome || 'OUTROS',
        r.p.grupo_filho_nome || r.p.grupo_nome || 'OUTROS',
        r.p.macroCategoria,
        r.p.medicamento,
        r.p.isMedEffective ? 1 : 0,
        r.p.moleculeKey,
        r.p.tipoProdutoCmed,
        r.abcClass,
        r.xyzClass,
        r.isTrafficBuilder ? 1 : 0,
        r.precoVenda,
        r.custoUnit,
        r.margemPct,
        r.estoqueAtual,
        r.estoqueReserva,
        r.transitoReal,
        r.vendas6s,
        r.vendas9s,
        r.vendas13s,
        r.vendasPbm13s,
        r.diasSemEstoque,
        r.vendaPerdidaEstUn,
        r.vendaPerdidaEstRs,
        round2(r.ddvBruta),
        round2(r.ddvAjustada),
        round2(r.ddvPbmAuto),
        round2(r.ddvLiquida),
        r.idxSaz,
        round2(r.ddvProjetada),
        r.leadTimeDias,
        r.estoqueMin,
        r.estoqueSeg,
        r.estoqueMax,
        r.coberturaDias,
        r.loteVencendo90dQtd,
        r.loteVencendo90dRs,
        r.loteVencidoQtd,
        r.loteMenorValidade,
        r.perda2026Un,
        r.perda2026Rs,
        r.remanEntrada,
        r.remanSaida,
        r.sugestaoCompraUn,
        r.sugestaoCompraRs,
        r.roiMarginal,
        r.custoVariacaoPct,
        JSON.stringify(r.excecoes),
        r.justificativaIa,
        JSON.stringify({
          list: r.lastEntries,
          bestSupplier30d: r.bestSupplier30d,
        }),
        r.curvaErpRanking || '',
        r.curvaErpClasse || '',
        r.diasEstoqueMin || 0,
        r.diasEstoqueMax || 0,
        r.paretoPct || 0,
        r.filialNome || '',
        r.filialReduz || '',
        r.transitoRemanejamento || 0
      );
    }

    const insRem = db.prepare(`
      INSERT INTO engine_remanejamento (
        run_id, produto_id, descricao, filial_origem, filial_destino, tipo,
        qtd_sugerida, custo_unit, valor_total, validade_prioritaria, motivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rm of remanejamentos) {
      insRem.run(
        runId,
        rm.produtoId,
        rm.descricao,
        rm.filialOrigem,
        rm.filialDestino,
        rm.tipo,
        rm.qtdSugerida,
        rm.custoUnit,
        rm.valorTotal,
        rm.validadePrioritaria,
        rm.motivo
      );
    }

    const insMol = db.prepare(`
      INSERT INTO engine_molecule_summary (
        run_id, molecule_key, substancia, concentracao, forma, pack_bucket, eh_referencia,
        skus_count, labs_count, estoque_total, transito_total, ddv_proj_total, cobertura_molecula_dias,
        sugestao_sku_soma, necessidade_liquida_molecula, economia_un_evitada, economia_rs_evitada,
        melhor_sku_id, melhor_sku_desc, melhor_custo_unit, detalhe_skus_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of molSummaries) {
      insMol.run(
        runId,
        m.moleculeKey,
        m.substancia,
        m.concentracao,
        m.forma,
        m.packBucket,
        m.ehReferencia,
        m.skusCount,
        m.labsCount,
        m.estoqueTotal,
        m.transitoTotal,
        m.ddvProjTotal,
        m.coberturaMoleculaDias,
        m.sugestaoSkuSoma,
        m.necessidadeLiquidaMolecula,
        m.economiaUnEvitada,
        m.economiaRsEvitada,
        m.melhorSkuId,
        m.melhorSkuDesc,
        m.melhorCustoUnit,
        JSON.stringify(m.detalheSkus)
      );
    }

    if (rawData.pbmAuditSample?.length) {
      db.prepare('DELETE FROM pbm_audit_rows WHERE client_code = ?').run(profile.code);
      const insPbm = db.prepare(`
        INSERT INTO pbm_audit_rows (
          client_code, filial_id, data_hora, operadora, projeto, nsu, autorizacao,
          cartao_cpf, produto_id, descricao, percentual_desconto, valor_desconto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of rawData.pbmAuditSample) {
        insPbm.run(
          profile.code,
          a.filial_id,
          String(a.data_hora || ''),
          a.operadora || '',
          a.projeto || '',
          a.nsu || '',
          a.autorizacao || '',
          a.cartao_cpf || '',
          a.produto_id,
          a.descricao || '',
          Number(a.percentual_desconto || 0),
          Number(a.valor_desconto || 0)
        );
      }
    }

    db.exec('COMMIT');
    try {
      pruneOldEngineRuns(profile.code, 2);
    } catch (ePrune) {
      console.warn('[ENGINE] Aviso no expurgo automático de rodadas antigas:', ePrune.message);
    }
    return { runId, summary };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

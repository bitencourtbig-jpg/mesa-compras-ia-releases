import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import {
  getAnalyticsDb,
  getClientProfile,
  upsertClientProfile,
  clearClientCalculations,
  getGroupCoverageConfigs,
  saveGroupCoverageConfigs,
  dismissSku,
  getGroupsTree,
  recordSkuSuspension,
  removeSkuSuspension,
  getActiveSkuSuspensions,
  getFilialPolicies,
  upsertFilialPolicy,
  createMotorTransfer,
  getMotorTransfers,
  updateMotorTransferStatus,
  getPendingTransfersItemsMap,
  recordBuyerLearning,
  getBuyerLearningLog,
  getBuyerActivePreferences,
} from './store/analyticsDb.mjs';
import { getCachedCmedMaps, importOfficialCmedToSqlite } from './services/cmedService.mjs';
import { syncBigClientData } from './engine/syncClientData.mjs';
import { runPurchasingEngine } from './engine/purchasingEngine.mjs';
import { GLOSSARY_SECTIONS, GLOSSARY_TERM_HINTS } from './services/glossaryData.mjs';
import { buildBuyerDecisionAnalysis } from './services/buyerInterpreter.mjs';
import { calculateBudgetOverview } from './services/budgetService.mjs';
import { listOlFabricantes, saveOlFabricante, analyzeOlOpportunity, getOlDashboardOverview } from './services/olService.mjs';
import { buildExecutiveBi } from './services/biAnalyticsService.mjs';
import { generateQuotationWorkbook, buildTransferPickListExcel } from './services/excelExportService.mjs';
import { testBigConnection, lookupBigSupplier, createWriteConnection } from '../db/client.mjs';
import { generateCotefacilTxt, generateBigNativeImportXlsx, generateOlOrderExcel, sanitizeCnpj } from './services/exportFormatsService.mjs';
import { insertBigPedidos } from './services/bigOrderWriter.mjs';
import { buildPresentationSyncPreview, executePresentationSync, cleanupBigPresentations } from './services/bigPresentationWriter.mjs';
import { isInspectorEnabled, getInspectorStatus, readBacklog, saveReview, updateReviewStatus } from './services/devInspectorService.mjs';
import {
  getMachineFingerprint,
  verifyMasterPassword,
  generateLicenseKey,
  validateLicenseKeyString,
  getClientLicenseStatus,
  activateLicenseKey,
  getMasterPassword,
  updateMasterPassword,
  sanitizeEnvFile,
  recordIssuedLicense,
  listIssuedLicenses,
  deleteIssuedLicense,
} from './services/licensingService.mjs';

function isMasterRequest(req, body = {}) {
  const token = req.headers['x-master-token'] || body.masterPassword || (new URL(req.url, `http://${req.headers.host}`).searchParams.get('masterToken'));
  return verifyMasterPassword(token);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3456);

let APP_VERSION = '1.2.0';
try {
  const pkgData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  APP_VERSION = pkgData.version || '1.2.0';
} catch {}

// Blindagem de seguranca: remove senhas expostas do .env na inicializacao
sanitizeEnvFile();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString('utf8');
  return txt ? JSON.parse(txt) : {};
}

function getLatestRun(clientCode) {
  const db = getAnalyticsDb();
  const row = db
    .prepare('SELECT * FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1')
    .get(clientCode);
  if (!row) return null;
  return { ...row, summary: JSON.parse(row.summary_json) };
}

function getCuradoriaDecisions(clientCode, runId) {
  const db = getAnalyticsDb();
  const filiais = getFilialPolicies(clientCode);
  const filMap = new Map(filiais.map(f => [Number(f.filial_id), f]));
  const transfers = getMotorTransfers(clientCode);

  const logs = db.prepare(`
    SELECT id, filial_id, produto_id, molecule_key, descricao, tipo_evento, motivo, acao_futura, created_at
    FROM buyer_learning_log
    WHERE client_code = ? AND tipo_evento IN (
      'DEDUZIU_ESTOQUE_MOLECULA',
      'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA',
      'CANCELOU_COMPRA_FILIAL_INDIVIDUAL',
      'EXECUTOU_SOLUCAO_IA_1CLIQUE'
    )
    ORDER BY id DESC
  `).all(clientCode);

  if (!logs || logs.length === 0) {
    const empty = [];
    empty.items = [];
    empty.storePairTransfers = [];
    empty.localCounterDeductions = [];
    return empty;
  }

  const grouped = new Map();
  for (const l of logs) {
    if (!grouped.has(l.produto_id)) {
      grouped.set(l.produto_id, {
        produto_id: l.produto_id,
        descricao: l.descricao,
        molecule_key: l.molecule_key,
        actions: [],
        total_un_abatidas: 0,
        lojas_canceladas: new Set(),
        created_at: l.created_at,
      });
    }
    const g = grouped.get(l.produto_id);
    g.actions.push(l);
    if (l.filial_id > 1) g.lojas_canceladas.add(l.filial_id);
    
    const match = (l.motivo || '').match(/(\d+)\s*un/i);
    if (match) {
      const un = Number(match[1]);
      if (l.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA' || l.tipo_evento === 'EXECUTOU_SOLUCAO_IA_1CLIQUE') {
        g.total_un_abatidas = Math.max(g.total_un_abatidas, un);
      } else if (l.tipo_evento === 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL') {
        if (!g.actions.some(a => a.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA' || a.tipo_evento === 'EXECUTOU_SOLUCAO_IA_1CLIQUE')) {
          g.total_un_abatidas += un;
        }
      }
    }
  }

  const items = [];
  const routesMap = new Map();
  const localCounterDeductions = [];

  for (const [pId, g] of grouped.entries()) {
    const skuInfo = db.prepare(`
      SELECT produto_id, barras, descricao, labora, custo_unit, preco_venda, abc_class
      FROM engine_sku_results
      WHERE run_id = ? AND produto_id = ?
      LIMIT 1
    `).get(runId, pId);

    let altStockStores = [];
    if (g.molecule_key) {
      altStockStores = db.prepare(`
        SELECT filial_id, produto_id, descricao, labora, estoque_atual, abc_class
        FROM engine_sku_results
        WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1 AND estoque_atual > 0
        ORDER BY estoque_atual DESC
      `).all(runId, g.molecule_key);
    }

    const existingTransfer = transfers.find(t => 
      (t.itens && t.itens.some(it => it.produto_id === pId)) || 
      (t.observacao && g.molecule_key && t.observacao.includes(g.molecule_key))
    );

    const custo = skuInfo?.custo_unit || 0;
    const qtyAbatida = g.total_un_abatidas > 0 ? g.total_un_abatidas : 1;
    const economiaRs = Math.round(qtyAbatida * custo * 100) / 100;

    const itemObj = {
      produto_id: pId,
      descricao: skuInfo?.descricao || g.descricao,
      barras: skuInfo?.barras || '',
      labora: skuInfo?.labora || '',
      molecule_key: g.molecule_key,
      total_un_abatidas: qtyAbatida,
      custo_unit: custo,
      economia_rs: economiaRs,
      lojas_canceladas: Array.from(g.lojas_canceladas).map(fId => ({
        filial_id: fId,
        nome: filMap.get(fId)?.nome_reduz || `Loja ${fId}`
      })),
      lojas_doadoras: altStockStores.map(s => ({
        filial_id: s.filial_id,
        nome: filMap.get(s.filial_id)?.nome_reduz || `Loja ${s.filial_id}`,
        estoque_atual: s.estoque_atual,
        labora: s.labora,
        descricao: s.descricao
      })),
      transfer_emitted: existingTransfer ? {
        codigo: existingTransfer.codigo_transferencia,
        id: existingTransfer.id,
        status: existingTransfer.status,
        filial_origem: existingTransfer.filial_origem_nome,
        filial_destino: existingTransfer.filial_destino_nome
      } : null,
      actions: g.actions.map(a => a.tipo_evento),
      latest_action: g.actions[0]?.tipo_evento,
      created_at: g.created_at
    };

    items.push(itemObj);

    // Identificar se há rota inter-filiais (doadora -> receptora)
    const donor = altStockStores.find(s => !g.lojas_canceladas.has(s.filial_id)) || altStockStores[0];
    const destFilialId = Array.from(g.lojas_canceladas)[0] || (donor ? (donor.filial_id === 2 ? 3 : 2) : 0);

    if (donor && destFilialId && donor.filial_id !== destFilialId && donor.estoque_atual > 0) {
      const routeKey = `${donor.filial_id}->${destFilialId}`;
      if (!routesMap.has(routeKey)) {
        const routeExistingTrf = transfers.find(t => 
          Number(t.filial_origem) === Number(donor.filial_id) && 
          Number(t.filial_destino) === Number(destFilialId)
        );

        routesMap.set(routeKey, {
          routeKey,
          filialOrigem: donor.filial_id,
          filialOrigemNome: filMap.get(donor.filial_id)?.nome_reduz || `Loja ${donor.filial_id}`,
          filialDestino: destFilialId,
          filialDestinoNome: filMap.get(destFilialId)?.nome_reduz || `Loja ${destFilialId}`,
          totalItens: 0,
          totalUnidades: 0,
          valorTotalRs: 0,
          transferEmitted: routeExistingTrf ? {
            id: routeExistingTrf.id,
            codigo: routeExistingTrf.codigo_transferencia,
            status: routeExistingTrf.status,
            data_emissao: routeExistingTrf.data_emissao
          } : null,
          items: []
        });
      }

      const rObj = routesMap.get(routeKey);
      rObj.totalItens += 1;
      rObj.totalUnidades += qtyAbatida;
      rObj.valorTotalRs = Math.round((rObj.valorTotalRs + economiaRs) * 100) / 100;
      rObj.items.push({
        produto_id: pId,
        descricao: skuInfo?.descricao || g.descricao,
        barras: skuInfo?.barras || '',
        labora: skuInfo?.labora || '',
        estoque_doador: donor.estoque_atual,
        qtd_sugerida: qtyAbatida,
        custo_unit: custo,
        valor_total: economiaRs,
        molecule_key: g.molecule_key
      });
    } else {
      localCounterDeductions.push(itemObj);
    }
  }

  const result = items;
  result.items = items;
  result.storePairTransfers = Array.from(routesMap.values());
  result.localCounterDeductions = localCounterDeductions;
  return result;
}

function buildSkuFilterSql(paramsObj, runId, clientCode = 'bandeirante') {
  const getParam = (k) => (typeof paramsObj.get === 'function' ? paramsObj.get(k) : paramsObj[k]) || '';
  const where = ['run_id = ?'];
  const params = [runId];
  const tab = getParam('tab') || 'exceptions';
  const abc = getParam('abc');
  const abcxyz = getParam('abcxyz');
  const macro = getParam('macro');
  const grupoPai = getParam('grupo_pai');
  const grupoFilho = getParam('grupo_filho');
  const grupoId = getParam('grupo_id');
  const labora = getParam('labora').trim();
  const stockStatus = getParam('stock_status');
  const pbmFilter = getParam('pbm_filter');
  const exc = getParam('exc');
  const q = getParam('q').trim();

  if (tab === 'dismissed') {
    where.push('dismissed = 1');
  } else if (tab === 'selected') {
    const selectedPidsRaw = getParam('selected_pids');
    if (selectedPidsRaw) {
      const pids = selectedPidsRaw.split(',').map(Number).filter((n) => n > 0);
      if (pids.length > 0) {
        where.push(`produto_id IN (${pids.map(() => '?').join(',')})`);
        params.push(...pids);
      } else {
        where.push('1 = 0');
      }
    } else {
      where.push('1 = 0');
    }
  } else {
    where.push('dismissed = 0');
    if (tab === 'exceptions') {
      where.push("excecoes_json <> '[]'");
    } else if (tab === 'buy') {
      where.push('sugestao_compra_un > 0');
      // Isolamento da Pré-Tela de Curadoria IA: itens de moléculas com concorrência pendentes de homologação
      where.push(`(molecule_key IS NULL OR molecule_key = '' OR molecule_key NOT IN (
        SELECT molecule_key FROM engine_molecule_summary
        WHERE run_id = ? AND labs_count > 1 AND sugestao_sku_soma > 0
          AND molecule_key NOT IN (
            SELECT DISTINCT molecule_key FROM buyer_learning_log
            WHERE client_code = ? AND molecule_key IS NOT NULL AND molecule_key <> ''
          )
      ))`);
      params.push(runId, clientCode);
    } else if (tab === 'pbm_replenish') {
      where.push('ddv_pbm_auto > 0');
    } else if (tab === 'non_med') {
      where.push('medicamento_efetivo = 0 AND (sugestao_compra_un > 0 OR estoque_atual > 0)');
    } else if (tab === 'expiring') {
      where.push('(lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)');
    } else if (tab === 'negative') {
      where.push('estoque_atual < 0 AND vendas_13s > 0');
    }
  }

  if (abc) {
    where.push('abc_class = ?');
    params.push(abc);
  }
  if (abcxyz && abcxyz.length === 2) {
    where.push('abc_class = ? AND xyz_class = ?');
    params.push(abcxyz[0], abcxyz[1]);
  }
  if (macro) {
    where.push('macro_categoria = ?');
    params.push(macro);
  }
  if (grupoId && grupoId !== 'all' && !isNaN(Number(grupoId)) && Number(grupoId) > 0) {
    where.push('grupo_id = ?');
    params.push(Number(grupoId));
  } else {
    if (grupoPai && grupoPai !== 'all') {
      if (grupoPai === 'OUTROS') {
        where.push('(grupo_pai_nome = ? OR grupo_pai_nome IS NULL)');
        params.push(grupoPai);
      } else {
        where.push('grupo_pai_nome = ?');
        params.push(grupoPai);
      }
    }
    if (grupoFilho && grupoFilho !== 'all') {
      where.push('(grupo_filho_nome = ? OR grupo_nome = ?)');
      params.push(grupoFilho, grupoFilho);
    }
  }
  if (labora) {
    where.push('UPPER(labora) LIKE ?');
    params.push(`%${labora.toUpperCase()}%`);
  }
  if (stockStatus === 'zero') {
    where.push('estoque_atual <= 0');
  } else if (stockStatus === 'positive') {
    where.push('estoque_atual > 0');
  } else if (stockStatus === 'transit') {
    where.push('transito_real > 0');
  }

  if (pbmFilter === 'pbm_auto_deducted') {
    where.push('ddv_pbm_auto > 0');
  } else if (pbmFilter === 'with_pbm') {
    where.push('vendas_pbm_13s > 0');
  } else if (pbmFilter === 'pure_buy') {
    where.push('(vendas_pbm_13s = 0 OR vendas_pbm_13s IS NULL)');
  }

  if (exc) {
    where.push('excecoes_json LIKE ?');
    params.push(`%${exc}%`);
  }
  if (q) {
    where.push('(descricao LIKE ? OR barras LIKE ? OR labora LIKE ? OR CAST(produto_id AS TEXT) = ?)');
    const like = `%${q.toUpperCase()}%`;
    params.push(like, like, like, q);
  }

  const filialId = getParam('filial_id');
  if (filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0) {
    where.push('filial_id = ?');
    params.push(Number(filialId));
  }

  return { whereSql: where.join(' AND '), params };
}

function getOrderByClause(sort) {
  if (sort === 'roi') return 'roi_marginal DESC, sugestao_compra_rs DESC';
  if (sort === 'lost') return 'venda_perdida_est_rs DESC';
  if (sort === 'expiry') return 'lote_vencendo_90d_rs DESC, lote_vencido_qtd DESC';
  if (sort === 'estoque_asc') return 'estoque_atual ASC, sugestao_compra_rs DESC';
  if (sort === 'estoque_desc') return 'estoque_atual DESC, sugestao_compra_rs DESC';
  if (sort === 'sugestao_un_desc') return 'sugestao_compra_un DESC';
  if (sort === 'sugestao_un_asc') return 'sugestao_compra_un ASC';
  if (sort === 'sugestao_rs_desc') return 'sugestao_compra_rs DESC';
  if (sort === 'sugestao_rs_asc') return 'sugestao_compra_rs ASC';
  if (sort === 'ddv_desc') return 'ddv_projetada DESC';
  if (sort === 'ddv_asc') return 'ddv_projetada ASC';
  if (sort === 'cobertura_asc') return 'cobertura_dias ASC';
  if (sort === 'cobertura_desc') return 'cobertura_dias DESC';
  if (sort === 'descricao_asc') return 'descricao ASC';
  if (sort === 'descricao_desc') return 'descricao DESC';
  return 'sugestao_compra_rs DESC, venda_perdida_est_rs DESC';
}

function applyBudgetCap(allBuy, budget) {
  let used = 0;
  const selected = [];
  const cutOff = [];
  const totalRequested = Math.round(allBuy.reduce((a, b) => a + Number(b.sugestao_compra_rs || 0), 0) * 100) / 100;

  for (const r of allBuy) {
    if (used + r.sugestao_compra_rs <= budget) {
      used += r.sugestao_compra_rs;
      selected.push({ ...r, budget_qtd: r.sugestao_compra_un, budget_rs: r.sugestao_compra_rs });
    } else if (used < budget) {
      const avail = budget - used;
      const maxUnits = r.custo_unit > 0 ? Math.floor(avail / r.custo_unit) : 0;
      if (maxUnits > 0) {
        const rs = Math.round(maxUnits * r.custo_unit * 100) / 100;
        used += rs;
        selected.push({ ...r, budget_qtd: maxUnits, budget_rs: rs });
      }
      if (r.sugestao_compra_un > maxUnits) {
        const cutUnits = r.sugestao_compra_un - maxUnits;
        cutOff.push({
          produto_id: r.produto_id,
          descricao: r.descricao,
          abc_class: r.abc_class,
          labora: r.labora,
          cut_qtd: cutUnits,
          cut_rs: Math.round(cutUnits * r.custo_unit * 100) / 100,
          motivo: 'Corte parcial (atingiu teto de verba)',
        });
      }
    } else {
      cutOff.push({
        produto_id: r.produto_id,
        descricao: r.descricao,
        abc_class: r.abc_class,
        labora: r.labora,
        cut_qtd: r.sugestao_compra_un,
        cut_rs: r.sugestao_compra_rs,
        motivo: r.estoque_atual <= 0 ? 'Sem verba para ruptura (priorizados itens de maior giro)' : 'Excedeu teto (priorizados itens com maior ROI)',
      });
    }
  }
  return {
    used: Math.round(used * 100) / 100,
    selected,
    cutOff,
    totalRequested,
    cutTotalRs: Math.round(Math.max(0, totalRequested - used) * 100) / 100,
  };
}

function hydrateSkuRow(r, customHorizon = null, suspensionsMap = null, networkBreakdown = []) {
  let ultimasEntradas = [];
  let best30d = null;
  try {
    const parsed = JSON.parse(r.ultimas_entradas_json || '[]');
    if (Array.isArray(parsed)) {
      ultimasEntradas = parsed;
    } else if (parsed && typeof parsed === 'object') {
      ultimasEntradas = parsed.list || [];
      best30d = parsed.bestSupplier30d || null;
    }
  } catch {}

  // Fallback seguro para auditorias passadas se bestSupplier30d nao veio salvo no JSON
  if (!best30d && ultimasEntradas.length > 0) {
    const latest = ultimasEntradas[0];
    best30d = {
      fornece_id: latest.fornece_id || r.fornecedor_id,
      fornecedor_nome: latest.fornecedor_nome || r.fornecedor_nome,
      fornecedor_cnpj: latest.fornecedor_cnpj || '',
      menor_custo: Number(latest.custo_item || latest.precouni || r.custo_unit || 0),
      datanota: latest.datanota || null,
      origem: 'ULTIMA_COMPRA',
    };
  }

  let rowCopy = { ...r };
  if (customHorizon && customHorizon > 0) {
    const ddv = Number(rowCopy.ddv_projetada || 0);
    const seg = Number(rowCopy.estoque_seg || 0);
    const disp = Number(rowCopy.estoque_atual || 0) + Number(rowCopy.transito_real || 0);
    const alvo = Math.ceil(ddv * customHorizon + seg);
    let novaSugUn = Math.max(0, alvo - disp);

    // REV-016: Piso de seguranca para Curva A zerada (Ruptura Critica)
    const isCurvaA = rowCopy.abc_class === 'A' || /A/i.test(rowCopy.curva_big || '') || /A/i.test(rowCopy.curva_erp_classe || '');
    if (isCurvaA && disp <= 0 && novaSugUn === 0 && ddv > 0) {
      novaSugUn = Math.max(1, Math.min(3, Math.ceil(ddv * Math.max(7, customHorizon)) || 1));
      rowCopy.justificativa_ia = '🚨 Piso de Ruptura Curva A: Estoque zerado em item essencial requer compra mínima preventiva.';
    }

    const custo = Number(rowCopy.custo_unit || 0);
    rowCopy.dias_estoque_max = customHorizon;
    rowCopy.sugestao_compra_un = novaSugUn;
    rowCopy.sugestao_compra_rs = Math.round(novaSugUn * custo * 100) / 100;
  }

  const susp = (suspensionsMap && typeof suspensionsMap.get === 'function')
    ? suspensionsMap.get(rowCopy.produto_id)
    : null;

  const hydrated = {
    ...rowCopy,
    excecoes: JSON.parse(rowCopy.excecoes_json || '[]'),
    ultimas_entradas: ultimasEntradas,
    melhor_fornecedor_30d: best30d,
    suspensao_info: susp || null,
    rede_distribuicao: networkBreakdown || [],
  };
  hydrated.ia_analysis = buildBuyerDecisionAnalysis(hydrated);
  return hydrated;
}

const _rawCache = new Map();
const _treeCache = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pathname = urlObj.pathname;
    const clientCode = urlObj.searchParams.get('client') || 'bandeirante';
    const db = getAnalyticsDb();

    if (pathname === '/api/overview' && req.method === 'GET') {
      const profile = getClientProfile(clientCode);
      const latestRun = getLatestRun(clientCode);
      const cmed = getCachedCmedMaps();
      const filtersMeta = latestRun
        ? {
            macros: db
              .prepare('SELECT macro_categoria, COUNT(*) AS cnt, ROUND(SUM(sugestao_compra_rs), 2) AS sug_rs FROM engine_sku_results WHERE run_id = ? GROUP BY macro_categoria ORDER BY cnt DESC')
              .all(latestRun.id),
            gruposPai: db
              .prepare("SELECT COALESCE(grupo_pai_nome, 'OUTROS') AS nome, COUNT(*) AS cnt, ROUND(SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN sugestao_compra_rs ELSE 0 END), 2) AS sug_rs, SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN 1 ELSE 0 END) AS buy_skus FROM engine_sku_results WHERE run_id = ? GROUP BY nome ORDER BY sug_rs DESC, cnt DESC")
              .all(latestRun.id),
            laboratorios: db
              .prepare("SELECT labora, COUNT(*) AS cnt FROM engine_sku_results WHERE run_id = ? AND labora IS NOT NULL AND TRIM(labora) <> '' GROUP BY labora ORDER BY cnt DESC LIMIT 70")
              .all(latestRun.id),
            dismissedCount: db
              .prepare('SELECT COUNT(*) AS cnt FROM engine_sku_results WHERE run_id = ? AND dismissed = 1')
              .get(latestRun.id)?.cnt || 0,
            pbmCount: db
              .prepare('SELECT COUNT(*) AS cnt FROM engine_sku_results WHERE run_id = ? AND ddv_pbm_auto > 0 AND dismissed = 0')
              .get(latestRun.id)?.cnt || 0,
          }
        : { macros: [], gruposPai: [], dismissedCount: 0, pbmCount: 0 };

      // KPIs granulares por filial (ou 'all' consolidado) para sincronismo perfeito nos filtros
      let filialKpis = {};
      if (latestRun) {
        filialKpis['all'] = latestRun.summary;
        const stats = db.prepare(`
          SELECT filial_id,
                 COUNT(*) AS totalSkus,
                 SUM(CASE WHEN abc_class = 'A' AND estoque_atual <= 0 THEN 1 ELSE 0 END) AS rupturasCurvaA,
                 SUM(CASE WHEN abc_class = 'B' AND estoque_atual <= 0 THEN 1 ELSE 0 END) AS rupturasCurvaB,
                 ROUND(SUM(venda_perdida_est_rs), 2) AS vendaPerdidaEstimadaRs91d,
                 SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN 1 ELSE 0 END) AS skusSugestaoCompra,
                 ROUND(SUM(CASE WHEN dismissed = 0 THEN sugestao_compra_rs ELSE 0 END), 2) AS totalSugestaoCompraRs,
                 ROUND(SUM(CASE WHEN estoque_max > 0 AND estoque_atual > estoque_max THEN (estoque_atual - estoque_max) * custo_unit ELSE 0 END), 2) AS capitalExcessoAcimaMaxRs,
                 ROUND(SUM(CASE WHEN abc_class = 'D' AND estoque_atual > 0 THEN estoque_atual * custo_unit ELSE 0 END), 2) AS capitalParadoCurvaDRs,
                 ROUND(SUM(lote_vencendo_90d_rs), 2) AS lotesVencendo90dRs,
                 ROUND(SUM(lote_vencido_qtd * custo_unit), 2) AS lotesVencidosRs,
                 SUM(CASE WHEN excecoes_json <> '[]' THEN 1 ELSE 0 END) AS skusComExcecao
          FROM engine_sku_results
          WHERE run_id = ?
          GROUP BY filial_id
        `).all(latestRun.id);

        for (const s of stats) {
          filialKpis[String(s.filial_id)] = {
            ...s,
            referenceDate: latestRun.summary?.referenceDate,
            weeksWindow: latestRun.summary?.weeksWindow,
            economiaMoleculaRs: latestRun.summary?.economiaMoleculaRs || 0,
            economiaMoleculaUn: latestRun.summary?.economiaMoleculaUn || 0,
          };
        }
      }

      const filiaisPolicies = getFilialPolicies(clientCode);
      const licenseStatus = getClientLicenseStatus(clientCode);
      return sendJson(res, 200, {
        appVersion: APP_VERSION,
        profile,
        latestRun,
        cmedImport: cmed.lastImport,
        filtersMeta,
        filiaisPolicies,
        filialKpis,
        licenseStatus: {
          ...licenseStatus,
          currentMachineId: getMachineFingerprint(),
        },
      });
    }

    // ========================================================
    // ROTAS DE CONTROLE ORÇAMENTÁRIO & DOTAÇÃO (OTB)
    // ========================================================
    if (pathname === '/api/budget/overview' && req.method === 'GET') {
      try {
        const force = urlObj.searchParams.get('refresh') === '1';
        const filialId = urlObj.searchParams.get('filial_id');
        const budget = await calculateBudgetOverview(clientCode, { forceRefresh: force, filialId });
        return sendJson(res, 200, { ok: true, data: budget, budget, ...budget });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: `Erro ao apurar dotação orçamentária: ${err.message}` });
      }
    }

    if (pathname === '/api/budget/recalculate' && req.method === 'POST') {
      try {
        const filialId = urlObj.searchParams.get('filial_id');
        const budget = await calculateBudgetOverview(clientCode, { forceRefresh: true, filialId });
        return sendJson(res, 200, { ok: true, data: budget, budget, ...budget });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: `Erro ao recalcular dotação: ${err.message}` });
      }
    }

    // ========================================================
    // OPERAÇÃO LOGÍSTICA (OL) & IA CONSULTORA DE PEDIDOS MÍNIMOS
    // ========================================================
    if (pathname === '/api/ol/fabricantes' && req.method === 'GET') {
      try {
        const fabricantes = listOlFabricantes(clientCode);
        return sendJson(res, 200, { ok: true, fabricantes });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/ol/dashboard' && req.method === 'GET') {
      try {
        const filialId = urlObj.searchParams.get('filial_id');
        const dashboard = getOlDashboardOverview(clientCode, filialId);
        return sendJson(res, 200, { ok: true, ...dashboard });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/ol/fabricante' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const result = saveOlFabricante(clientCode, body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/ol/opportunity' && req.method === 'GET') {
      try {
        const fabricante = urlObj.searchParams.get('fabricante');
        const runId = urlObj.searchParams.get('runId') ? Number(urlObj.searchParams.get('runId')) : null;
        const filialId = urlObj.searchParams.get('filial_id');
        const analysis = analyzeOlOpportunity(clientCode, { fabricante, runId, filialId });
        return sendJson(res, 200, { ok: true, ...analysis });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/ol/export-excel' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { fabricante, items, observacoes } = body;
        const profile = getClientProfile(clientCode) || {};
        const olList = listOlFabricantes(clientCode);
        const olConfig = olList.find(o => o.fabricante_nome.toUpperCase() === String(fabricante || '').toUpperCase()) || null;

        const buffer = await generateOlOrderExcel({
          clientName: profile.name || 'Drogaria',
          clientCnpj: profile.buyer_cnpj || '',
          filialNome: `Filial ${profile.buyer_filial_id || 2}`,
          filialId: profile.buyer_filial_id || 2,
          fabricante: fabricante || 'FABRICANTE',
          olConfig,
          items: items || [],
          observacoes: observacoes || '',
        });

        const safeFab = String(fabricante || 'OL').replace(/[^a-zA-Z0-9_-]/g, '_');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="PEDIDO_OL_${safeFab}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
          'Content-Length': buffer.length,
        });
        return res.end(buffer);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ========================================================
    // ROTAS DE LICENCIAMENTO, ASSINATURA & SEGURANÇA MASTER
    // ========================================================
    if (pathname === '/api/license/status' && req.method === 'GET') {
      const status = getClientLicenseStatus(clientCode);
      const machineId = getMachineFingerprint();
      return sendJson(res, 200, {
        ok: true,
        appVersion: APP_VERSION,
        ...status,
        currentMachineId: machineId,
      });
    }

    if (pathname === '/api/system/check-update' && req.method === 'GET') {
      try {
        const ghRes = await fetch('https://api.github.com/repos/bitencourtbig-jpg/mesa-compras-ia-releases/releases/latest', {
          headers: { 'User-Agent': 'MesaComprasIA-Client' },
        });
        if (!ghRes.ok) {
          return sendJson(res, 200, { hasUpdate: false, currentVersion: APP_VERSION, error: 'GitHub indisponível' });
        }
        const data = await ghRes.json();
        const latestTag = data.tag_name || '';
        const cleanLatest = latestTag.replace(/^v/, '');
        const hasUpdate = cleanLatest !== APP_VERSION;
        return sendJson(res, 200, {
          hasUpdate,
          currentVersion: APP_VERSION,
          latestVersion: latestTag,
          releaseName: data.name || latestTag,
          publishedAt: data.published_at,
          notes: data.body || '',
          downloadUrl: 'https://github.com/bitencourtbig-jpg/mesa-compras-ia-releases/releases/latest/download/Mesa_Compras_IA_Core.zip',
        });
      } catch (err) {
        return sendJson(res, 200, { hasUpdate: false, currentVersion: APP_VERSION, error: err.message });
      }
    }

    if (pathname === '/api/system/apply-update' && req.method === 'POST') {
      try {
        const os = await import('node:os');
        const tempZip = path.join(os.tmpdir(), 'Mesa_Compras_IA_Update.zip');
        const releaseUrl = 'https://github.com/bitencourtbig-jpg/mesa-compras-ia-releases/releases/latest/download/Mesa_Compras_IA_Core.zip';

        // 1. Download do zip oficial diretamente em memória/disco
        const resp = await fetch(releaseUrl, { headers: { 'User-Agent': 'MesaComprasIA-InAppUpdater' } });
        if (!resp.ok) {
          throw new Error(`Falha no download da versão (${resp.status}): ${resp.statusText}`);
        }
        const arrayBuf = await resp.arrayBuffer();
        fs.writeFileSync(tempZip, Buffer.from(arrayBuf));

        // 2. Extração segura preservando analytics.db, .env e node.exe
        const { execSync, spawn } = await import('node:child_process');
        const parentDir = path.resolve(PROJECT_ROOT, '..').replace(/\\/g, '/');

        let extractOk = false;
        try {
          execSync(`tar -xf "${tempZip}" --exclude="*analytics.db*" --exclude="*.env*" --exclude="*node.exe*" -C "${parentDir}"`, { stdio: 'pipe' });
          extractOk = true;
        } catch (tarErr) {
          // Fallback via PowerShell caso tar apresente alguma restrição
          try {
            const psScript = `
              Add-Type -AssemblyName System.IO.Compression.FileSystem;
              $archive = [System.IO.Compression.ZipFile]::OpenRead('${tempZip.replace(/\\/g, '\\\\')}');
              $targetBase = '${parentDir.replace(/\\/g, '\\\\')}';
              foreach ($entry in $archive.Entries) {
                if ($entry.FullName -match 'analytics\\.db|\\.env|node\\.exe') { continue; }
                $outPath = [System.IO.Path]::Combine($targetBase, $entry.FullName);
                if ([string]::IsNullOrEmpty($entry.Name)) {
                  [System.IO.Directory]::CreateDirectory($outPath) | Out-Null;
                } else {
                  $dir = [System.IO.Path]::GetDirectoryName($outPath);
                  if (!(Test-Path $dir)) { [System.IO.Directory]::CreateDirectory($dir) | Out-Null; }
                  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $outPath, $true);
                }
              }
              $archive.Dispose();
            `;
            execSync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { stdio: 'pipe' });
            extractOk = true;
          } catch (psErr) {
            throw new Error(`Falha ao extrair arquivos da atualização: ${tarErr.message} | ${psErr.message}`);
          }
        }

        // 3. Responder sucesso para o navegador antes de reiniciar
        sendJson(res, 200, { ok: true, message: 'Atualização baixada e aplicada com sucesso! O motor reiniciará em instantes.' });

        // 4. Agendar reinicialização desanexada e sair para liberar a porta 3456
        const serverMjs = path.join(PROJECT_ROOT, 'src', 'server.mjs');
        const restartCmd = `timeout /t 2 /nobreak >nul && "${process.execPath}" "${serverMjs}"`;
        const child = spawn('cmd.exe', ['/c', restartCmd], {
          detached: true,
          stdio: 'ignore',
          cwd: PROJECT_ROOT,
        });
        child.unref();

        setTimeout(() => {
          process.exit(0);
        }, 1000);
        return;
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: `Falha ao aplicar atualização: ${err.message}` });
      }
    }

    if (pathname === '/api/license/activate' && req.method === 'POST') {
      const body = await readBody(req);
      const key = body.licenseKey || body.key;
      if (!key) {
        return sendJson(res, 400, { ok: false, error: 'Chave de licença não informada.' });
      }
      try {
        const result = activateLicenseKey(clientCode, key);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/master/verify' && req.method === 'POST') {
      const body = await readBody(req);
      const valid = verifyMasterPassword(body.masterPassword);
      if (!valid) {
        return sendJson(res, 403, { ok: false, error: 'Senha Master incorreta ou não autorizada.' });
      }
      return sendJson(res, 200, { ok: true, message: 'Autenticação Master validada.' });
    }

    if (pathname === '/api/license/generate-master' && req.method === 'POST') {
      const body = await readBody(req);
      const valid = verifyMasterPassword(body.masterPassword);
      if (!valid) {
        return sendJson(res, 403, { ok: false, error: 'Acesso negado: Senha Master incorreta.' });
      }
      const gen = generateLicenseKey({
        cnpj: body.cnpj,
        machineId: body.machineId,
        days: body.days || 30,
        maxFiliais: body.maxFiliais || 1,
        planType: body.planType || 'mensal',
      });
      // Grava automaticamente no livro de controle do dono
      recordIssuedLicense({
        clientName: body.clientName || 'Cliente Farmácia',
        cnpj: body.cnpj,
        machineId: body.machineId,
        contactPhone: body.contactPhone || '',
        monthlyPrice: body.monthlyPrice || 0,
        planType: body.planType || 'mensal',
        days: body.days || 30,
        licenseKey: gen.licenseKey,
        validUntil: gen.validUntil,
        notes: body.notes || '',
      });
      return sendJson(res, 200, gen);
    }

    if (pathname === '/api/master/change-password' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const result = updateMasterPassword(body.currentPassword, body.newPassword);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/admin/licenses' && req.method === 'GET') {
      if (!isMasterRequest(req)) {
        return sendJson(res, 403, { ok: false, error: 'Acesso restrito ao Painel do Dono. Senha Master necessária.' });
      }
      const licenses = listIssuedLicenses();
      return sendJson(res, 200, { ok: true, licenses });
    }

    if (pathname === '/api/admin/licenses' && req.method === 'DELETE') {
      if (!isMasterRequest(req)) {
        return sendJson(res, 403, { ok: false, error: 'Acesso negado.' });
      }
      const id = urlObj.searchParams.get('id');
      if (id) deleteIssuedLicense(id);
      return sendJson(res, 200, { ok: true, message: 'Registro removido com sucesso.' });
    }

    // ========================================================
    // ROTAS DE STATUS E IMPORTAÇÃO DO CATÁLOGO OFICIAL CMED
    // ========================================================
    if (pathname === '/api/cmed/status' && req.method === 'GET') {
      const cmed = getCachedCmedMaps();
      const countCatalog = db.prepare('SELECT COUNT(*) AS c FROM cmed_catalog').get()?.c || 0;
      const countEans = db.prepare('SELECT COUNT(*) AS c FROM cmed_eans').get()?.c || 0;
      return sendJson(res, 200, {
        ok: true,
        ready: countCatalog > 0,
        totalCatalog: countCatalog,
        totalEans: countEans,
        lastImport: cmed.lastImport || null,
        officialDownloadUrl: 'https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos',
      });
    }

    if (pathname === '/api/cmed/import' && req.method === 'POST') {
      const body = await readBody(req);
      let targetPath = '';

      // 1. Se passou um caminho local direto no disco
      if (body.filePath && typeof body.filePath === 'string') {
        targetPath = body.filePath.trim();
      }
      // 2. Se enviou o arquivo via base64 do navegador
      else if (body.fileBase64 && typeof body.fileBase64 === 'string') {
        const rawName = body.fileName || 'Lista_PMC_ANVISA.xlsx';
        const cleanName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadDir = path.join(PROJECT_ROOT, 'data', 'cmed');
        fs.mkdirSync(uploadDir, { recursive: true });
        targetPath = path.join(uploadDir, cleanName);

        const base64Data = body.fileBase64.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetPath, buffer);
      }
      // 3. Fallback: Se existe algum arquivo .xlsx recente na pasta data/cmed/
      else {
        const cmedDir = path.join(PROJECT_ROOT, 'data', 'cmed');
        if (fs.existsSync(cmedDir)) {
          const files = fs.readdirSync(cmedDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.zip'));
          if (files.length > 0) {
            targetPath = path.join(cmedDir, files[0]);
          }
        }
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Nenhum arquivo CMED (.xlsx ou .zip) foi enviado ou encontrado no caminho informado.',
        });
      }

      try {
        const result = await importOfficialCmedToSqlite(targetPath);
        return sendJson(res, 200, {
          ok: true,
          message: `Catálogo CMED importado com sucesso! ${result.totalCatalog} apresentações e ${result.totalEans} EANs indexados.`,
          ...result,
        });
      } catch (err) {
        return sendJson(res, 500, {
          ok: false,
          error: 'Erro ao processar planilha CMED: ' + err.message,
        });
      }
    }

    if (pathname === '/api/engine/run' && req.method === 'POST') {
      const licStatus = getClientLicenseStatus(clientCode);
      if (licStatus.isExpired || !licStatus.isValid) {
        return sendJson(res, 403, {
          ok: false,
          error: `Licença de uso expirada ou inválida. Venceu em ${licStatus.validUntil || 'indefinido'}. Por favor, insira uma chave de assinatura mensal válida para calcular compras.`,
          licenseExpired: true,
          licStatus,
        });
      }
      const body = await readBody(req);
      let profile = getClientProfile(clientCode);
      if (!profile) {
        return sendJson(res, 404, { error: `Cliente ${clientCode} nao encontrado.` });
      }
      if (body.serviceProfile || body.weeksWindow || body.recentEntriesLimit) {
        profile = upsertClientProfile({
          ...profile,
          service_profile: body.serviceProfile || profile.service_profile,
          default_weeks: Number(body.weeksWindow || profile.default_weeks),
          recent_entries_limit: Number(body.recentEntriesLimit || profile.recent_entries_limit),
        });
      }

      const forceSync = body.forceSync === true || (body.fastRecalc !== true && !_rawCache.has(clientCode));
      const cached = _rawCache.get(clientCode);
      let raw;
      if (!forceSync && cached && (Date.now() - cached.timestamp < 30 * 60 * 1000)) {
        raw = cached.data;
      } else {
        try {
          raw = await syncBigClientData(profile, { referenceDate: body.referenceDate || null });
          _rawCache.set(clientCode, { data: raw, timestamp: Date.now() });
        } catch (syncErr) {
          // Fallback resiliente: se for fastRecalc (ex: troca de perfil no topo) e tivermos qualquer cache anterior em memoria, aproveita
          if (cached && cached.data) {
            console.warn(`[engine/run] syncBigClientData falhou (${syncErr.code || syncErr.message}). Utilizando cache existente em memória para concluir recálculo.`);
            raw = cached.data;
          } else {
            throw syncErr;
          }
        }
      }
      const result = runPurchasingEngine(profile, raw, {
        weeksWindow: Number(body.weeksWindow || profile.default_weeks),
        serviceProfile: body.serviceProfile || profile.service_profile,
        recentEntriesLimit: Number(body.recentEntriesLimit || profile.recent_entries_limit),
      });
      _treeCache.clear();
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (pathname === '/api/glossary' && req.method === 'GET') {
      return sendJson(res, 200, {
        sections: GLOSSARY_SECTIONS,
        hints: GLOSSARY_TERM_HINTS,
      });
    }

    if (pathname === '/api/bi' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { empty: true });
      const filialId = urlObj.searchParams.get('filial_id');
      const bi = buildExecutiveBi(clientCode, latestRun.id, latestRun.summary, filialId);
      return sendJson(res, 200, { empty: false, runId: latestRun.id, referenceDate: latestRun.reference_date, ...bi });
    }

    if (pathname === '/api/skus' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { total: 0, rows: [] });

      const limit = Math.min(1000, Math.max(10, Number(urlObj.searchParams.get('limit') || 80)));
      const offset = Math.max(0, Number(urlObj.searchParams.get('offset') || 0));
      const budget = Number(urlObj.searchParams.get('budget') || 0);
      const sort = urlObj.searchParams.get('sort') || 'impact';
      const customHorizonRaw = urlObj.searchParams.get('horizon_days');
      const customHorizon = customHorizonRaw && !isNaN(Number(customHorizonRaw)) ? Number(customHorizonRaw) : null;

      const tab = urlObj.searchParams.get('tab') || 'buy';
      const { whereSql, params } = buildSkuFilterSql(urlObj.searchParams, latestRun.id, clientCode);
      const orderBy = getOrderByClause(sort);

      const activeSuspensions = getActiveSkuSuspensions(clientCode);
      const suspensionsMap = new Map(activeSuspensions.map((s) => [s.produto_id, s]));

      // Busca todos os candidatos que satisfazem os filtros de banco
      let allCandidates = db
        .prepare(`SELECT * FROM engine_sku_results WHERE ${whereSql} ORDER BY ${orderBy}`)
        .all(...params);

      // Hidrata os SKUs aplicando simulação de horizonte (ex: 15d, 21d, etc.) se solicitado
      let processed = allCandidates.map((r) => hydrateSkuRow(r, customHorizon, suspensionsMap));

      // Se estamos na aba 'buy' (Sugestão de Compra), NENHUM item que caia para 0 un ou com tag 'NÃO COMPRAR' pode aparecer
      if (tab === 'buy') {
        processed = processed.filter((r) => {
          const q = r.budget_qtd !== undefined ? Number(r.budget_qtd) : Number(r.sugestao_compra_un || 0);
          return q > 0 && r.ia_analysis?.acaoCodigo !== 'NAO_COMPRAR';
        });
      }

      if (budget > 0) {
        const { selected, used, cutOff, totalRequested, cutTotalRs } = applyBudgetCap(processed, budget);
        const pagedRows = selected.slice(offset, offset + limit);
        const uniquePids = [...new Set(pagedRows.map((r) => r.produto_id))];
        const networkMap = new Map();
        if (uniquePids.length > 0) {
          const netRows = db
            .prepare(
              `SELECT filial_id, filial_reduz, filial_nome, produto_id, estoque_atual, transito_real,
                      vendas_13s, ddv_projetada, estoque_min, estoque_max, cobertura_dias,
                      sugestao_compra_un, sugestao_compra_rs, justificativa_ia, excecoes_json
               FROM engine_sku_results
               WHERE run_id = ? AND produto_id IN (${uniquePids.map(() => '?').join(',')}) AND filial_id <> 1
               ORDER BY filial_id ASC`
            )
            .all(latestRun.id, ...uniquePids);

          for (const nr of netRows) {
            if (!networkMap.has(nr.produto_id)) networkMap.set(nr.produto_id, []);
            networkMap.get(nr.produto_id).push(nr);
          }
        }
        for (const pr of pagedRows) {
          pr.rede_distribuicao = networkMap.get(pr.produto_id) || [];
        }
        return sendJson(res, 200, {
          total: selected.length,
          sumRs: used,
          budgetApplied: budget,
          budgetAudit: {
            budget,
            used,
            totalRequested,
            cutTotalRs,
            selectedCount: selected.length,
            cutCount: cutOff.length,
            cutOffTop: cutOff.slice(0, 100),
          },
          rows: pagedRows,
        });
      }

      const totalCount = processed.length;
      const totalSumRs = Math.round(processed.reduce((a, b) => a + Number(b.sugestao_compra_rs || 0), 0) * 100) / 100;
      const pagedRows = processed.slice(offset, offset + limit);
      const uniquePids = [...new Set(pagedRows.map((r) => r.produto_id))];
      const networkMap = new Map();
      if (uniquePids.length > 0) {
        const netRows = db
          .prepare(
            `SELECT filial_id, filial_reduz, filial_nome, produto_id, estoque_atual, transito_real,
                    vendas_13s, ddv_projetada, estoque_min, estoque_max, cobertura_dias,
                    sugestao_compra_un, sugestao_compra_rs, justificativa_ia, excecoes_json
             FROM engine_sku_results
             WHERE run_id = ? AND produto_id IN (${uniquePids.map(() => '?').join(',')}) AND filial_id <> 1
             ORDER BY filial_id ASC`
          )
          .all(latestRun.id, ...uniquePids);

        for (const nr of netRows) {
          if (!networkMap.has(nr.produto_id)) networkMap.set(nr.produto_id, []);
          networkMap.get(nr.produto_id).push(nr);
        }
      }
      for (const pr of pagedRows) {
        pr.rede_distribuicao = networkMap.get(pr.produto_id) || [];
      }

      return sendJson(res, 200, {
        total: totalCount,
        sumRs: totalSumRs,
        rows: pagedRows,
      });
    }

    if (pathname === '/api/groups/tree' && req.method === 'GET') {
      try {
        const latestRun = getLatestRun(clientCode);
        if (!latestRun) return sendJson(res, 200, { tree: [] });
        const filialId = urlObj.searchParams.get('filial_id');
        const cacheKey = `${latestRun.id}|${filialId || 'all'}`;
        if (_treeCache.has(cacheKey)) {
          return sendJson(res, 200, { tree: _treeCache.get(cacheKey) });
        }
        const tree = getGroupsTree(latestRun.id, filialId);
        _treeCache.set(cacheKey, tree);
        return sendJson(res, 200, { tree });
      } catch (err) {
        return sendJson(res, 500, { error: err.message, tree: [] });
      }
    }

    if (pathname === '/api/skus/dismiss' && req.method === 'POST') {
      const body = await readBody(req);
      const filialId = Number(body.filialId || 2);
      const produtoId = Number(body.produtoId);
      const dismissed = body.dismissed !== undefined ? (body.dismissed ? 1 : 0) : 1;
      if (!produtoId) return sendJson(res, 400, { error: 'produtoId obrigatorio.' });
      dismissSku(clientCode, filialId, produtoId, dismissed);
      return sendJson(res, 200, { ok: true, produtoId, dismissed });
    }

    if (pathname === '/api/skus/suspend' && req.method === 'DELETE') {
      const filialId = Number(urlObj.searchParams.get('filialId') || 2);
      const produtoId = Number(urlObj.searchParams.get('produtoId'));
      if (!produtoId) return sendJson(res, 400, { error: 'produtoId obrigatorio.' });
      removeSkuSuspension(clientCode, filialId, produtoId);
      return sendJson(res, 200, { ok: true, produtoId, message: 'Suspensão de compras removida no Motor.' });
    }

    if (pathname === '/api/skus/suspend-big' && req.method === 'POST') {
      const body = await readBody(req);
      const filialId = Number(body.filialId || 2);
      const produtoId = Number(body.produtoId);
      const days = Number(body.days || 30);
      const motivo = String(body.motivo || 'Excesso / Sem giro / Decisão Comprador');
      const target = String(body.target || 'motor'); // 'motor' (exclusivo) ou 'big' (grava no BIG)
      if (!produtoId) return sendJson(res, 400, { error: 'produtoId obrigatorio.' });

      // Busca dados do SKU para gravar histórico legível
      const skuRow = db.prepare('SELECT descricao FROM engine_sku_results WHERE produto_id = ? LIMIT 1').get(produtoId);
      const descricao = skuRow?.descricao || '';

      // 1. Grava suspensão persistente no Motor Inteligente (REV-011)
      const suspRes = recordSkuSuspension(clientCode, filialId, produtoId, {
        descricao,
        motivo,
        days,
        origem: target === 'big' ? 'BIG_SYNCED' : 'MOTOR_ONLY',
      });

      let bigOk = false;
      let bigMsg = `Produto suspenso exclusivamente no Motor Inteligente até ${suspRes.endDate}. O Linx BIG permaneceu intacto.`;

      // 2. Se o usuário optou por gravar também no Linx BIG ERP
      if (target === 'big') {
        const profile = getClientProfile(clientCode) || {};
        try {
          const conn = await createWriteConnection(profile);
          try {
            await conn.execute(`
              INSERT INTO produtos_suspensos_compra (
                filial_id, produto_id, compra_suspensa, desabilita_qtde_estoque,
                data_inicio_bloqueio, data_fim_bloqueio, justificativa_susp_compra_id,
                dtcadastro, cad_usuario_id, apagado
              ) VALUES (?, ?, 'S', 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 2, NOW(), 1, 'N')
              ON DUPLICATE KEY UPDATE 
                compra_suspensa = 'S', 
                data_fim_bloqueio = DATE_ADD(CURDATE(), INTERVAL ? DAY),
                dtalteracao = NOW(),
                apagado = 'N'
            `, [filialId, produtoId, days, days]);
            bigOk = true;
            bigMsg = `Compra suspensa no Motor e no Linx BIG por ${days} dias (até ${suspRes.endDate}).`;
          } finally {
            await conn.end();
          }
        } catch (err) {
          console.warn('Alerta na suspensao no MariaDB:', err.message);
          bigMsg = `Item suspenso no Motor Inteligente. (Aviso BIG: ${err.message})`;
        }
      }

      return sendJson(res, 200, { ok: true, produtoId, bigOk, target, endDate: suspRes.endDate, message: bigMsg });
    }

    // -------------------------------------------------------------
    // GESTÃO DE POLÍTICAS DE FILIAIS & CARÊNCIA DE LOJAS NOVAS
    // -------------------------------------------------------------
    if (pathname === '/api/filiais/policies' && req.method === 'GET') {
      const policies = getFilialPolicies(clientCode);
      return sendJson(res, 200, { ok: true, policies });
    }

    if (pathname === '/api/filiais/policies' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.filial_id) return sendJson(res, 400, { error: 'filial_id obrigatorio.' });
      upsertFilialPolicy({
        client_code: clientCode,
        filial_id: Number(body.filial_id),
        nome_loja: body.nome_loja || `Filial ${body.filial_id}`,
        nome_reduz: body.nome_reduz || null,
        data_inauguracao: body.data_inauguracao || null,
        dias_carencia: Number(body.dias_carencia ?? 90),
        bloquear_doacao_remanejamento: body.bloquear_doacao_remanejamento !== undefined ? (body.bloquear_doacao_remanejamento ? 1 : 0) : 1,
        tipo_reposicao: body.tipo_reposicao || 'sellout_1to1',
      });
      return sendJson(res, 200, { ok: true });
    }

    // -------------------------------------------------------------
    // REMANEJAMENTO MULTI-LOJA: ROTAS, APROVAÇÃO, ESTOQUE EM TRÂNSITO & EXCEL
    // -------------------------------------------------------------
    if (pathname === '/api/remanejamento/routes' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { routes: [], summary: {} });

      const filialId = urlObj.searchParams.get('filial_id');
      const origemParam = urlObj.searchParams.get('origem');
      const destinoParam = urlObj.searchParams.get('destino');
      const tipoParam = urlObj.searchParams.get('tipo') || 'ALL';
      const curvaParam = urlObj.searchParams.get('curva') || 'ALL';
      const minValParam = Number(urlObj.searchParams.get('min_valor') || 0);
      const searchParam = (urlObj.searchParams.get('search') || '').trim();

      const conditions = ['r.run_id = ?'];
      const params = [latestRun.id];

      if (origemParam && origemParam !== 'ALL' && !isNaN(Number(origemParam))) {
        conditions.push('r.filial_origem = ?');
        params.push(Number(origemParam));
      }
      if (destinoParam && destinoParam !== 'ALL' && !isNaN(Number(destinoParam))) {
        conditions.push('r.filial_destino = ?');
        params.push(Number(destinoParam));
      }
      if (filialId && filialId !== 'all' && !isNaN(Number(filialId)) && !origemParam && !destinoParam) {
        conditions.push('(r.filial_origem = ? OR r.filial_destino = ?)');
        params.push(Number(filialId), Number(filialId));
      }
      if (tipoParam && tipoParam !== 'ALL') {
        if (tipoParam === 'CURADORIA_IA') {
          conditions.push("(r.tipo = 'CURADORIA_IA' OR r.motivo LIKE '%Curadoria%' OR esr_orig.justificativa_ia LIKE '%Remanejamento%')");
        } else {
          conditions.push('r.tipo = ?');
          params.push(tipoParam);
        }
      }
      if (curvaParam && curvaParam !== 'ALL') {
        conditions.push('esr_orig.abc_class = ?');
        params.push(curvaParam);
      }
      if (minValParam > 0) {
        conditions.push('r.valor_total >= ?');
        params.push(minValParam);
      }
      if (searchParam) {
        conditions.push('(r.descricao LIKE ? OR esr_orig.barras LIKE ? OR esr_orig.labora LIKE ? OR CAST(r.produto_id AS TEXT) LIKE ?)');
        const s = `%${searchParam}%`;
        params.push(s, s, s, s);
      }

      const remanSql = `
        SELECT r.id, r.run_id, r.produto_id, r.descricao, r.filial_origem, r.filial_destino,
               r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.validade_prioritaria, r.motivo,
               esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
               esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
               esr_orig.barras, esr_orig.labora, esr_orig.abc_class, esr_orig.justificativa_ia, esr_orig.molecule_key
        FROM engine_remanejamento r
        LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
        LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC
      `;

      const remanRows = db.prepare(remanSql).all(...params);

      // Agrupamento por Rota
      const routesMap = new Map();
      let fefoCount = 0, fefoVal = 0;
      let excessoCount = 0, excessoVal = 0;
      let paradoCount = 0, paradoVal = 0;
      let curadoriaCount = 0, curadoriaVal = 0;

      for (const row of remanRows) {
        const routeKey = `${row.filial_origem}->${row.filial_destino}`;
        if (!routesMap.has(routeKey)) {
          routesMap.set(routeKey, {
            routeKey,
            filialOrigem: row.filial_origem,
            filialOrigemNome: row.filial_origem_nome || `Filial ${row.filial_origem}`,
            filialOrigemReduz: row.filial_origem_reduz || `L${String(row.filial_origem).padStart(2, '0')}`,
            filialDestino: row.filial_destino,
            filialDestinoNome: row.filial_destino_nome || `Filial ${row.filial_destino}`,
            filialDestinoReduz: row.filial_destino_reduz || `L${String(row.filial_destino).padStart(2, '0')}`,
            totalItens: 0,
            totalUnidades: 0,
            valorTotalRs: 0,
            countFefo: 0,
            countExcesso: 0,
            countParado: 0,
            countCuradoria: 0,
            items: [],
          });
        }
        const rObj = routesMap.get(routeKey);
        const val = Number(row.valor_total || 0);
        const un = Number(row.qtd_sugerida || 0);

        rObj.totalItens += 1;
        rObj.totalUnidades += un;
        rObj.valorTotalRs = Math.round((rObj.valorTotalRs + val) * 100) / 100;

        const isCuradoria = row.tipo === 'CURADORIA_IA' || (row.motivo && row.motivo.includes('Curadoria')) || (row.justificativa_ia && row.justificativa_ia.includes('Remanejamento'));
        if (isCuradoria) {
          rObj.countCuradoria += 1;
          curadoriaCount += 1;
          curadoriaVal += val;
        } else if (row.tipo === 'FEFO_VALIDADE') {
          rObj.countFefo += 1;
          fefoCount += 1;
          fefoVal += val;
        } else if (row.tipo === 'EXCESSO') {
          rObj.countExcesso += 1;
          excessoCount += 1;
          excessoVal += val;
        } else {
          rObj.countParado += 1;
          paradoCount += 1;
          paradoVal += val;
        }

        rObj.items.push({
          ...row,
          barras: row.barras || '',
          labora: row.labora || '',
          isCuradoria,
        });
      }

      const activeTransfers = getMotorTransfers(clientCode);
      const curadoriaDecisionsList = getCuradoriaDecisions(clientCode, latestRun.id);

      // REV-026: Quando o comprador filtra por Curadoria IA, mesclar decisões tomadas para que nunca apareça vazio
      if (tipoParam === 'CURADORIA_IA' || tipoParam === 'ALL') {
        for (const cd of curadoriaDecisionsList) {
          if (cd.lojas_doadoras && cd.lojas_doadoras.length > 0) {
            const donor = cd.lojas_doadoras[0];
            const dest = cd.lojas_canceladas[0] || { filial_id: donor.filial_id === 2 ? 3 : 2, nome: donor.filial_id === 2 ? 'BF CENTRO' : 'BF CID.NOVA' };
            const rKey = `${donor.filial_id}->${dest.filial_id}`;
            
            if (!routesMap.has(rKey)) {
              routesMap.set(rKey, {
                routeKey: rKey,
                filialOrigem: donor.filial_id,
                filialOrigemNome: donor.nome,
                filialOrigemReduz: donor.nome,
                filialDestino: dest.filial_id,
                filialDestinoNome: dest.nome,
                filialDestinoReduz: dest.nome,
                totalItens: 0,
                totalUnidades: 0,
                valorTotalRs: 0,
                countFefo: 0,
                countExcesso: 0,
                countParado: 0,
                countCuradoria: 0,
                items: []
              });
            }
            
            const rObj = routesMap.get(rKey);
            // Evitar duplicar o mesmo produto na mesma rota
            if (!rObj.items.some(it => it.produto_id === cd.produto_id)) {
              const itemQty = cd.total_un_abatidas || 1;
              const itemRs = cd.economia_rs || Math.round(itemQty * cd.custo_unit * 100) / 100;
              rObj.totalItens += 1;
              rObj.totalUnidades += itemQty;
              rObj.valorTotalRs = Math.round((rObj.valorTotalRs + itemRs) * 100) / 100;
              rObj.countCuradoria += 1;
              curadoriaCount += 1;
              curadoriaVal += itemRs;

              rObj.items.push({
                id: `curad-${cd.produto_id}`,
                run_id: latestRun.id,
                produto_id: cd.produto_id,
                descricao: cd.descricao,
                filial_origem: donor.filial_id,
                filial_origem_nome: donor.nome,
                filial_destino: dest.filial_id,
                filial_destino_nome: dest.nome,
                tipo: 'CURADORIA_IA',
                qtd_sugerida: itemQty,
                custo_unit: cd.custo_unit,
                valor_total: itemRs,
                validade_prioritaria: '2027-12-31',
                motivo: `🧬 Curadoria IA • Transfer-First: Abatimento de compra externa suprido por estoque de ${donor.labora} (${donor.estoque_atual} un em estoque)`,
                barras: cd.barras,
                labora: cd.labora,
                isCuradoria: true
              });
            }
          }
        }
      }

      // Lista de filiais ativas para os dropdowns de filtro
      const clientPolicies = getFilialPolicies(clientCode).filter((p) => Number(p.filial_id) !== 1);
      const filiais = clientPolicies.map((p) => ({
        filial_id: Number(p.filial_id),
        label: `L${String(p.filial_id).padStart(2, '0')} • ${p.nome_reduz || p.nome_loja?.slice(0, 15) || `Loja ${p.filial_id}`}`,
        short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
      }));

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        routes: Array.from(routesMap.values()),
        totalGeralRs: Math.round(remanRows.reduce((a, b) => a + Number(b.valor_total || 0), 0) * 100) / 100,
        totalGeralUnidades: remanRows.reduce((a, b) => a + Number(b.qtd_sugerida || 0), 0),
        totalItens: remanRows.length,
        summary: {
          fefoCount, fefoVal: Math.round(fefoVal * 100) / 100,
          excessoCount, excessoVal: Math.round(excessoVal * 100) / 100,
          paradoCount, paradoVal: Math.round(paradoVal * 100) / 100,
          curadoriaCount, curadoriaVal: Math.round(curadoriaVal * 100) / 100,
        },
        filiais,
        transfers: activeTransfers,
      });
    }

    if (pathname === '/api/remanejamento/approve' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const body = await readBody(req);
      const { filialOrigem, filialDestino, items, observacao } = body;
      if (!filialOrigem || !filialDestino || !Array.isArray(items) || items.length === 0) {
        return sendJson(res, 400, { error: 'filialOrigem, filialDestino e items obrigatorios.' });
      }

      const resTransf = createMotorTransfer(clientCode, latestRun.id, {
        filialOrigem: Number(filialOrigem),
        filialDestino: Number(filialDestino),
        filialOrigemNome: body.filialOrigemNome || `Filial ${filialOrigem}`,
        filialDestinoNome: body.filialDestinoNome || `Filial ${filialDestino}`,
        items,
        observacao: observacao || 'Aprovado pelo comprador via Cockpit',
      });

      // Abate da sugestao de compra externa para os distribuidores na filial destino
      const updDest = db.prepare(`
        UPDATE engine_sku_results
        SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
            sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
            transito_remanejamento = transito_remanejamento + ?,
            remanejamento_entrada = remanejamento_entrada + ?
        WHERE run_id = ? AND filial_id = ? AND produto_id = ?
      `);
      for (const it of items) {
        const q = Number(it.qtd_solicitada || it.qtdSugerida || it.qtd_sugerida || it.qtd || 0);
        const pId = Number(it.produto_id || it.produtoId);
        updDest.run(q, q, q, q, latestRun.id, Number(filialDestino), pId);
      }

      return sendJson(res, 200, { ok: true, ...resTransf });
    }

    if (pathname === '/api/remanejamento/transfers' && req.method === 'GET') {
      const status = urlObj.searchParams.get('status');
      const transfers = getMotorTransfers(clientCode, status);
      return sendJson(res, 200, { ok: true, transfers });
    }

    if ((pathname === '/api/remanejamento/transfer-status' || pathname === '/api/remanejamento/status') && req.method === 'POST') {
      const body = await readBody(req);
      const tId = Number(body.transferId || body.id);
      const status = body.status;
      if (!tId || !status) {
        return sendJson(res, 400, { error: 'transferId e status obrigatorios.' });
      }
      updateMotorTransferStatus(clientCode, tId, status);
      return sendJson(res, 200, { ok: true, transferId: tId, status });
    }

    
    // REV-027: Emitir transferência consolidada por rota/loja a partir de decisões da Curadoria IA
    if (pathname === '/api/curadoria/emit-transfer' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const body = await readBody(req);
      const { produto_id, routeKey, all } = body;
      const decData = getCuradoriaDecisions(clientCode, latestRun.id);
      const routes = decData.storePairTransfers || [];
      const decs = decData.items || [];

      const updDest = db.prepare(`
        UPDATE engine_sku_results
        SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
            sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
            transito_remanejamento = transito_remanejamento + ?,
            remanejamento_entrada = remanejamento_entrada + ?
        WHERE run_id = ? AND filial_id = ? AND produto_id = ?
      `);

      // 1. Emitir todas as rotas pendentes em guias consolidadas por loja
      if (all) {
        let count = 0;
        const emitted = [];
        for (const route of routes) {
          if (!route.transferEmitted && route.items.length > 0) {
            const trfItems = route.items.map(it => ({
              produto_id: it.produto_id,
              barras: it.barras,
              descricao: it.descricao,
              labora: it.labora,
              qtd_solicitada: it.qtd_sugerida || 1,
              custo_unit: it.custo_unit,
              valor_total: it.valor_total,
              motivo_decisao: `🧬 Curadoria IA • Transfer-First Consolidado (${it.molecule_key || ''})`
            }));

            const resTrf = createMotorTransfer(clientCode, latestRun.id, {
              filialOrigem: route.filialOrigem,
              filialOrigemNome: route.filialOrigemNome,
              filialDestino: route.filialDestino,
              filialDestinoNome: route.filialDestinoNome,
              items: trfItems,
              observacao: `🧬 Curadoria IA • Guia Consolidada da Rota (${route.filialOrigemNome} ➔ ${route.filialDestinoNome} • ${route.totalItens} produtos)`
            });

            // Abater compra externa na loja destino
            for (const it of route.items) {
              const q = Number(it.qtd_sugerida || 1);
              updDest.run(q, q, q, q, latestRun.id, Number(route.filialDestino), Number(it.produto_id));
            }

            count++;
            emitted.push({
              codigo: resTrf.codigoTransferencia,
              origem: route.filialOrigemNome,
              destino: route.filialDestinoNome,
              itens: route.totalItens,
              unidades: route.totalUnidades
            });
          }
        }
        return sendJson(res, 200, {
          ok: true,
          count,
          emitted,
          message: count > 0 ? `${count} guias consolidadas por loja emitidas no motor!` : 'Todas as guias desta rodada já foram emitidas anteriormente.'
        });
      }

      // 2. Emitir uma rota específica agrupada (ex: routeKey "2->3")
      if (routeKey) {
        const targetRoute = routes.find(r => r.routeKey === routeKey);
        if (!targetRoute) return sendJson(res, 404, { error: `Rota ${routeKey} não encontrada nas decisões.` });

        const trfItems = targetRoute.items.map(it => ({
          produto_id: it.produto_id,
          barras: it.barras,
          descricao: it.descricao,
          labora: it.labora,
          qtd_solicitada: it.qtd_sugerida || 1,
          custo_unit: it.custo_unit,
          valor_total: it.valor_total,
          motivo_decisao: `🧬 Curadoria IA • Transfer-First Consolidado (${it.molecule_key || ''})`
        }));

        const resTrf = createMotorTransfer(clientCode, latestRun.id, {
          filialOrigem: targetRoute.filialOrigem,
          filialOrigemNome: targetRoute.filialOrigemNome,
          filialDestino: targetRoute.filialDestino,
          filialDestinoNome: targetRoute.filialDestinoNome,
          items: trfItems,
          observacao: `🧬 Curadoria IA • Guia Consolidada da Rota (${targetRoute.filialOrigemNome} ➔ ${targetRoute.filialDestinoNome} • ${targetRoute.totalItens} produtos)`
        });

        // Abater compra externa na loja destino
        for (const it of targetRoute.items) {
          const q = Number(it.qtd_sugerida || 1);
          updDest.run(q, q, q, q, latestRun.id, Number(targetRoute.filialDestino), Number(it.produto_id));
        }

        return sendJson(res, 200, {
          ok: true,
          codigoTransferencia: resTrf.codigoTransferencia,
          totalItens: targetRoute.totalItens,
          totalUnidades: targetRoute.totalUnidades,
          valorTotalRs: targetRoute.valorTotalRs,
          message: `Guia consolidada ${resTrf.codigoTransferencia} emitida com ${targetRoute.totalItens} produtos entre ${targetRoute.filialOrigemNome} ➔ ${targetRoute.filialDestinoNome}!`
        });
      }

      // 3. Fallback: emissão por produto_id individual
      const targetDec = decs.find(d => Number(d.produto_id) === Number(produto_id));
      if (!targetDec) return sendJson(res, 404, { error: 'Decisão não encontrada.' });
      if (!targetDec.lojas_doadoras || targetDec.lojas_doadoras.length === 0) {
        return sendJson(res, 400, { error: 'Nenhuma loja doadora com estoque alternativo para transferir.' });
      }

      const donor = targetDec.lojas_doadoras[0];
      const dest = targetDec.lojas_canceladas[0] || { filial_id: donor.filial_id === 2 ? 3 : 2, nome: donor.filial_id === 2 ? 'Loja 3' : 'Loja 2' };
      const qty = targetDec.total_un_abatidas || 1;
      const resTrf = createMotorTransfer(clientCode, latestRun.id, {
        filialOrigem: donor.filial_id,
        filialOrigemNome: donor.nome,
        filialDestino: dest.filial_id,
        filialDestinoNome: dest.nome,
        items: [{
          produto_id: targetDec.produto_id,
          barras: targetDec.barras,
          descricao: targetDec.descricao,
          labora: targetDec.labora,
          qtd_solicitada: qty,
          custo_unit: targetDec.custo_unit,
          valor_total: targetDec.economia_rs,
          motivo_decisao: `🧬 Curadoria IA • Transfer-First (${targetDec.molecule_key || ''})`
        }],
        observacao: `🧬 Curadoria IA • Transfer-First (${targetDec.descricao})`
      });

      updDest.run(qty, qty, qty, qty, latestRun.id, Number(dest.filial_id), Number(targetDec.produto_id));

      return sendJson(res, 200, { ok: true, codigoTransferencia: resTrf.codigoTransferencia, message: `Guia ${resTrf.codigoTransferencia} emitida com sucesso!` });
    }

    // REV-027: Desfazer decisão da Curadoria e reabrir produto na lista de oportunidades
    if (pathname === '/api/curadoria/undo-decision' && req.method === 'POST') {
      const body = await readBody(req);
      const pId = Number(body.produto_id);
      const molKey = body.molecule_key;
      if (!pId && !molKey) {
        return sendJson(res, 400, { error: 'produto_id ou molecule_key obrigatório.' });
      }

      db.prepare('DELETE FROM buyer_learning_log WHERE client_code = ? AND (produto_id = ? OR molecule_key = ?)').run(clientCode, pId, molKey || '');
      db.prepare('DELETE FROM sku_suspensions WHERE client_code = ? AND (produto_id = ? OR molecule_key = ?) AND origem = ?').run(clientCode, pId, molKey || '', 'CURADORIA_1CLICK_ACTION');
      
      return sendJson(res, 200, { ok: true, message: 'Decisão desfeita com sucesso! O produto foi reaberto na Curadoria IA.' });
    }

    // REV-027: Lista de decisões homologadas / feitas pelo comprador
    if (pathname === '/api/curadoria/homologated' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { ok: true, decisions: [], count: 0, routes: [], localDecisions: [] });
      const curadData = getCuradoriaDecisions(clientCode, latestRun.id);
      return sendJson(res, 200, {
        ok: true,
        count: curadData.items.length,
        decisions: curadData.items,
        routes: curadData.storePairTransfers,
        localDecisions: curadData.localCounterDeductions
      });
    }

    // REV-027: Atalho para download do Romaneio Excel de transferência
    if (pathname === '/api/transfers/export-excel' && req.method === 'GET') {
      const transferId = Number(urlObj.searchParams.get('transferId') || urlObj.searchParams.get('id'));
      if (!transferId) return sendJson(res, 400, { error: 'transferId obrigatorio.' });
      const transfers = getMotorTransfers(clientCode);
      const transfer = transfers.find((t) => t.id === transferId);
      if (!transfer) return sendJson(res, 404, { error: 'Transferencia nao encontrada.' });

      const buffer = await buildTransferPickListExcel({ transfer, items: transfer.itens || [] });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Romaneio_Transferencia_${transfer.codigo_transferencia}.xlsx"`,
      });
      return res.end(buffer);
    }

    // REV-026: Ação operacional no lote crítico FEFO
    if (pathname === '/api/remanejamento/fefo-action' && req.method === 'POST') {
      const body = await readBody(req);
      const { produto_id, filial_id, acao, motivo } = body;
      recordBuyerLearning(clientCode, {
        filial_id: Number(filial_id || 0),
        produto_id: Number(produto_id),
        descricao: body.descricao || `SKU ${produto_id}`,
        tipo_evento: acao === 'SEGREGA_DEVOLUCAO' ? 'FEFO_SEGREGA_DEVOLUCAO' : 'FEFO_DESOVA_BALCAO',
        motivo: motivo || (acao === 'SEGREGA_DEVOLUCAO' ? 'Lote vencido segregado para troca/devolução ao fornecedor' : 'Ação de desova ativa no balcão da loja'),
        acao_futura: 'PREVENCAO_PERDAS'
      });
      return sendJson(res, 200, { ok: true, message: 'Ação operacional registrada com sucesso!' });
    }

    if (pathname === '/api/remanejamento/export-excel' && req.method === 'GET') {
      const transferId = Number(urlObj.searchParams.get('transferId'));
      const origem = Number(urlObj.searchParams.get('origem'));
      const destino = Number(urlObj.searchParams.get('destino'));

      if (transferId) {
        const transfers = getMotorTransfers(clientCode);
        const transfer = transfers.find((t) => t.id === transferId);
        if (!transfer) return sendJson(res, 404, { error: 'Transferencia nao encontrada.' });

        const buffer = await buildTransferPickListExcel({ transfer, items: transfer.itens || [] });
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Guia_Separacao_${transfer.codigo_transferencia}.xlsx"`,
        });
        return res.end(buffer);
      }

      if (origem && destino) {
        const latestRun = getLatestRun(clientCode);
        if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
        const filiaisPolicies = getFilialPolicies(clientCode);
        const polMap = new Map(filiaisPolicies.map(p => [Number(p.filial_id), p]));
        const origemNome = polMap.get(origem)?.nome_reduz || `Filial ${origem}`;
        const destinoNome = polMap.get(destino)?.nome_reduz || `Filial ${destino}`;

        const items = db.prepare(`
          SELECT r.*, s.barras, s.labora
          FROM engine_remanejamento r
          LEFT JOIN engine_sku_results s ON s.run_id = r.run_id AND s.produto_id = r.produto_id AND s.filial_id = r.filial_destino
          WHERE r.run_id = ? AND r.filial_origem = ? AND r.filial_destino = ?
          ORDER BY r.tipo ASC, r.valor_total DESC
        `).all(latestRun.id, origem, destino);

        if (!items || items.length === 0) {
          return sendJson(res, 404, { error: 'Nenhum item encontrado nesta rota.' });
        }

        const draftTransfer = {
          codigo_transferencia: `PREVIA-F${origem}-F${destino}`,
          data_emissao: new Date().toISOString().slice(0, 10),
          status: 'PREVIA',
          filial_origem: origem,
          filial_origem_nome: polMap.get(origem)?.nome_loja || origemNome,
          filial_origem_reduz: origemNome,
          filial_destino: destino,
          filial_destino_nome: polMap.get(destino)?.nome_loja || destinoNome,
          filial_destino_reduz: destinoNome,
          total_itens: items.length,
          total_unidades: items.reduce((acc, x) => acc + Number(x.qtd_sugerida || 0), 0),
          valor_total_rs: Math.round(items.reduce((acc, x) => acc + Number(x.valor_total || 0), 0) * 100) / 100,
          observacao: 'Guia de separação prévia gerada pelo comprador'
        };

        const buffer = await buildTransferPickListExcel({ transfer: draftTransfer, items });
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Guia_Separacao_Previa_F${origem}_F${destino}.xlsx"`,
        });
        return res.end(buffer);
      }

      return sendJson(res, 400, { error: 'transferId ou (origem e destino) obrigatorios.' });
    }

    if (pathname === '/api/molecules' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { rows: [], dePara: [] });

      const q = (urlObj.searchParams.get('q') || '').trim().toUpperCase();
      const onlySavings = urlObj.searchParams.get('onlySavings') === '1';

      let sql = 'SELECT * FROM engine_molecule_summary WHERE run_id = ?';
      const params = [latestRun.id];
      if (onlySavings) sql += ' AND economia_rs_evitada > 0';
      if (q) {
        sql += ' AND molecule_key LIKE ?';
        params.push(`%${q}%`);
      }
      sql += ' ORDER BY economia_rs_evitada DESC, labs_count DESC LIMIT 100';

      const rows = db.prepare(sql).all(...params).map((m) => ({
        ...m,
        detalhe_skus: JSON.parse(m.detalhe_skus_json || '[]'),
      }));

      const approvedDePara = db
        .prepare('SELECT * FROM molecule_de_para WHERE client_code = ? ORDER BY updated_at DESC LIMIT 100')
        .all(clientCode);

      const backups = db
        .prepare('SELECT id, scope, record_count, created_at FROM big_backups WHERE client_code = ? ORDER BY id DESC LIMIT 10')
        .all(clientCode);

      return sendJson(res, 200, { rows, approvedDePara, backups });
    }

    if (pathname === '/api/molecules/sweep' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });

      let key = urlObj.searchParams.get('key');
      const skuId = Number(urlObj.searchParams.get('skuId') || 0);
      let filialId = Number(urlObj.searchParams.get('filialId') || 0);

      if (skuId && (!key || !filialId)) {
        const probe = db.prepare('SELECT molecule_key, filial_id FROM engine_sku_results WHERE run_id = ? AND produto_id = ?' + (filialId ? ' AND filial_id = ?' : '')).get(latestRun.id, ...(filialId ? [skuId, filialId] : [skuId]));
        if (probe) {
          if (!key) key = probe.molecule_key;
          if (!filialId) filialId = probe.filial_id;
        }
      }
      if (!filialId) filialId = 2;

      if (!key) {
        return sendJson(res, 400, { error: 'Chave de molécula não informada ou produto não associado a uma molécula.' });
      }

      const mol = db.prepare('SELECT * FROM engine_molecule_summary WHERE run_id = ? AND molecule_key = ?').get(latestRun.id, key);
      const activeSuspensions = getActiveSkuSuspensions(clientCode);
      const suspensionsMap = new Map(activeSuspensions.map((s) => [s.produto_id, s]));

      // Filiais operacionais ativas deste cliente específico (exclui escritório central id=1)
      const clientPolicies = getFilialPolicies(clientCode).filter((p) => Number(p.filial_id) !== 1);
      const filiais = clientPolicies.length > 0
        ? clientPolicies.map((p) => ({
            filial_id: Number(p.filial_id),
            label: `L${String(p.filial_id).padStart(2, '0')} • ${p.nome_reduz || p.nome_loja?.slice(0, 15) || `Loja ${p.filial_id}`}`,
            short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
          }))
        : [{ filial_id: Number(profile.buyer_filial_id || 2), label: `L${String(profile.buyer_filial_id || 2).padStart(2, '0')} • ${profile.name || 'Loja Local'}`, short: `L${String(profile.buyer_filial_id || 2).padStart(2, '0')}` }];

      const allRows = db.prepare(`
        SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome,
               abc_class, xyz_class, curva_erp_ranking, curva_erp_classe,
               preco_venda, custo_unit, margem_pct,
               estoque_atual, transito_real, ddv_projetada, cobertura_dias,
               vendas_6s, vendas_9s, vendas_13s,
               sugestao_compra_un, sugestao_compra_rs, excecoes_json, ultimas_entradas_json,
               tipo_produto_cmed, justificativa_ia
        FROM engine_sku_results
        WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1
        ORDER BY produto_id ASC, filial_id ASC
      `).all(latestRun.id, key);

      // Agrupa por produto_id para eliminar repetições na tela (visão consolidada matricial)
      const groupedMap = new Map();
      for (const r of allRows) {
        if (!groupedMap.has(r.produto_id)) {
          groupedMap.set(r.produto_id, {
            produto_id: r.produto_id,
            barras: r.barras,
            descricao: r.descricao,
            labora: r.labora || 'Laboratório Não Informado',
            abc_class: r.abc_class || 'D',
            xyz_class: r.xyz_class,
            curva_erp_ranking: r.curva_erp_ranking,
            curva_erp_classe: r.curva_erp_classe,
            preco_venda: r.preco_venda,
            custo_unit: r.custo_unit,
            margem_pct: r.margem_pct,
            tipo_produto_cmed: r.tipo_produto_cmed,
            lojas: {},
            total_estoque: 0,
            total_transito: 0,
            total_ddv: 0,
            total_vendas_13s: 0,
            total_sugestao_un: 0,
            total_sugestao_rs: 0,
            is_suspended: suspensionsMap.has(r.produto_id),
          });
        }
        const item = groupedMap.get(r.produto_id);
        item.lojas[r.filial_id] = {
          filial_id: r.filial_id,
          estoque_atual: Number(r.estoque_atual || 0),
          transito_real: Number(r.transito_real || 0),
          cobertura_dias: Number(r.cobertura_dias || 0),
          ddv_projetada: Number(r.ddv_projetada || 0),
          vendas_13s: Number(r.vendas_13s || 0),
          sugestao_compra_un: Number(r.sugestao_compra_un || 0),
          sugestao_compra_rs: Number(r.sugestao_compra_rs || 0),
          justificativa_ia: r.justificativa_ia,
          abc_class: r.abc_class,
          curva_erp_ranking: r.curva_erp_ranking,
        };
        item.total_estoque += Math.max(0, Number(r.estoque_atual || 0));
        item.total_transito += Math.max(0, Number(r.transito_real || 0));
        item.total_ddv += Number(r.ddv_projetada || 0);
        item.total_vendas_13s += Number(r.vendas_13s || 0);
        item.total_sugestao_un += Number(r.sugestao_compra_un || 0);
        item.total_sugestao_rs += Number(r.sugestao_compra_rs || 0);
        if (r.custo_unit > 0 && (!item.custo_unit || r.custo_unit < item.custo_unit)) {
          item.custo_unit = r.custo_unit;
        }
        if (r.preco_venda > 0 && (!item.preco_venda || r.preco_venda > item.preco_venda)) {
          item.preco_venda = r.preco_venda;
        }
        if (['A', 'B'].includes(r.abc_class)) {
          item.abc_class = r.abc_class;
        }
      }

      const distinctSkus = Array.from(groupedMap.values()).map((p) => {
        p.cobertura_rede = p.total_ddv > 0
          ? Math.round((p.total_estoque / p.total_ddv) * 10) / 10
          : (p.total_estoque > 0 ? 999 : 0);
        return p;
      }).sort((a, b) => (a.custo_unit || 9999) - (b.custo_unit || 9999));

      const [substancia = '', concentracao = '', forma = '', packBucket = ''] = key.split('|');
      const targetSku = distinctSkus.find((s) => s.produto_id === skuId) || distinctSkus.slice().sort((a, b) => b.total_sugestao_un - a.total_sugestao_un)[0] || distinctSkus[0];

      // REV-022: Filtrar rigorosamente produtos sem estoque fisico nem sugestao (elimina fantasmas de R$ 0,01 e linhas de zeros)
      const visibleSkus = distinctSkus.filter((s) =>
        (targetSku && s.produto_id === targetSku.produto_id) ||
        s.total_estoque > 0 ||
        s.total_sugestao_un > 0
      );

      // Menor custo apenas entre produtos comercialmente validos (custo >= 0.50 e com estoque ou demanda real)
      const candidateCheapest = visibleSkus.filter((s) =>
        s.custo_unit >= 0.50 &&
        (s.total_estoque > 0 || s.total_sugestao_un > 0)
      );
      const cheapestSku = candidateCheapest.length > 0
        ? candidateCheapest.slice().sort((a, b) => a.custo_unit - b.custo_unit)[0]
        : targetSku;

      const otherSkus = targetSku ? visibleSkus.filter((s) => s.produto_id !== targetSku.produto_id) : visibleSkus;
      const otherStockTotal = otherSkus.reduce((acc, s) => acc + s.total_estoque, 0);
      const totalDdvMolecula = visibleSkus.reduce((acc, s) => acc + s.total_ddv, 0);
      const otherCoverageDays = totalDdvMolecula > 0 ? Math.round((otherStockTotal / totalDdvMolecula) * 10) / 10 : (otherStockTotal > 0 ? 999 : 0);

      // REV-020 / REV-022: Deteccao de produtos de baixo giro / Curva D com estoque parado na mesma molecula
      const deadStocks = otherSkus.filter((s) => (s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '')) && s.total_estoque > 0);
      const deadTotalQty = deadStocks.reduce((acc, s) => acc + s.total_estoque, 0);
      const deadLabsList = Array.from(new Set(deadStocks.map((s) => s.labora || 'Outro'))).join(', ');

      let iaAdvice = null;
      if (deadStocks.length > 0 && targetSku && targetSku.total_sugestao_un > 0) {
        const dedQty = Math.min(deadTotalQty, targetSku.total_sugestao_un);
        const ecoDead = Math.round(dedQty * targetSku.custo_unit * 100) / 100;
        iaAdvice = {
          type: 'DEAD_STOCK_WARNING',
          severity: 'danger',
          title: '🛑 Recomendação da IA: Não Recomendamos Comprar Agora Este Produto!',
          headline: `Risco de Validade na Prateleira: ${deadTotalQty} un de marcas de baixo giro (Curva D) já estão paradas na rede.`,
          message: `Identificamos que já existem ${deadTotalQty} unidades em estoque na rede das marcas ${deadLabsList} (Curva D - Baixo Giro), sem giro recente e correndo risco iminente de perda por validade na prateleira.\n\nAntes de fechar a compra de mais ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}), recomendamos priorizar a desova no balcão das lojas ou abater as ${dedQty} un existentes do pedido atual.`,
          deadStocks: deadStocks.map((s) => ({ produto_id: s.produto_id, descricao: s.descricao, labora: s.labora, estoque: s.total_estoque, curva: s.abc_class })),
          deadTotalQty,
          deadLabsList,
          dedQty,
          ecoDead,
          canSuspend: true,
          canDiscount: deadTotalQty > 0,
          canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
        };
      } else if (cheapestSku && targetSku && targetSku.produto_id !== cheapestSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit) {
        const diffUnit = (targetSku.custo_unit - cheapestSku.custo_unit).toFixed(2);
        const economiaTotal = Math.round(Number(diffUnit) * targetSku.total_sugestao_un * 100) / 100;
        iaAdvice = {
          type: 'MARGIN_OPPORTUNITY',
          severity: 'info',
          title: '💡 Oportunidade de Maior Margem / Menor Custo na Rede',
          headline: `O fabricante ${cheapestSku.labora} possui menor custo de compra: Economia de R$ ${diffUnit}/un (R$ ${economiaTotal.toFixed(2)} no pedido).`,
          message: `O laboratório ${cheapestSku.labora} (${cheapestSku.descricao}) está cotado a R$ ${cheapestSku.custo_unit.toFixed(2)} vs R$ ${targetSku.custo_unit.toFixed(2)} da marca demandada (${targetSku.labora}). A rede possui ${cheapestSku.total_estoque} un em estoque deste fabricante mais econômico!`,
          canSwitch: true,
          canDiscount: otherStockTotal > 0,
          canSuspend: true,
          diffUnit: Number(diffUnit),
          economiaTotal,
        };
      } else if (targetSku && targetSku.total_sugestao_un > 0 && otherStockTotal > 0 && otherCoverageDays >= 14) {
        const dedQty = Math.min(otherStockTotal, targetSku.total_sugestao_un);
        const ecoDeducao = Math.round(dedQty * targetSku.custo_unit * 100) / 100;
        const otherLabsList = Array.from(new Set(otherSkus.filter((s) => s.total_estoque > 0).map((s) => s.labora))).join(', ');
        iaAdvice = {
          type: 'ENOUGH_STOCK_WARNING',
          severity: 'warning',
          title: '⚠️ Recomendação da IA: Estoque Suficiente da Molécula em Outras Marcas',
          headline: `A rede já possui ${otherStockTotal} un (${otherCoverageDays} dias de cobertura) em marcas alternativas (${otherLabsList}).`,
          message: `O motor sugeriu compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}) totalizando R$ ${(targetSku.total_sugestao_rs || 0).toFixed(2)}. Porém, a rede já possui ${otherCoverageDays} dias de cobertura garantida em estoques de outros fabricantes desta mesma apresentação!`,
          canDiscount: true,
          canSuspend: true,
          canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
          dedQty,
          ecoDeducao,
        };
      } else {
        iaAdvice = {
          type: 'BALANCED',
          severity: 'success',
          title: '✓ Molécula Equilibrada na Rede',
          message: `Total de ${visibleSkus.length} produtos ativos nesta molécula. Estoque somado: ${visibleSkus.reduce((a, s) => a + s.total_estoque, 0)} un (Cobertura média: ${otherCoverageDays} dias).`,
          canKeep: true,
        };
      }

      // REV-023: Rotas nativas de remanejamento e estratégia loja a loja
      const molProductIds = visibleSkus.map((s) => s.produto_id);
      let nativeRemanRoutes = [];
      if (molProductIds.length > 0) {
        nativeRemanRoutes = db.prepare(`
          SELECT r.id, r.produto_id, r.filial_origem, r.filial_destino, r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.motivo,
                 p.descricao, p.labora
          FROM engine_remanejamento r
          JOIN engine_sku_results p ON p.run_id = r.run_id AND p.filial_id = r.filial_origem AND p.produto_id = r.produto_id
          WHERE r.run_id = ? AND r.produto_id IN (${molProductIds.map(() => '?').join(',')})
          ORDER BY r.valor_total DESC
        `).all(latestRun.id, ...molProductIds);
      }
      const storeStrategy = analyzeMoleculeStoreStrategy(targetSku, visibleSkus, filiais, nativeRemanRoutes);

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        filiais,
        filialId,
        moleculeKey: key,
        substancia,
        concentracao,
        forma,
        packBucket,
        summary: {
          ...(mol || {}),
          skus_count: visibleSkus.length,
          labs_count: new Set(visibleSkus.map((s) => s.labora)).size,
          estoque_total: visibleSkus.reduce((acc, s) => acc + s.total_estoque, 0),
          ddv_proj_total: totalDdvMolecula,
          cobertura_molecula_dias: otherCoverageDays,
          economia_rs_evitada: mol?.economia_rs_evitada || 0,
        },
        targetSku,
        cheapestSku,
        otherStockTotal,
        otherCoverageDays,
        deadStocks,
        ia_advice: iaAdvice,
        store_analysis: storeStrategy.stores,
        remanejamento_sinergia: storeStrategy.remanejamento,
        skus: visibleSkus,
      });
    }

    if (pathname === '/api/molecules/teach' && req.method === 'POST') {
      const body = await readBody(req);
      const latestRun = getLatestRun(clientCode);
      const { produtoId, substancia, concentracao = '', forma = 'CPR', packBucket = '30UN', motivo = 'Correção pelo Comprador' } = body;
      if (!produtoId || !substancia) {
        return sendJson(res, 400, { error: 'produtoId e substancia são obrigatórios.' });
      }

      const pId = Number(produtoId);
      const cleanSubst = String(substancia).trim().toUpperCase();
      const cleanConc = String(concentracao).trim().toUpperCase();
      const cleanForm = String(forma).trim().toUpperCase();
      const cleanPack = String(packBucket).trim().toUpperCase();
      const canonKey = `${cleanSubst}|${cleanConc}|${cleanForm}|${cleanPack}`;

      // 1. Grava no De->Para deste cliente (REV-006)
      db.prepare(`
        INSERT INTO molecule_de_para (
          client_code, produto_id, canon_key, substancia, concentracao, forma, pack_bucket, status, source, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'BUYER_AI_LEARNED', ?, datetime('now'))
        ON CONFLICT(client_code, produto_id) DO UPDATE SET
          canon_key = excluded.canon_key,
          substancia = excluded.substancia,
          concentracao = excluded.concentracao,
          forma = excluded.forma,
          pack_bucket = excluded.pack_bucket,
          status = 'approved',
          source = 'BUYER_AI_LEARNED',
          notes = excluded.notes,
          updated_at = datetime('now')
      `).run(clientCode, pId, canonKey, cleanSubst, cleanConc, cleanForm, cleanPack, motivo);

      // 2. Grava no repositório de conhecimento global da IA (para outros clientes e futuras execuções)
      const skuRow = latestRun ? db.prepare('SELECT barras, descricao FROM engine_sku_results WHERE run_id = ? AND produto_id = ? LIMIT 1').get(latestRun.id, pId) : null;
      const barras = skuRow?.barras || '';
      const desc = skuRow?.descricao || '';

      try {
        db.prepare(`
          INSERT INTO global_molecule_knowledge (
            produto_id, barras, descricao, canon_key, substancia, concentracao, forma, pack_bucket, learned_source, motivo, approval_count, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BUYER_AI_LEARNED', ?, 1, datetime('now'))
          ON CONFLICT(canon_key, barras) DO UPDATE SET
            approval_count = approval_count + 1,
            updated_at = datetime('now')
        `).run(pId, barras, desc, canonKey, cleanSubst, cleanConc, cleanForm, cleanPack, motivo);
      } catch (err) {
        console.warn('Alerta ao registrar conhecimento global IA:', err.message);
      }

      // 3. Atualiza imediatamente o SKU no resultado da execução atual
      if (latestRun) {
        db.prepare(`
          UPDATE engine_sku_results
          SET molecule_key = ?,
              medicamento_efetivo = 1,
              justificativa_ia = 'Classificação de molécula validada e aprendida com comprador especialista: ' || ?
          WHERE run_id = ? AND produto_id = ?
        `).run(canonKey, cleanSubst, latestRun.id, pId);
      }

      return sendJson(res, 200, {
        ok: true,
        produtoId: pId,
        canonKey,
        message: `Molécula corrigida para "${cleanSubst} ${cleanConc}". A IA registrou o aprendizado no repositório global com sucesso!`
      });
    }

    if (pathname === '/api/molecules/action/discount' && req.method === 'POST') {
      const body = await readBody(req);
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });

      const skuId = Number(body.skuId);
      const filialId = Number(body.filialId || 2);
      if (!skuId) return sendJson(res, 400, { error: 'Informe o skuId.' });

      db.prepare(`
        UPDATE engine_sku_results
        SET sugestao_compra_un = 0,
            sugestao_compra_rs = 0,
            justificativa_ia = 'Compra cancelada pelo comprador via Varredura de Molécula (demanda coberta por outros laboratórios em estoque)'
        WHERE run_id = ? AND filial_id = ? AND produto_id = ?
      `).run(latestRun.id, filialId, skuId);

      return sendJson(res, 200, { ok: true, skuId, filialId, action: 'DISCOUNTED' });
    }

    if (pathname === '/api/molecules/action/switch-lab' && req.method === 'POST') {
      const body = await readBody(req);
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });

      const sourceSkuId = Number(body.sourceSkuId);
      const targetSkuId = Number(body.targetSkuId);
      const filialId = Number(body.filialId || 2);
      const qty = Number(body.qty || 0);

      if (!sourceSkuId || !targetSkuId || qty <= 0) {
        return sendJson(res, 400, { error: 'Informe sourceSkuId, targetSkuId e qty > 0.' });
      }

      const targetRow = db.prepare('SELECT custo_unit, descricao FROM engine_sku_results WHERE run_id = ? AND filial_id = ? AND produto_id = ?').get(latestRun.id, filialId, targetSkuId);
      if (!targetRow) return sendJson(res, 404, { error: 'SKU de destino não encontrado nesta execução.' });

      const targetCost = Number(targetRow.custo_unit || 0);
      const newRs = Math.round(qty * targetCost * 100) / 100;

      db.exec('BEGIN');
      try {
        db.prepare(`
          UPDATE engine_sku_results
          SET sugestao_compra_un = 0,
              sugestao_compra_rs = 0,
              justificativa_ia = 'Compra transferida pelo comprador para o laboratório mais barato da mesma molécula'
          WHERE run_id = ? AND filial_id = ? AND produto_id = ?
        `).run(latestRun.id, filialId, sourceSkuId);

        db.prepare(`
          UPDATE engine_sku_results
          SET sugestao_compra_un = ?,
              sugestao_compra_rs = ?,
              justificativa_ia = 'Compra assumida pelo comprador por menor custo na mesma molécula'
          WHERE run_id = ? AND filial_id = ? AND produto_id = ?
        `).run(qty, newRs, latestRun.id, filialId, targetSkuId);

        db.exec('COMMIT');
        return sendJson(res, 200, { ok: true, sourceSkuId, targetSkuId, qty, newRs });
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }

    if (pathname === '/api/molecules/sync-preview' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      const limit = Number(urlObj.searchParams.get('limit') || 1500);
      const preview = await buildPresentationSyncPreview({ runId: latestRun?.id, limit });
      return sendJson(res, 200, preview);
    }

    if (pathname === '/api/molecules/sync-execute' && req.method === 'POST') {
      const body = await readBody(req);
      const { items, options } = body;
      const result = await executePresentationSync({ skuList: items, options });
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/molecules/sync-cleanup' && req.method === 'POST') {
      const body = await readBody(req);
      const fromId = Number(body.fromId || 1019);
      const result = await cleanupBigPresentations({ fromId });
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/molecules/sync-logs' && req.method === 'GET') {
      const logs = db.prepare('SELECT * FROM big_presentation_sync_log ORDER BY id DESC LIMIT 20').all();
      return sendJson(res, 200, { logs });
    }

    // ========================================================
    // CURADORIA IA DE MOLÉCULAS & LEARNING ENGINE
    // ========================================================
// ========================================================
// AUXILIAR: ANÁLISE FILIAL A FILIAL & SINERGIA COM REMANEJAMENTO (REV-023)
// ========================================================
function analyzeMoleculeStoreStrategy(targetSku, distinctSkus, filiais, nativeRemanRoutes = []) {
  if (!targetSku) return { stores: [], remanejamento: null };

  const otherSkus = distinctSkus.filter((s) => s.produto_id !== targetSku.produto_id);
  const storesAnalysis = [];
  const doadoras = [];
  const receptoras = [];

  for (const f of filiais) {
    const fId = Number(f.filial_id);
    const targetInStore = (targetSku.lojas && targetSku.lojas[fId]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0, ddv_projetada: 0 };
    const sugUn = Number(targetInStore.sugestao_compra_un || 0);
    const sugRs = Number(targetInStore.sugestao_compra_rs || (sugUn * (targetSku.custo_unit || 0)).toFixed(2));
    const estAlvo = Number(targetInStore.estoque_atual || 0);
    const cobAlvo = Number(targetInStore.cobertura_dias || 0);
    const ddvAlvo = Number(targetInStore.ddv_projetada || 0);

    const altItems = [];
    let altEstTotal = 0;
    let deadEstTotal = 0;
    let altDdvTotal = 0;

    for (const os of otherSkus) {
      const osInStore = (os.lojas && os.lojas[fId]) || { estoque_atual: 0, cobertura_dias: 0, ddv_projetada: 0 };
      const e = Number(osInStore.estoque_atual || 0);
      if (e > 0) {
        altEstTotal += e;
        altDdvTotal += Number(osInStore.ddv_projetada || 0);
        const isDead = os.abc_class === 'D' || /D/i.test(os.curva_erp_classe || '');
        if (isDead) deadEstTotal += e;
        altItems.push({
          produto_id: os.produto_id,
          descricao: os.descricao,
          labora: os.labora,
          estoque: e,
          cobertura_dias: osInStore.cobertura_dias,
          abc_class: os.abc_class,
          isDead,
        });
      }
    }

    const cobAltMedia = altDdvTotal > 0 ? Math.round((altEstTotal / altDdvTotal) * 10) / 10 : (altEstTotal > 0 ? 999 : 0);

    let veredito = 'EQUILIBRADO';
    let badgeColor = 'neutral';
    let tituloVeredito = '✓ Estoque Equilibrado';
    let orientacao = 'Estoque em níveis normais para esta filial.';
    let acaoSugerida = 'Nenhuma compra externa necessária.';
    let cancelQty = 0;
    let faltaQty = 0;

    if (sugUn > 0) {
      if (altEstTotal >= sugUn || cobAltMedia >= 45 || altEstTotal >= 15) {
        veredito = 'BLOQUEAR_COMPRA';
        badgeColor = 'danger';
        tituloVeredito = '🛑 NÃO COMPRAR NESTA FILIAL';
        cancelQty = sugUn;
        const labsText = altItems.map(a => `${a.labora}: ${a.estoque} un (${a.cobertura_dias >= 999 ? '999+d' : a.cobertura_dias + 'd'})`).slice(0, 3).join(', ');
        orientacao = `A loja já possui ${altEstTotal} un em estoque de marcas concorrentes (${labsText}). Repor mais ${sugUn} un gerará sobre-estoque crítico e imobilização desnecessária de caixa!`;
        acaoSugerida = `Cancelar a compra de ${sugUn} un desta filial (Economia de R$ ${(sugUn * (targetSku.custo_unit || 0)).toFixed(2)}).`;
      } else if (altEstTotal > 0) {
        veredito = 'DEDUZIR_PARCIAL';
        badgeColor = 'warning';
        tituloVeredito = '📉 DESCONTAR DO PEDIDO DA FILIAL';
        cancelQty = Math.min(sugUn, altEstTotal);
        const labsText = altItems.map(a => `${a.labora}: ${a.estoque} un`).join(', ');
        orientacao = `A loja possui demanda de ${sugUn} un, mas já tem ${altEstTotal} un de marcas alternativas em prateleira (${labsText}).`;
        acaoSugerida = `Abater as ${cancelQty} un existentes, reduzindo a compra para ${sugUn - cancelQty} un.`;
      } else {
        veredito = 'RUPTURA_REAL';
        badgeColor = 'primary';
        faltaQty = sugUn;
        tituloVeredito = '🛒 RUPTURA / DEMANDA GENUÍNA';
        orientacao = `Loja com estoque zerado e sem alternativas na mesma molécula. Demanda comprovada de ${sugUn} un.`;
        acaoSugerida = `Atender prioritariamente via Remanejamento Interno (custo zero) ou compra direta.`;
        receptoras.push({
          filial_id: fId,
          label: f.short || f.label,
          faltaQty: sugUn,
          sugRs: Number((sugUn * (targetSku.custo_unit || 0)).toFixed(2)),
        });
      }
    } else {
      if (altEstTotal >= 15 && cobAltMedia >= 60) {
        veredito = 'DOADORA_EXCESSO';
        badgeColor = 'purple';
        tituloVeredito = '🚚 LOJA DOADORA (SOBRA DE ESTOQUE)';
        const surplus = Math.max(0, altEstTotal - Math.round(altDdvTotal * 30));
        orientacao = `Possui excedente de ${altEstTotal} un em marcas concorrentes (${cobAltMedia}d de cobertura).`;
        acaoSugerida = `Pode transferir até ${surplus} un para filiais com falta, evitando compras externas.`;
        if (surplus > 0) {
          doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
        }
      } else if (deadEstTotal > 0) {
        veredito = 'DESOVAR_BALCAO';
        badgeColor = 'warning';
        tituloVeredito = '⚠️ PRIORIZAR DESOVA NO BALCÃO';
        orientacao = `Possui ${deadEstTotal} un de Curva D sem giro recente correndo risco de vencimento.`;
        acaoSugerida = `Focar no balcão e não repor nada até zerar este estoque.`;
      }
    }

    if (altEstTotal >= 20 && cobAltMedia >= 60) {
      const surplus = Math.max(0, altEstTotal - Math.max(1, Math.round(altDdvTotal * 30)));
      if (surplus > 0 && !doadoras.some((d) => d.filial_id === fId)) {
        doadoras.push({ filial_id: fId, label: f.short || f.label, surplus, items: altItems });
      }
    }

    storesAnalysis.push({
      filial_id: fId,
      label: f.short || f.label,
      full_label: f.label,
      targetSug: sugUn,
      sugRs,
      targetEst: estAlvo,
      targetCob: cobAlvo,
      altEstTotal,
      deadEstTotal,
      cobAltMedia,
      altItems,
      veredito,
      badgeColor,
      tituloVeredito,
      orientacao,
      acaoSugerida,
      cancelQty,
      faltaQty,
    });
  }

  // Rotas de Remanejamento: nativas do motor ou calculadas entre doadoras e receptoras
  const transferRoutes = [];
  let totalTransferivel = 0;

  if (nativeRemanRoutes.length > 0) {
    for (const r of nativeRemanRoutes) {
      totalTransferivel += r.qtd_sugerida;
      const fOrig = filiais.find((fl) => fl.filial_id === r.filial_origem);
      const fDest = filiais.find((fl) => fl.filial_id === r.filial_destino);
      transferRoutes.push({
        id: r.id,
        from_filial_id: r.filial_origem,
        from_label: fOrig ? (fOrig.short || fOrig.label) : `L0${r.filial_origem}`,
        to_filial_id: r.filial_destino,
        to_label: fDest ? (fDest.short || fDest.label) : `L0${r.filial_destino}`,
        produto_id: r.produto_id,
        produto_desc: r.descricao,
        labora: r.labora,
        qty: r.qtd_sugerida,
        economia_rs: r.valor_total || Math.round(r.qtd_sugerida * (targetSku.custo_unit || 0) * 100) / 100,
        motivo: r.motivo,
        tipo: r.tipo,
      });
    }
  } else if (doadoras.length > 0 && receptoras.length > 0) {
    const doadorasCopy = doadoras.map((d) => ({ ...d }));
    for (const rec of receptoras) {
      let needed = rec.faltaQty;
      for (const donor of doadorasCopy) {
        if (needed <= 0) break;
        if (donor.surplus <= 0 || donor.filial_id === rec.filial_id) continue;
        const qtyToTransfer = Math.min(needed, donor.surplus);
        donor.surplus -= qtyToTransfer;
        needed -= qtyToTransfer;
        totalTransferivel += qtyToTransfer;
        const mainItem = donor.items[0] || { labora: 'Marca Alternativa', descricao: targetSku.descricao };
        transferRoutes.push({
          from_filial_id: donor.filial_id,
          from_label: donor.label,
          to_filial_id: rec.filial_id,
          to_label: rec.label,
          produto_id: mainItem.produto_id || targetSku.produto_id,
          produto_desc: mainItem.descricao,
          labora: mainItem.labora,
          qty: qtyToTransfer,
          economia_rs: Math.round(qtyToTransfer * (targetSku.custo_unit || 0) * 100) / 100,
          motivo: 'Transferência de estoque excedente para cobrir ruptura sem compra externa',
          tipo: 'EXCESSO',
        });
      }
    }
  }

  const economiaRemanejamentoRs = Math.round(transferRoutes.reduce((acc, r) => acc + (r.economia_rs || 0), 0) * 100) / 100;
  const remanejamento = {
    hasOpportunities: transferRoutes.length > 0,
    routes: transferRoutes,
    totalTransferivel,
    economiaRemanejamentoRs,
    doadoras: doadoras.map((d) => ({ filial_id: d.filial_id, label: d.label, surplus: d.surplus })),
    receptoras: receptoras.map((r) => ({ filial_id: r.filial_id, label: r.label, faltaQty: r.faltaQty })),
  };

  return {
    stores: storesAnalysis,
    remanejamento,
  };
}


// ========================================================
// AUXILIAR: VISÃO MATRICIAL POR MOLÉCULA (REV-021)
// ========================================================
function buildMoleculeMatricialCard(db, runId, molRow, clientCode, filiais, suspensionsMap) {
  const allRows = db.prepare(`
    SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome,
           abc_class, xyz_class, curva_erp_ranking, curva_erp_classe,
           preco_venda, custo_unit, margem_pct,
           estoque_atual, transito_real, ddv_projetada, cobertura_dias,
           sugestao_compra_un, sugestao_compra_rs, justificativa_ia
    FROM engine_sku_results
    WHERE run_id = ? AND molecule_key = ? AND filial_id <> 1
    ORDER BY produto_id ASC, filial_id ASC
  `).all(runId, molRow.molecule_key);

  const groupedMap = new Map();
  for (const r of allRows) {
    if (!groupedMap.has(r.produto_id)) {
      groupedMap.set(r.produto_id, {
        produto_id: r.produto_id,
        barras: r.barras,
        descricao: r.descricao,
        labora: r.labora || 'Não Informado',
        abc_class: r.abc_class || 'D',
        curva_erp_classe: r.curva_erp_classe,
        preco_venda: r.preco_venda,
        custo_unit: r.custo_unit,
        margem_pct: r.margem_pct,
        lojas: {},
        total_estoque: 0,
        total_transito: 0,
        total_ddv: 0,
        total_sugestao_un: 0,
        total_sugestao_rs: 0,
        is_suspended: suspensionsMap.has(r.produto_id),
      });
    }
    const item = groupedMap.get(r.produto_id);
    item.lojas[r.filial_id] = {
      filial_id: r.filial_id,
      estoque_atual: Number(r.estoque_atual || 0),
      transito_real: Number(r.transito_real || 0),
      cobertura_dias: Number(r.cobertura_dias || 0),
      ddv_projetada: Number(r.ddv_projetada || 0),
      sugestao_compra_un: Number(r.sugestao_compra_un || 0),
      sugestao_compra_rs: Number(r.sugestao_compra_rs || 0),
      abc_class: r.abc_class,
    };
    item.total_estoque += Math.max(0, Number(r.estoque_atual || 0));
    item.total_transito += Math.max(0, Number(r.transito_real || 0));
    item.total_ddv += Number(r.ddv_projetada || 0);
    item.total_sugestao_un += Number(r.sugestao_compra_un || 0);
    item.total_sugestao_rs += Number(r.sugestao_compra_rs || 0);
    if (r.custo_unit > 0 && (!item.custo_unit || r.custo_unit < item.custo_unit)) {
      item.custo_unit = r.custo_unit;
    }
    if (r.preco_venda > 0 && (!item.preco_venda || r.preco_venda > item.preco_venda)) {
      item.preco_venda = r.preco_venda;
    }
    if (['A', 'B'].includes(r.abc_class)) {
      item.abc_class = r.abc_class;
    }
  }

  const distinctSkus = Array.from(groupedMap.values()).map(p => {
    p.cobertura_rede = p.total_ddv > 0
      ? Math.round((p.total_estoque / p.total_ddv) * 10) / 10
      : (p.total_estoque > 0 ? 999 : 0);
    return p;
  }).sort((a, b) => (a.custo_unit || 9999) - (b.custo_unit || 9999));

  // O SKU alvo: preferir o que tem a maior sugestão de compra un
  const targetSku = distinctSkus.slice().sort((a, b) => b.total_sugestao_un - a.total_sugestao_un)[0] || distinctSkus[0];

  // REV-022: Filtrar rigorosamente produtos sem estoque fisico nem sugestao (elimina fantasmas de R$ 0,01 e linhas de zeros)
  const visibleSkus = distinctSkus.filter((s) =>
    (targetSku && s.produto_id === targetSku.produto_id) ||
    s.total_estoque > 0 ||
    s.total_sugestao_un > 0
  );

  // Se nao ha concorrente com estoque fisico nem demanda na rede, nao bloqueia o comprador
  if (visibleSkus.length <= 1) {
    return null;
  }

  // Menor custo apenas entre produtos comercialmente validos (custo >= 0.50 e com estoque ou demanda real)
  const candidateCheapest = visibleSkus.filter(s =>
    s.custo_unit >= 0.50 &&
    (s.total_estoque > 0 || s.total_sugestao_un > 0)
  );
  const cheapestSku = candidateCheapest.length > 0
    ? candidateCheapest.slice().sort((a, b) => a.custo_unit - b.custo_unit)[0]
    : targetSku;

  const otherSkus = targetSku ? visibleSkus.filter(s => s.produto_id !== targetSku.produto_id) : visibleSkus;
  const otherStockTotal = otherSkus.reduce((acc, s) => acc + s.total_estoque, 0);
  const totalDdvMolecula = visibleSkus.reduce((acc, s) => acc + s.total_ddv, 0);
  const otherCoverageDays = totalDdvMolecula > 0 ? Math.round((otherStockTotal / totalDdvMolecula) * 10) / 10 : (otherStockTotal > 0 ? 999 : 0);

  // Detecção de Curva D / Parados com estoque real na rede
  const deadStocks = otherSkus.filter(s => (s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '')) && s.total_estoque > 0);
  const deadTotalQty = deadStocks.reduce((acc, s) => acc + s.total_estoque, 0);
  const deadLabsList = Array.from(new Set(deadStocks.map(s => s.labora || 'Outro'))).join(', ');

  let iaAdvice = null;
  if (deadStocks.length > 0 && targetSku && targetSku.total_sugestao_un > 0) {
    const dedQty = Math.min(deadTotalQty, targetSku.total_sugestao_un);
    const ecoDead = Math.round(dedQty * targetSku.custo_unit * 100) / 100;
    iaAdvice = {
      type: 'DEAD_STOCK_WARNING',
      severity: 'danger',
      title: '🛑 Recomendação da IA: Não Recomendamos Comprar Agora Este Produto!',
      headline: `Risco de Validade na Prateleira: ${deadTotalQty} un de marcas de baixo giro (Curva D) já estão paradas na rede.`,
      message: `Identificamos que já existem ${deadTotalQty} unidades em estoque na rede das marcas ${deadLabsList} (Curva D - Baixo Giro), sem giro recente e correndo risco iminente de perda por validade na prateleira.\n\nAntes de fechar a compra de mais ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}), recomendamos priorizar a desova no balcão das lojas ou abater as ${dedQty} un existentes do pedido atual.`,
      deadStocks: deadStocks.map(s => ({ produto_id: s.produto_id, descricao: s.descricao, labora: s.labora, estoque: s.total_estoque })),
      deadTotalQty,
      deadLabsList,
      dedQty,
      ecoDead,
      canSuspend: true,
      canDiscount: deadTotalQty > 0,
      canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
    };
  } else if (cheapestSku && targetSku && targetSku.produto_id !== cheapestSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit) {
    const diffUnit = (targetSku.custo_unit - cheapestSku.custo_unit).toFixed(2);
    const economiaTotal = Math.round(Number(diffUnit) * targetSku.total_sugestao_un * 100) / 100;
    iaAdvice = {
      type: 'MARGIN_OPPORTUNITY',
      severity: 'info',
      title: '💡 Oportunidade de Maior Margem / Menor Custo na Rede',
      headline: `O fabricante ${cheapestSku.labora} possui menor custo de compra: Economia de R$ ${diffUnit}/un (R$ ${economiaTotal.toFixed(2)} no pedido).`,
      message: `O laboratório ${cheapestSku.labora} (${cheapestSku.descricao}) está cotado a R$ ${cheapestSku.custo_unit.toFixed(2)} vs R$ ${targetSku.custo_unit.toFixed(2)} da marca demandada (${targetSku.labora}). A rede possui ${cheapestSku.total_estoque} un em estoque deste fabricante mais econômico!`,
      canSwitch: true,
      canDiscount: otherStockTotal > 0,
      canSuspend: true,
      diffUnit: Number(diffUnit),
      economiaTotal,
    };
  } else if (targetSku && targetSku.total_sugestao_un > 0 && otherStockTotal > 0 && otherCoverageDays >= 14) {
    const dedQty = Math.min(otherStockTotal, targetSku.total_sugestao_un);
    const ecoDeducao = Math.round(dedQty * targetSku.custo_unit * 100) / 100;
    const otherLabsList = Array.from(new Set(otherSkus.filter(s => s.total_estoque > 0).map(s => s.labora))).join(', ');
    iaAdvice = {
      type: 'ENOUGH_STOCK_WARNING',
      severity: 'warning',
      title: '⚠️ Recomendação da IA: Estoque Suficiente da Molécula em Outras Marcas',
      headline: `A rede já possui ${otherStockTotal} un (${otherCoverageDays} dias de cobertura) em marcas alternativas (${otherLabsList}).`,
      message: `O motor sugeriu compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}) totalizando R$ ${(targetSku.total_sugestao_rs || 0).toFixed(2)}. Porém, a rede já possui ${otherCoverageDays} dias de cobertura garantida em marcas alternativas desta mesma apresentação!`,
      canDiscount: true,
      canSuspend: true,
      canSwitch: cheapestSku && cheapestSku.produto_id !== targetSku.produto_id,
      dedQty,
      ecoDeducao,
    };
  } else {
    iaAdvice = {
      type: 'BALANCED',
      severity: 'success',
      title: '✓ Molécula Equilibrada na Rede',
      message: `Total de ${visibleSkus.length} produtos ativos nesta molécula. Estoque somado: ${visibleSkus.reduce((a, s) => a + s.total_estoque, 0)} un (Cobertura média: ${otherCoverageDays} dias).`,
      canKeep: true,
    };
  }

  // REV-023: Rotas nativas de remanejamento e estratégia loja a loja
  const molProductIds = visibleSkus.map(s => s.produto_id);
  const nativeRemanRoutes = molProductIds.length > 0 ? db.prepare(`
    SELECT r.id, r.produto_id, r.filial_origem, r.filial_destino, r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.motivo,
           p.descricao, p.labora
    FROM engine_remanejamento r
    JOIN engine_sku_results p ON p.run_id = r.run_id AND p.filial_id = r.filial_origem AND p.produto_id = r.produto_id
    WHERE r.run_id = ? AND r.produto_id IN (${molProductIds.map(() => '?').join(',')})
    ORDER BY r.valor_total DESC
  `).all(runId, ...molProductIds) : [];
  const storeStrategy = analyzeMoleculeStoreStrategy(targetSku, visibleSkus, filiais, nativeRemanRoutes);

  return {
    molecule_key: molRow.molecule_key,
    substancia: molRow.substancia,
    concentracao: molRow.concentracao,
    forma: molRow.forma,
    pack_bucket: molRow.pack_bucket,
    labs_count: new Set(visibleSkus.map(s => s.labora)).size,
    skus_count: visibleSkus.length,
    targetSku,
    cheapestSku,
    otherStockTotal,
    otherCoverageDays,
    iaAdvice,
    store_analysis: storeStrategy.stores,
    remanejamento_sinergia: storeStrategy.remanejamento,
    filiais,
    skus: visibleSkus,
  };
}

    // ========================================================
    // CURADORIA IA: CARDS MATRICIAIS POR MOLÉCULA & BUYER LEARNING (REV-021)
    // ========================================================
    if (pathname === '/api/curadoria/opportunities' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { ok: true, molecules: [], count: 0, totalEconomiaRs: 0 });

      // Filiais operacionais ativas (exclui escritório filial_id = 1)
      const clientPolicies = getFilialPolicies(clientCode).filter(p => Number(p.filial_id) !== 1);
      const filiais = clientPolicies.map(p => ({
        filial_id: Number(p.filial_id),
        label: `L${String(p.filial_id).padStart(2, '0')} • ${p.nome_reduz || p.nome_loja?.slice(0, 15) || `Loja ${p.filial_id}`}`,
        short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
      }));

      const activeSuspensions = getActiveSkuSuspensions(clientCode);
      const suspensionsMap = new Map(activeSuspensions.map(s => [s.produto_id, s]));

      // Moléculas que possuem concorrência (labs_count > 1) e sugestão de compra ativa (> 0)
      // que ainda NÃO foram decididas pelo comprador no learning log
      const pendingMols = db.prepare(`
        SELECT molecule_key, substancia, concentracao, forma, pack_bucket,
               labs_count, skus_count, estoque_total, sugestao_sku_soma,
               economia_rs_evitada, melhor_sku_id, melhor_sku_desc, melhor_custo_unit
        FROM engine_molecule_summary
        WHERE run_id = ? AND labs_count > 1 AND sugestao_sku_soma > 0
          AND molecule_key NOT IN (
            SELECT DISTINCT molecule_key FROM buyer_learning_log
            WHERE client_code = ? AND molecule_key IS NOT NULL AND molecule_key <> ''
          )
        ORDER BY sugestao_sku_soma DESC
        LIMIT 40
      `).all(latestRun.id, clientCode);

      const cards = [];
      let totalEconomiaRs = 0;

      for (const mol of pendingMols) {
        const card = buildMoleculeMatricialCard(db, latestRun.id, mol, clientCode, filiais, suspensionsMap);
        if (card) {
          cards.push(card);
          if (card.iaAdvice?.economiaTotal) {
            totalEconomiaRs += card.iaAdvice.economiaTotal;
          } else if (card.iaAdvice?.ecoDeducao) {
            totalEconomiaRs += card.iaAdvice.ecoDeducao;
          }
        }
      }

      const totalPendingRow = db.prepare(`
        SELECT COUNT(*) AS total
        FROM engine_molecule_summary
        WHERE run_id = ? AND labs_count > 1 AND sugestao_sku_soma > 0
          AND molecule_key NOT IN (
            SELECT DISTINCT molecule_key FROM buyer_learning_log
            WHERE client_code = ? AND molecule_key IS NOT NULL AND molecule_key <> ''
          )
      `).get(latestRun.id, clientCode);
      const totalPendingCount = totalPendingRow ? totalPendingRow.total : 0;

      return sendJson(res, 200, {
        ok: true,
        count: totalPendingCount,
        totalEconomiaRs: Math.round(totalEconomiaRs * 100) / 100,
        filiais,
        molecules: cards,
      });
    }

    if (pathname === '/api/curadoria/decision' && req.method === 'POST') {
      const body = await readBody(req);
      const latestRun = getLatestRun(clientCode);
      const { action, filial_id, produto_id, molecule_key, motivo, target_sku_id, descricao, labora_origem, labora_proposto, qty, deduct_qty } = body;

      if (action === 'APPROVE_ALL') {
        const pendingMols = db.prepare(`
          SELECT molecule_key, substancia, melhor_sku_id, melhor_sku_desc, melhor_custo_unit
          FROM engine_molecule_summary
          WHERE run_id = ? AND labs_count > 1 AND sugestao_sku_soma > 0
            AND molecule_key NOT IN (
              SELECT DISTINCT molecule_key FROM buyer_learning_log
              WHERE client_code = ? AND molecule_key IS NOT NULL AND molecule_key <> ''
            )
        `).all(latestRun.id, clientCode);

        let count = 0;
        for (const pm of pendingMols) {
          recordBuyerLearning(clientCode, {
            filial_id: 0,
            molecule_key: pm.molecule_key,
            descricao: pm.substancia,
            tipo_evento: 'HOMOLOGOU_EM_LOTE',
            motivo: 'Homologação expressa em lote na Pré-Tela de Curadoria IA',
            acao_futura: 'APROVADO',
          });
          count++;
        }
        return sendJson(res, 200, { ok: true, message: `${count} moléculas homologadas com sucesso!` });
      }

      if (action === 'SUSPEND') {
        const fId = Number(filial_id || 0);
        const pId = Number(produto_id);
        recordSkuSuspension(clientCode, fId, pId, {
          descricao: descricao || '',
          motivo: motivo || 'Suspenso para desova de Curva D no balcão das lojas (Curadoria IA)',
          days: 30,
          origem: 'CURADORIA_DESOVA',
          moleculeKey: molecule_key,
          gatilhoCobertura: 7.0,
        });

        // Zera sugestão de compra em engine_sku_results
        db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ?' + (fId ? ' AND filial_id = ?' : ''))
          .run('Suspenso para priorizar desova no balcão da loja', latestRun.id, pId, ...(fId ? [fId] : []));

        recordBuyerLearning(clientCode, {
          filial_id: fId,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'SUSPENSAO_DESOVA_BALCAO',
          motivo: motivo || 'Suspenso para desova de Curva D no balcão',
          acao_futura: 'SUSPENDER_ENQUANTO_ESTOQUE_ALTERNATIVO',
        });

        return sendJson(res, 200, { ok: true, message: 'Compra suspensa temporariamente para priorizar desova. IA monitorará vendas diárias!' });
      }

      if (action === 'DEDUCT') {
        const fId = Number(filial_id || 0);
        const pId = Number(produto_id);
        const totalDed = Number(deduct_qty || 0);
        let remainingDed = totalDed;

        if (fId > 0) {
          db.prepare(`
            UPDATE engine_sku_results
            SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
                sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
                justificativa_ia = ?
            WHERE run_id = ? AND produto_id = ? AND filial_id = ?
          `).run(remainingDed, remainingDed, `Deduzidas ${remainingDed} un de estoque concorrente da mesma molécula existente na rede`, latestRun.id, pId, fId);
        } else {
          // Distribui proporcionalmente pelas lojas que possuem sugestao ativa (maior primeiro)
          const storesWithSug = db.prepare(`
            SELECT filial_id, sugestao_compra_un, custo_unit
            FROM engine_sku_results
            WHERE run_id = ? AND produto_id = ? AND filial_id <> 1 AND sugestao_compra_un > 0
            ORDER BY sugestao_compra_un DESC
          `).all(latestRun.id, pId);

          for (const s of storesWithSug) {
            if (remainingDed <= 0) break;
            const toDeduct = Math.min(s.sugestao_compra_un, remainingDed);
            const newSug = s.sugestao_compra_un - toDeduct;
            const newRs = Math.round(newSug * s.custo_unit * 100) / 100;
            db.prepare(`
              UPDATE engine_sku_results
              SET sugestao_compra_un = ?, sugestao_compra_rs = ?, justificativa_ia = ?
              WHERE run_id = ? AND produto_id = ? AND filial_id = ?
            `).run(newSug, newRs, `Abatidas ${toDeduct} un de estoque concorrente parado na rede`, latestRun.id, pId, s.filial_id);
            remainingDed -= toDeduct;
          }
        }

        recordBuyerLearning(clientCode, {
          filial_id: fId,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'DEDUZIU_ESTOQUE_MOLECULA',
          motivo: `Abatidas ${totalDed} un do pedido considerando estoque concorrente parado na rede`,
          acao_futura: 'DEDUZIR_ESTOQUE_CONCORRENTE',
        });

        return sendJson(res, 200, { ok: true, message: `Estoque alternativo de ${totalDed} un abatido do pedido com sucesso!` });
      }

      if (action === 'REMANEJAR_E_CANCELAR') {
        const pId = Number(produto_id);
        const { blockedStores = [], routes = [] } = body;

        db.exec('BEGIN');
        try {
          // 1. Zera compra nas lojas com excesso bloqueado
          for (const b of blockedStores) {
            const bFId = Number(b.filial_id);
            db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ? AND filial_id = ?')
              .run(`Compra cancelada via Curadoria IA: Loja já possui ${b.altEstTotal || 0} un de marcas alternativas em estoque`, latestRun.id, pId, bFId);

            recordSkuSuspension(clientCode, bFId, pId, {
              descricao: descricao || '',
              motivo: `Compra bloqueada pela Curadoria IA: loja possui ${b.altEstTotal || 0} un de marcas alternativas da mesma molécula`,
              days: 30,
              origem: 'CURADORIA_SOBREESTOQUE',
              moleculeKey: molecule_key,
              gatilhoCobertura: 7.0,
            });
          }

          // 2. Abate transferências nas lojas receptoras
          for (const r of routes) {
            const destFId = Number(r.to_filial_id);
            const qty = Number(r.qty || 0);
            if (qty > 0) {
              db.prepare(`
                UPDATE engine_sku_results
                SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
                    sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
                    justificativa_ia = ?
                WHERE run_id = ? AND produto_id = ? AND filial_id = ?
              `).run(qty, qty, `Suprido por Remanejamento Interno (${qty} un vindas de ${r.from_label}) - Transfer-First`, latestRun.id, pId, destFId);
            }
          }

          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }

        // REV-025: Registrar guia de transferência formal no motor com sinalização de Curadoria IA
        if (routes && routes.length > 0) {
          const groupedRoutes = new Map();
          for (const r of routes) {
            const key = `${r.from_filial_id || r.filial_origem}->${r.to_filial_id || r.filial_destino}`;
            if (!groupedRoutes.has(key)) {
              groupedRoutes.set(key, {
                origem: Number(r.from_filial_id || r.filial_origem),
                origemNome: r.from_label || `Loja ${r.from_filial_id || r.filial_origem}`,
                destino: Number(r.to_filial_id || r.filial_destino),
                destinoNome: r.to_label || `Loja ${r.to_filial_id || r.filial_destino}`,
                items: [],
              });
            }
            groupedRoutes.get(key).items.push({
              produto_id: Number(r.produto_id || pId),
              barras: r.barras || '',
              descricao: r.produto_desc || descricao,
              labora: r.labora || '',
              qtd_solicitada: Number(r.qty || 0),
              custo_unit: Number(r.custo_unit || 0),
              valor_total: Number(r.economia_rs || 0),
              motivo_decisao: `🧬 Curadoria IA: Substituição de molécula para suprir demanda da filial e cancelar compras externas`,
            });
          }

          for (const grp of groupedRoutes.values()) {
            try {
              createMotorTransfer(clientCode, latestRun.id, {
                filialOrigem: grp.origem,
                filialOrigemNome: grp.origemNome,
                filialDestino: grp.destino,
                filialDestinoNome: grp.destinoNome,
                items: grp.items,
                observacao: `🧬 Curadoria IA • Transfer-First (Cancelou compras externas da molécula ${molecule_key})`
              });
            } catch (errTransf) {
              console.error('Aviso ao emitir transferência formal da curadoria:', errTransf.message);
            }
          }
        }

        recordBuyerLearning(clientCode, {
          filial_id: 0,
          produto_id: pId,
          molecule_key,
          descricao,
          tipo_evento: 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA',
          motivo: `Remanejamento homologado pela IA: compras canceladas em lojas com excesso e demanda suprida por transferência interna`,
          acao_futura: 'SEMPRE_PRIORIZAR_TRANSFER_FIRST',
        });

        return sendJson(res, 200, {
          ok: true,
          message: 'Remanejamento homologado com sucesso! Compras canceladas nas lojas com excesso e transferências aprovadas!'
        });
      }

      // REV-024: Ação direta em card individual de filial
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
          message: `Compra da filial L0${fId} cancelada com sucesso! Economia de caixa garantida.`
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
              .run(`Solução IA 1-Clique: Compra cancelada (estoque de concorrente ou Curva D parado na rede)`, latestRun.id, pId, bFId);

            recordSkuSuspension(clientCode, bFId, pId, {
              descricao: descricao || '',
              motivo: `Solução IA 1-Clique: compra cancelada para priorizar desova e proteger caixa`,
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
              db.prepare(`
                UPDATE engine_sku_results
                SET sugestao_compra_un = MAX(0, sugestao_compra_un - ?),
                    sugestao_compra_rs = ROUND(MAX(0, sugestao_compra_un - ?) * custo_unit, 2),
                    justificativa_ia = ?
                WHERE run_id = ? AND produto_id = ? AND filial_id = ?
              `).run(qty, qty, `Suprido via Remanejamento 1-Clique (${qty} un de ${r.from_label}) - Transfer-First`, latestRun.id, pId, destFId);
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
                .run(newSug, newRs, `Abatidas ${d} un via Solução IA 1-Clique considerando produto alternativo parado`, latestRun.id, pId, row.filial_id);
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
          motivo: `Executada recomendação completa da IA em 1 clique (Cancelou ${totalCanceladoUn} un, Economizou R$ ${totalEconomizadoRs.toFixed(2)})`,
          acao_futura: 'SEMPRE_SEGUIR_IA_REMANEJAMENTO_E_SOBREESTOQUE',
        });

        return sendJson(res, 200, {
          ok: true,
          message: `Solução da IA executada com sucesso em 1 clique! Economia de R$ ${totalEconomizadoRs.toFixed(2)} retida no caixa.`,
          totalCanceladoUn,
          totalEconomizadoRs
        });
      }

      if (action === 'SWITCH') {
        const fId = Number(filial_id || 2);
        const fromPid = Number(produto_id);
        const toPid = Number(target_sku_id);
        const switchQty = Number(qty || 0);

        const targetRow = db.prepare('SELECT custo_unit, descricao FROM engine_sku_results WHERE run_id = ? AND filial_id = ? AND produto_id = ?').get(latestRun.id, fId, toPid);
        if (targetRow) {
          db.exec('BEGIN');
          try {
            db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = 0, sugestao_compra_rs = 0, justificativa_ia = ? WHERE run_id = ? AND produto_id = ?' + (fId ? ' AND filial_id = ?' : ''))
              .run(`Demanda transferida pelo comprador para o SKU mais rentável (${targetRow.descricao})`, latestRun.id, fromPid, ...(fId ? [fId] : []));

            db.prepare('UPDATE engine_sku_results SET sugestao_compra_un = sugestao_compra_un + ?, sugestao_compra_rs = ROUND((sugestao_compra_un + ?) * custo_unit, 2), justificativa_ia = ? WHERE run_id = ? AND produto_id = ?' + (fId ? ' AND filial_id = ?' : ''))
              .run(switchQty, switchQty, `Sugestão homologada via Curadoria IA (transferida de marca com maior custo)`, latestRun.id, toPid, ...(fId ? [fId] : []));
            db.exec('COMMIT');
          } catch (e) {
            db.exec('ROLLBACK');
          }
        }

        recordBuyerLearning(clientCode, {
          filial_id: fId,
          produto_id: fromPid,
          molecule_key,
          descricao,
          fabricante_origem: labora_origem,
          fabricante_proposto: labora_proposto,
          tipo_evento: 'TROCOU_MENOR_CUSTO',
          motivo: motivo || 'Homologada troca para laboratório de menor custo na pré-tela',
          acao_futura: 'SEMPRE_PREFERIR_LAB',
        });

        return sendJson(res, 200, { ok: true, message: 'Troca para fabricante de menor custo homologada com sucesso!' });
      }

      // Default: KEEP (Manter compra original)
      recordBuyerLearning(clientCode, {
        filial_id: Number(filial_id || 0),
        produto_id: Number(produto_id || 0),
        molecule_key,
        descricao,
        tipo_evento: 'MANTEVE_COMPRA_ORIGINAL',
        motivo: motivo || 'Comprador optou por manter marca sugerida originalmente',
        acao_futura: 'MANTER_MARCA',
      });

      return sendJson(res, 200, { ok: true, message: 'Compra da marca original homologada e liberada para Sugestão de Compra!' });
    }

    if (pathname === '/api/curadoria/desova-items' && req.method === 'GET') {
      const rows = db.prepare(`
        SELECT s.*, p.descricao, p.labora, p.estoque_atual, p.ddv_projetada, p.cobertura_dias
        FROM client_sku_suspensions s
        LEFT JOIN (
          SELECT produto_id, filial_id, descricao, labora, estoque_atual, ddv_projetada, cobertura_dias
          FROM engine_sku_results
          WHERE run_id = (SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1)
        ) p ON p.produto_id = s.produto_id AND (s.filial_id = 0 OR p.filial_id = s.filial_id)
        WHERE s.client_code = ? AND (s.origem = 'CURADORIA_DESOVA' OR s.motivo LIKE '%desova%')
        ORDER BY s.id DESC
      `).all(clientCode, clientCode);

      return sendJson(res, 200, { ok: true, items: rows });
    }

    if (pathname === '/api/curadoria/desova-unsuspend' && req.method === 'POST') {
      const body = await readBody(req);
      const { filial_id, produto_id } = body;
      removeSkuSuspension(clientCode, Number(filial_id || 0), Number(produto_id));
      recordBuyerLearning(clientCode, {
        filial_id: Number(filial_id || 0),
        produto_id: Number(produto_id),
        tipo_evento: 'LIBEROU_DESOVA_MANUAL',
        motivo: 'Comprador liberou produto manualmente para retorno à esteira de compras',
        acao_futura: 'LIBERAR_COMPRA',
      });
      return sendJson(res, 200, { ok: true, message: 'Produto liberado com sucesso para a esteira de compras!' });
    }

    if (pathname === '/api/buyer/learning-log' && req.method === 'GET') {
      const logs = getBuyerLearningLog(clientCode, 150);
      return sendJson(res, 200, { ok: true, logs });
    }

    if (pathname === '/api/remanejamento' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { transfers: [], expiringLots: [] });

      const filialId = urlObj.searchParams.get('filial_id');
      const hasFilial = filialId && filialId !== 'all' && !isNaN(Number(filialId)) && Number(filialId) > 0;
      const fNum = hasFilial ? Number(filialId) : null;

      const transfersSql = hasFilial
        ? 'SELECT * FROM engine_remanejamento WHERE run_id = ? AND (filial_origem = ? OR filial_destino = ?) ORDER BY valor_total DESC LIMIT 200'
        : 'SELECT * FROM engine_remanejamento WHERE run_id = ? ORDER BY valor_total DESC LIMIT 200';
      const transfersParams = hasFilial ? [latestRun.id, fNum, fNum] : [latestRun.id];
      const transfers = db.prepare(transfersSql).all(...transfersParams);

      const expSql = hasFilial
        ? `SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada,
                  lote_menor_validade AS menor_validade,
                  lote_vencendo_90d_qtd AS qtd_vencendo_90d,
                  lote_vencido_qtd AS qtd_vencido,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS valor_risco_rs,
                  CASE 
                    WHEN lote_vencido_qtd > 0 THEN 'LOTE_VENCIDO'
                    WHEN lote_vencendo_90d_qtd > 0 AND estoque_atual > (ddv_projetada * 90) THEN 'PERDA_VALIDADE_IMINENTE'
                    ELSE 'FEFO_ALERTA'
                  END AS acao_recomendada
           FROM engine_sku_results
           WHERE run_id = ? AND filial_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY valor_risco_rs DESC, lote_menor_validade ASC
           LIMIT 150`
        : `SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada,
                  lote_menor_validade AS menor_validade,
                  lote_vencendo_90d_qtd AS qtd_vencendo_90d,
                  lote_vencido_qtd AS qtd_vencido,
                  ROUND((lote_vencendo_90d_qtd + lote_vencido_qtd) * custo_unit, 2) AS valor_risco_rs,
                  CASE 
                    WHEN lote_vencido_qtd > 0 THEN 'LOTE_VENCIDO'
                    WHEN lote_vencendo_90d_qtd > 0 AND estoque_atual > (ddv_projetada * 90) THEN 'PERDA_VALIDADE_IMINENTE'
                    ELSE 'FEFO_ALERTA'
                  END AS acao_recomendada
           FROM engine_sku_results
           WHERE run_id = ? AND estoque_atual > 0 AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY valor_risco_rs DESC, lote_menor_validade ASC
           LIMIT 150`;
      const expParams = hasFilial ? [latestRun.id, fNum] : [latestRun.id];
      const expiringLots = db.prepare(expSql).all(...expParams);
      const curadoriaData = getCuradoriaDecisions(clientCode, latestRun.id);

      return sendJson(res, 200, {
        transfers,
        expiringLots,
        curadoriaDecisions: curadoriaData.items,
        curadoriaRoutes: curadoriaData.storePairTransfers,
        localCounterDeductions: curadoriaData.localCounterDeductions
      });
    }

    if (pathname === '/api/pbm' && req.method === 'GET') {
      const rules = db
        .prepare('SELECT * FROM pbm_program_rules WHERE client_code = ? ORDER BY unidades_91d DESC')
        .all(clientCode);

      const q = (urlObj.searchParams.get('q') || '').trim();
      let sql = 'SELECT * FROM pbm_audit_rows WHERE client_code = ?';
      const params = [clientCode];
      if (q) {
        sql += ' AND (nsu LIKE ? OR autorizacao LIKE ? OR cartao_cpf LIKE ? OR descricao LIKE ? OR projeto LIKE ?)';
        const like = `%${q.toUpperCase()}%`;
        params.push(like, like, like, like, like);
      }
      sql += ' ORDER BY data_hora DESC LIMIT 150';
      const auditRows = db.prepare(sql).all(...params);

      return sendJson(res, 200, { rules, auditRows });
    }

    if (pathname === '/api/pbm/rule' && req.method === 'POST') {
      const body = await readBody(req);
      const { id, autoReposicao } = body;
      if (!['S', 'P', 'N'].includes(autoReposicao)) {
        return sendJson(res, 400, { error: 'autoReposicao deve ser S, P ou N.' });
      }
      db.prepare("UPDATE pbm_program_rules SET auto_reposicao = ?, updated_at = datetime('now') WHERE id = ? AND client_code = ?")
        .run(autoReposicao, Number(id), clientCode);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/export/quotation.xlsx' && (req.method === 'GET' || req.method === 'POST')) {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const profile = getClientProfile(clientCode);
      const body = req.method === 'POST' ? await readBody(req) : {};
      const mode = (body.mode || urlObj.searchParams.get('mode') || 'manager') === 'cotefacil' ? 'cotefacil' : 'manager';
      const selectedKeys = Array.isArray(body.selectedKeys) ? body.selectedKeys : [];
      const budget = Number(body.budget ?? urlObj.searchParams.get('budget') ?? 0);
      const sort = body.sort || urlObj.searchParams.get('sort') || 'impact';

      let exportRows = [];
      if (selectedKeys.length > 0) {
        const stmt = db.prepare('SELECT * FROM engine_sku_results WHERE run_id = ? AND filial_id = ? AND produto_id = ?');
        for (const key of selectedKeys) {
          const [fId, pId] = String(key).split('|').map(Number);
          if (fId && pId) {
            const found = stmt.get(latestRun.id, fId, pId);
            if (found) exportRows.push(found);
          }
        }
      } else {
        const filterSource = req.method === 'POST' ? body : urlObj.searchParams;
        const { whereSql, params } = buildSkuFilterSql(filterSource, latestRun.id, clientCode);
        if (budget > 0) {
          const allBuy = db
            .prepare(`SELECT * FROM engine_sku_results WHERE ${whereSql} AND sugestao_compra_un > 0 ORDER BY roi_marginal DESC, sugestao_compra_rs DESC`)
            .all(...params);
          exportRows = applyBudgetCap(allBuy, budget).selected;
        } else {
          const extraBuyCond = mode === 'cotefacil' ? ' AND sugestao_compra_un > 0' : '';
          exportRows = db
            .prepare(`SELECT * FROM engine_sku_results WHERE ${whereSql}${extraBuyCond} ORDER BY ${getOrderByClause(sort)} LIMIT 3000`)
            .all(...params);
        }
      }

      const molecules = mode === 'manager'
        ? db.prepare('SELECT * FROM engine_molecule_summary WHERE run_id = ? AND economia_rs_evitada > 0 ORDER BY economia_rs_evitada DESC LIMIT 200').all(latestRun.id)
        : [];
      const expiringLots = mode === 'manager'
        ? db.prepare('SELECT produto_id, descricao, abc_class, lote_menor_validade, lote_vencendo_90d_qtd, lote_vencido_qtd, lote_vencendo_90d_rs, margem_pct FROM engine_sku_results WHERE run_id = ? AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0) ORDER BY lote_vencido_qtd DESC, lote_vencendo_90d_rs DESC LIMIT 200').all(latestRun.id)
        : [];

      const buffer = await generateQuotationWorkbook({
        mode,
        profile,
        latestRun,
        rows: exportRows,
        molecules,
        expiringLots,
      });

      const fname =
        mode === 'cotefacil'
          ? `cotefacil_cotacao_${clientCode}_run${latestRun.id}.xlsx`
          : `decisao_compras_${clientCode}_run${latestRun.id}.xlsx`;

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
      });
      return res.end(Buffer.from(buffer));
    }

    if (pathname === '/api/export/buy.csv' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const rows = db
        .prepare(
          `SELECT filial_id, produto_id, barras, descricao, labora, fornecedor_nome, macro_categoria,
                  abc_class, xyz_class, estoque_atual, ddv_projetada, lead_time_dias,
                  estoque_min, estoque_max, sugestao_compra_un, custo_unit, sugestao_compra_rs, justificativa_ia
           FROM engine_sku_results
           WHERE run_id = ? AND sugestao_compra_un > 0
           ORDER BY sugestao_compra_rs DESC`
        )
        .all(latestRun.id);

      const header = 'filial_id;produto_id;barras;descricao;laboratorio;ultimo_fornecedor;categoria;abc;xyz;estoque;ddv_proj;lead_time;min;max;sugestao_un;custo_unit;total_rs;justificativa';
      const lines = rows.map((r) =>
        [
          r.filial_id,
          r.produto_id,
          r.barras,
          `"${String(r.descricao).replace(/"/g, '""')}"`,
          `"${String(r.labora).replace(/"/g, '""')}"`,
          `"${String(r.fornecedor_nome).replace(/"/g, '""')}"`,
          r.macro_categoria,
          r.abc_class,
          r.xyz_class,
          r.estoque_atual,
          r.ddv_projetada,
          r.lead_time_dias,
          r.estoque_min,
          r.estoque_max,
          r.sugestao_compra_un,
          r.custo_unit,
          r.sugestao_compra_rs,
          `"${String(r.justificativa_ia).replace(/"/g, '""')}"`,
        ].join(';')
      );
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sugestao_compras_${clientCode}_run${latestRun.id}.csv"`,
      });
      return res.end('\uFEFF' + [header, ...lines].join('\n'));
    }

    // -------------------------------------------------------------
    // CONFIGURAÇÃO MULTI-CLIENTE & BANCO DE DADOS BIG
    // -------------------------------------------------------------
    if (pathname === '/api/config/profile' && req.method === 'GET') {
      const isMaster = isMasterRequest(req);
      const profile = getClientProfile(clientCode);
      if (!profile) return sendJson(res, 404, { error: 'Perfil não encontrado' });

      if (!isMaster) {
        return sendJson(res, 200, {
          profile: {
            id: profile.id,
            code: profile.code,
            name: profile.name,
            buyer_cnpj: profile.buyer_cnpj,
            buyer_filial_id: profile.buyer_filial_id,
            operation_mode: profile.operation_mode,
            default_supplier_id: profile.default_supplier_id,
            default_supplier_name: profile.default_supplier_name,
            service_profile: profile.service_profile,
            default_weeks: profile.default_weeks,
            recent_entries_limit: profile.recent_entries_limit,
            isMasterLocked: true,
            db_host: '●●●.●●●.●●●.●●● (Protegido por Senha Master)',
            db_port: 3306,
            db_user: '●●●●●●●',
            db_password: '••••••••',
            db_name: '●●●●●●●',
          },
          isMaster: false,
        });
      }

      const safeProfile = {
        ...profile,
        db_password: profile.db_password ? '••••••••' : '',
      };
      return sendJson(res, 200, { profile: safeProfile, isMaster: true });
    }

    if (pathname === '/api/config/profile' && req.method === 'POST') {
      const body = await readBody(req);
      if (!isMasterRequest(req, body)) {
        return sendJson(res, 403, {
          ok: false,
          error: 'Acesso negado: Somente técnicos autorizados com a Senha Master podem alterar a conexão do banco de dados.',
        });
      }
      const existing = getClientProfile(clientCode) || {};

      // Proteção de senha: só sobrescreve se o usuário digitar uma senha nova não-mascarada
      const newPassword =
        body.db_password && body.db_password !== '••••••••' && body.db_password !== '********'
          ? body.db_password
          : existing.db_password || '';

      const isDbHostChanged = body.db_host && existing.db_host && String(existing.db_host).trim().toLowerCase() !== String(body.db_host).trim().toLowerCase();
      const isDbNameChanged = body.db_name && existing.db_name && String(existing.db_name).trim().toLowerCase() !== String(body.db_name).trim().toLowerCase();
      const isFilialChanged = body.buyer_filial_id !== undefined && existing.buyer_filial_id !== undefined && Number(existing.buyer_filial_id) !== Number(body.buyer_filial_id);
      const isModeChanged = body.operation_mode && existing.operation_mode && existing.operation_mode !== body.operation_mode;
      const shouldReset = isDbHostChanged || isDbNameChanged || isFilialChanged || isModeChanged || Boolean(body.forceReset);

      // Auto-descoberta das lojas reais do MariaDB deste cliente
      let discoveredFiliais = [];
      try {
        const testRes = await testBigConnection({
          host: body.db_host || existing.db_host || '127.0.0.1',
          port: Number(body.db_port || existing.db_port || 3306),
          user: body.db_user || existing.db_user || 'root',
          password: newPassword,
          database: body.db_name || existing.db_name || 'gerente',
        });
        if (testRes && Array.isArray(testRes.filiais)) {
          discoveredFiliais = testRes.filiais;
        }
      } catch (err) {
        console.warn('[CONFIG] Aviso ao auto-descobrir filiais no MariaDB:', err.message);
      }

      const salesFilials = discoveredFiliais
        .filter((f) => !f.escritorio)
        .map((f) => Number(f.filial_id));

      const isSingleStore = (body.operation_mode === 'local') || (salesFilials.length <= 1);
      const buyerFilialId = Number(body.buyer_filial_id ?? existing.buyer_filial_id ?? (salesFilials[0] || 2));
      const activeSales = isSingleStore
        ? [buyerFilialId]
        : (salesFilials.length > 0 ? salesFilials : [buyerFilialId]);
      const ignoredFilials = discoveredFiliais
        .filter((f) => f.escritorio || (isSingleStore && Number(f.filial_id) !== buyerFilialId))
        .map((f) => Number(f.filial_id));

      if (shouldReset) {
        console.log(`[CONFIG] Banco/Host ou Filial alterado (${existing.db_host} -> ${body.db_host}). Limpando dados calculados do cliente ${clientCode}...`);
        clearClientCalculations(clientCode);
        _treeCache.clear();
        _rawCache.clear();

        // Auto-cadastra as políticas de filiais para as lojas reais deste cliente
        for (const f of discoveredFiliais) {
          if (f.escritorio && isSingleStore) continue;
          try {
            upsertFilialPolicy(clientCode, {
              filial_id: Number(f.filial_id),
              nome_loja: f.nome,
              nome_reduz: f.reduz || f.nome.slice(0, 15),
              data_inauguracao: null,
              dias_carencia: 90,
              bloquear_doacao_remanejamento: 0,
              tipo_reposicao: 'curva_motor',
            });
          } catch (e) {
            console.warn('[CONFIG] Erro ao auto-cadastrar filial policy:', e.message);
          }
        }
      }

      const updated = upsertClientProfile({
        ...existing,
        ...body,
        code: clientCode,
        name: body.name || existing.name || 'Farmácia Cliente',
        db_host: body.db_host || existing.db_host || '127.0.0.1',
        db_port: Number(body.db_port || existing.db_port || 3306),
        db_user: body.db_user || existing.db_user || 'root',
        db_password: newPassword,
        db_name: body.db_name || existing.db_name || 'gerente',
        buyer_filial_id: buyerFilialId,
        buyer_cnpj: body.buyer_cnpj || existing.buyer_cnpj || null,
        operation_mode: isSingleStore ? 'local' : (body.operation_mode || 'central'),
        target_filial_id: isSingleStore ? buyerFilialId : null,
        active_sales_filials: activeSales,
        ignored_filials: ignoredFilials,
        default_supplier_id: Number(body.default_supplier_id ?? existing.default_supplier_id ?? 10),
        default_supplier_name: body.default_supplier_name || existing.default_supplier_name || null,
      });

      const safeUpdated = {
        ...updated,
        db_password: updated.db_password ? '••••••••' : '',
      };

      return sendJson(res, 200, { ok: true, profile: safeUpdated, dbChanged: shouldReset });
    }

    if (pathname === '/api/config/reset-cache' && req.method === 'POST') {
      const body = await readBody(req);
      if (!isMasterRequest(req, body)) {
        return sendJson(res, 403, { ok: false, error: 'Acesso negado: Somente técnicos autorizados podem limpar dados calculados.' });
      }
      const result = clearClientCalculations(clientCode);
      return sendJson(res, 200, { ok: true, message: 'Dados calculados resetados com sucesso.', result });
    }

    if (pathname === '/api/config/test-connection' && req.method === 'POST') {
      const body = await readBody(req);
      if (!isMasterRequest(req, body)) {
        return sendJson(res, 403, { ok: false, error: 'Acesso negado: Somente técnicos autorizados com a Senha Master podem testar a conexão do banco.' });
      }
      const profile = getClientProfile(clientCode) || {};
      const isMaskedPassword = body.password === '••••••••' || body.password === '********';
      const password = isMaskedPassword
        ? (profile.db_password || '')
        : (body.password !== undefined && body.password !== '' ? body.password : (profile.db_password || ''));

      const testConfig = {
        ...body,
        host: body.host || profile.db_host || '127.0.0.1',
        port: Number(body.port || profile.db_port || 3306),
        user: body.user || profile.db_user || 'root',
        password,
        database: body.database || profile.db_name || 'gerente',
      };

      try {
        const testRes = await testBigConnection(testConfig);
        return sendJson(res, 200, testRes);
      } catch (err) {
        return sendJson(res, 400, {
          ok: false,
          error: err.message,
          code: err.code,
          latencyMs: err.latencyMs || null,
          diagnostic: err.diagnostic || null,
        });
      }
    }

    if (pathname === '/api/config/supplier-lookup' && req.method === 'GET') {
      const profile = getClientProfile(clientCode) || {};
      const id = urlObj.searchParams.get('id');
      const q = urlObj.searchParams.get('q');
      const rawPassword = urlObj.searchParams.get('password');
      const isMaskedPassword = rawPassword === '••••••••' || rawPassword === '********';
      const password = isMaskedPassword
        ? (profile.db_password || '')
        : (rawPassword !== null && rawPassword !== undefined && rawPassword !== '' ? rawPassword : (profile.db_password || ''));

      const customConfig = {
        db_host: urlObj.searchParams.get('host') || profile.db_host || '127.0.0.1',
        db_port: Number(urlObj.searchParams.get('port') || profile.db_port || 3306),
        db_user: urlObj.searchParams.get('user') || profile.db_user || 'root',
        db_password: password,
        db_name: urlObj.searchParams.get('database') || profile.db_name || 'gerente',
      };
      try {
        const lookup = await lookupBigSupplier(customConfig, { id, query: q });
        return sendJson(res, 200, lookup);
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message, code: err.code });
      }
    }

    // -------------------------------------------------------------
    // CONFIGURAÇÃO DE GRUPOS & DIAS DE COBERTURA
    // -------------------------------------------------------------
    if (pathname === '/api/config/groups' && req.method === 'GET') {
      const groups = getGroupCoverageConfigs(clientCode);
      return sendJson(res, 200, { ok: true, groups });
    }

    if (pathname === '/api/config/groups' && req.method === 'POST') {
      const body = await readBody(req);
      const configs = Array.isArray(body.configs) ? body.configs : [];
      if (configs.length === 0) {
        return sendJson(res, 400, { error: 'Nenhuma configuracao fornecida.' });
      }
      const saved = saveGroupCoverageConfigs(clientCode, configs);
      return sendJson(res, 200, { ok: true, saved });
    }

    // -------------------------------------------------------------
    // DEV INSPECTOR / COPILOT DE FEEDBACK EM TEMPO REAL
    // -------------------------------------------------------------
    if (pathname === '/api/dev-inspector/status' && req.method === 'GET') {
      const status = getInspectorStatus();
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/dev-inspector/reviews' && req.method === 'GET') {
      if (!isInspectorEnabled()) return sendJson(res, 403, { error: 'Dev inspector desativado em produção.' });
      const backlog = readBacklog();
      return sendJson(res, 200, backlog);
    }

    if (pathname === '/api/dev-inspector/save' && req.method === 'POST') {
      if (!isInspectorEnabled()) return sendJson(res, 403, { error: 'Dev inspector desativado em produção.' });
      const body = await readBody(req);
      if (!body.critica || !String(body.critica).trim()) {
        return sendJson(res, 400, { error: 'Digite sua observação/crítica antes de gravar.' });
      }
      const saved = saveReview(body);
      return sendJson(res, 200, { ok: true, review: saved });
    }

    if (pathname === '/api/dev-inspector/update-status' && req.method === 'POST') {
      if (!isInspectorEnabled()) return sendJson(res, 403, { error: 'Dev inspector desativado em produção.' });
      const body = await readBody(req);
      const updated = updateReviewStatus(body.id, body.status, body.resolutionNotes);
      if (!updated) return sendJson(res, 404, { error: 'Revisão não encontrada.' });
      return sendJson(res, 200, { ok: true, review: updated });
    }

    // Helper para extrair itens formatados para exportação/gravação
    const resolveOrderItems = async (body, latestRun) => {
      if (Array.isArray(body.items) && body.items.length > 0) {
        return body.items;
      }
      const selectedKeys = Array.isArray(body.selectedKeys) ? body.selectedKeys : [];
      let rows = [];
      if (selectedKeys.length > 0) {
        const stmt = db.prepare('SELECT * FROM engine_sku_results WHERE run_id = ? AND filial_id = ? AND produto_id = ?');
        for (const k of selectedKeys) {
          const [fId, pId] = String(k).split('|').map(Number);
          if (fId && pId) {
            const found = stmt.get(latestRun.id, fId, pId);
            if (found) rows.push(found);
          }
        }
      } else {
        rows = db.prepare('SELECT * FROM engine_sku_results WHERE run_id = ? AND sugestao_compra_un > 0 ORDER BY sugestao_compra_rs DESC LIMIT 500').all(latestRun.id);
      }
      return rows.map((r) => hydrateSkuRow(r));
    };

    // -------------------------------------------------------------
    // EXPORTAÇÃO COTEfÁCIL TXT (LAYOUT OFICIAL 3.0)
    // -------------------------------------------------------------
    if (pathname === '/api/export/cotefacil.txt' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const profile = getClientProfile(clientCode) || {};
      const body = await readBody(req);
      const items = await resolveOrderItems(body, latestRun);

      const clientCnpj = body.clientCnpj || profile.buyer_cnpj || '28660206000167';
      const txt = generateCotefacilTxt({ clientCnpj, items });

      const dateStr = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      const fname = `COTAC_${dateStr}.txt`;

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fname}"`,
      });
      return res.end(txt);
    }

    // -------------------------------------------------------------
    // EXPORTAÇÃO PLANILHA LINX FARMA BIG (LAYOUT NATIVO 10 COLUNAS)
    // -------------------------------------------------------------
    if (pathname === '/api/export/big-compras.xlsx' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const profile = getClientProfile(clientCode) || {};
      const body = await readBody(req);
      const items = await resolveOrderItems(body, latestRun);

      const clientCnpj = body.clientCnpj || profile.buyer_cnpj || '28660206000167';
      const buyerFilialId = Number(body.buyerFilialId || profile.buyer_filial_id || 2);
      const defaultSupplier = {
        fornece_id: Number(profile.default_supplier_id || 10),
        nome: profile.default_supplier_name || 'FORNECEDOR PADRÃO',
        cgc: body.supplierCnpj || '00000000000000',
      };

      const buffer = await generateBigNativeImportXlsx({
        clientCnpj,
        buyerFilialId,
        items,
        defaultSupplier,
      });

      const dateStr = new Date().toISOString().replace(/\D/g, '').slice(0, 8);
      const fname = `importacao_compras_big_${clientCode}_${dateStr}.xlsx`;

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
      });
      return res.end(Buffer.from(buffer));
    }

    // -------------------------------------------------------------
    // GRAVAÇÃO DIRETA NO BANCO BIG (TABELA PEDIDOS)
    // -------------------------------------------------------------
    if (pathname === '/api/pedidos/save-big' && req.method === 'POST') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 404, { error: 'Nenhuma execucao encontrada.' });
      const profile = getClientProfile(clientCode) || {};
      const body = await readBody(req);
      const items = await resolveOrderItems(body, latestRun);

      if (items.length === 0) {
        return sendJson(res, 400, { error: 'Selecione ao menos um produto para gravar pedido.' });
      }

      const saveRes = await insertBigPedidos(profile, {
        items,
        supplierId: body.supplierId || profile.default_supplier_id,
        supplierName: body.supplierName || profile.default_supplier_name,
        notes: body.notes || '',
        targetFilialId: body.targetFilialId || null,
      });

      return sendJson(res, 200, saveRes);
    }

    if (pathname === '/api/pedidos/history' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM big_orders_log WHERE client_code = ? ORDER BY id DESC LIMIT 50').all(clientCode);
      return sendJson(res, 200, { rows });
    }

    // Servir arquivos estaticos de /public
    let safePath = pathname === '/' ? '/index.html' : pathname;
    safePath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
    const fullPath = path.join(PUBLIC_DIR, safePath);
    if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('API error:', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cockpit Compras BIG rodando em http://127.0.0.1:${PORT}`);
});


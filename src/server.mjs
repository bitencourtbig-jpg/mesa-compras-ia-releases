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
} from './store/analyticsDb.mjs';
import { getCachedCmedMaps, importOfficialCmedToSqlite } from './services/cmedService.mjs';
import { syncBigClientData } from './engine/syncClientData.mjs';
import { runPurchasingEngine } from './engine/purchasingEngine.mjs';
import { GLOSSARY_SECTIONS, GLOSSARY_TERM_HINTS } from './services/glossaryData.mjs';
import { buildBuyerDecisionAnalysis } from './services/buyerInterpreter.mjs';
import { buildExecutiveBi } from './services/biAnalyticsService.mjs';
import { generateQuotationWorkbook, buildTransferPickListExcel } from './services/excelExportService.mjs';
import { testBigConnection, lookupBigSupplier, createWriteConnection } from '../db/client.mjs';
import { generateCotefacilTxt, generateBigNativeImportXlsx, sanitizeCnpj } from './services/exportFormatsService.mjs';
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

let APP_VERSION = '1.1.6';
try {
  const pkgData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  APP_VERSION = pkgData.version || '1.1.6';
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

function buildSkuFilterSql(paramsObj, runId) {
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

      const filiaisPolicies = getFilialPolicies(clientCode);
      const licenseStatus = getClientLicenseStatus(clientCode);
      return sendJson(res, 200, {
        appVersion: APP_VERSION,
        profile,
        latestRun,
        cmedImport: cmed.lastImport,
        filtersMeta,
        filiaisPolicies,
        licenseStatus: {
          ...licenseStatus,
          currentMachineId: getMachineFingerprint(),
        },
      });
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
        raw = await syncBigClientData(profile, { referenceDate: body.referenceDate || null });
        _rawCache.set(clientCode, { data: raw, timestamp: Date.now() });
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
      const bi = buildExecutiveBi(clientCode, latestRun.id, latestRun.summary);
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

      const { whereSql, params } = buildSkuFilterSql(urlObj.searchParams, latestRun.id);
      const totalRow = db.prepare(`SELECT COUNT(*) AS cnt, ROUND(SUM(sugestao_compra_rs), 2) AS sum_rs FROM engine_sku_results WHERE ${whereSql}`).get(...params);
      const orderBy = getOrderByClause(sort);

      const activeSuspensions = getActiveSkuSuspensions(clientCode);
      const suspensionsMap = new Map(activeSuspensions.map((s) => [s.produto_id, s]));

      const rows = db
        .prepare(`SELECT * FROM engine_sku_results WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

      const targetRows = budget > 0 ? selected.slice(offset, offset + limit) : rows;
      const uniquePids = [...new Set(targetRows.map((r) => r.produto_id))];
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

      if (budget > 0) {
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
          rows: selected.slice(offset, offset + limit).map((r) => hydrateSkuRow(r, customHorizon, suspensionsMap, networkMap.get(r.produto_id) || [])),
        });
      }

      return sendJson(res, 200, {
        total: totalRow.cnt,
        sumRs: totalRow.sum_rs || 0,
        rows: rows.map((r) => hydrateSkuRow(r, customHorizon, suspensionsMap, networkMap.get(r.produto_id) || [])),
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

      const remanRows = db.prepare(`
        SELECT r.*,
               esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
               esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
               esr_orig.barras, esr_orig.labora
        FROM engine_remanejamento r
        LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
        LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
        WHERE r.run_id = ?
        ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC
      `).all(latestRun.id);

      const routesMap = new Map();
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
            items: [],
          });
        }
        const rObj = routesMap.get(routeKey);
        rObj.totalItens += 1;
        rObj.totalUnidades += Number(row.qtd_sugerida || 0);
        rObj.valorTotalRs = Math.round((rObj.valorTotalRs + Number(row.valor_total || 0)) * 100) / 100;
        rObj.items.push({
          ...row,
          barras: row.barras || '',
          labora: row.labora || '',
        });
      }

      const activeTransfers = getMotorTransfers(clientCode);

      return sendJson(res, 200, {
        ok: true,
        runId: latestRun.id,
        routes: Array.from(routesMap.values()),
        totalGeralRs: remanRows.reduce((a, b) => a + Number(b.valor_total || 0), 0),
        totalGeralUnidades: remanRows.reduce((a, b) => a + Number(b.qtd_sugerida || 0), 0),
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

    if (pathname === '/api/remanejamento/transfer-status' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.transferId || !body.status) {
        return sendJson(res, 400, { error: 'transferId e status obrigatorios.' });
      }
      updateMotorTransferStatus(clientCode, Number(body.transferId), body.status);
      return sendJson(res, 200, { ok: true, transferId: body.transferId, status: body.status });
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
      const targetSku = distinctSkus.find((s) => s.produto_id === skuId) || null;
      const cheapestSku = distinctSkus.filter((s) => s.custo_unit > 0).sort((a, b) => a.custo_unit - b.custo_unit)[0] || distinctSkus[0];
      const otherSkus = targetSku ? distinctSkus.filter((s) => s.produto_id !== skuId) : distinctSkus;
      const otherStockTotal = otherSkus.reduce((acc, s) => acc + s.total_estoque, 0);
      const totalDdvMolecula = distinctSkus.reduce((acc, s) => acc + s.total_ddv, 0);
      const otherCoverageDays = totalDdvMolecula > 0 ? Math.round((otherStockTotal / totalDdvMolecula) * 10) / 10 : (otherStockTotal > 0 ? 999 : 0);

      // REV-020: Deteccao de produtos de baixo giro / Curva D com estoque parado na mesma molecula
      const deadStocks = distinctSkus.filter((s) => (s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '')) && s.total_estoque > 0);
      const deadTotalQty = deadStocks.reduce((acc, s) => acc + s.total_estoque, 0);
      const deadLabsList = Array.from(new Set(deadStocks.map((s) => s.labora || 'Outro'))).join(', ');

      let iaAdvice = null;
      if (deadStocks.length > 0 && targetSku && targetSku.total_sugestao_un > 0) {
        iaAdvice = {
          type: 'DEAD_STOCK_WARNING',
          severity: 'warning',
          title: '⚠️ Atenção ao Giro na Rede: Estoque Parado de Baixo Giro (Curva D) na Mesma Molécula',
          message: `Existem ${deadTotalQty} un em estoque na rede de marcas/laboratórios de baixo giro (${deadLabsList}) com curva D e sem demanda recente. Antes de fechar compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao}, recomendamos priorizar a desova no balcão das lojas ou suspender temporariamente a compra.`,
          deadStocks: deadStocks.map((s) => ({ produto_id: s.produto_id, descricao: s.descricao, labora: s.labora, estoque: s.total_estoque, curva: s.abc_class })),
          canSuspend: true,
        };
      } else if (cheapestSku && targetSku && targetSku.produto_id !== cheapestSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit) {
        const diffUnit = (targetSku.custo_unit - cheapestSku.custo_unit).toFixed(2);
        iaAdvice = {
          type: 'MARGIN_OPPORTUNITY',
          severity: 'info',
          title: '💡 Oportunidade de Maior Margem / Menor Custo na Rede',
          message: `O laboratório ${cheapestSku.labora} (${cheapestSku.descricao}) tem o menor custo de compra registrado: R$ ${cheapestSku.custo_unit.toFixed(2)} vs R$ ${targetSku.custo_unit.toFixed(2)} da marca sugerida (Economia de R$ ${diffUnit} por unidade). A rede já possui ${cheapestSku.total_estoque} un em estoque deste fabricante mais econômico!`,
          canSwitch: true,
        };
      } else if (targetSku && targetSku.total_sugestao_un > 0 && otherStockTotal > 0 && otherCoverageDays >= 14) {
        iaAdvice = {
          type: 'ENOUGH_STOCK_WARNING',
          severity: 'warning',
          title: '⚠️ Estoque Existente da Mesma Molécula em Outros Laboratórios na Rede',
          message: `O motor sugeriu compra de ${targetSku.total_sugestao_un} un de ${targetSku.descricao} (${targetSku.labora}) totalizando R$ ${(targetSku.total_sugestao_rs || 0).toFixed(2)}. Porém, a rede já possui ${otherStockTotal} unidades em estoque de outros laboratórios desta mesma apresentação, com ${otherCoverageDays} dias de cobertura garantida!`,
          canDiscount: true,
        };
      }

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
        summary: mol || {
          skus_count: distinctSkus.length,
          labs_count: new Set(distinctSkus.map((s) => s.labora)).size,
          estoque_total: distinctSkus.reduce((acc, s) => acc + s.total_estoque, 0),
          ddv_proj_total: totalDdvMolecula,
          cobertura_molecula_dias: otherCoverageDays,
          economia_rs_evitada: 0,
        },
        targetSku,
        cheapestSku,
        otherStockTotal,
        otherCoverageDays,
        deadStocks,
        ia_advice: iaAdvice,
        skus: distinctSkus,
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

    if (pathname === '/api/remanejamento' && req.method === 'GET') {
      const latestRun = getLatestRun(clientCode);
      if (!latestRun) return sendJson(res, 200, { transfers: [], expiringLots: [] });

      const transfers = db
        .prepare('SELECT * FROM engine_remanejamento WHERE run_id = ? ORDER BY valor_total DESC LIMIT 200')
        .all(latestRun.id);

      const expiringLots = db
        .prepare(
          `SELECT produto_id, filial_id, descricao, abc_class, preco_venda, custo_unit, margem_pct,
                  estoque_atual, ddv_projetada, lote_vencendo_90d_qtd, lote_vencendo_90d_rs,
                  lote_vencido_qtd, lote_menor_validade
           FROM engine_sku_results
           WHERE run_id = ? AND (lote_vencendo_90d_qtd > 0 OR lote_vencido_qtd > 0)
           ORDER BY lote_vencido_qtd DESC, lote_vencendo_90d_rs DESC
           LIMIT 150`
        )
        .all(latestRun.id);

      return sendJson(res, 200, { transfers, expiringLots });
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
        const { whereSql, params } = buildSkuFilterSql(filterSource, latestRun.id);
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


import path from 'node:path';
import { getAnalyticsDb, PROJECT_ROOT } from '../store/analyticsDb.mjs';
import { loadCmedIndex, normCode } from '../../lib/cmedLoader.mjs';

/**
 * Importa uma planilha oficial CMED (.zip ou .xlsx) para o cache SQLite local
 * para que todas as execucoes do motor e curadoria consultem em milissegundos.
 */
export async function importOfficialCmedToSqlite(xlsxOrZipPath, { allowTolerance = true } = {}) {
  const index = await loadCmedIndex(xlsxOrZipPath, {
    extractDir: path.join(PROJECT_ROOT, 'data', 'cmed'),
    allowTolerance,
  });

  const db = getAnalyticsDb();
  const sourceName = path.basename(index.sourceFile);

  // Garante integridade do esquema da tabela cmed_catalog
  try {
    const cmedCols = db.prepare('PRAGMA table_info(cmed_catalog)').all().map((c) => c.name);
    if (cmedCols.length > 0 && !cmedCols.includes('concentracao')) {
      db.exec('DROP TABLE IF EXISTS cmed_eans; DROP TABLE IF EXISTS cmed_catalog;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS cmed_catalog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_name TEXT NOT NULL,
          substancia_raw TEXT,
          substancia_norm TEXT,
          laboratorio TEXT,
          registro TEXT,
          produto TEXT,
          apresentacao TEXT,
          classe_terapeutica TEXT,
          tipo_produto TEXT,
          tarja TEXT,
          concentracao TEXT,
          forma TEXT,
          pack_exact TEXT,
          pack_bucket TEXT,
          sig_key TEXT
        );
        CREATE TABLE IF NOT EXISTS cmed_eans (
          ean TEXT NOT NULL,
          cmed_id INTEGER NOT NULL,
          FOREIGN KEY (cmed_id) REFERENCES cmed_catalog(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cmed_eans_ean ON cmed_eans(ean);
        CREATE INDEX IF NOT EXISTS idx_cmed_reg ON cmed_catalog(registro);
        CREATE INDEX IF NOT EXISTS idx_cmed_sig ON cmed_catalog(sig_key);
      `);
    }
  } catch {}

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM cmed_eans; DELETE FROM cmed_catalog;');

    const insertCatalog = db.prepare(`
      INSERT INTO cmed_catalog (
        source_name, substancia_raw, substancia_norm, laboratorio, registro,
        produto, apresentacao, classe_terapeutica, tipo_produto, tarja,
        concentracao, forma, pack_exact, pack_bucket, sig_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEan = db.prepare('INSERT INTO cmed_eans (ean, cmed_id) VALUES (?, ?)');

    // Evita iterar duas vezes se o mesmo registro aparecer por varios EANs
    const seen = new Set();
    let totalCatalog = 0;
    let totalEans = 0;

    for (const rec of [...index.byRegistro.values(), ...index.byEan.values()]) {
      const uniqKey = `${rec.registro}|${rec.eans.join(',')}|${rec.apresentacao}`;
      if (seen.has(uniqKey)) continue;
      seen.add(uniqKey);

      const res = insertCatalog.run(
        sourceName,
        rec.substanciaRaw || '',
        rec.sig.substanciaNorm || '',
        rec.laboratorio || '',
        rec.registro || '',
        rec.produto || '',
        rec.apresentacao || '',
        rec.classeTerapeutica || '',
        rec.tipoProduto || '',
        rec.tarja || '',
        rec.sig.concentracao || '',
        rec.sig.forma || '',
        rec.sig.packExact || '',
        rec.sig.packBucket || '',
        rec.sig.key || ''
      );
      totalCatalog += 1;
      const cmedId = Number(res.lastInsertRowid);
      for (const ean of rec.eans) {
        insertEan.run(ean, cmedId);
        totalEans += 1;
      }
    }

    db.prepare('INSERT INTO cmed_imports (source_file, source_type, total_rows, total_eans) VALUES (?, ?, ?, ?)')
      .run(sourceName, 'ANVISA_CMED_XLSX', totalCatalog, totalEans);

    db.exec('COMMIT');
    invalidateCmedCache();
    return { sourceName, totalCatalog, totalEans };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Carrega o cache CMED do SQLite em Maps em memoria com cache singleton (< 2ms em cache hit).
 */
let _cmedMapsCache = null;
let _cmedLastImportId = null;

export function invalidateCmedCache() {
  _cmedMapsCache = null;
  _cmedLastImportId = null;
}

export function getCachedCmedMaps() {
  const db = getAnalyticsDb();
  const lastImport = db.prepare('SELECT * FROM cmed_imports ORDER BY id DESC LIMIT 1').get();
  if (!lastImport) {
    return { ready: false, lastImport: null, byEan: new Map(), byRegistro: new Map() };
  }

  if (_cmedMapsCache && _cmedLastImportId === lastImport.id) {
    return _cmedMapsCache;
  }

  const rows = db.prepare('SELECT * FROM cmed_catalog').all();
  const byId = new Map();
  const byRegistro = new Map();

  for (const r of rows) {
    const rec = {
      id: r.id,
      substanciaRaw: r.substancia_raw,
      substanciaNorm: r.substancia_norm,
      laboratorio: r.laboratorio,
      registro: r.registro,
      produto: r.produto,
      apresentacao: r.apresentacao,
      classeTerapeutica: r.classe_terapeutica,
      tipoProduto: r.tipo_produto,
      tarja: r.tarja,
      concentracao: r.concentracao,
      forma: r.forma,
      packExact: r.pack_exact,
      packBucket: r.pack_bucket,
      sigKey: r.sig_key,
    };
    byId.set(r.id, rec);
    if (r.registro && !byRegistro.has(r.registro)) {
      byRegistro.set(r.registro, rec);
    }
  }

  const byEan = new Map();
  const eanRows = db.prepare('SELECT ean, cmed_id FROM cmed_eans').all();
  for (const er of eanRows) {
    const rec = byId.get(er.cmed_id);
    if (rec && !byEan.has(er.ean)) {
      byEan.set(er.ean, rec);
    }
  }

  _cmedLastImportId = lastImport.id;
  _cmedMapsCache = { ready: true, lastImport, byEan, byRegistro };
  return _cmedMapsCache;
}

/**
 * Executa a cascata EAN-first validada:
 * 1) produto.barras -> 2) barras(unit) -> 3) gtin14 -> 4) barras(master) -> 5) fallback registro_ms.
 */
export function lookupCmedCascade(item, cmedMaps) {
  if (!cmedMaps?.ready) {
    return { hit: null, source: null, eanMsDivergent: false, eanHit: null, regHit: null };
  }

  const findFirst = (codes) => {
    for (const raw of codes) {
      const nc = normCode(raw);
      if (nc && cmedMaps.byEan.has(nc)) return cmedMaps.byEan.get(nc);
    }
    return null;
  };

  let eanHit = null;
  let source = null;

  const h1 = findFirst([item.prodBarras]);
  if (h1) {
    eanHit = h1;
    source = 'produto.barras';
  } else {
    const h2 = findFirst(item.extraBarrasUnit || []);
    if (h2) {
      eanHit = h2;
      source = 'barras(unit)';
    } else {
      const h3 = findFirst([item.gtin14]);
      if (h3) {
        eanHit = h3;
        source = 'produto.gtin14';
      } else {
        const h4 = findFirst(item.extraBarrasMaster || []);
        if (h4) {
          eanHit = h4;
          source = 'barras(master)';
        }
      }
    }
  }

  const reg = normCode(item.registroMs);
  const regHit = reg ? cmedMaps.byRegistro.get(reg) || null : null;
  const eanMsDivergent = Boolean(eanHit && regHit && eanHit.registro !== regHit.registro);

  let hit = eanHit;
  if (!hit && regHit) {
    hit = regHit;
    source = 'registro_ms';
  }

  return { hit, source, eanMsDivergent, eanHit, regHit };
}


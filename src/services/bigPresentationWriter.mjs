import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/analytics.db');

function getSqliteDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS big_presentation_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      client_name TEXT,
      db_name TEXT,
      total_requested INTEGER,
      created_presentations INTEGER,
      linked_products INTEGER,
      skipped_already_linked INTEGER,
      options_json TEXT,
      status TEXT,
      error_message TEXT,
      elapsed_ms REAL
    );
  `);
  return db;
}

function getActiveProfile(sqliteDb) {
  return sqliteDb.prepare('SELECT * FROM client_profiles ORDER BY id DESC LIMIT 1').get();
}

function createMariaDbPool(profile) {
  return mysql.createPool({
    host: profile?.db_host || '127.0.0.1',
    port: Number(profile?.db_port || 3306),
    user: profile?.db_user || 'root',
    password: profile?.db_password || '',
    database: profile?.db_name || 'gerente',
    connectTimeout: 6000,
  });
}

/**
 * Mapeia forma normalizada do motor para nome amigável e canônico de exibição em produto_apresentacao
 * Linx BIG compatível: '16 SACHES', '120ML XAROPE', '30 COMPRIMIDOS', etc.
 */
export function formatFormaLabel(forma, packBucket) {
  const f = String(forma || '').toUpperCase();
  const rawPack = String(packBucket || '').replace('~', '').trim();

  const map = {
    CPR: 'COMPRIMIDOS',
    CPR_LP: 'COMPRIMIDOS LIB PROL',
    CPR_ESP: 'COMPRIMIDOS EFERV',
    CAPS: 'CAPSULAS',
    CAPS_LP: 'CAPSULAS LIB PROL',
    CREME: 'CREME',
    POMADA: 'POMADA',
    GEL: 'GEL',
    SOL_OFT: 'SOL OFT',
    GOTAS: 'GOTAS',
    XAROPE: 'XAROPE',
    SUSP: 'SUSPENSAO',
    SPRAY: 'SPRAY',
    SACHE: 'SACHES',
    INJ: 'INJETAVEL',
    SOL: 'SOLUCAO',
    NASAL: 'SOL NASAL',
  };
  const formaText = map[f] || (f && f !== 'OUTROS' ? f : 'UNIDADES');

  if (rawPack.endsWith('ML') || rawPack.endsWith('G')) {
    return `${rawPack} ${formaText}`.trim();
  }
  if (rawPack.endsWith('UN')) {
    const num = rawPack.replace('UN', '');
    return `${num} ${formaText}`.trim();
  }

  return rawPack ? `${rawPack} ${formaText}`.trim() : formaText;
}

/**
 * Reverte e limpa apresentações de teste ou corrompidas criadas a partir de determinado ID
 */
export async function cleanupBigPresentations({ fromId = 1019 } = {}) {
  const t0 = performance.now();
  const sqliteDb = getSqliteDb();
  const profile = getActiveProfile(sqliteDb);
  if (!profile) throw new Error('Nenhum perfil de banco BIG configurado.');

  const pool = createMariaDbPool(profile);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Desvincular produtos que apontam para as apresentações criadas a partir de fromId
    const [updRes] = await conn.query(
      `UPDATE produto 
       SET produto_apresentacao_id = NULL, considera_prod_apresentacao = 'N', dtalteracao = NOW(), lojas_leram = '1'
       WHERE produto_apresentacao_id >= ?`,
      [fromId]
    );

    // 2. Deletar os registros de produto_apresentacao criados no teste
    const [delRes] = await conn.query(
      `DELETE FROM produto_apresentacao WHERE produto_apresentacao_id >= ?`,
      [fromId]
    );

    await conn.commit();
    const elapsedMs = Math.round(performance.now() - t0);

    sqliteDb.prepare(`
      INSERT INTO big_presentation_sync_log (
        client_name, db_name, total_requested, created_presentations,
        linked_products, skipped_already_linked, options_json, status, error_message, elapsed_ms
      ) VALUES (?, ?, 0, ?, ?, 0, ?, 'LIMPEZA_CONCLUIDA', NULL, ?)
    `).run(
      profile.name,
      profile.db_name,
      -Number(delRes.affectedRows || 0),
      -Number(updRes.affectedRows || 0),
      JSON.stringify({ action: 'cleanup', fromId }),
      elapsedMs
    );

    return {
      ok: true,
      fromId,
      unlinkedProducts: updRes.affectedRows || 0,
      deletedPresentations: delRes.affectedRows || 0,
      elapsedMs,
      clientName: profile.name,
      dbName: profile.db_name,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

/**
 * Gera prévia dos candidatos de De -> Para agrupados por Apresentação Canônica Inteligente
 */
export async function buildPresentationSyncPreview({ runId = null, limit = 2000 } = {}) {
  const sqliteDb = getSqliteDb();
  const profile = getActiveProfile(sqliteDb);
  if (!profile) throw new Error('Nenhum perfil de banco BIG configurado.');

  const effectiveRunId = runId || sqliteDb.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get()?.id;
  if (!effectiveRunId) {
    return {
      summary: { totalCandidates: 0, pendingToLink: 0, alreadyLinked: 0, uniquePresentations: 0, totalClusters: 0 },
      clusters: [],
      items: [],
    };
  }

  // Buscar SKUs da análise que possuem molécula válida e segura
  const skus = sqliteDb.prepare(`
    SELECT 
      produto_id, descricao, labora, macro_categoria, molecule_key,
      tipo_produto_cmed, estoque_atual, sugestao_compra_un, preco_venda, custo_unit
    FROM engine_sku_results
    WHERE run_id = ? AND molecule_key IS NOT NULL AND molecule_key NOT LIKE '.NA%'
    ORDER BY molecule_key ASC, descricao ASC
    LIMIT ?
  `).all(effectiveRunId, limit);

  if (skus.length === 0) {
    return {
      summary: { totalCandidates: 0, pendingToLink: 0, alreadyLinked: 0, uniquePresentations: 0, totalClusters: 0 },
      clusters: [],
      items: [],
    };
  }

  // Consultar status atual no MariaDB do Linx BIG
  const pool = createMariaDbPool(profile);
  let bigProductMap = new Map();
  try {
    const pids = skus.map((s) => s.produto_id);
    const chunkSize = 1000;
    for (let i = 0; i < pids.length; i += chunkSize) {
      const slice = pids.slice(i, i + chunkSize);
      const [rows] = await pool.query(
        `SELECT produto_id, produto_apresentacao_id, considera_prod_apresentacao, qtde_apres 
         FROM produto WHERE produto_id IN (${slice.map(() => '?').join(',')})`,
        slice
      );
      for (const r of rows) {
        bigProductMap.set(r.produto_id, r);
      }
    }
  } finally {
    await pool.end();
  }

  let alreadyLinkedCount = 0;
  let pendingCount = 0;
  const clusterMap = new Map();
  const validItems = [];

  for (const s of skus) {
    const parts = (s.molecule_key || '').split('|');
    const substancia = parts[0]?.trim() || '';
    const concentracao = parts[1]?.trim() || '';
    const forma = parts[2]?.trim() || 'OUTROS';
    const packBucket = parts[3]?.trim() || '';

    // Filtragem estrita: Concentração deve ser assertiva, nunca '?' ou desconhecida
    if (!substancia || substancia.length < 2) continue;
    if (!concentracao || concentracao === '?' || concentracao === '0') continue;
    if (!packBucket || packBucket === '?') continue;

    const packMatch = packBucket.match(/\d+/);
    const packQty = packMatch ? Number(packMatch[0]) : 0;
    const qtdForma = formatFormaLabel(forma, packBucket);

    const bigInfo = bigProductMap.get(s.produto_id);
    const hasApres = Boolean(bigInfo && bigInfo.produto_apresentacao_id && bigInfo.produto_apresentacao_id > 0);
    const considersApres = bigInfo?.considera_prod_apresentacao === 'S';

    if (hasApres && considersApres) {
      alreadyLinkedCount += 1;
    } else {
      pendingCount += 1;
    }

    const itemObj = {
      produto_id: s.produto_id,
      descricao: s.descricao,
      labora: s.labora || '—',
      substancia,
      concentracao,
      forma,
      qtd_forma_farmaceutica: qtdForma,
      pack_qty: packQty,
      molecule_key: s.molecule_key,
      tipo_cmed: s.tipo_produto_cmed || '—',
      estoque_atual: s.estoque_atual,
      sugestao_compra_un: s.sugestao_compra_un,
      current_apres_id: bigInfo?.produto_apresentacao_id || null,
      current_considera: bigInfo?.considera_prod_apresentacao || 'N',
      current_qtde_apres: bigInfo?.qtde_apres || 0,
      status: hasApres ? (considersApres ? 'VINCULADO_ATIVO' : 'VINCULADO_INATIVO') : 'NAO_VINCULADO',
    };

    validItems.push(itemObj);

    // Agrupamento por Apresentação Canônica
    const canonKey = `${substancia}|${concentracao}|${qtdForma}`;
    if (!clusterMap.has(canonKey)) {
      clusterMap.set(canonKey, {
        canonical_key: canonKey,
        molecule_key: s.molecule_key,
        substancia,
        concentracao,
        qtd_forma_farmaceutica: qtdForma,
        forma,
        pack_qty: packQty,
        skus_count: 0,
        pending_count: 0,
        linked_count: 0,
        labs: new Set(),
        items: [],
      });
    }

    const cluster = clusterMap.get(canonKey);
    cluster.skus_count += 1;
    if (itemObj.status === 'NAO_VINCULADO' || itemObj.status === 'VINCULADO_INATIVO') {
      cluster.pending_count += 1;
    } else {
      cluster.linked_count += 1;
    }
    if (s.labora && s.labora !== '—') {
      cluster.labs.add(s.labora);
    }
    cluster.items.push(itemObj);
  }

  // Converter Clusters para array ordenado por quantidade de SKUs agrupados (maior impacto primeiro)
  const clusters = Array.from(clusterMap.values())
    .map((c) => ({
      ...c,
      labs: Array.from(c.labs),
      status: c.pending_count > 0 ? 'PENDENTE_SINCRONIZACAO' : 'TOTALMENTE_VINCULADO',
    }))
    .sort((a, b) => b.skus_count - a.skus_count || a.substancia.localeCompare(b.substancia));

  return {
    summary: {
      totalCandidates: validItems.length,
      pendingToLink: pendingCount,
      alreadyLinked: alreadyLinkedCount,
      uniquePresentations: clusters.length,
      totalClusters: clusters.length,
      clientName: profile.name,
      dbName: profile.db_name,
    },
    clusters,
    items: validItems,
  };
}

/**
 * Executa a gravação e sincronização do De -> Para diretamente no Linx BIG
 */
export async function executePresentationSync({
  skuList = [],
  options = { onlyUnlinked: true, activateConsidera: true, updateQtdeApres: true },
} = {}) {
  const t0 = performance.now();
  const sqliteDb = getSqliteDb();
  const profile = getActiveProfile(sqliteDb);
  if (!profile) throw new Error('Nenhum perfil de banco BIG configurado.');

  if (!Array.isArray(skuList) || skuList.length === 0) {
    throw new Error('Nenhum produto selecionado para sincronizar.');
  }

  const pool = createMariaDbPool(profile);
  const conn = await pool.getConnection();

  let createdPresentations = 0;
  let linkedProducts = 0;
  let skippedAlreadyLinked = 0;

  try {
    await conn.beginTransaction();

    // Cache local de produto_apresentacao para evitar queries repetidas dentro do lote
    const presentationCache = new Map(); // key -> id

    // Carregar apresentações existentes no MariaDB para cache
    const [existingRows] = await conn.query(
      `SELECT produto_apresentacao_id, UPPER(TRIM(substancia)) as sub, UPPER(TRIM(concentracao)) as conc, UPPER(TRIM(qtd_forma_farmaceutica)) as qtd 
       FROM produto_apresentacao WHERE apagado = 'N'`
    );
    for (const r of existingRows) {
      const cacheKey = `${r.sub}|${r.conc}|${r.qtd}`;
      presentationCache.set(cacheKey, r.produto_apresentacao_id);
    }

    for (const item of skuList) {
      const produtoId = Number(item.produto_id);
      if (!produtoId) continue;

      // Verificar se já possui vínculo e se devemos respeitar
      if (options.onlyUnlinked && item.current_apres_id && item.current_apres_id > 0) {
        skippedAlreadyLinked += 1;
        continue;
      }

      const substancia = String(item.substancia || '').trim().slice(0, 45).toUpperCase();
      const concentracao = String(item.concentracao || '').trim().slice(0, 30).toUpperCase();
      const qtdForma = String(item.qtd_forma_farmaceutica || '').trim().slice(0, 45).toUpperCase();
      const packQty = Math.max(0, Math.round(Number(item.pack_qty || 0)));

      // Validação estrita
      if (!substancia || substancia.length < 2) continue;
      if (!concentracao || concentracao === '?' || concentracao === '0') continue;
      if (!qtdForma || qtdForma.includes('?')) continue;

      const cacheKey = `${substancia}|${concentracao}|${qtdForma}`;
      let apresId = presentationCache.get(cacheKey);

      if (!apresId) {
        // Criar nova apresentação canônica unificada na tabela nativa do BIG
        const [insRes] = await conn.query(
          `INSERT INTO produto_apresentacao 
             (substancia, concentracao, qtd_forma_farmaceutica, dtcadastro, cad_usuario_id, lojas_leram, apagado)
           VALUES (?, ?, ?, NOW(), 1, '1', 'N')`,
          [substancia, concentracao, qtdForma]
        );
        apresId = insRes.insertId;
        presentationCache.set(cacheKey, apresId);
        createdPresentations += 1;
      }

      // Atualizar o produto na tabela produto do BIG
      const updateFields = ['produto_apresentacao_id = ?', 'dtalteracao = NOW()', "lojas_leram = '1'"];
      const updateParams = [apresId];

      if (options.activateConsidera) {
        updateFields.push("considera_prod_apresentacao = 'S'");
      }

      if (options.updateQtdeApres && packQty > 0) {
        updateFields.push('qtde_apres = ?');
        updateParams.push(packQty);
      }

      updateParams.push(produtoId);

      const [updRes] = await conn.query(
        `UPDATE produto SET ${updateFields.join(', ')} WHERE produto_id = ?`,
        updateParams
      );

      if (updRes.affectedRows > 0) {
        linkedProducts += 1;
      }
    }

    await conn.commit();

    const elapsedMs = Math.round(performance.now() - t0);

    // Gravar log de auditoria no SQLite local
    sqliteDb.prepare(`
      INSERT INTO big_presentation_sync_log (
        client_name, db_name, total_requested, created_presentations,
        linked_products, skipped_already_linked, options_json, status, elapsed_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCESSO', ?)
    `).run(
      profile.name,
      profile.db_name,
      skuList.length,
      createdPresentations,
      linkedProducts,
      skippedAlreadyLinked,
      JSON.stringify(options),
      elapsedMs
    );

    return {
      ok: true,
      createdPresentations,
      linkedProducts,
      skippedAlreadyLinked,
      elapsedMs,
      clientName: profile.name,
    };
  } catch (err) {
    await conn.rollback();
    const elapsedMs = Math.round(performance.now() - t0);

    sqliteDb.prepare(`
      INSERT INTO big_presentation_sync_log (
        client_name, db_name, total_requested, created_presentations,
        linked_products, skipped_already_linked, options_json, status, error_message, elapsed_ms
      ) VALUES (?, ?, ?, 0, 0, 0, ?, 'ERRO', ?, ?)
    `).run(
      profile?.name || 'Desconhecido',
      profile?.db_name || 'Desconhecido',
      skuList.length,
      JSON.stringify(options),
      err.message,
      elapsedMs
    );

    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

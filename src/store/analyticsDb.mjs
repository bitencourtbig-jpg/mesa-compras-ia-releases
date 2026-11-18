import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'analytics.db');

let _db = null;

/**
 * Abre (ou cria) o banco analitico local SQLite do Motor de Compras.
 * Todo De->Para, cache CMED, regras PBM, historico de backups e resultados
 * rodam aqui sem modificar o banco de producao do cliente.
 */
export function getAnalyticsDb(dbPath = DEFAULT_DB_PATH) {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -64000;'); // 64 MB de cache de páginas em memória RAM
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA busy_timeout = 8000;'); // 8s de tolerância para concorrência sem bloqueio fatal
  initSchema(db);
  _db = db;
  return _db;
}

function safeAddColumn(db, table, column, definition) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (cols && cols.length > 0) {
      const colNames = new Set(cols.map(c => c.name.toLowerCase()));
      if (!colNames.has(column.toLowerCase())) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      }
    }
  } catch (err) {
    // Tolerante a falhas individuais para nunca interromper a migração
  }
}

function initSchema(db) {
  // =========================================================================
  // FASE 1: Migrações defensivas prévias para tabelas existentes
  // Garante que todas as colunas necessárias existam ANTES de criar tabelas e índices
  // =========================================================================
  try {
    const esrCols = db.prepare("PRAGMA table_info(engine_sku_results)").all();
    if (esrCols && esrCols.length > 0) {
      const colNames = new Set(esrCols.map(c => c.name.toLowerCase()));
      if (!colNames.has('filial_id')) {
        db.exec("DROP TABLE IF EXISTS engine_sku_results;");
      }
    }
  } catch (err) {
    console.warn('Alerta na checagem de engine_sku_results:', err.message);
  }

  try {
    const erCols = db.prepare("PRAGMA table_info(engine_runs)").all();
    if (erCols && erCols.length > 0) {
      const colNames = new Set(erCols.map(c => c.name.toLowerCase()));
      if (!colNames.has('client_code')) {
        db.exec("DROP TABLE IF EXISTS engine_runs;");
      }
    }
  } catch (err) {
    console.warn('Alerta na migracao de engine_runs:', err.message);
  }

  try {
    const remCols = db.prepare('PRAGMA table_info(engine_remanejamento)').all();
    if (remCols && remCols.length > 0) {
      const colNames = new Set(remCols.map(c => c.name.toLowerCase()));
      if (!colNames.has('produto_id')) {
        db.exec('DROP TABLE IF EXISTS engine_remanejamento;');
      }
    }
  } catch (err) {
    console.warn('Alerta na migracao de engine_remanejamento:', err.message);
  }

  try {
    const molCols = db.prepare('PRAGMA table_info(engine_molecule_summary)').all();
    if (molCols && molCols.length > 0) {
      const colNames = new Set(molCols.map(c => c.name.toLowerCase()));
      if (!colNames.has('molecule_key')) {
        db.exec('DROP TABLE IF EXISTS engine_molecule_summary;');
      }
    }
  } catch (err) {
    console.warn('Alerta na migracao de engine_molecule_summary:', err.message);
  }

  try {
    const cmedCols = db.prepare('PRAGMA table_info(cmed_catalog)').all();
    if (cmedCols && cmedCols.length > 0) {
      const colNames = new Set(cmedCols.map(c => c.name.toLowerCase()));
      if (!colNames.has('concentracao')) {
        db.exec('DROP TABLE IF EXISTS cmed_eans;');
        db.exec('DROP TABLE IF EXISTS cmed_catalog;');
      }
    }
  } catch (err) {
    console.warn('Alerta na migracao de cmed_catalog:', err.message);
  }

  // Migrações seguras e isoladas de colunas em engine_sku_results
  safeAddColumn(db, 'engine_sku_results', 'curva_erp_ranking', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'curva_erp_classe', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'dias_estoque_min', 'INTEGER DEFAULT 0');
  safeAddColumn(db, 'engine_sku_results', 'dias_estoque_max', 'INTEGER DEFAULT 0');
  safeAddColumn(db, 'engine_sku_results', 'grupo_pai_nome', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'grupo_filho_nome', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'dismissed', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'engine_sku_results', 'pareto_pct', 'REAL DEFAULT 0');
  safeAddColumn(db, 'engine_sku_results', 'filial_nome', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'filial_reduz', 'TEXT');
  safeAddColumn(db, 'engine_sku_results', 'transito_remanejamento', 'REAL DEFAULT 0');

  // cmed_catalog
  safeAddColumn(db, 'cmed_catalog', 'sig_key', 'TEXT');
  safeAddColumn(db, 'cmed_catalog', 'substancia_raw', 'TEXT');
  safeAddColumn(db, 'cmed_catalog', 'substancia_norm', 'TEXT');
  safeAddColumn(db, 'cmed_catalog', 'source_name', "TEXT DEFAULT 'ANVISA'");

  // budget_monthly_summary
  safeAddColumn(db, 'budget_monthly_summary', 'remanejamento_economizado_rs', 'REAL DEFAULT 0');
  safeAddColumn(db, 'budget_monthly_summary', 'unoptimized_products_json', 'TEXT');

  // client_sku_suspensions
  safeAddColumn(db, 'client_sku_suspensions', 'molecule_key', 'TEXT');
  safeAddColumn(db, 'client_sku_suspensions', 'gatilho_cobertura_limite', 'REAL DEFAULT 7.0');

  // client_profiles
  safeAddColumn(db, 'client_profiles', 'db_user', "TEXT NOT NULL DEFAULT 'root'");
  safeAddColumn(db, 'client_profiles', 'db_password', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn(db, 'client_profiles', 'buyer_cnpj', 'TEXT');
  safeAddColumn(db, 'client_profiles', 'default_supplier_id', 'INTEGER NOT NULL DEFAULT 10');
  safeAddColumn(db, 'client_profiles', 'default_supplier_name', 'TEXT');
  safeAddColumn(db, 'client_profiles', 'operation_mode', "TEXT NOT NULL DEFAULT 'central'");
  safeAddColumn(db, 'client_profiles', 'target_filial_id', 'INTEGER');
  safeAddColumn(db, 'client_profiles', 'allow_pack_tolerance', 'INTEGER NOT NULL DEFAULT 1');
  safeAddColumn(db, 'client_profiles', 'open_order_cutoff_days', 'INTEGER NOT NULL DEFAULT 30');
  safeAddColumn(db, 'client_profiles', 'recent_entries_limit', 'INTEGER NOT NULL DEFAULT 5');
  safeAddColumn(db, 'client_profiles', 'default_weeks', 'INTEGER NOT NULL DEFAULT 13');
  safeAddColumn(db, 'client_profiles', 'service_profile', "TEXT NOT NULL DEFAULT 'equilibrado'");
  safeAddColumn(db, 'client_profiles', 'active_sales_filials', "TEXT NOT NULL DEFAULT '[2]'");
  safeAddColumn(db, 'client_profiles', 'ignored_filials', "TEXT NOT NULL DEFAULT '[3]'");

  // client_group_coverage_config
  safeAddColumn(db, 'client_group_coverage_config', 'codigo', 'TEXT');
  safeAddColumn(db, 'client_group_coverage_config', 'desc_arvore', 'TEXT');
  safeAddColumn(db, 'client_group_coverage_config', 'grupo_pai_nome', 'TEXT');
  safeAddColumn(db, 'client_group_coverage_config', 'grupo_filho_nome', 'TEXT');

  // client_filial_policies
  safeAddColumn(db, 'client_filial_policies', 'data_inauguracao', 'TEXT');
  safeAddColumn(db, 'client_filial_policies', 'dias_carencia', 'INTEGER DEFAULT 90');
  safeAddColumn(db, 'client_filial_policies', 'bloquear_doacao_remanejamento', 'INTEGER DEFAULT 1');
  safeAddColumn(db, 'client_filial_policies', 'tipo_reposicao', "TEXT DEFAULT 'sellout_1to1'");

  // =========================================================================
  // FASE 2: Criação de Tabelas e Índices
  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      cnpj TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      license_key TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      plan_type TEXT DEFAULT 'mensal',
      max_filiais INTEGER DEFAULT 1,
      status TEXT DEFAULT 'ACTIVE',
      activated_at TEXT,
      signature TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS issued_licenses_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      cnpj TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      contact_phone TEXT,
      monthly_price REAL DEFAULT 0,
      plan_type TEXT DEFAULT 'mensal',
      days INTEGER DEFAULT 30,
      license_key TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS client_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      db_host TEXT NOT NULL DEFAULT '127.0.0.1',
      db_port INTEGER NOT NULL DEFAULT 3306,
      db_user TEXT NOT NULL DEFAULT 'root',
      db_password TEXT NOT NULL DEFAULT '',
      db_name TEXT NOT NULL,
      buyer_filial_id INTEGER NOT NULL DEFAULT 1,
      buyer_cnpj TEXT,
      default_supplier_id INTEGER NOT NULL DEFAULT 10,
      default_supplier_name TEXT,
      active_sales_filials TEXT NOT NULL DEFAULT '[2]',
      ignored_filials TEXT NOT NULL DEFAULT '[3]',
      service_profile TEXT NOT NULL DEFAULT 'equilibrado',
      default_weeks INTEGER NOT NULL DEFAULT 13,
      recent_entries_limit INTEGER NOT NULL DEFAULT 5,
      allow_pack_tolerance INTEGER NOT NULL DEFAULT 1,
      open_order_cutoff_days INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_group_coverage_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      grupo_id INTEGER NOT NULL,
      grupo_nome TEXT NOT NULL,
      macro_categoria TEXT NOT NULL,
      total_produtos INTEGER NOT NULL DEFAULT 0,
      dias_min_a INTEGER NOT NULL DEFAULT 3,
      dias_max_a INTEGER NOT NULL DEFAULT 12,
      dias_min_b INTEGER NOT NULL DEFAULT 7,
      dias_max_b INTEGER NOT NULL DEFAULT 15,
      dias_min_c INTEGER NOT NULL DEFAULT 10,
      dias_max_c INTEGER NOT NULL DEFAULT 20,
      dias_min_d INTEGER NOT NULL DEFAULT 0,
      dias_max_d INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'IA_SMART', -- 'ERP' | 'IA_SMART' | 'CUSTOM'
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(client_code, grupo_id)
    );

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

    CREATE TABLE IF NOT EXISTS cmed_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      source_type TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      total_eans INTEGER NOT NULL,
      imported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pbm_program_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      operadora TEXT NOT NULL,
      projeto TEXT NOT NULL,
      auto_reposicao TEXT NOT NULL DEFAULT 'S', -- S = Sim (100%), P = Parcial (50%), N = Nao
      tx_count_91d INTEGER NOT NULL DEFAULT 0,
      unidades_91d REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_code, operadora, projeto)
    );

    CREATE TABLE IF NOT EXISTS molecule_de_para (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      produto_id INTEGER NOT NULL,
      big_grupo_id INTEGER DEFAULT 0,
      canon_key TEXT NOT NULL,
      substancia TEXT NOT NULL,
      concentracao TEXT,
      forma TEXT,
      pack_bucket TEXT,
      tipo_produto TEXT,
      status TEXT NOT NULL DEFAULT 'suggested', -- approved | suggested | conflict | ignored
      source TEXT NOT NULL DEFAULT 'CMED_EAN',
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_code, produto_id)
    );

    CREATE TABLE IF NOT EXISTS global_molecule_knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER,
      barras TEXT,
      descricao TEXT,
      canon_key TEXT NOT NULL,
      substancia TEXT NOT NULL,
      concentracao TEXT,
      forma TEXT,
      pack_bucket TEXT,
      learned_source TEXT NOT NULL DEFAULT 'BUYER_CORRECTION',
      motivo TEXT,
      approval_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(canon_key, barras)
    );

    CREATE TABLE IF NOT EXISTS big_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      scope TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS engine_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      weeks_window INTEGER NOT NULL,
      service_profile TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS engine_sku_results (
      run_id INTEGER NOT NULL,
      filial_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      descricao TEXT NOT NULL,
      barras TEXT,
      labora TEXT,
      fornecedor_id INTEGER,
      fornecedor_nome TEXT,
      grupo_id INTEGER,
      grupo_nome TEXT,
      macro_categoria TEXT NOT NULL,
      medicamento_flag TEXT,
      medicamento_efetivo INTEGER NOT NULL,
      molecule_key TEXT,
      tipo_produto_cmed TEXT,
      abc_class TEXT NOT NULL,
      xyz_class TEXT NOT NULL,
      is_traffic_builder INTEGER NOT NULL DEFAULT 0,
      preco_venda REAL NOT NULL DEFAULT 0,
      custo_unit REAL NOT NULL DEFAULT 0,
      margem_pct REAL NOT NULL DEFAULT 0,
      estoque_atual REAL NOT NULL DEFAULT 0,
      estoque_reserva REAL NOT NULL DEFAULT 0,
      transito_real REAL NOT NULL DEFAULT 0,
      vendas_6s REAL NOT NULL DEFAULT 0,
      vendas_9s REAL NOT NULL DEFAULT 0,
      vendas_13s REAL NOT NULL DEFAULT 0,
      vendas_pbm_13s REAL NOT NULL DEFAULT 0,
      dias_sem_estoque_13s INTEGER NOT NULL DEFAULT 0,
      venda_perdida_est_un REAL NOT NULL DEFAULT 0,
      venda_perdida_est_rs REAL NOT NULL DEFAULT 0,
      ddv_bruta REAL NOT NULL DEFAULT 0,
      ddv_ajustada REAL NOT NULL DEFAULT 0,
      ddv_pbm_auto REAL NOT NULL DEFAULT 0,
      ddv_liquida REAL NOT NULL DEFAULT 0,
      indice_sazonalidade REAL NOT NULL DEFAULT 1,
      ddv_projetada REAL NOT NULL DEFAULT 0,
      lead_time_dias REAL NOT NULL DEFAULT 5,
      estoque_min REAL NOT NULL DEFAULT 0,
      estoque_seg REAL NOT NULL DEFAULT 0,
      estoque_max REAL NOT NULL DEFAULT 0,
      cobertura_dias REAL NOT NULL DEFAULT 0,
      lote_vencendo_90d_qtd REAL NOT NULL DEFAULT 0,
      lote_vencendo_90d_rs REAL NOT NULL DEFAULT 0,
      lote_vencido_qtd REAL NOT NULL DEFAULT 0,
      lote_menor_validade TEXT,
      perda_2026_un REAL NOT NULL DEFAULT 0,
      perda_2026_rs REAL NOT NULL DEFAULT 0,
      remanejamento_entrada REAL NOT NULL DEFAULT 0,
      remanejamento_saida REAL NOT NULL DEFAULT 0,
      sugestao_compra_un REAL NOT NULL DEFAULT 0,
      sugestao_compra_rs REAL NOT NULL DEFAULT 0,
      roi_marginal REAL NOT NULL DEFAULT 0,
      custo_variacao_pct REAL NOT NULL DEFAULT 0,
      excecoes_json TEXT,
      justificativa_ia TEXT,
      ultimas_entradas_json TEXT,
      curva_erp_ranking TEXT,
      curva_erp_classe TEXT,
      dias_estoque_min INTEGER DEFAULT 0,
      dias_estoque_max INTEGER DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (run_id, filial_id, produto_id)
    );

    CREATE TABLE IF NOT EXISTS engine_remanejamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      descricao TEXT NOT NULL,
      filial_origem INTEGER NOT NULL,
      filial_destino INTEGER NOT NULL,
      tipo TEXT NOT NULL, -- PARADO | EXCESSO | FEFO_VALIDADE
      qtd_sugerida REAL NOT NULL,
      custo_unit REAL NOT NULL,
      valor_total REAL NOT NULL,
      validade_prioritaria TEXT,
      motivo TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS engine_run_meta (
      run_id INTEGER PRIMARY KEY,
      client_code TEXT NOT NULL,
      filters_meta_json TEXT NOT NULL,
      filial_kpis_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS engine_molecule_summary (
      run_id INTEGER NOT NULL,
      molecule_key TEXT NOT NULL,
      substancia TEXT NOT NULL,
      concentracao TEXT,
      forma TEXT,
      pack_bucket TEXT,
      eh_referencia INTEGER NOT NULL DEFAULT 0,
      skus_count INTEGER NOT NULL,
      labs_count INTEGER NOT NULL,
      estoque_total REAL NOT NULL,
      transito_total REAL NOT NULL,
      ddv_proj_total REAL NOT NULL,
      cobertura_molecula_dias REAL NOT NULL,
      sugestao_sku_soma REAL NOT NULL,
      necessidade_liquida_molecula REAL NOT NULL,
      economia_un_evitada REAL NOT NULL,
      economia_rs_evitada REAL NOT NULL,
      melhor_sku_id INTEGER,
      melhor_sku_desc TEXT,
      melhor_custo_unit REAL,
      detalhe_skus_json TEXT,
      PRIMARY KEY (run_id, molecule_key, eh_referencia)
    );

    CREATE INDEX IF NOT EXISTS idx_ems_run_labs ON engine_molecule_summary(run_id, labs_count, sugestao_sku_soma);

    CREATE TABLE IF NOT EXISTS pbm_audit_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      filial_id INTEGER NOT NULL,
      data_hora TEXT NOT NULL,
      operadora TEXT,
      projeto TEXT,
      nsu TEXT,
      autorizacao TEXT,
      cartao_cpf TEXT,
      produto_id INTEGER NOT NULL,
      descricao TEXT,
      percentual_desconto REAL DEFAULT 0,
      valor_desconto REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS big_orders_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      numlanc INTEGER NOT NULL,
      filial_id INTEGER NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT,
      total_items INTEGER NOT NULL,
      total_units REAL NOT NULL,
      total_rs REAL NOT NULL,
      export_channel TEXT NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_sku_suspensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      filial_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      descricao TEXT,
      motivo TEXT,
      dias_bloqueio INTEGER NOT NULL DEFAULT 30,
      data_fim_bloqueio TEXT NOT NULL,
      origem TEXT NOT NULL DEFAULT 'MOTOR_ONLY', -- 'MOTOR_ONLY' | 'BIG_SYNCED'
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(client_code, filial_id, produto_id)
    );

    CREATE TABLE IF NOT EXISTS client_filial_policies (
      client_code TEXT NOT NULL,
      filial_id INTEGER NOT NULL,
      nome_loja TEXT NOT NULL,
      nome_reduz TEXT,
      data_inauguracao TEXT,
      dias_carencia INTEGER DEFAULT 90,
      bloquear_doacao_remanejamento INTEGER DEFAULT 1,
      tipo_reposicao TEXT DEFAULT 'sellout_1to1',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (client_code, filial_id)
    );

    CREATE TABLE IF NOT EXISTS budget_monthly_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      reference_month TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      cmv_mes_anterior REAL NOT NULL DEFAULT 0,
      score_mes_anterior REAL NOT NULL DEFAULT 0,
      score_mes_atual REAL NOT NULL DEFAULT 0,
      peso_sabado REAL NOT NULL DEFAULT 1,
      peso_domingo REAL NOT NULL DEFAULT 1,
      dotacao_inicial REAL NOT NULL DEFAULT 0,
      var_faturamento_pct REAL NOT NULL DEFAULT 0,
      dotacao_ajustada REAL NOT NULL DEFAULT 0,
      consumido_compras_rs REAL NOT NULL DEFAULT 0,
      faturamento_liquido_mes REAL NOT NULL DEFAULT 0,
      compra_x_venda_pct REAL NOT NULL DEFAULT 0,
      compras_sem_demanda_rs REAL NOT NULL DEFAULT 0,
      compras_sem_demanda_pct REAL NOT NULL DEFAULT 0,
      compras_excesso_rs REAL NOT NULL DEFAULT 0,
      compras_excesso_pct REAL NOT NULL DEFAULT 0,
      compras_nao_otimizadas_rs REAL NOT NULL DEFAULT 0,
      compras_nao_otimizadas_pct REAL NOT NULL DEFAULT 0,
      iec_eficiencia_pct REAL NOT NULL DEFAULT 0,
      dimensions_json TEXT,
      filiais_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(client_code, reference_month)
    );

    CREATE TABLE IF NOT EXISTS budget_filial_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      filial_id INTEGER NOT NULL,
      reference_month TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      dotacao_ajustada REAL NOT NULL DEFAULT 0,
      consumido_compras_rs REAL NOT NULL DEFAULT 0,
      saldo_livre_rs REAL NOT NULL DEFAULT 0,
      consumido_pct REAL NOT NULL DEFAULT 0,
      faturamento_liquido_mes REAL NOT NULL DEFAULT 0,
      compra_x_venda_pct REAL NOT NULL DEFAULT 0,
      compras_nao_otimizadas_rs REAL NOT NULL DEFAULT 0,
      iec_eficiencia_pct REAL NOT NULL DEFAULT 0,
      summary_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(client_code, filial_id, reference_month)
    );
    CREATE INDEX IF NOT EXISTS idx_bfs_client_filial ON budget_filial_summary(client_code, filial_id, reference_month);

    CREATE TABLE IF NOT EXISTS ol_fabricantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      fabricante_nome TEXT NOT NULL,
      tipo_canal TEXT NOT NULL DEFAULT 'OL', -- 'OL' | 'FABRICANTE_DIRETO'
      pedido_minimo_rs REAL NOT NULL DEFAULT 3000.00,
      desconto_extra_pct REAL NOT NULL DEFAULT 10.00,
      prazo_medio_dias INTEGER NOT NULL DEFAULT 45,
      lead_time_dias INTEGER NOT NULL DEFAULT 14,
      horizonte_cobertura_dias INTEGER NOT NULL DEFAULT 21,
      ativo INTEGER NOT NULL DEFAULT 1,
      observacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(client_code, fabricante_nome)
    );

    CREATE TABLE IF NOT EXISTS motor_transferencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      codigo_transferencia TEXT NOT NULL UNIQUE,
      run_id INTEGER NOT NULL,
      filial_origem INTEGER NOT NULL,
      filial_origem_nome TEXT,
      filial_destino INTEGER NOT NULL,
      filial_destino_nome TEXT,
      status TEXT DEFAULT 'PENDENTE_SEPARACAO',
      total_itens INTEGER NOT NULL,
      total_unidades REAL NOT NULL,
      valor_total_rs REAL NOT NULL,
      data_emissao TEXT NOT NULL,
      data_recebimento TEXT,
      observacao TEXT
    );

    CREATE TABLE IF NOT EXISTS motor_transferencia_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transferencia_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      barras TEXT,
      descricao TEXT NOT NULL,
      labora TEXT,
      qtd_solicitada REAL NOT NULL,
      qtd_atendida REAL DEFAULT 0,
      custo_unit REAL NOT NULL,
      valor_total REAL NOT NULL,
      motivo_decisao TEXT NOT NULL,
      FOREIGN KEY (transferencia_id) REFERENCES motor_transferencias(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS buyer_learning_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      filial_id INTEGER NOT NULL DEFAULT 0,
      produto_id INTEGER NOT NULL,
      principio_ativo_id INTEGER DEFAULT 0,
      molecule_key TEXT,
      descricao TEXT,
      fabricante_origem TEXT,
      fabricante_proposto TEXT,
      tipo_evento TEXT NOT NULL,
      motivo TEXT,
      acao_futura TEXT DEFAULT 'LEMBRAR_PREFERENCIA',
      usuario TEXT DEFAULT 'comprador',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // =========================================================================
  // FASE 3: Criação segura de Índices (nunca quebra a inicialização)
  // =========================================================================
  const safeIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_cmed_eans_ean ON cmed_eans(ean);',
    'CREATE INDEX IF NOT EXISTS idx_cmed_reg ON cmed_catalog(registro);',
    'CREATE INDEX IF NOT EXISTS idx_cmed_sig ON cmed_catalog(sig_key);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_filial ON engine_sku_results(run_id, filial_id);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_abc ON engine_sku_results(run_id, abc_class);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_mol ON engine_sku_results(run_id, molecule_key);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_mol_prod ON engine_sku_results(run_id, molecule_key, produto_id, filial_id);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_prod ON engine_sku_results(run_id, produto_id);',
    'CREATE INDEX IF NOT EXISTS idx_esr_prod ON engine_sku_results(produto_id);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_buy ON engine_sku_results(run_id, dismissed, sugestao_compra_un);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_macro ON engine_sku_results(run_id, macro_categoria);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_grupopai ON engine_sku_results(run_id, grupo_pai_nome);',
    'CREATE INDEX IF NOT EXISTS idx_esr_run_labora ON engine_sku_results(run_id, labora);',
    'CREATE INDEX IF NOT EXISTS idx_mti_transf ON motor_transferencia_itens(transferencia_id);',
    'CREATE INDEX IF NOT EXISTS idx_mti_prod ON motor_transferencia_itens(produto_id);',
    'CREATE INDEX IF NOT EXISTS idx_mt_client_status ON motor_transferencias(client_code, status);',
    'CREATE INDEX IF NOT EXISTS idx_reman_run_route ON engine_remanejamento(run_id, filial_origem, filial_destino);',
    'CREATE INDEX IF NOT EXISTS idx_reman_run_tipo ON engine_remanejamento(run_id, tipo);',
    'CREATE INDEX IF NOT EXISTS idx_reman_run_prod ON engine_remanejamento(run_id, produto_id);',
    'CREATE INDEX IF NOT EXISTS idx_buyer_learning_prod ON buyer_learning_log(client_code, filial_id, produto_id);',
    'CREATE INDEX IF NOT EXISTS idx_buyer_learning_mol ON buyer_learning_log(client_code, filial_id, molecule_key);'
  ];

  for (const idxSql of safeIndexes) {
    try {
      db.exec(idxSql);
    } catch (err) {
      // Ignora silenciosamente ou loga em debug se tabela/coluna estiver em transição
      console.warn('Aviso seguro ao criar índice:', err.message);
    }
  }
}

export function upsertClientProfile(profile) {
  const db = getAnalyticsDb();
  const stmt = db.prepare(`
    INSERT INTO client_profiles (
      code, name, db_host, db_port, db_user, db_password, db_name, buyer_filial_id, buyer_cnpj,
      default_supplier_id, default_supplier_name,
      active_sales_filials, ignored_filials, service_profile,
      default_weeks, recent_entries_limit, allow_pack_tolerance, open_order_cutoff_days,
      operation_mode, target_filial_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      db_host = excluded.db_host,
      db_port = excluded.db_port,
      db_user = excluded.db_user,
      db_password = excluded.db_password,
      db_name = excluded.db_name,
      buyer_filial_id = excluded.buyer_filial_id,
      buyer_cnpj = excluded.buyer_cnpj,
      default_supplier_id = excluded.default_supplier_id,
      default_supplier_name = excluded.default_supplier_name,
      active_sales_filials = excluded.active_sales_filials,
      ignored_filials = excluded.ignored_filials,
      service_profile = excluded.service_profile,
      default_weeks = excluded.default_weeks,
      recent_entries_limit = excluded.recent_entries_limit,
      allow_pack_tolerance = excluded.allow_pack_tolerance,
      open_order_cutoff_days = excluded.open_order_cutoff_days,
      operation_mode = excluded.operation_mode,
      target_filial_id = excluded.target_filial_id,
      updated_at = datetime('now')
  `);
  stmt.run(
    profile.code,
    profile.name,
    profile.db_host || '127.0.0.1',
    Number(profile.db_port || 3306),
    profile.db_user || 'root',
    profile.db_password || '',
    profile.db_name,
    Number(profile.buyer_filial_id ?? 1),
    profile.buyer_cnpj || null,
    Number(profile.default_supplier_id ?? 10),
    profile.default_supplier_name || null,
    JSON.stringify(profile.active_sales_filials || [2]),
    JSON.stringify(profile.ignored_filials || []),
    profile.service_profile || 'equilibrado',
    Number(profile.default_weeks || 13),
    Number(profile.recent_entries_limit || 5),
    profile.allow_pack_tolerance === false ? 0 : 1,
    Number(profile.open_order_cutoff_days || 30),
    profile.operation_mode || 'central',
    profile.target_filial_id ? Number(profile.target_filial_id) : null
  );
  return getClientProfile(profile.code);
}

export function getClientProfile(code) {
  const db = getAnalyticsDb();
  let row = null;
  if (code) {
    row = db.prepare('SELECT * FROM client_profiles WHERE code = ?').get(code);
  }
  if (!row) {
    row = db.prepare('SELECT * FROM client_profiles ORDER BY updated_at DESC LIMIT 1').get();
  }
  if (!row) return null;
  return {
    ...row,
    active_sales_filials: JSON.parse(row.active_sales_filials || '[2]'),
    ignored_filials: JSON.parse(row.ignored_filials || '[]'),
    allow_pack_tolerance: Boolean(row.allow_pack_tolerance),
  };
}

/**
 * Remove com seguranca todos os calculos analiticos, runs e resultados de um cliente
 * ou de todas as execucoes locais, preservando a base oficial da CMED intacta.
 * Essencial quando o usuario muda o IP ou banco de dados MariaDB para outro cliente.
 */
export function clearClientCalculations(clientCode = null) {
  const db = getAnalyticsDb();
  db.exec('BEGIN');
  try {
    let runIds = [];
    if (clientCode) {
      const runs = db.prepare('SELECT id FROM engine_runs WHERE client_code = ?').all(clientCode);
      runIds = runs.map((r) => r.id);
    } else {
      const runs = db.prepare('SELECT id FROM engine_runs').all();
      runIds = runs.map((r) => r.id);
    }

    if (runIds.length > 0) {
      const placeholders = runIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM engine_sku_results WHERE run_id IN (${placeholders})`).run(...runIds);
      db.prepare(`DELETE FROM engine_remanejamento WHERE run_id IN (${placeholders})`).run(...runIds);
      db.prepare(`DELETE FROM engine_molecule_summary WHERE run_id IN (${placeholders})`).run(...runIds);
      db.prepare(`DELETE FROM engine_runs WHERE id IN (${placeholders})`).run(...runIds);
    }

    if (clientCode) {
      db.prepare('DELETE FROM pbm_audit_rows WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM pbm_program_rules WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM molecule_de_para WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM client_filial_policies WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM client_sku_suspensions WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM client_group_coverage_config WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM budget_monthly_summary WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM budget_filial_summary WHERE client_code = ?').run(clientCode);
      db.prepare('DELETE FROM engine_run_meta WHERE client_code = ?').run(clientCode);
      try {
        db.prepare('DELETE FROM motor_transferencia_itens WHERE transferencia_id IN (SELECT id FROM motor_transferencias WHERE client_code = ?)').run(clientCode);
        db.prepare('DELETE FROM motor_transferencias WHERE client_code = ?').run(clientCode);
      } catch {}
    } else {
      db.prepare('DELETE FROM pbm_audit_rows').run();
      db.prepare('DELETE FROM pbm_program_rules').run();
      db.prepare('DELETE FROM molecule_de_para').run();
      db.prepare('DELETE FROM client_filial_policies').run();
      db.prepare('DELETE FROM client_sku_suspensions').run();
      db.prepare('DELETE FROM client_group_coverage_config').run();
      db.prepare('DELETE FROM budget_monthly_summary').run();
      db.prepare('DELETE FROM budget_filial_summary').run();
      db.prepare('DELETE FROM engine_run_meta').run();
      try {
        db.prepare('DELETE FROM motor_transferencia_itens').run();
        db.prepare('DELETE FROM motor_transferencias').run();
      } catch {}
    }
    db.exec('COMMIT');
    return { ok: true, clearedRuns: runIds.length };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Política de retenção automática: Mantém as N últimas rodadas (padrão 2)
 * e expurga execuções antigas de engine_sku_results para evitar inchaço do SQLite.
 */
export function pruneOldEngineRuns(clientCode, keepCount = 2) {
  const db = getAnalyticsDb();
  try {
    const runsToKeep = db.prepare(`
      SELECT id FROM engine_runs
      WHERE client_code = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(clientCode, keepCount);

    if (!runsToKeep || runsToKeep.length === 0) return { deletedRuns: 0 };
    const keepIds = runsToKeep.map((r) => r.id);
    const placeholders = keepIds.map(() => '?').join(',');

    const runsToDelete = db.prepare(`
      SELECT id FROM engine_runs
      WHERE client_code = ? AND id NOT IN (${placeholders})
    `).all(clientCode, ...keepIds);

    if (runsToDelete.length === 0) return { deletedRuns: 0 };

    const delIds = runsToDelete.map((r) => r.id);
    const delPlaceholders = delIds.map(() => '?').join(',');

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`DELETE FROM engine_sku_results WHERE run_id IN (${delPlaceholders})`).run(...delIds);
      db.prepare(`DELETE FROM engine_remanejamento WHERE run_id IN (${delPlaceholders})`).run(...delIds);
      db.prepare(`DELETE FROM engine_molecule_summary WHERE run_id IN (${delPlaceholders})`).run(...delIds);
      db.prepare(`DELETE FROM engine_runs WHERE id IN (${delPlaceholders})`).run(...delIds);
      db.exec('COMMIT');
      console.log(`[RETENTION] Expurgo automático para ${clientCode}: ${delIds.length} rodadas antigas eliminadas (${delIds.join(', ')}).`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    return { deletedRuns: delIds.length, prunedIds: delIds };
  } catch (err) {
    console.warn('[RETENTION] Aviso ao expurgar rodadas antigas:', err.message);
    return { deletedRuns: 0, error: err.message };
  }
}

/**
 * Retorna as configuracoes de dias de estoque min/max por grupo e curva para um cliente
 */
export function getGroupCoverageConfigs(clientCode) {
  const db = getAnalyticsDb();
  return db
    .prepare('SELECT * FROM client_group_coverage_config WHERE client_code = ? ORDER BY total_produtos DESC, grupo_nome ASC')
    .all(clientCode);
}

/**
 * Salva/atualiza em lote as configuracoes de dias de estoque min/max por grupo
 */
export function saveGroupCoverageConfigs(clientCode, configs) {
  const db = getAnalyticsDb();
  db.exec('BEGIN');
  try {
    const upsert = db.prepare(`
      INSERT INTO client_group_coverage_config (
        client_code, grupo_id, grupo_nome, codigo, desc_arvore, grupo_pai_nome, grupo_filho_nome, macro_categoria, total_produtos,
        dias_min_a, dias_max_a, dias_min_b, dias_max_b, dias_min_c, dias_max_c, dias_min_d, dias_max_d,
        source, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(client_code, grupo_id) DO UPDATE SET
        grupo_nome = excluded.grupo_nome,
        codigo = COALESCE(excluded.codigo, client_group_coverage_config.codigo),
        desc_arvore = COALESCE(excluded.desc_arvore, client_group_coverage_config.desc_arvore),
        grupo_pai_nome = COALESCE(excluded.grupo_pai_nome, client_group_coverage_config.grupo_pai_nome),
        grupo_filho_nome = COALESCE(excluded.grupo_filho_nome, client_group_coverage_config.grupo_filho_nome),
        macro_categoria = excluded.macro_categoria,
        total_produtos = excluded.total_produtos,
        dias_min_a = excluded.dias_min_a,
        dias_max_a = excluded.dias_max_a,
        dias_min_b = excluded.dias_min_b,
        dias_max_b = excluded.dias_max_b,
        dias_min_c = excluded.dias_min_c,
        dias_max_c = excluded.dias_max_c,
        dias_min_d = excluded.dias_min_d,
        dias_max_d = excluded.dias_max_d,
        source = excluded.source,
        updated_at = datetime('now', 'localtime')
    `);

    for (const c of configs) {
      upsert.run(
        clientCode,
        Number(c.grupo_id),
        c.grupo_nome || `Grupo ${c.grupo_id}`,
        c.codigo || '',
        c.desc_arvore || '',
        c.grupo_pai_nome || 'OUTROS',
        c.grupo_filho_nome || c.grupo_nome || 'OUTROS',
        c.macro_categoria || 'OUTROS',
        Number(c.total_produtos || 0),
        Number(c.dias_min_a ?? 3),
        Number(c.dias_max_a ?? 12),
        Number(c.dias_min_b ?? 7),
        Number(c.dias_max_b ?? 15),
        Number(c.dias_min_c ?? 10),
        Number(c.dias_max_c ?? 20),
        Number(c.dias_min_d ?? 0),
        Number(c.dias_max_d ?? 0),
        c.source || 'CUSTOM'
      );
    }
    db.exec('COMMIT');
    return { ok: true, count: configs.length };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Marca ou desmarca um SKU como descartado para a cotação ativa
 */
export function dismissSku(clientCode, filialId, produtoId, dismissed = 1) {
  const db = getAnalyticsDb();
  const latest = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get(clientCode);
  if (latest) {
    db.prepare('UPDATE engine_sku_results SET dismissed = ? WHERE run_id = ? AND filial_id = ? AND produto_id = ?')
      .run(dismissed ? 1 : 0, latest.id, filialId, produtoId);
  }
}

/**
 * Retorna a árvore hierárquica de grupos do Linx BIG com consolidação de compras da última execução
 */
export function getGroupsTree(runId, filialId = null) {
  const db = getAnalyticsDb();
  let sql = `
    SELECT 
      COALESCE(grupo_pai_nome, 'OUTROS') AS pai,
      COALESCE(grupo_filho_nome, grupo_nome, 'OUTROS') AS filho,
      grupo_id,
      COUNT(*) AS total_skus,
      SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN 1 ELSE 0 END) AS buy_skus,
      ROUND(SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN sugestao_compra_un ELSE 0 END), 0) AS buy_un,
      ROUND(SUM(CASE WHEN sugestao_compra_un > 0 AND dismissed = 0 THEN sugestao_compra_rs ELSE 0 END), 2) AS buy_rs
    FROM engine_sku_results
    WHERE run_id = ?
  `;
  const params = [runId];
  if (filialId && filialId !== 'all' && Number(filialId) > 0) {
    sql += ' AND filial_id = ?';
    params.push(Number(filialId));
  }
  sql += ' GROUP BY pai, filho, grupo_id ORDER BY pai ASC, buy_rs DESC';
  const rows = db.prepare(sql).all(...params);
  
  const tree = {};
  for (const r of rows) {
    if (!tree[r.pai]) {
      tree[r.pai] = {
        name: r.pai,
        nome: r.pai,
        totalSkus: 0,
        skusCount: 0,
        buySkus: 0,
        buyUn: 0,
        sugestaoUn: 0,
        buyRs: 0,
        sugestaoRs: 0,
        children: []
      };
    }
    tree[r.pai].totalSkus += r.total_skus;
    tree[r.pai].skusCount += r.total_skus;
    tree[r.pai].buySkus += r.buy_skus;
    tree[r.pai].buyUn += r.buy_un;
    tree[r.pai].sugestaoUn += r.buy_un;
    tree[r.pai].buyRs = Math.round((tree[r.pai].buyRs + r.buy_rs) * 100) / 100;
    tree[r.pai].sugestaoRs = tree[r.pai].buyRs;
    tree[r.pai].children.push({
      grupoId: r.grupo_id,
      codigo: r.grupo_id,
      name: r.filho,
      nome: r.filho,
      totalSkus: r.total_skus,
      skusCount: r.total_skus,
      buySkus: r.buy_skus,
      buyUn: r.buy_un,
      sugestaoUn: r.buy_un,
      buyRs: r.buy_rs,
      sugestaoRs: r.buy_rs
    });
  }
  return Object.values(tree).sort((a, b) => b.buyRs - a.buyRs);
}

/**
 * Registra suspensão de compras exclusiva no Motor Inteligente (REV-011)
 * ou sincronizada com Linx BIG.
 */
export function recordSkuSuspension(clientCode, filialId, produtoId, { descricao = '', motivo = '', days = 30, origem = 'MOTOR_ONLY', moleculeKey = null, gatilhoCobertura = 7.0 } = {}) {
  const db = getAnalyticsDb();
  const endDate = new Date(Date.now() + Number(days) * 86400000).toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO client_sku_suspensions (client_code, filial_id, produto_id, descricao, motivo, dias_bloqueio, data_fim_bloqueio, origem, molecule_key, gatilho_cobertura_limite, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(client_code, filial_id, produto_id) DO UPDATE SET
      descricao = excluded.descricao,
      motivo = excluded.motivo,
      dias_bloqueio = excluded.dias_bloqueio,
      data_fim_bloqueio = excluded.data_fim_bloqueio,
      origem = excluded.origem,
      molecule_key = COALESCE(excluded.molecule_key, client_sku_suspensions.molecule_key),
      gatilho_cobertura_limite = excluded.gatilho_cobertura_limite,
      created_at = datetime('now', 'localtime')
  `).run(clientCode, filialId, produtoId, descricao, motivo, days, endDate, origem, moleculeKey, gatilhoCobertura);

  dismissSku(clientCode, filialId, produtoId, 1);
  return { ok: true, endDate };
}

/**
 * Remove suspensão de compra no Motor Inteligente
 */
export function removeSkuSuspension(clientCode, filialId, produtoId) {
  const db = getAnalyticsDb();
  db.prepare('DELETE FROM client_sku_suspensions WHERE client_code = ? AND filial_id = ? AND produto_id = ?')
    .run(clientCode, filialId, produtoId);
  dismissSku(clientCode, filialId, produtoId, 0);
  return { ok: true };
}

/**
 * Retorna suspensões ativas no Motor
 */
export function getActiveSkuSuspensions(clientCode, filialId = null) {
  const db = getAnalyticsDb();
  const today = new Date().toISOString().split('T')[0];
  if (filialId) {
    return db.prepare('SELECT * FROM client_sku_suspensions WHERE client_code = ? AND filial_id = ? AND data_fim_bloqueio >= ? ORDER BY created_at DESC')
      .all(clientCode, filialId, today);
  }
  return db.prepare('SELECT * FROM client_sku_suspensions WHERE client_code = ? AND data_fim_bloqueio >= ? ORDER BY created_at DESC')
    .all(clientCode, today);
}

/**
 * Retorna políticas configuradas para as filiais do cliente
 */
export function getFilialPolicies(clientCode = 'bandeirante') {
  const db = getAnalyticsDb();
  return db.prepare('SELECT * FROM client_filial_policies WHERE client_code = ? ORDER BY filial_id').all(clientCode || 'bandeirante');
}

/**
 * Salva ou atualiza política de maturidade/carência para uma filial
 */
export function upsertFilialPolicy(clientCodeOrPolicy, maybePolicy = null) {
  const db = getAnalyticsDb();
  let clientCode;
  let policy;
  if (maybePolicy) {
    clientCode = clientCodeOrPolicy;
    policy = maybePolicy;
  } else {
    policy = clientCodeOrPolicy;
    clientCode = policy?.client_code || 'bandeirante';
  }
  if (!policy || policy.filial_id === undefined) {
    throw new Error('Policy invalida ou filial_id nao informado em upsertFilialPolicy');
  }
  db.prepare(`
    INSERT INTO client_filial_policies (
      client_code, filial_id, nome_loja, nome_reduz, data_inauguracao, dias_carencia, bloquear_doacao_remanejamento, tipo_reposicao, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(client_code, filial_id) DO UPDATE SET
      nome_loja = excluded.nome_loja,
      nome_reduz = excluded.nome_reduz,
      data_inauguracao = excluded.data_inauguracao,
      dias_carencia = excluded.dias_carencia,
      bloquear_doacao_remanejamento = excluded.bloquear_doacao_remanejamento,
      tipo_reposicao = excluded.tipo_reposicao,
      updated_at = datetime('now', 'localtime')
  `).run(
    clientCode,
    Number(policy.filial_id),
    policy.nome_loja || `Loja ${policy.filial_id}`,
    policy.nome_reduz || null,
    policy.data_inauguracao || null,
    Number(policy.dias_carencia ?? 90),
    policy.bloquear_doacao_remanejamento === false || policy.bloquear_doacao_remanejamento === 0 ? 0 : 1,
    policy.tipo_reposicao || 'sellout_1to1'
  );
  return db.prepare('SELECT * FROM client_filial_policies WHERE client_code = ? AND filial_id = ?').get(clientCode, Number(policy.filial_id));
}

/**
 * Cria uma Ordem de Transferência Interna no Motor (SQLite)
 */
export function createMotorTransfer(clientCode, runIdOrOpts = {}, maybeOpts = null) {
  const db = getAnalyticsDb();
  let runId = 0;
  let opts = {};
  if (typeof runIdOrOpts === 'number' || (typeof runIdOrOpts === 'string' && !isNaN(Number(runIdOrOpts)))) {
    runId = Number(runIdOrOpts);
    opts = maybeOpts || {};
  } else {
    opts = runIdOrOpts || {};
    runId = opts.runId || opts.run_id || 0;
  }

  const filialOrigem = Number(opts.filialOrigem || opts.filial_origem);
  const filialOrigemNome = opts.filialOrigemNome || opts.filial_origem_nome;
  const filialDestino = Number(opts.filialDestino || opts.filial_destino);
  const filialDestinoNome = opts.filialDestinoNome || opts.filial_destino_nome;
  const itens = opts.itens || opts.items || [];
  const observacao = opts.observacao || '';
  const forceNew = Boolean(opts.forceNew);

  if (!filialOrigem || !filialDestino || !Array.isArray(itens) || itens.length === 0) {
    throw new Error('filialOrigem, filialDestino e itens são obrigatórios para emissão de transferência.');
  }

  db.exec('BEGIN TRANSACTION');
  try {
    // REV-029: Consolidação inteligente por rota (Origem ➔ Destino)
    // Se já existir uma guia PENDENTE_SEPARACAO para este par de lojas, agrupa nela em vez de fragmentar
    let transf = null;
    if (!forceNew) {
      transf = db.prepare(`
        SELECT * FROM motor_transferencias
        WHERE client_code = ? AND filial_origem = ? AND filial_destino = ? AND status = 'PENDENTE_SEPARACAO'
        ORDER BY id ASC LIMIT 1
      `).get(clientCode, filialOrigem, filialDestino);
    }

    let transfId;
    let codigo;
    let isConsolidated = false;

    if (transf) {
      transfId = transf.id;
      codigo = transf.codigo_transferencia;
      isConsolidated = true;
    } else {
      const year = new Date().getFullYear();
      const countRow = db.prepare('SELECT COUNT(*) as count FROM motor_transferencias WHERE client_code = ?').get(clientCode);
      const nextSeq = String((countRow?.count || 0) + 1).padStart(4, '0');
      codigo = `TRF-${year}-${nextSeq}`;
      const dataEmissao = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const res = db.prepare(`
        INSERT INTO motor_transferencias (
          client_code, codigo_transferencia, run_id, filial_origem, filial_origem_nome,
          filial_destino, filial_destino_nome, status, total_itens, total_unidades, valor_total_rs,
          data_emissao, observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE_SEPARACAO', 0, 0, 0, ?, ?)
      `).run(
        clientCode, codigo, Number(runId || 0), filialOrigem, filialOrigemNome || `Loja ${filialOrigem}`,
        filialDestino, filialDestinoNome || `Loja ${filialDestino}`,
        dataEmissao, observacao
      );
      transfId = res.lastInsertRowid;
    }

    const selItem = db.prepare('SELECT id, qtd_solicitada, custo_unit FROM motor_transferencia_itens WHERE transferencia_id = ? AND produto_id = ?');
    const insItem = db.prepare(`
      INSERT INTO motor_transferencia_itens (
        transferencia_id, produto_id, barras, descricao, labora, qtd_solicitada, custo_unit, valor_total, motivo_decisao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updItem = db.prepare(`
      UPDATE motor_transferencia_itens
      SET qtd_solicitada = qtd_solicitada + ?,
          valor_total = ROUND((qtd_solicitada + ?) * custo_unit, 2),
          motivo_decisao = ?
      WHERE id = ?
    `);

    for (const it of itens) {
      const pId = Number(it.produto_id || it.produtoId);
      const qtd = Number(it.qtd_solicitada || it.qtdSugerida || it.qtd_sugerida || it.qtd || 0);
      const custo = Number(it.custo_unit || it.custoUnit || it.custo || 0);
      const motivo = it.motivo || it.motivo_decisao || 'Remanejamento sugerido pelo Motor';

      if (qtd <= 0 || !pId) continue;

      const existing = selItem.get(transfId, pId);
      if (existing) {
        updItem.run(qtd, qtd, motivo, existing.id);
      } else {
        insItem.run(
          transfId,
          pId,
          it.barras || '',
          it.descricao || '',
          it.labora || '',
          qtd,
          custo,
          Number((qtd * custo).toFixed(2)),
          motivo
        );
      }
    }

    // Recalcular totais consolidados da guia
    const agg = db.prepare(`
      SELECT 
        COUNT(DISTINCT produto_id) as total_itens,
        COALESCE(SUM(qtd_solicitada), 0) as total_unidades,
        COALESCE(SUM(valor_total), 0) as valor_total_rs
      FROM motor_transferencia_itens
      WHERE transferencia_id = ?
    `).get(transfId);

    const totalItens = Number(agg?.total_itens || 0);
    const totalUnidades = Number(agg?.total_unidades || 0);
    const valorTotalRs = Number((agg?.valor_total_rs || 0).toFixed(2));

    let updatedObs = transf ? (transf.observacao || '') : observacao;
    if (isConsolidated && observacao && !updatedObs.includes(observacao)) {
      updatedObs = `${updatedObs} | ${observacao}`.slice(0, 500);
    }

    db.prepare(`
      UPDATE motor_transferencias
      SET total_itens = ?, total_unidades = ?, valor_total_rs = ?, observacao = ?
      WHERE id = ?
    `).run(totalItens, totalUnidades, valorTotalRs, updatedObs, transfId);

    db.exec('COMMIT');
    return {
      ok: true,
      transferenciaId: transfId,
      codigoTransferencia: codigo,
      totalItens,
      totalUnidades,
      valorTotalRs,
      consolidated: isConsolidated
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Consolida todas as transferências abertas (PENDENTE_SEPARACAO) que pertencem à mesma rota
 */
export function consolidateOpenTransfers(clientCode) {
  const db = getAnalyticsDb();
  const openTransfers = db.prepare(`
    SELECT * FROM motor_transferencias
    WHERE client_code = ? AND status = 'PENDENTE_SEPARACAO'
    ORDER BY filial_origem, filial_destino, id ASC
  `).all(clientCode);

  if (openTransfers.length <= 1) return { ok: true, consolidatedCount: 0, openCount: openTransfers.length };

  const groups = new Map();
  for (const t of openTransfers) {
    const key = `${t.filial_origem}_${t.filial_destino}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  let consolidatedCount = 0;
  db.exec('BEGIN TRANSACTION');
  try {
    for (const [key, trfs] of groups.entries()) {
      if (trfs.length <= 1) continue;
      const master = trfs[0];
      const secondaries = trfs.slice(1);

      for (const sec of secondaries) {
        const secItems = db.prepare('SELECT * FROM motor_transferencia_itens WHERE transferencia_id = ?').all(sec.id);
        for (const item of secItems) {
          const existing = db.prepare('SELECT id, qtd_solicitada, custo_unit FROM motor_transferencia_itens WHERE transferencia_id = ? AND produto_id = ?').get(master.id, item.produto_id);
          if (existing) {
            const newQtd = existing.qtd_solicitada + item.qtd_solicitada;
            const newTot = Number((newQtd * existing.custo_unit).toFixed(2));
            db.prepare('UPDATE motor_transferencia_itens SET qtd_solicitada = ?, valor_total = ? WHERE id = ?').run(newQtd, newTot, existing.id);
          } else {
            db.prepare(`
              INSERT INTO motor_transferencia_itens (
                transferencia_id, produto_id, barras, descricao, labora, qtd_solicitada, custo_unit, valor_total, motivo_decisao
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              master.id, item.produto_id, item.barras, item.descricao, item.labora,
              item.qtd_solicitada, item.custo_unit, item.valor_total, item.motivo_decisao
            );
          }
        }
        db.prepare('DELETE FROM motor_transferencia_itens WHERE transferencia_id = ?').run(sec.id);
        db.prepare('DELETE FROM motor_transferencias WHERE id = ?').run(sec.id);
        consolidatedCount++;
      }

      const agg = db.prepare(`
        SELECT COUNT(DISTINCT produto_id) as total_itens,
               COALESCE(SUM(qtd_solicitada), 0) as total_unidades,
               COALESCE(SUM(valor_total), 0) as valor_total_rs
        FROM motor_transferencia_itens WHERE transferencia_id = ?
      `).get(master.id);

      db.prepare(`
        UPDATE motor_transferencias
        SET total_itens = ?, total_unidades = ?, valor_total_rs = ?,
            observacao = observacao || ' [Consolidado]'
        WHERE id = ?
      `).run(agg?.total_itens || 0, agg?.total_unidades || 0, Number((agg?.valor_total_rs || 0).toFixed(2)), master.id);
    }

    db.exec('COMMIT');
    return { ok: true, consolidatedCount };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Cancela uma transferência e reverte o estoque/trânsito no motor
 */
export function cancelMotorTransfer(clientCode, transferId) {
  const db = getAnalyticsDb();
  const trf = db.prepare('SELECT * FROM motor_transferencias WHERE id = ? AND client_code = ?').get(Number(transferId), clientCode);
  if (!trf) throw new Error('Transferência não encontrada.');
  if (trf.status === 'RECEBIDA') throw new Error('Não é possível cancelar uma transferência já recebida na filial destino.');

  db.exec('BEGIN TRANSACTION');
  try {
    const items = db.prepare('SELECT * FROM motor_transferencia_itens WHERE transferencia_id = ?').all(Number(transferId));

    if (trf.run_id) {
      const revDest = db.prepare(`
        UPDATE engine_sku_results
        SET transito_remanejamento = MAX(0, transito_remanejamento - ?),
            remanejamento_entrada = MAX(0, remanejamento_entrada - ?),
            sugestao_compra_un = sugestao_compra_un + ?,
            sugestao_compra_rs = ROUND((sugestao_compra_un + ?) * custo_unit, 2)
        WHERE run_id = ? AND filial_id = ? AND produto_id = ?
      `);
      const revOrig = db.prepare(`
        UPDATE engine_sku_results
        SET remanejamento_saida = MAX(0, remanejamento_saida - ?)
        WHERE run_id = ? AND filial_id = ? AND produto_id = ?
      `);
      for (const it of items) {
        revDest.run(it.qtd_solicitada, it.qtd_solicitada, it.qtd_solicitada, it.qtd_solicitada, trf.run_id, trf.filial_destino, it.produto_id);
        revOrig.run(it.qtd_solicitada, trf.run_id, trf.filial_origem, it.produto_id);
      }
    }

    db.prepare("UPDATE motor_transferencias SET status = 'CANCELADA' WHERE id = ?").run(Number(transferId));
    db.exec('COMMIT');
    return { ok: true, transferId: Number(transferId), status: 'CANCELADA' };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Retorna as transferências do motor
 */
export function getMotorTransfers(clientCode, status = null) {
  const db = getAnalyticsDb();
  let sql = 'SELECT * FROM motor_transferencias WHERE client_code = ?';
  const params = [clientCode];
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY id DESC';
  const transfers = db.prepare(sql).all(...params);

  const getItens = db.prepare('SELECT * FROM motor_transferencia_itens WHERE transferencia_id = ?');
  return transfers.map((t) => ({
    ...t,
    itens: getItens.all(t.id),
  }));
}

/**
 * Atualiza status da transferência (ex: 'EM_TRANSITO', 'RECEBIDA', 'CANCELADA')
 */
export function updateMotorTransferStatus(clientCode, transferId, newStatus) {
  const db = getAnalyticsDb();
  const dataRecebimento = newStatus === 'RECEBIDA' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null;
  db.prepare(`
    UPDATE motor_transferencias
    SET status = ?, data_recebimento = COALESCE(?, data_recebimento)
    WHERE id = ? AND client_code = ?
  `).run(newStatus, dataRecebimento, Number(transferId), clientCode);
  return { ok: true, transferId, status: newStatus };
}

/**
 * Retorna itens pendentes em trânsito de transferências abertas
 * para proteger a loja destino contra recompra e a loja origem contra nova doação.
 */
export function getPendingTransfersItemsMap(clientCode) {
  const db = getAnalyticsDb();
  const rows = db.prepare(`
    SELECT t.filial_origem, t.filial_destino, ti.produto_id, ti.qtd_solicitada
    FROM motor_transferencia_itens ti
    JOIN motor_transferencias t ON t.id = ti.transferencia_id
    WHERE t.client_code = ? AND t.status IN ('PENDENTE_SEPARACAO', 'EM_TRANSITO')
  `).all(clientCode);

  const incomingMap = new Map(); // Destino: filial_destino|produto_id -> qtd
  const outgoingMap = new Map(); // Origem: filial_origem|produto_id -> qtd
  for (const r of rows) {
    const incKey = `${r.filial_destino}|${r.produto_id}`;
    incomingMap.set(incKey, (incomingMap.get(incKey) || 0) + Number(r.qtd_solicitada));

    const outKey = `${r.filial_origem}|${r.produto_id}`;
    outgoingMap.set(outKey, (outgoingMap.get(outKey) || 0) + Number(r.qtd_solicitada));
  }
  return { incomingMap, outgoingMap };
}

/**
 * Salva ou atualiza o resumo mensal da dotação orçamentária e governança de compras.
 */
export function upsertBudgetSummary(clientCode, summary) {
  const db = getAnalyticsDb();
  db.prepare(`
    INSERT INTO budget_monthly_summary (
      client_code, reference_month, reference_date,
      cmv_mes_anterior, score_mes_anterior, score_mes_atual, peso_sabado, peso_domingo,
      dotacao_inicial, var_faturamento_pct, dotacao_ajustada, consumido_compras_rs,
      faturamento_liquido_mes, compra_x_venda_pct,
      compras_sem_demanda_rs, compras_sem_demanda_pct,
      compras_excesso_rs, compras_excesso_pct,
      compras_nao_otimizadas_rs, compras_nao_otimizadas_pct,
      iec_eficiencia_pct, remanejamento_economizado_rs, unoptimized_products_json, dimensions_json, filiais_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(client_code, reference_month) DO UPDATE SET
      reference_date = excluded.reference_date,
      cmv_mes_anterior = excluded.cmv_mes_anterior,
      score_mes_anterior = excluded.score_mes_anterior,
      score_mes_atual = excluded.score_mes_atual,
      peso_sabado = excluded.peso_sabado,
      peso_domingo = excluded.peso_domingo,
      dotacao_inicial = excluded.dotacao_inicial,
      var_faturamento_pct = excluded.var_faturamento_pct,
      dotacao_ajustada = excluded.dotacao_ajustada,
      consumido_compras_rs = excluded.consumido_compras_rs,
      faturamento_liquido_mes = excluded.faturamento_liquido_mes,
      compra_x_venda_pct = excluded.compra_x_venda_pct,
      compras_sem_demanda_rs = excluded.compras_sem_demanda_rs,
      compras_sem_demanda_pct = excluded.compras_sem_demanda_pct,
      compras_excesso_rs = excluded.compras_excesso_rs,
      compras_excesso_pct = excluded.compras_excesso_pct,
      compras_nao_otimizadas_rs = excluded.compras_nao_otimizadas_rs,
      compras_nao_otimizadas_pct = excluded.compras_nao_otimizadas_pct,
      iec_eficiencia_pct = excluded.iec_eficiencia_pct,
      remanejamento_economizado_rs = excluded.remanejamento_economizado_rs,
      unoptimized_products_json = excluded.unoptimized_products_json,
      dimensions_json = excluded.dimensions_json,
      filiais_json = excluded.filiais_json,
      created_at = datetime('now', 'localtime')
  `).run(
    clientCode,
    summary.reference_month,
    summary.reference_date,
    Number(summary.cmv_mes_anterior || 0),
    Number(summary.score_mes_anterior || 0),
    Number(summary.score_mes_atual || 0),
    Number(summary.peso_sabado || 1),
    Number(summary.peso_domingo || 1),
    Number(summary.dotacao_inicial || 0),
    Number(summary.var_faturamento_pct || 0),
    Number(summary.dotacao_ajustada || 0),
    Number(summary.consumido_compras_rs || 0),
    Number(summary.faturamento_liquido_mes || 0),
    Number(summary.compra_x_venda_pct || 0),
    Number(summary.compras_sem_demanda_rs || 0),
    Number(summary.compras_sem_demanda_pct || 0),
    Number(summary.compras_excesso_rs || 0),
    Number(summary.compras_excesso_pct || 0),
    Number(summary.compras_nao_otimizadas_rs || 0),
    Number(summary.compras_nao_otimizadas_pct || 0),
    Number(summary.iec_eficiencia_pct || 0),
    Number(summary.remanejamento_economizado_rs || 0),
    typeof summary.unoptimized_products_json === 'string' ? summary.unoptimized_products_json : JSON.stringify(summary.unoptimized_products || []),
    typeof summary.dimensions_json === 'string' ? summary.dimensions_json : JSON.stringify(summary.dimensions || []),
    typeof summary.filiais_json === 'string' ? summary.filiais_json : JSON.stringify(summary.filiais || [])
  );
  return { ok: true, referenceMonth: summary.reference_month };
}

/**
 * Recupera o resumo mensal mais recente da dotação orçamentária do cliente.
 */
export function getLatestBudgetSummary(clientCode) {
  const db = getAnalyticsDb();
  let row = db.prepare(`
    SELECT * FROM budget_monthly_summary
    WHERE client_code = ? AND dotacao_ajustada > 0
    ORDER BY reference_month DESC, id DESC
    LIMIT 1
  `).get(clientCode);

  if (!row) {
    row = db.prepare(`
      SELECT * FROM budget_monthly_summary
      WHERE client_code = ?
      ORDER BY reference_month DESC, id DESC
      LIMIT 1
    `).get(clientCode);
  }

  if (!row) return null;
  const dotacao = Number(row.dotacao_ajustada || 0);
  const consumido = Number(row.consumido_compras_rs || 0);
  const consumidoPct = dotacao > 0 ? Number(((consumido / dotacao) * 100).toFixed(2)) : 0;
  const saldoLivre = Math.max(0, Number((dotacao - consumido).toFixed(2)));
  return {
    ...row,
    consumido_pct: consumidoPct,
    saldo_livre_rs: saldoLivre,
    remanejamento_economizado_rs: Number(row.remanejamento_economizado_rs || 0),
    unoptimized_products: row.unoptimized_products_json ? JSON.parse(row.unoptimized_products_json) : [],
    dimensions: row.dimensions_json ? JSON.parse(row.dimensions_json) : [],
    filiais: row.filiais_json ? JSON.parse(row.filiais_json) : []
  };
}

/**
 * Recupera o resumo orçamentário específico de uma filial do SQLite (< 1ms).
 */
export function getFilialBudgetSummary(clientCode, filialId) {
  const db = getAnalyticsDb();
  const fId = Number(filialId);
  if (!fId) return null;
  const row = db.prepare(`
    SELECT * FROM budget_filial_summary
    WHERE client_code = ? AND filial_id = ?
    ORDER BY reference_month DESC, id DESC
    LIMIT 1
  `).get(clientCode, fId);
  if (!row) return null;
  try {
    const summary = JSON.parse(row.summary_json);
    return summary;
  } catch {
    return null;
  }
}

/**
 * Salva ou atualiza o resumo orçamentário de uma filial no SQLite.
 */
export function upsertFilialBudgetSummary(clientCode, filialId, summary) {
  const db = getAnalyticsDb();
  const fId = Number(filialId);
  if (!fId || !summary) return;
  db.prepare(`
    INSERT INTO budget_filial_summary (
      client_code, filial_id, reference_month, reference_date,
      dotacao_ajustada, consumido_compras_rs, saldo_livre_rs, consumido_pct,
      faturamento_liquido_mes, compra_x_venda_pct, compras_nao_otimizadas_rs, iec_eficiencia_pct,
      summary_json, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime')
    )
    ON CONFLICT(client_code, filial_id, reference_month) DO UPDATE SET
      reference_date = excluded.reference_date,
      dotacao_ajustada = excluded.dotacao_ajustada,
      consumido_compras_rs = excluded.consumido_compras_rs,
      saldo_livre_rs = excluded.saldo_livre_rs,
      consumido_pct = excluded.consumido_pct,
      faturamento_liquido_mes = excluded.faturamento_liquido_mes,
      compra_x_venda_pct = excluded.compra_x_venda_pct,
      compras_nao_otimizadas_rs = excluded.compras_nao_otimizadas_rs,
      iec_eficiencia_pct = excluded.iec_eficiencia_pct,
      summary_json = excluded.summary_json,
      updated_at = datetime('now', 'localtime')
  `).run(
    clientCode,
    fId,
    summary.reference_month || new Date().toISOString().slice(0, 7),
    summary.reference_date || new Date().toISOString().slice(0, 10),
    Number(summary.dotacao_ajustada || 0),
    Number(summary.consumido_compras_rs || 0),
    Number(summary.saldo_livre_rs || 0),
    Number(summary.consumido_pct || 0),
    Number(summary.faturamento_liquido_mes || 0),
    Number(summary.compra_x_venda_pct || 0),
    Number(summary.compras_nao_otimizadas_rs || 0),
    Number(summary.iec_eficiencia_pct || 0),
    JSON.stringify(summary)
  );
}

/**
 * Retorna todos os resumos de filiais para a tabela de desempenho por loja do OTB.
 */
export function getAllFilialBudgetSummaries(clientCode) {
  const db = getAnalyticsDb();
  const rows = db.prepare(`
    SELECT bfs.*, p.nome_loja, p.nome_reduz
    FROM budget_filial_summary bfs
    INNER JOIN client_filial_policies p ON p.client_code = bfs.client_code AND p.filial_id = bfs.filial_id
    WHERE bfs.client_code = ?
    ORDER BY bfs.filial_id ASC
  `).all(clientCode);

  const profile = getClientProfile(clientCode) || {};
  let activeSales = [];
  try {
    activeSales = typeof profile.active_sales_filials === 'string'
      ? JSON.parse(profile.active_sales_filials)
      : (Array.isArray(profile.active_sales_filials) ? profile.active_sales_filials : []);
  } catch {}

  const filtered = (activeSales && activeSales.length > 0)
    ? rows.filter(r => activeSales.includes(Number(r.filial_id)))
    : rows;

  return filtered.map(r => {
    let summary = {};
    try { summary = JSON.parse(r.summary_json); } catch {}
    return {
      filial_id: r.filial_id,
      nome_loja: r.nome_loja || summary.nome_loja || `Filial ${r.filial_id}`,
      nome_reduz: r.nome_reduz || summary.nome_reduz || `L${r.filial_id}`,
      reference_month: r.reference_month,
      reference_date: r.reference_date,
      dotacao_ajustada: r.dotacao_ajustada,
      consumido_compras_rs: r.consumido_compras_rs,
      saldo_livre_rs: r.saldo_livre_rs,
      consumido_pct: r.consumido_pct,
      faturamento_liquido_mes: r.faturamento_liquido_mes,
      compra_x_venda_pct: r.compra_x_venda_pct,
      compras_nao_otimizadas_rs: r.compras_nao_otimizadas_rs,
      iec_eficiencia_pct: r.iec_eficiencia_pct
    };
  });
}

/**
 * Recupera os metadados calculados da rodada (macros, laboratorios, kpis de filiais)
 * direto de SQLite sem reprocessar 150 mil registros (< 1ms).
 */
export function getRunOverviewMeta(runId) {
  const db = getAnalyticsDb();
  if (!runId) return null;
  const row = db.prepare('SELECT filters_meta_json, filial_kpis_json FROM engine_run_meta WHERE run_id = ?').get(runId);
  if (!row) return null;
  try {
    return {
      filtersMeta: JSON.parse(row.filters_meta_json),
      filialKpis: JSON.parse(row.filial_kpis_json)
    };
  } catch {
    return null;
  }
}

/**
 * Salva os metadados agregados da rodada em SQLite para boot instantâneo no /api/overview.
 */
export function saveRunOverviewMeta(runId, clientCode, filtersMeta, filialKpis) {
  const db = getAnalyticsDb();
  if (!runId) return;
  db.prepare(`
    INSERT INTO engine_run_meta (run_id, client_code, filters_meta_json, filial_kpis_json, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(run_id) DO UPDATE SET
      filters_meta_json = excluded.filters_meta_json,
      filial_kpis_json = excluded.filial_kpis_json,
      updated_at = datetime('now', 'localtime')
  `).run(runId, clientCode, JSON.stringify(filtersMeta), JSON.stringify(filialKpis));
}

// ========================================================
// OPERAÇÃO LOGÍSTICA (OL) & FABRICANTES COM PEDIDO MÍNIMO
// ========================================================

const DEFAULT_OL_FABRICANTES = [
  { fabricante_nome: 'EMS', pedido_minimo_rs: 3000, desconto_extra_pct: 12, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística EMS (Genéricos e Similares)' },
  { fabricante_nome: 'EUROFARMA', pedido_minimo_rs: 3500, desconto_extra_pct: 10, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Eurofarma' },
  { fabricante_nome: 'NEO QUIMICA', pedido_minimo_rs: 2500, desconto_extra_pct: 12, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Neo Química' },
  { fabricante_nome: 'HYPERA', pedido_minimo_rs: 4000, desconto_extra_pct: 10, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Hypera Pharma' },
  { fabricante_nome: 'CIMED', pedido_minimo_rs: 2000, desconto_extra_pct: 15, prazo_medio_dias: 45, lead_time_dias: 10, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Cimed' },
  { fabricante_nome: 'ACHE', pedido_minimo_rs: 3500, desconto_extra_pct: 10, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Aché Laboratórios' },
  { fabricante_nome: 'SANOFI', pedido_minimo_rs: 5000, desconto_extra_pct: 8, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Sanofi Medley' },
  { fabricante_nome: 'NOVARTIS', pedido_minimo_rs: 5000, desconto_extra_pct: 8, prazo_medio_dias: 45, lead_time_dias: 14, horizonte_cobertura_dias: 21, observacao: 'Operação Logística Novartis / Sandoz' },
  { fabricante_nome: 'NESTLE', pedido_minimo_rs: 2500, desconto_extra_pct: 7, prazo_medio_dias: 30, lead_time_dias: 10, horizonte_cobertura_dias: 15, observacao: 'Nutrição infantil e leites especiais' },
  { fabricante_nome: 'DANONE', pedido_minimo_rs: 2000, desconto_extra_pct: 7, prazo_medio_dias: 30, lead_time_dias: 10, horizonte_cobertura_dias: 15, observacao: 'Nutrição médica e infantil (Aptamil/Milnutri)' },
  { fabricante_nome: 'PROCTER & GAMBLE', pedido_minimo_rs: 3000, desconto_extra_pct: 9, prazo_medio_dias: 30, lead_time_dias: 12, horizonte_cobertura_dias: 21, observacao: 'Higiene e cuidados pessoais (Pampers/Gillette/Oral-B)' },
  { fabricante_nome: 'JOHNSON & JOHNSON', pedido_minimo_rs: 3000, desconto_extra_pct: 8, prazo_medio_dias: 30, lead_time_dias: 12, horizonte_cobertura_dias: 21, observacao: 'Linha Baby e HPC' },
];

export function getOlFabricantes(clientCode) {
  const db = getAnalyticsDb();
  let rows = db.prepare('SELECT * FROM ol_fabricantes WHERE client_code = ? ORDER BY fabricante_nome ASC').all(clientCode);
  if (rows.length === 0) {
    seedDefaultOlFabricantes(clientCode);
    rows = db.prepare('SELECT * FROM ol_fabricantes WHERE client_code = ? ORDER BY fabricante_nome ASC').all(clientCode);
  }
  return rows;
}

export function seedDefaultOlFabricantes(clientCode) {
  const db = getAnalyticsDb();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO ol_fabricantes (
      client_code, fabricante_nome, tipo_canal, pedido_minimo_rs,
      desconto_extra_pct, prazo_medio_dias, lead_time_dias, horizonte_cobertura_dias,
      ativo, observacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  for (const fab of DEFAULT_OL_FABRICANTES) {
    ins.run(
      clientCode,
      fab.fabricante_nome,
      fab.tipo_canal || 'OL',
      fab.pedido_minimo_rs,
      fab.desconto_extra_pct,
      fab.prazo_medio_dias,
      fab.lead_time_dias,
      fab.horizonte_cobertura_dias,
      fab.observacao
    );
  }
}

export function upsertOlFabricante(clientCode, data) {
  const db = getAnalyticsDb();
  const stmt = db.prepare(`
    INSERT INTO ol_fabricantes (
      client_code, fabricante_nome, tipo_canal, pedido_minimo_rs,
      desconto_extra_pct, prazo_medio_dias, lead_time_dias, horizonte_cobertura_dias,
      ativo, observacao, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(client_code, fabricante_nome) DO UPDATE SET
      tipo_canal = excluded.tipo_canal,
      pedido_minimo_rs = excluded.pedido_minimo_rs,
      desconto_extra_pct = excluded.desconto_extra_pct,
      prazo_medio_dias = excluded.prazo_medio_dias,
      lead_time_dias = excluded.lead_time_dias,
      horizonte_cobertura_dias = excluded.horizonte_cobertura_dias,
      ativo = excluded.ativo,
      observacao = excluded.observacao,
      updated_at = datetime('now', 'localtime')
  `);
  stmt.run(
    clientCode,
    String(data.fabricante_nome || '').trim().toUpperCase(),
    data.tipo_canal || 'OL',
    Number(data.pedido_minimo_rs || 3000),
    Number(data.desconto_extra_pct || 10),
    Number(data.prazo_medio_dias || 45),
    Number(data.lead_time_dias || 14),
    Number(data.horizonte_cobertura_dias || 21),
    data.ativo !== undefined ? (data.ativo ? 1 : 0) : 1,
    data.observacao || null
  );
  return { ok: true };
}

export function recordBuyerLearning(clientCode, record) {
  const db = getAnalyticsDb();
  const rawPid = record.produto_id !== undefined && record.produto_id !== null ? Number(record.produto_id) : 0;
  const safeProdId = !isNaN(rawPid) ? rawPid : 0;

  const stmt = db.prepare(`
    INSERT INTO buyer_learning_log (
      client_code, filial_id, produto_id, principio_ativo_id, molecule_key,
      descricao, fabricante_origem, fabricante_proposto, tipo_evento,
      motivo, acao_futura, usuario, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  stmt.run(
    clientCode,
    Number(record.filial_id || 0),
    safeProdId,
    Number(record.principio_ativo_id || 0),
    record.molecule_key || null,
    record.descricao || '',
    record.fabricante_origem || null,
    record.fabricante_proposto || null,
    record.tipo_evento,
    record.motivo || null,
    record.acao_futura || 'LEMBRAR_PREFERENCIA',
    record.usuario || 'comprador'
  );
  return { ok: true };
}

export function getBuyerLearningLog(clientCode, limit = 100) {
  const db = getAnalyticsDb();
  return db
    .prepare('SELECT * FROM buyer_learning_log WHERE client_code = ? ORDER BY id DESC LIMIT ?')
    .all(clientCode, limit);
}

export function getBuyerActivePreferences(clientCode, filialId = null) {
  const db = getAnalyticsDb();
  let sql = 'SELECT * FROM buyer_learning_log WHERE client_code = ?';
  const params = [clientCode];
  if (filialId !== null && filialId !== undefined && filialId !== 'all') {
    sql += ' AND (filial_id = ? OR filial_id = 0)';
    params.push(Number(filialId));
  }
  sql += ' ORDER BY id DESC';
  return db.prepare(sql).all(...params);
}






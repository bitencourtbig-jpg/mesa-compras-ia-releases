import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Carrega variaveis do arquivo .env na raiz do projeto, se existir.
 */
export function loadProjectEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

const ALLOWED_START_KEYWORDS = new Set([
  'SELECT',
  'WITH',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'EXPLAIN',
]);

/**
 * Garante que a instrucao SQL seja estritamente somente leitura.
 * @param {string} sql
 */
export function assertReadOnlySql(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/#[^\r\n]*/g, ' ')
    .trim()
    .replace(/;+$/, '')
    .trim();

  if (!cleaned) {
    throw new Error('SQL vazio.');
  }

  const firstWordMatch = cleaned.match(/^([a-zA-Z]+)/);
  const firstWord = firstWordMatch ? firstWordMatch[1].toUpperCase() : '';
  if (!ALLOWED_START_KEYWORDS.has(firstWord)) {
    throw new Error(
      `Operacao bloqueada (${firstWord || 'DESCONHECIDA'}): cliente configurado apenas para leitura.`
    );
  }
}

function resolveDbConfig(cfg = null) {
  loadProjectEnv();
  let rawPass =
    cfg?.db_password !== undefined && cfg?.db_password !== ''
      ? cfg.db_password
      : cfg?.password !== undefined && cfg?.password !== ''
        ? cfg.password
        : process.env.DB_PASSWORD || '';

  // Se por acaso vier como mascara de exibicao, nunca envie as bolinhas como senha real
  if (rawPass === '••••••••' || rawPass === '********') {
    rawPass = process.env.DB_PASSWORD || '';
  }

  return {
    host: cfg?.db_host || cfg?.host || process.env.DB_HOST || '127.0.0.1',
    port: Number(cfg?.db_port || cfg?.port || process.env.DB_PORT || 3306),
    user: cfg?.db_user || cfg?.user || process.env.DB_USER || 'root',
    password: rawPass,
    database: cfg?.db_name || cfg?.database || process.env.DB_NAME || 'bandeirante',
    dateStrings: true,
    decimalNumbers: false,
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };
}

/**
 * Cria uma conexao MySQL somente leitura usando as variaveis do perfil ou .env.
 */
export async function createReadOnlyConnection(customConfig = null) {
  const connConfig = resolveDbConfig(customConfig);
  const conn = await mysql.createConnection(connConfig);

  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY');
  } catch {
    // Versoes antigas de MySQL/MariaDB podem ignorar; assertReadOnlySql valida queries no JS
  }

  return conn;
}

/**
 * Cria uma conexao de escrita controlada para o motor gravar cotações/pedidos no BIG.
 */
export async function createWriteConnection(customConfig = null) {
  const connConfig = resolveDbConfig(customConfig);
  const conn = await mysql.createConnection(connConfig);
  return conn;
}

/**
 * Executa uma query somente leitura e retorna as linhas com timeout de seguranca.
 * @param {mysql.Connection} conn
 * @param {string} sql
 * @param {unknown[]} [params]
 * @param {Object} [options]
 */
export async function runReadOnlyQuery(conn, sql, params = [], options = {}) {
  assertReadOnlySql(sql);
  const timeoutMs = Number(options.timeout || 45000);
  const [rows] = await conn.query({ sql, timeout: timeoutMs }, params);
  return rows;
}

/**
 * Testa conexao com o banco MariaDB do Linx BIG e retorna filiais encontradas,
 * latencia, tabelas essenciais validadas e diagnostico inteligente em caso de falha.
 */
export async function testBigConnection(customConfig) {
  const connConfig = resolveDbConfig(customConfig);
  const startTime = Date.now();
  let conn;

  try {
    conn = await mysql.createConnection(connConfig);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isAccessDenied = err.code === 'ER_ACCESS_DENIED_ERROR' || String(err.message).includes('Access denied for user');
    const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH';

    // Extrai o IP do cliente se reportado pelo MariaDB: 'user'@'138.97.39.230'
    const ipMatch = String(err.message).match(/user\s+'([^']+)'@'([^']+)'/i);
    const deniedUser = ipMatch ? ipMatch[1] : (connConfig.user || 'root');
    const clientIp = ipMatch ? ipMatch[2] : null;

    let diagnostic = null;
    if (isAccessDenied) {
      diagnostic = {
        type: 'ACCESS_DENIED',
        code: err.code || 'ER_ACCESS_DENIED_ERROR',
        title: 'Permissão de Acesso Remoto no MariaDB Rejeitada',
        user: deniedUser,
        clientIp,
        host: connConfig.host,
        port: connConfig.port,
        sqlGrantCommand: `GRANT ALL PRIVILEGES ON \`${connConfig.database || 'gerente'}\`.* TO '${deniedUser}'@'%' IDENTIFIED BY 'sua_senha_aqui'; FLUSH PRIVILEGES;`,
        sqlDedicatedUserCommand: `CREATE USER IF NOT EXISTS 'big_motor'@'%' IDENTIFIED BY 'SenhaForte123!';\nGRANT SELECT, INSERT, UPDATE ON \`${connConfig.database || 'gerente'}\`.* TO 'big_motor'@'%';\nFLUSH PRIVILEGES;`,
        explanation: `A conexão de rede com o servidor ${connConfig.host}:${connConfig.port} funcionou (porta aberta), mas o MariaDB rejeitou as credenciais para o usuário '${deniedUser}' vindo do IP público ${clientIp || 'do cliente'}. No MariaDB padrão, o usuário 'root' não tem permissão para conectar via IP externo ('%').`,
      };
    } else if (isTimeout) {
      diagnostic = {
        type: 'NETWORK_TIMEOUT',
        code: err.code || 'ETIMEDOUT',
        title: 'Tempo Limite de Conexão Esgotado (Porta 3306 Inacessível)',
        host: connConfig.host,
        port: connConfig.port,
        explanation: `Não foi possível alcançar o servidor ${connConfig.host} na porta ${connConfig.port}. Verifique se a porta 3306 está liberada no Firewall do Windows e no roteador da farmácia (NAT/Port Forwarding).`,
      };
    }

    const enhancedError = new Error(err.message);
    enhancedError.code = err.code;
    enhancedError.latencyMs = latencyMs;
    enhancedError.diagnostic = diagnostic;
    throw enhancedError;
  }

  try {
    const latencyMs = Date.now() - startTime;
    const [filiais] = await conn.query(
      "SELECT filial_id, nome, reduz, cgc, escritorio FROM filial WHERE apagado = 'N' ORDER BY filial_id"
    );
    const [dbInfo] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db_name');

    // Validação de presença das tabelas essenciais do Linx Farma BIG
    let verifiedTables = [];
    try {
      const [tableRows] = await conn.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('filial', 'produtos', 'estoque', 'itvendas', 'fornece', 'fabric')
      `);
      verifiedTables = tableRows.map((r) => r.table_name || r.TABLE_NAME);
    } catch {
      // Ignora erro de information_schema em bancos restritos
    }

    // Contagem de SKUs ativos para dimensionar o mix do banco
    let totalProducts = 0;
    try {
      const [prodCount] = await conn.query("SELECT COUNT(*) AS total FROM produtos WHERE apagado = 'N'");
      totalProducts = prodCount[0]?.total || 0;
    } catch {
      // Ignora caso tabela produtos tenha restrição de acesso
    }

    return {
      ok: true,
      latencyMs,
      version: dbInfo[0]?.version || 'Desconhecida',
      dbName: dbInfo[0]?.db_name || connConfig.database,
      verifiedTables,
      totalProducts,
      filiais: filiais.map((f) => ({
        filial_id: f.filial_id,
        nome: f.nome,
        reduz: f.reduz || f.nome.slice(0, 15),
        cgc: f.cgc || '',
        escritorio: f.escritorio === 'S',
      })),
    };
  } finally {
    await conn.end();
  }
}

/**
 * Consulta fornecedor na tabela nativa `fornece` do BIG pelo ID ou busca textual.
 * Se nenhum ID ou query for informado, retorna os 30 primeiros fornecedores ativos.
 */
export async function lookupBigSupplier(customConfig, { id, query = '' }) {
  const conn = await createReadOnlyConnection(customConfig);
  try {
    if (id !== undefined && id !== null && String(id).trim() !== '') {
      const numId = Number(id);
      const [rows] = await conn.query(
        "SELECT fornece_id, nome, fantasia, cgc, cidade, estado FROM fornece WHERE fornece_id = ? AND apagado = 'N' LIMIT 1",
        [numId]
      );
      if (rows.length > 0) {
        return { found: true, supplier: rows[0], suppliers: rows };
      }
      return { found: false, supplier: null, suppliers: [] };
    }

    if (query && query.trim().length >= 1) {
      const q = `%${query.trim().toUpperCase()}%`;
      const [rows] = await conn.query(
        "SELECT fornece_id, nome, fantasia, cgc, cidade, estado FROM fornece WHERE (nome LIKE ? OR fantasia LIKE ? OR cgc LIKE ?) AND apagado = 'N' ORDER BY nome LIMIT 25",
        [q, q, q]
      );
      return { found: rows.length > 0, suppliers: rows };
    }

    // Se nenhum filtro, lista os primeiros fornecedores ativos cadastrados
    const [rows] = await conn.query(
      "SELECT fornece_id, nome, fantasia, cgc, cidade, estado FROM fornece WHERE apagado = 'N' ORDER BY nome LIMIT 30"
    );
    return { found: rows.length > 0, suppliers: rows };
  } finally {
    await conn.end();
  }
}

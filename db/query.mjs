import fs from 'node:fs';
import { createReadOnlyConnection, runReadOnlyQuery } from './client.mjs';

function parseArgs(argv) {
  const opts = { format: 'tsv', file: null, sql: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') opts.format = 'json';
    else if (arg === '--md') opts.format = 'md';
    else if (arg === '--tsv') opts.format = 'tsv';
    else if (arg === '--file' && argv[i + 1]) {
      opts.file = argv[++i];
    } else if (!opts.sql) {
      opts.sql = arg;
    }
  }
  return opts;
}

function formatMarkdown(rows) {
  if (!rows.length) return '_Sem resultados (0 linhas)._';
  const cols = Object.keys(rows[0]);
  const esc = (v) =>
    v === null || v === undefined ? 'NULL' : String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const header = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${cols.map((c) => esc(r[c])).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function formatTsv(rows) {
  if (!rows.length) return '(0 rows)';
  const cols = Object.keys(rows[0]);
  const fmt = (v) => (v === null || v === undefined ? 'NULL' : String(v).replace(/[\t\r\n]/g, ' '));
  return [cols.join('\t'), ...rows.map((r) => cols.map((c) => fmt(r[c])).join('\t'))].join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sql = opts.file ? fs.readFileSync(opts.file, 'utf8') : opts.sql;
  if (!sql) {
    console.error('Uso: node db/query.mjs [--tsv|--md|--json] [--file caminho.sql | "SELECT ..."]');
    process.exit(1);
  }

  const conn = await createReadOnlyConnection();
  try {
    const rows = await runReadOnlyQuery(conn, sql);
    if (opts.format === 'json') console.log(JSON.stringify(rows, null, 2));
    else if (opts.format === 'md') console.log(formatMarkdown(rows));
    else console.log(formatTsv(rows));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro na consulta:', err.message);
  process.exit(1);
});


import { getClientProfile } from '../src/store/analyticsDb.mjs';
import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';

function addDaysIso(iso, d) {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

const profile = getClientProfile('bandeirante');
const conn = await createReadOnlyConnection(profile);

console.log('--- INDIVIDUAL QUERY PROFILER ---');

async function timeQuery(name, sql, params = []) {
  const t0 = Date.now();
  try {
    const rows = await runReadOnlyQuery(conn, sql, params);
    console.log(`[${((Date.now() - t0)/1000).toFixed(2)}s] ${name}: ${rows.length} rows`);
    return rows;
  } catch (err) {
    console.error(`[${((Date.now() - t0)/1000).toFixed(2)}s] ${name} FAILED:`, err.message);
    return [];
  }
}

// 1. Filiais
await timeQuery('1. filiais', "SELECT filial_id, nome, reduz FROM filial WHERE apagado = 'N'");

// 2. Ultvenda
await timeQuery('2. ultvenda', "SELECT DATE(MAX(ultvenda)) AS max_ult FROM estoque_minimo WHERE filial_id IN (2,3) AND apagado = 'N'");

// 3. Products
await timeQuery('3. products', `SELECT p.Produto_id AS produto_id, p.descricao, p.barras FROM produto p WHERE p.apagado = 'N' AND p.inativo = 'N' LIMIT 1000`);

// 4. StockRows
await timeQuery('4. stockRows', `SELECT em1.filial_id, em1.produto_id, em1.estoque FROM estoque_minimo em1 WHERE em1.filial_id IN (2,3) AND em1.apagado = 'N'`);

// 5. WeeklySales (91d)
const refDate = '2026-10-28';
const start91 = '2026-07-29';
const endExcl = '2026-10-29';
await timeQuery('5. weeklySales (91d movment)', `
  SELECT m.filial_id, m.produto_id, FLOOR(DATEDIFF('${refDate}', DATE(m.data_hora)) / 7) AS week_idx, SUM(ABS(m.quanti_uni)) AS qty
  FROM movment m
  WHERE m.filial_id IN (2,3) AND m.data_hora >= '${start91}' AND m.data_hora < '${endExcl}' AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
  GROUP BY m.filial_id, m.produto_id, week_idx
`);

// 6. YoY Sales
const lyNextStart = '2025-10-29';
const lyNextEndExcl = '2025-11-28';
const lyPrevStart = '2025-08-30';
await timeQuery('6. yoySales (movment ano passado)', `
  SELECT m.filial_id, m.produto_id, SUM(ABS(m.quanti_uni)) as qty
  FROM movment m
  WHERE m.filial_id IN (2,3) AND m.data_hora >= '${lyPrevStart}' AND m.data_hora < '${lyNextEndExcl}' AND m.apagado = 'N' AND m.oper IN (2, 3) AND m.E_S = 'S'
  GROUP BY m.filial_id, m.produto_id
`);

// 7. epDaily (estoque_posterior)
await timeQuery('7. epDaily (estoque_posterior 91d)', `
  SELECT ep.filial_id, ep.produto_id, DATE(ep.data_hora) AS dt, MIN(ep.estoque_pos) AS min_est
  FROM estoque_posterior ep
  WHERE ep.filial_id IN (2,3) AND ep.data_hora >= '${start91}' AND ep.data_hora < '${endExcl}' AND ep.apagado = 'N'
  GROUP BY ep.filial_id, ep.produto_id, DATE(ep.data_hora)
`);

// 8. Entries 18m
const start18m = '2025-05-06';
await timeQuery('8. entries (entradas 18m)', `
  SELECT e.filial_id, e.produto_id, e.datanota, e.quantiuni, e.precouni
  FROM entradas e
  WHERE e.filial_id IN (2,3) AND e.apagado = 'N' AND e.datanota >= '${start18m}'
`);

// 9. Lote novo
await timeQuery('9. lote_novo', `
  SELECT filial_id, produto_id, lote, validade, estoque
  FROM lote_novo
  WHERE filial_id IN (2,3) AND apagado = 'N' AND estoque > 0
`);

await conn.end();
console.log('--- PROFILER FINISHED ---');

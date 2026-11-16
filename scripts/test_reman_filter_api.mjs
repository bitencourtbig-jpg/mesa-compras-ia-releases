import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const runId = 66;

function queryRemanRoutes(filters = {}) {
  const {
    origem = null,
    destino = null,
    filialId = null,
    tipo = 'ALL',
    curva = 'ALL',
    minValor = 0,
    search = ''
  } = filters;

  const conditions = ['r.run_id = ?'];
  const params = [runId];

  if (origem && !isNaN(Number(origem))) {
    conditions.push('r.filial_origem = ?');
    params.push(Number(origem));
  }
  if (destino && !isNaN(Number(destino))) {
    conditions.push('r.filial_destino = ?');
    params.push(Number(destino));
  }
  if (filialId && !isNaN(Number(filialId)) && !origem && !destino) {
    conditions.push('(r.filial_origem = ? OR r.filial_destino = ?)');
    params.push(Number(filialId), Number(filialId));
  }
  if (tipo && tipo !== 'ALL') {
    if (tipo === 'CURADORIA_IA') {
      conditions.push("(r.tipo = 'CURADORIA_IA' OR r.motivo LIKE '%Curadoria%' OR esr_orig.justificativa_ia LIKE '%Remanejamento%')");
    } else {
      conditions.push('r.tipo = ?');
      params.push(tipo);
    }
  }
  if (curva && curva !== 'ALL') {
    conditions.push('esr_orig.abc_class = ?');
    params.push(curva);
  }
  if (minValor && Number(minValor) > 0) {
    conditions.push('r.valor_total >= ?');
    params.push(Number(minValor));
  }
  if (search && search.trim()) {
    conditions.push('(r.descricao LIKE ? OR esr_orig.barras LIKE ? OR esr_orig.labora LIKE ? OR CAST(r.produto_id AS TEXT) LIKE ?)');
    const s = `%${search.trim()}%`;
    params.push(s, s, s, s);
  }

  const sql = `
    SELECT r.id, r.run_id, r.produto_id, r.descricao, r.filial_origem, r.filial_destino,
           r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.validade_prioritaria, r.motivo,
           esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
           esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
           esr_orig.barras, esr_orig.labora, esr_orig.abc_class
    FROM engine_remanejamento r
    LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
    LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.filial_origem, r.filial_destino, r.valor_total DESC
  `;

  console.time('query');
  const rows = db.prepare(sql).all(...params);
  console.timeEnd('query');
  return rows;
}

// Testar 1: Sem filtros
const all = queryRemanRoutes();
console.log('Sem filtros:', all.length, 'itens');

// Testar 2: Apenas EXCESSO
const excesso = queryRemanRoutes({ tipo: 'EXCESSO' });
console.log('Apenas EXCESSO:', excesso.length, 'itens');

// Testar 3: Apenas FEFO
const fefo = queryRemanRoutes({ tipo: 'FEFO_VALIDADE' });
console.log('Apenas FEFO_VALIDADE:', fefo.length, 'itens');

// Testar 4: Apenas Curva A com valor >= R$ 50
const curvaAHigh = queryRemanRoutes({ curva: 'A', minValor: 50 });
console.log('Curva A >= R$ 50:', curvaAHigh.length, 'itens');
if (curvaAHigh[0]) {
  console.log('Top Curva A item:', curvaAHigh[0].descricao, curvaAHigh[0].valor_total);
}

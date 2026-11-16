import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
console.time('filtered-query');
const rows = db.prepare(`
  SELECT r.id, r.run_id, r.produto_id, r.descricao, r.filial_origem, r.filial_destino,
         r.tipo, r.qtd_sugerida, r.custo_unit, r.valor_total, r.validade_prioritaria, r.motivo,
         esr_orig.filial_nome AS filial_origem_nome, esr_orig.filial_reduz AS filial_origem_reduz,
         esr_dest.filial_nome AS filial_destino_nome, esr_dest.filial_reduz AS filial_destino_reduz,
         esr_orig.barras, esr_orig.labora, esr_orig.abc_class
  FROM engine_remanejamento r
  LEFT JOIN engine_sku_results esr_orig ON esr_orig.run_id = r.run_id AND esr_orig.filial_id = r.filial_origem AND esr_orig.produto_id = r.produto_id
  LEFT JOIN engine_sku_results esr_dest ON esr_dest.run_id = r.run_id AND esr_dest.filial_id = r.filial_destino AND esr_dest.produto_id = r.produto_id
  WHERE r.run_id = 66 AND r.valor_total >= 10.0
  ORDER BY r.valor_total DESC
`).all();
console.timeEnd('filtered-query');
console.log('Filtered rows count (val >= 10):', rows.length);
console.log('Sample row with abc_class:', rows[0]?.descricao, 'curva:', rows[0]?.abc_class, 'tipo:', rows[0]?.tipo, 'valor:', rows[0]?.valor_total);

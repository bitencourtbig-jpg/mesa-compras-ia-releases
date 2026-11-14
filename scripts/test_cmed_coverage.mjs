import ExcelJS from 'exceljs';
import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';

const XLSX_PATH = 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/cmed/Lista_PMC_20261109_111901661.xlsx';

function cleanStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.text) v = v.text;
  return String(v).trim();
}

function normCode(v) {
  const s = cleanStr(v).replace(/[^0-9]/g, '');
  if (!s) return '';
  return s.replace(/^0+/, '') || s;
}

async function main() {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(XLSX_PATH, {
    entries: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    worksheets: 'emit',
  });

  let headers = [];
  const byRegistro = new Map();
  const byEan = new Map();
  let totalRows = 0;

  for await (const worksheet of reader) {
    if (worksheet.name !== 'Lista PMC') continue;
    let rIdx = 0;
    for await (const row of worksheet) {
      rIdx += 1;
      const vals = row.values.slice(1).map(cleanStr);
      if (rIdx === 1) {
        headers = vals;
        continue;
      }
      if (!vals[0] && !vals[4]) continue;
      totalRows += 1;
      const rec = {
        substancia: vals[0],
        laboratorio: vals[2],
        registro: normCode(vals[4]),
        ean1: normCode(vals[5]),
        ean2: normCode(vals[6]),
        ean3: normCode(vals[7]),
        produto: vals[8],
        apresentacao: vals[9],
        classe_terapeutica: vals[10],
        tipo_produto: vals[11],
        tarja: vals[headers.findIndex((h) => /tarja/i.test(h))] || '',
      };
      if (rec.registro && !byRegistro.has(rec.registro)) byRegistro.set(rec.registro, rec);
      for (const ean of [rec.ean1, rec.ean2, rec.ean3]) {
        if (ean && !byEan.has(ean)) byEan.set(ean, rec);
      }
    }
  }

  console.log('Headers Lista PMC:', JSON.stringify(headers.map((h, i) => `${i}:${h}`)));
  console.log(`Total linhas CMED 2026-11-09: ${totalRows} | Registros MS: ${byRegistro.size} | EANs: ${byEan.size}`);

  const conn = await createReadOnlyConnection();
  try {
    const prods = await runReadOnlyQuery(
      conn,
      `SELECT p.Produto_id, p.descricao, p.registro_ms, p.medicamento,
              p.produto_apresentacao_id, p.considera_prod_apresentacao,
              GROUP_CONCAT(DISTINCT b.barras) AS barras_list
       FROM curvaabc c
       JOIN produto p ON p.Produto_id = c.produto_id AND p.apagado='N' AND p.inativo='N' AND p.medicamento='S'
       LEFT JOIN barras b ON b.produto_id = p.Produto_id AND b.apagado='N'
       WHERE c.filial_id = 2 AND c.apagado='N' AND SUBSTRING_INDEX(c.curvaabc,' ',1) IN ('A','B','C')
       GROUP BY p.Produto_id`
    );

    let matchReg = 0;
    let matchEan = 0;
    let matchEither = 0;
    for (const p of prods) {
      const reg = normCode(p.registro_ms);
      const rHit = reg ? byRegistro.get(reg) : null;
      let eHit = null;
      if (p.barras_list) {
        for (const b of p.barras_list.split(',')) {
          const nb = normCode(b);
          if (nb && byEan.has(nb)) {
            eHit = byEan.get(nb);
            break;
          }
        }
      }
      if (rHit) matchReg += 1;
      if (eHit) matchEan += 1;
      if (rHit || eHit) matchEither += 1;
    }

    console.log(
      `Medicamentos ativos A/B/C filial 2: ${prods.length} | Match REGISTRO: ${matchReg} | Match EAN: ${matchEan} | Match Combinado (REG ou EAN): ${matchEither} (${((matchEither * 100) / prods.length).toFixed(1)}%)`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';
import { loadCmedIndex, normCode } from '../lib/cmedLoader.mjs';

const ZIP_PATH = 'C:/Users/quemf/Downloads/Lista_PMC_20261109_111901661.zip';

async function main() {
  const cmed = await loadCmedIndex(ZIP_PATH, {
    extractDir: 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/cmed',
  });
  const conn = await createReadOnlyConnection();
  try {
    const prods = await runReadOnlyQuery(
      conn,
      `SELECT p.Produto_id, p.descricao, p.registro_ms, p.barras AS prod_barras, p.gtin14,
              GROUP_CONCAT(DISTINCT CASE WHEN COALESCE(b.caixa_master,'N')='N' THEN b.barras END) AS extra_unit,
              GROUP_CONCAT(DISTINCT CASE WHEN b.caixa_master='S' THEN b.barras END) AS extra_master
       FROM curvaabc c
       JOIN produto p ON p.Produto_id = c.produto_id AND p.apagado='N' AND p.inativo='N' AND p.medicamento='S'
       LEFT JOIN barras b ON b.produto_id = p.Produto_id AND b.apagado='N'
       WHERE c.filial_id=2 AND c.apagado='N' AND SUBSTRING_INDEX(c.curvaabc,' ',1) IN ('A','B','C')
       GROUP BY p.Produto_id`
    );

    let hitProdBarras = 0;
    let hitExtraBarras = 0;
    let hitGtin14 = 0;
    let hitAnyEan = 0;
    let hitRegMs = 0;
    let hitBoth = 0;
    let conflitoEanVsReg = 0;
    const sampleConflicts = [];

    for (const p of prods) {
      const pb = normCode(p.prod_barras);
      const gt = normCode(p.gtin14);
      const extras = [
        ...(p.extra_unit ? p.extra_unit.split(',') : []),
        ...(p.extra_master ? p.extra_master.split(',') : []),
      ]
        .map(normCode)
        .filter(Boolean);

      const e1 = pb ? cmed.byEan.get(pb) : null;
      const e2 = extras.map((c) => cmed.byEan.get(c)).find(Boolean) || null;
      const e3 = gt ? cmed.byEan.get(gt) : null;
      const eanHit = e1 || e2 || e3;

      const reg = normCode(p.registro_ms);
      const regHit = reg ? cmed.byRegistro.get(reg) : null;

      if (e1) hitProdBarras += 1;
      if (!e1 && e2) hitExtraBarras += 1;
      if (!e1 && !e2 && e3) hitGtin14 += 1;
      if (eanHit) hitAnyEan += 1;
      if (regHit) hitRegMs += 1;
      if (eanHit || regHit) hitBoth += 1;

      if (eanHit && regHit && eanHit.registro !== regHit.registro) {
        conflitoEanVsReg += 1;
        if (sampleConflicts.length < 10) {
          sampleConflicts.push({
            Produto_id: p.Produto_id,
            descricao: p.descricao,
            ean_subst: `${eanHit.sig.substanciaNorm} ${eanHit.sig.concentracao} ${eanHit.sig.packExact}`,
            reg_subst: `${regHit.sig.substanciaNorm} ${regHit.sig.concentracao} ${regHit.sig.packExact}`,
          });
        }
      }
    }

    console.log(`Total med A/B/C: ${prods.length}`);
    console.log(`Match produto.barras: ${hitProdBarras}`);
    console.log(`Match adicional tabela barras: +${hitExtraBarras}`);
    console.log(`Match adicional produto.gtin14: +${hitGtin14}`);
    console.log(`Total Match por EAN: ${hitAnyEan} (${((hitAnyEan * 100) / prods.length).toFixed(1)}%)`);
    console.log(`Total Match por registro_ms: ${hitRegMs} (${((hitRegMs * 100) / prods.length).toFixed(1)}%)`);
    console.log(`Match Combinado (EAN + registro_ms): ${hitBoth} (${((hitBoth * 100) / prods.length).toFixed(1)}%)`);
    console.log(`Conflitos EAN != registro_ms: ${conflitoEanVsReg}`);
    if (sampleConflicts.length) console.table(sampleConflicts);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


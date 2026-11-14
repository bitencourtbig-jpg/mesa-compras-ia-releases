import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';

async function checkRealBatch() {
  const conn = await createReadOnlyConnection();
  try {
    const rows = await runReadOnlyQuery(conn, "SELECT * FROM pedidos WHERE numlanc = 50552960 LIMIT 3");
    console.log('Sample rows from real batch 50552960:');
    for (const r of rows) {
      console.log(r);
    }

    // Check if there are other columns that are NOT NULL or have specific defaults
    const distinctVals = await runReadOnlyQuery(conn, `
      SELECT
        MIN(datahora) as min_dt, MAX(datahora) as max_dt,
        MIN(marcado) as min_marcado, MAX(marcado) as max_marcado,
        MIN(apagado) as min_apagado, MAX(apagado) as max_apagado,
        MIN(recebido) as min_rec, MAX(recebido) as max_rec,
        MIN(falta) as min_falta, MAX(falta) as max_falta,
        MIN(cotacao_online) as min_cot, MAX(cotacao_online) as max_cot,
        MIN(fornece_id) as min_forn, MAX(fornece_id) as max_forn,
        MIN(comprarfornece_id) as min_comp_forn, MAX(comprarfornece_id) as max_comp_forn,
        MIN(cotacao_fornece_id) as min_cot_forn, MAX(cotacao_fornece_id) as max_cot_forn,
        MIN(lojas_leram) as min_ll, MAX(lojas_leram) as max_ll
      FROM pedidos
      WHERE numlanc = 50552960
    `);
    console.log('Batch characteristics:', distinctVals);

  } finally {
    await conn.end();
  }
}

checkRealBatch().catch(console.error);

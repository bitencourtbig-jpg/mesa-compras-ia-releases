import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { buildPresentationSignature } from '../lib/moleculeNormalizer.mjs';

const db = new DatabaseSync('data/analytics.db');
const prof = db.prepare('SELECT * FROM client_profiles LIMIT 1').get();

const pool = mysql.createPool({
  host: prof?.db_host || '127.0.0.1',
  port: Number(prof?.db_port || 3306),
  user: prof?.db_user || 'root',
  password: prof?.db_password || '',
  database: prof?.db_name || 'gerente',
  connectTimeout: 5000,
});

async function main() {
  const [rows] = await pool.query(`
    SELECT produto_id, descricao, labora, produto_apresentacao_id, considera_prod_apresentacao
    FROM produto
    WHERE (descricao LIKE '%ACETILCIST%' OR descricao LIKE '%FLUIMUCIL%' OR descricao LIKE '%CISTEIL%')
      AND descricao NOT LIKE '%MAMADEIRA%'
      AND descricao NOT LIKE '%ABSORVENTE%'
    ORDER BY descricao
  `);

  console.log('Real Acetilcisteína products:', rows.length);
  const parsed = rows.map(r => {
    const sig = buildPresentationSignature({ substancia: 'ACETILCISTEINA', textoFonte: r.descricao });
    return {
      id: r.produto_id,
      desc: r.descricao,
      lab: r.labora,
      subst: sig.substanciaNorm,
      conc: sig.concentracao,
      forma: sig.forma,
      pack: sig.packExact,
      bucket: sig.packBucket,
      key: sig.key,
      reliable: sig.isReliable
    };
  });

  console.table(parsed);
  await pool.end();
}
main();

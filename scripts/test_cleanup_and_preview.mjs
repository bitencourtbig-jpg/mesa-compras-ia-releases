import { cleanupBigPresentations, buildPresentationSyncPreview } from '../src/services/bigPresentationWriter.mjs';

console.log('1. Executing cleanupBigPresentations (fromId: 1019)...');
const cleanRes = await cleanupBigPresentations({ fromId: 1019 });
console.log('Cleanup result:', cleanRes);

console.log('\n2. Building buildPresentationSyncPreview...');
const preview = await buildPresentationSyncPreview({ limit: 1500 });
console.log('Summary:', preview.summary);
console.log('Top 10 Presentation Clusters:');
for (const c of preview.clusters.slice(0, 10)) {
  console.log(`  • [${c.substancia}] Conc: ${c.concentracao} | Qtd: ${c.qtd_forma_farmaceutica} | ${c.skus_count} SKUs (${c.labs.slice(0, 4).join(', ')})`);
}

// Verificar especificamente Acetilcisteína
const acetilClusters = preview.clusters.filter(c => c.substancia.includes('ACETILCIST'));
console.log('\nAcetilcisteína Clusters in Preview:', acetilClusters.length);
for (const c of acetilClusters) {
  console.log(`  ★ [${c.canonical_key}] -> ${c.skus_count} SKUs | QtdForma BIG: "${c.qtd_forma_farmaceutica}" | Labs: ${c.labs.join(', ')}`);
  for (const it of c.items) {
    console.log(`     - [${it.produto_id}] ${it.descricao}`);
  }
}


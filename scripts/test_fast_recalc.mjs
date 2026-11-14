async function testFastRecalc() {
  console.log('1. Sincronização inicial com MariaDB...');
  const t0 = Date.now();
  const r1 = await fetch('http://127.0.0.1:3456/api/engine/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeksWindow: 13, serviceProfile: 'equilibrado', forceSync: true })
  }).then(r => r.json());
  console.log(`Sincronização 1 concluída em ${Date.now() - t0}ms | Run #${r1.runId} | Perfil: ${r1.summary.serviceProfile} | Total: R$ ${r1.summary.totalSugestaoCompraRs}`);

  console.log('\n2. Testando recálculo ultrarrápido ao trocar Perfil para Enxuto (6 sem)...');
  const t1 = Date.now();
  const r2 = await fetch('http://127.0.0.1:3456/api/engine/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeksWindow: 6, serviceProfile: 'enxuto', fastRecalc: true, forceSync: false })
  }).then(r => r.json());
  const elapsedFast = Date.now() - t1;
  console.log(`Recálculo rápido concluído em ${elapsedFast}ms | Run #${r2.runId} | Perfil: ${r2.summary.serviceProfile} | Janela: ${r2.summary.weeksWindow} sem | Total: R$ ${r2.summary.totalSugestaoCompraRs}`);

  if (elapsedFast > 2000) {
    console.warn('Aviso: Demorou mais que o esperado');
  } else {
    console.log(`✓ [PASS] Recálculo instantâneo em ${elapsedFast}ms sem travamento!`);
  }
}

testFastRecalc().catch(console.error);


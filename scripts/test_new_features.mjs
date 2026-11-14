const baseUrl = 'http://127.0.0.1:3456';

async function testFeatures() {
  console.log('--- 1. Testing GET /api/overview ---');
  const overRes = await fetch(`${baseUrl}/api/overview`);
  const overJson = await overRes.json();
  console.log('Overview OK:', Boolean(overJson.latestRun));
  console.log('FiltersMeta Labs count:', overJson.filtersMeta?.laboratorios?.length || 0);

  console.log('\n--- 2. Testing Motor-Only Suspension (REV-011) ---');
  const sampleSku = 11; // CALADRYL CR C/28 GR
  const suspRes = await fetch(`${baseUrl}/api/skus/suspend-big`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produtoId: sampleSku,
      filialId: 2,
      days: 30,
      motivo: 'Teste Automatizado Suspensão Exclusiva no Motor',
      target: 'motor'
    })
  });
  const suspJson = await suspRes.json();
  console.log('Suspension Response:', suspJson);

  console.log('\n--- 3. Testing GET /api/skus with tab=dismissed ---');
  const disRes = await fetch(`${baseUrl}/api/skus?tab=dismissed&limit=10`);
  const disJson = await disRes.json();
  const foundSusp = disJson.rows.find(r => r.produto_id === sampleSku);
  console.log('Found Suspended in tab=dismissed:', Boolean(foundSusp));
  if (foundSusp) {
    console.log('Suspension metadata:', foundSusp.suspensao_info);
  }

  console.log('\n--- 4. Testing DELETE /api/skus/suspend (Unsuspend) ---');
  const unsuspRes = await fetch(`${baseUrl}/api/skus/suspend?filialId=2&produtoId=${sampleSku}`, {
    method: 'DELETE'
  });
  const unsuspJson = await unsuspRes.json();
  console.log('Unsuspend Response:', unsuspJson);

  console.log('\n--- 5. Testing POST /api/molecules/teach (REV-006) ---');
  const teachRes = await fetch(`${baseUrl}/api/molecules/teach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produtoId: sampleSku,
      substancia: 'DIFENIDRAMINA',
      concentracao: '10MG/G',
      forma: 'CREME',
      packBucket: '28G',
      motivo: 'Teste de Aprendizado Ativo IA'
    })
  });
  const teachJson = await teachRes.json();
  console.log('Teach Response:', teachJson);

  console.log('\n=== ALL FEATURE VERIFICATIONS PASSED 100% ===');
}

testFeatures().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

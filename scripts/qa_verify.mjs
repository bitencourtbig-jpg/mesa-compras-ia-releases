async function runQa() {
  const r1 = await (await fetch('http://127.0.0.1:3456/api/overview')).json();
  console.log('R1 KEYS:', Object.keys(r1));
  console.log('LATEST RUN:', r1.latestRun?.id);
  console.log('FILIAIS POLICIES:', r1.filiaisPolicies);

  const r2 = await (await fetch('http://127.0.0.1:3456/api/remanejamento/routes')).json();
  console.log('\nR2 KEYS:', Object.keys(r2));
  console.log('R2 FIRST ROUTE:', r2.routes?.[0]);
  console.log('R2 ALL ROUTES:', r2.routes);

  if (r2.routes?.length > 0) {
    const route = r2.routes[0];
    const origem = route.filial_origem || route.origem_id || route.origemId;
    const destino = route.filial_destino || route.destino_id || route.destinoId;
    const excelRes = await fetch(`http://127.0.0.1:3456/api/remanejamento/export-excel?origem=${origem}&destino=${destino}`);
    console.log(`Excel Export (${origem} -> ${destino}) Status:`, excelRes.status, 'Type:', excelRes.headers.get('content-type'));
  }
}

runQa().catch(console.error);

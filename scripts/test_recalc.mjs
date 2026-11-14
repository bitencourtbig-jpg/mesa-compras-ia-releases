async function main() {
  const res = await fetch('http://127.0.0.1:3456/api/engine/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceProfile: 'enxuto', weeksWindow: 6 }),
  });
  console.log('HTTP Status:', res.status);
  const json = await res.json();
  console.log('Engine Run Result:', json.ok ? 'SUCCESS' : 'ERROR', json.summary ? `Processed ${json.summary.totalSkusAnalisados} SKUs` : json);
}
main().catch(console.error);


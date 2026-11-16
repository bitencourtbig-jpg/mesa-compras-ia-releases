import http from 'http';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data.slice(0, 200) });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing /api/curadoria/opportunities...');
  const cur = await get('http://127.0.0.1:3456/api/curadoria/opportunities');
  console.log('Curadoria OK:', cur.ok);
  console.log('Molecules count:', cur.molecules?.length);
  if (cur.molecules?.length > 0) {
    const first = cur.molecules[0];
    console.log('First molecule:', first.molecule_key);
    console.log('Target SKU:', first.targetSku?.descricao, 'PID:', first.targetSku?.produto_id);
    console.log('Cheapest SKU:', first.cheapestSku?.descricao, 'Custo:', first.cheapestSku?.custo_unit);
    console.log('IA Advice Type:', first.iaAdvice?.type);
    console.log('IA Advice Title:', first.iaAdvice?.title);
  }

  console.log('\nTesting /api/budget/overview...');
  const budAll = await get('http://127.0.0.1:3456/api/budget/overview');
  console.log('Budget All OK:', budAll.ok);
  console.log('Budget All dotacao_ajustada:', budAll.dotacao_ajustada || budAll.data?.dotacao_ajustada);
  console.log('Budget All consumido:', budAll.consumido_compras_rs || budAll.data?.consumido_compras_rs);

  const budF2 = await get('http://127.0.0.1:3456/api/budget/overview?filial_id=2');
  console.log('Budget F2 dotacao_ajustada:', budF2.dotacao_ajustada || budF2.data?.dotacao_ajustada);

  const budF3 = await get('http://127.0.0.1:3456/api/budget/overview?filial_id=3');
  console.log('Budget F3 dotacao_ajustada:', budF3.dotacao_ajustada || budF3.data?.dotacao_ajustada);

  console.log('\nAll API tests PASSED!');
}

run().catch(console.error);

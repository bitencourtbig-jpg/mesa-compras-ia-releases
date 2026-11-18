import http from 'http';

function get(path, isBinary = false) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3456${path}`, (res) => {
      if (isBinary) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- 1. Testing /api/remanejamento/routes ---');
  const resRoutes = await get('/api/remanejamento/routes');
  console.log('Ok:', resRoutes.ok);
  console.log('Routes found:', resRoutes.routes?.length);
  console.log('Total Itens:', resRoutes.totalItens);
  console.log('Total Unidades:', resRoutes.totalGeralUnidades);
  console.log('Total R$:', resRoutes.totalGeralRs);

  if (resRoutes.routes && resRoutes.routes.length > 0) {
    const r1 = resRoutes.routes[0];
    console.log(`Route 1: ${r1.filialOrigemNome} -> ${r1.filialDestinoNome} (${r1.totalItens} items)`);
    const it1 = r1.items[0];
    console.log('Item 1 Sample fields:');
    console.log({
      produto_id: it1.produto_id,
      descricao: it1.descricao,
      qtd_sugerida: it1.qtd_sugerida,
      estoqueOrigem: it1.estoqueOrigem,
      estoqueDestino: it1.estoqueDestino,
      estoqueMinOrigem: it1.estoqueMinOrigem,
      estoqueMaxOrigem: it1.estoqueMaxOrigem,
      transitoInfo: it1.transitoInfo,
    });

    console.log('\n--- 2. Testing /api/remanejamento/export-excel for Route 1 ---');
    const excelBuffer = await get(`/api/remanejamento/export-excel?origem=${r1.filialOrigem}&destino=${r1.filialDestino}`, true);
    console.log('Excel buffer size in bytes:', excelBuffer.length);
    const isZip = excelBuffer[0] === 0x50 && excelBuffer[1] === 0x4B; // 'PK'
    console.log('Is valid Excel xlsx (PK header):', isZip);
  }

  console.log('\n--- 3. Testing /api/remanejamento/transfers ---');
  const resTransfers = await get('/api/remanejamento/transfers');
  console.log('Existing transfers count:', resTransfers.transfers?.length);

  console.log('\nAll checks passed!');
}

run().catch(console.error);

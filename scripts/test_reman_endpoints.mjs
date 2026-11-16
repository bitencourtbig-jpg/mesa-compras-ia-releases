import http from 'http';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3456${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing /api/remanejamento:');
  const reman = await get('/api/remanejamento');
  console.log('curadoriaDecisions count:', reman.curadoriaDecisions?.length);
  console.log('expiringLots count:', reman.expiringLots?.length);
  if (reman.expiringLots?.length > 0) {
    console.log('First expiring lot sample:', reman.expiringLots[0]);
  }

  console.log('\nTesting /api/remanejamento/routes?tipo=CURADORIA_IA:');
  const curRoutes = await get('/api/remanejamento/routes?tipo=CURADORIA_IA');
  console.log('Routes count for Curadoria IA:', curRoutes.routes?.length);
  if (curRoutes.routes?.length > 0) {
    console.log('First route:', curRoutes.routes[0].routeKey, 'total itens:', curRoutes.routes[0].totalItens, 'valorTotalRs:', curRoutes.routes[0].valorTotalRs);
    console.log('Items sample in route 1:', curRoutes.routes[0].items.map(i => ({ pId: i.produto_id, desc: i.descricao, un: i.qtd_sugerida, val: i.valor_total })));
  }
}

test().catch(console.error);

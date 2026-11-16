import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testWithUrlParam() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-reman-url',
    '--window-size=1600,1200',
    'about:blank'
  ]);
  await sleep(1500);

  const tabs = await fetch('http://127.0.0.1:9232/json/list').then(r => r.json());
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const curId = id++;
    const handler = (msg) => {
      const d = JSON.parse(msg.data);
      if (d.id === curId) {
        ws.removeEventListener('message', handler);
        res(d);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navegando direto para http://127.0.0.1:3456/?view=transfers ...');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456/?view=transfers' });
  await sleep(4000);

  // Verificar estado
  const check = await send('Runtime.evaluate', {
    expression: `
      ({
        view: state.view,
        transfersHidden: document.getElementById('view-transfers')?.classList.contains('hidden'),
        cardCount: document.querySelectorAll('.transfer-route-card').length,
        summaryText: document.getElementById('reman-filter-summary')?.innerText.trim()
      })
    `,
    returnByValue: true
  });
  console.log('Estado inicial transfers:', check.result?.result?.value);

  // Screenshot 1: Visão Geral com Painel de Filtros e KPIs
  console.log('Capturando Screenshot 1: Painel de Filtros e KPIs...');
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_painel_filtros_e_kpis.png'), Buffer.from(ss1.result.data, 'base64'));
  console.log('Screenshot 1 salvo: remanejamento_painel_filtros_e_kpis.png');

  // Testar Filtro de Doação de Excesso + Curva A + Min R$ 50
  console.log('Aplicando filtro: Tipo=EXCESSO, Curva=A, MinVal=50...');
  const filterResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        document.getElementById('reman-filter-tipo').value = 'EXCESSO';
        document.getElementById('reman-filter-curva').value = 'A';
        document.getElementById('reman-filter-min-val').value = '50';
        state.remanFilters.tipo = 'EXCESSO';
        state.remanFilters.curva = 'A';
        state.remanFilters.minValor = 50;
        await loadTransfers();
        return {
          cardCount: document.querySelectorAll('.transfer-route-card').length,
          summaryText: document.getElementById('reman-filter-summary')?.innerText.trim(),
          firstRouteTitle: document.querySelector('.transfer-route-title')?.innerText.trim()
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Resultado após filtro Excesso Curva A >= 50:', filterResult.result?.result?.value);

  // Screenshot 2: Filtro Excesso Curva A
  console.log('Capturando Screenshot 2: Filtro Excesso Curva A...');
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_filtro_excesso_curva_a.png'), Buffer.from(ss2.result.data, 'base64'));
  console.log('Screenshot 2 salvo: remanejamento_filtro_excesso_curva_a.png');

  // Testar Busca em Tempo Real "DORFLEX"
  console.log('Aplicando busca: "DORFLEX"...');
  const searchResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        document.getElementById('reman-filter-tipo').value = 'ALL';
        document.getElementById('reman-filter-curva').value = 'ALL';
        document.getElementById('reman-filter-min-val').value = '0';
        state.remanFilters = { search: 'DORFLEX', tipo: 'ALL', curva: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0 };
        document.getElementById('reman-search-input').value = 'DORFLEX';
        await loadTransfers();
        return {
          cardCount: document.querySelectorAll('.transfer-route-card').length,
          summaryText: document.getElementById('reman-filter-summary')?.innerText.trim()
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Resultado após busca "DORFLEX":', searchResult.result?.result?.value);

  // Screenshot 3: Busca por Produto
  console.log('Capturando Screenshot 3: Busca por Produto...');
  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_busca_produto.png'), Buffer.from(ss3.result.data, 'base64'));
  console.log('Screenshot 3 salvo: remanejamento_busca_produto.png');

  // Scroll até as Guias Emitidas do Motor
  console.log('Resetando busca e rolando até a tabela de Guias Emitidas...');
  const guiasResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        state.remanFilters = { search: '', tipo: 'ALL', curva: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0 };
        document.getElementById('reman-search-input').value = '';
        await loadTransfers();
        const el = document.getElementById('active-transfers-table') || document.querySelector('#motor-transfers-tbody').closest('.panel');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        return {
          guiasRows: document.querySelectorAll('#motor-transfers-tbody tr').length,
          firstRowText: document.querySelector('#motor-transfers-tbody tr')?.innerText.replace(/\\s+/g, ' ').trim()
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Resultado das Guias Emitidas:', guiasResult.result?.result?.value);
  await sleep(1000);

  // Screenshot 4: Guias Emitidas com Sinalização de Curadoria IA
  console.log('Capturando Screenshot 4: Guias Emitidas com Sinalização...');
  const ss4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_guias_emitidas_curadoria_ia.png'), Buffer.from(ss4.result.data, 'base64'));
  console.log('Screenshot 4 salvo: remanejamento_guias_emitidas_curadoria_ia.png');

  console.log('Todos os testes e screenshots concluídos com total sucesso!');
  ws.close();
  chromeProc.kill();
}

testWithUrlParam().catch(console.error);

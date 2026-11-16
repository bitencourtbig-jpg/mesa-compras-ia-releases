import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Iniciando headless Chrome na porta 9222...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner-reman',
    '--window-size=1600,1100',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1800);

  try {
    const tabs = await getJson('http://127.0.0.1:9222/json/list');
    const wsUrl = tabs[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('Não encontrou webSocketDebuggerUrl');

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        consoleLogs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      }
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    const send = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navegando para http://127.0.0.1:3456 ...');
    await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
    await sleep(3500);

    // Navegar para view-transfers
    console.log('Alternando para view transfers...');
    await send('Runtime.evaluate', {
      expression: `
        if (typeof switchView === 'function') {
          switchView('transfers');
        } else {
          document.getElementById('btn-goto-transfers').click();
        }
      `
    });
    await sleep(2500);

    // Capturar estado inicial
    console.log('Verificando carregamento inicial da Central de Remanejamento...');
    const evalInit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const filterPanel = document.getElementById('reman-filters-panel');
          const summaryEl = document.getElementById('reman-filter-summary');
          const routesContainer = document.getElementById('transfer-routes-container');
          const cards = routesContainer ? routesContainer.querySelectorAll('.transfer-route-card').length : 0;
          return {
            hasFilterPanel: !!filterPanel,
            summaryText: summaryEl ? summaryEl.innerText.trim() : '',
            cardCount: cards,
            origemOptions: document.getElementById('reman-filter-origem')?.options?.length || 0,
            destinoOptions: document.getElementById('reman-filter-destino')?.options?.length || 0
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Status inicial:', evalInit.result?.value);

    // Screenshot 1: Central de Remanejamento com Painel de Filtros
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_central_com_filtros.png'), Buffer.from(ss1.result.data, 'base64'));
    console.log('Screenshot 1 salvo: remanejamento_central_com_filtros.png');

    // Testar Filtro 1: Excesso + Curva A + Min Valor 50
    console.log('Aplicando Filtro: Tipo=EXCESSO, Curva=A, MinVal=50...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('reman-filter-tipo').value = 'EXCESSO';
          document.getElementById('reman-filter-curva').value = 'A';
          document.getElementById('reman-filter-min-val').value = '50';
          state.remanFilters.tipo = 'EXCESSO';
          state.remanFilters.curva = 'A';
          state.remanFilters.minValor = 50;
          loadTransfers();
        })()
      `
    });
    await sleep(2500);

    const evalFilter1 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const summaryEl = document.getElementById('reman-filter-summary');
          const routesContainer = document.getElementById('transfer-routes-container');
          const firstCardTitle = routesContainer ? routesContainer.querySelector('.transfer-route-title')?.innerText : '';
          const firstCardMeta = routesContainer ? routesContainer.querySelector('.transfer-route-meta')?.innerText : '';
          return {
            summaryText: summaryEl ? summaryEl.innerText.trim() : '',
            firstCardTitle,
            firstCardMeta
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Status após Filtro Excesso Curva A >= R$ 50:', evalFilter1.result?.value);

    // Screenshot 2: Filtro Excesso Curva A
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_filtro_excesso_curva_a.png'), Buffer.from(ss2.result.data, 'base64'));
    console.log('Screenshot 2 salvo: remanejamento_filtro_excesso_curva_a.png');

    // Testar Filtro 2: Resetar filtros e scroll até a Tabela de Guias Emitidas
    console.log('Resetando filtros e visualizando Tabela de Guias Emitidas...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btn-reman-clear-filters').click();
          const guiasSec = document.getElementById('active-transfers-table');
          if (guiasSec) guiasSec.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()
      `
    });
    await sleep(2000);

    const evalGuias = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('motor-transfers-tbody');
          const rows = tbody ? Array.from(tbody.querySelectorAll('tr')).map(r => r.innerText.replace(/\\s+/g, ' ').trim()) : [];
          return {
            rowCount: rows.length,
            rowsSummary: rows.slice(0, 5)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Status das Guias Emitidas:', evalGuias.result?.value);

    // Screenshot 3: Guias Emitidas com Sinalização de Curadoria IA
    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'remanejamento_guias_emitidas_curadoria.png'), Buffer.from(ss3.result.data, 'base64'));
    console.log('Screenshot 3 salvo: remanejamento_guias_emitidas_curadoria.png');

    console.log('Verificação CDP concluída com sucesso!');
    ws.close();
  } catch (err) {
    console.error('Erro na execução CDP:', err);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

run();

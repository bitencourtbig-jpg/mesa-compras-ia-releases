import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval6',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9231/json/list').then(r => r.json());
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

  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await new Promise(r => setTimeout(r, 3500));

  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        switchView('transfers');
        await loadTransfers();
      })()
    `,
    awaitPromise: true
  });

  const check1 = await send('Runtime.evaluate', {
    expression: '({ view: state.view, transfersHidden: document.getElementById("view-transfers")?.classList.contains("hidden") })',
    returnByValue: true
  });
  console.log('Check 1 (before filter):', check1.result?.result?.value);

  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        state.remanFilters.tipo = 'EXCESSO';
        state.remanFilters.curva = 'A';
        state.remanFilters.minValor = 50;
        await loadTransfers();
      })()
    `,
    awaitPromise: true
  });

  const check2 = await send('Runtime.evaluate', {
    expression: '({ view: state.view, transfersHidden: document.getElementById("view-transfers")?.classList.contains("hidden") })',
    returnByValue: true
  });
  console.log('Check 2 (after filter):', check2.result?.result?.value);

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

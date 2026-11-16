import http from 'http';
import { spawn } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function testBrowser() {
  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-reman-profile-debug',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9226/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  const tabs = await getJson('http://127.0.0.1:9226/json/list');
  const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

  let reqId = 1;
  const pending = new Map();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER LOG:', data.params.type, data.params.args.map(a => a.value || a.description));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
    }
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data.result);
      pending.delete(data.id);
    }
  };

  const send = (method, params = {}) => new Promise(res => {
    const id = reqId++;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://127.0.0.1:3456/' });
  await sleep(3000);

  // Directly evaluate loadTransfers with full error capture
  const result = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          console.log('Direct test starting...');
          const r1 = await apiGet('/api/remanejamento/routes');
          console.log('routes r1 count:', r1.routes?.length, 'filiais:', r1.filiais?.length);
          const r2 = await apiGet('/api/remanejamento');
          console.log('reman r2 curDecs:', r2.curadoriaDecisions?.length, 'expLots:', r2.expiringLots?.length);
          await loadTransfers();
          console.log('loadTransfers finished!');
          const curRows = document.querySelectorAll('#curadoria-decisions-tbody tr');
          const expRows = document.querySelectorAll('#expiring-tbody tr');
          const trfRows = document.querySelectorAll('#motor-transfers-tbody tr');
          return {
            curCount: curRows.length,
            curText: curRows[0] ? curRows[0].innerText : null,
            expCount: expRows.length,
            expText: expRows[0] ? expRows[0].innerText : null,
            trfCount: trfRows.length,
            trfText: trfRows[0] ? trfRows[0].innerText : null
          };
        } catch (err) {
          console.error('Error during test:', err);
          return { error: err.message, stack: err.stack };
        }
      })()
    `,
    returnByValue: true,
    awaitPromise: true
  });

  console.log('FINAL EVAL RESULT:', JSON.stringify(result?.result?.value, null, 2));

  ws.close();
  chromeProc.kill();
}

testBrowser().catch(console.error);

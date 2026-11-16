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

async function debug() {
  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-debug-profile',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9225/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  const tabs = await getJson('http://127.0.0.1:9225/json/list');
  const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

  let reqId = 1;
  const pending = new Map();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
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

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const res = await fetch('/api/remanejamento');
          const data = await res.json();
          return { status: res.status, curDecs: data.curadoriaDecisions?.length, expLots: data.expiringLots?.length };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    returnByValue: true,
    awaitPromise: true
  });
  console.log('Fetch from inside browser:', evalRes?.result?.value);

  // Now call loadTransfers directly inside the browser
  const loadRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          await loadTransfers();
          const rows = document.querySelectorAll('#curadoria-decisions-tbody tr');
          const expRows = document.querySelectorAll('#expiring-tbody tr');
          return { curRows: rows.length, expRows: expRows.length };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()
    `,
    returnByValue: true,
    awaitPromise: true
  });
  console.log('loadTransfers result inside browser:', loadRes?.result?.value);

  ws.close();
  chromeProc.kill();
}

debug().catch(console.error);

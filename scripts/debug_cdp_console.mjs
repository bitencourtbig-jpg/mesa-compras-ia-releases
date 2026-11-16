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

async function check() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner2',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);
  const tabs = await getJson('http://127.0.0.1:9222/json/list');
  const targetTab = tabs[0];
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', d.params.type, d.params.args.map(a => a.value));
    }
    if (d.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION:', d.params.exceptionDetails?.text, d.params.exceptionDetails?.exception?.description);
    }
    if (d.id === 5) {
      console.log('EVAL 5 RESULT:', d.result);
    }
  };

  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://127.0.0.1:3456/' } }));
  await sleep(2500);

  // Trigger sweep
  console.log('Calling openMoleculeSweep...');
  ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: {
    expression: 'openMoleculeSweep("CLORIDRATO DE ONDANSETRONA|8MG|CPR_ESP|10UN", 78967857, 2)',
    awaitPromise: true
  }}));

  await sleep(3000);

  // Check res
  ws.send(JSON.stringify({ id: 5, method: 'Runtime.evaluate', params: {
    expression: '(() => ({ banner: document.getElementById("sweep-ia-banner")?.innerHTML?.slice(0, 100), diag: document.getElementById("sweep-store-diagnostic")?.style?.display, tbody: document.getElementById("sweep-tbody")?.children?.length }))()',
    returnByValue: true
  }}));

  await sleep(1000);
  chromeProc.kill();
}
check();

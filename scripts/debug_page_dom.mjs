import http from 'http';
import { spawn } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: e.message, raw: data }); }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.reqId = 1;
    this.pending = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.method === 'Console.messageAdded') {
          console.log('[BROWSER CONSOLE]', data.params.message.text);
        }
        if (data.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER LOG]', ...data.params.args.map(a => a.value || a.description));
        }
        if (data.method === 'Runtime.exceptionThrown') {
          console.error('[BROWSER EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
        }
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.reqId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }
  close() { if (this.ws) this.ws.close(); }
}

async function debug() {
  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9222/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  try {
    const tabs = await getJson('http://127.0.0.1:9222/json/list');
    const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
    const client = new CdpClient(targetTab.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Console.enable');

    console.log('Navigating to http://127.0.0.1:3456/?view=cockpit&tab=curadoria...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/?view=cockpit&tab=curadoria' });
    await sleep(4000);

    const stateInfo = await client.eval(`JSON.stringify({ view: state.view, tab: state.tab, filial: state.selectedFilial })`);
    console.log('App state:', stateInfo);

    const curContainerHtml = await client.eval(`document.getElementById('view-curadoria-container')?.innerHTML?.slice(0, 300)`);
    console.log('view-curadoria-container innerHTML snippet:\n', curContainerHtml);

    const isContainerHidden = await client.eval(`document.getElementById('view-curadoria-container')?.classList.contains('hidden')`);
    console.log('view-curadoria-container is hidden:', isContainerHidden);

    const isCockpitHidden = await client.eval(`document.getElementById('view-cockpit')?.classList.contains('hidden')`);
    console.log('view-cockpit is hidden:', isCockpitHidden);

    client.close();
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

debug().catch(console.error);

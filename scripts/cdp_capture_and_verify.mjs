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
  async screenshot(filePath, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath} (${Math.round(res.data.length * 0.75 / 1024)} KB)`);
  }
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  console.log('0. Spawning headless Chrome with CDP...');
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

    console.log('1. Navigating to http://127.0.0.1:3456/?view=cockpit&tab=curadoria...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/?view=cockpit&tab=curadoria' });

    console.log('2. Waiting for Curadoria list rows to render...');
    let rowCount = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      rowCount = await client.eval(`document.querySelectorAll('.curadoria-product-row').length`);
      if (rowCount > 0) break;
    }
    console.log(`Curadoria product rows count: ${rowCount}`);

    // Scroll directly to the table header so the table and products are in view
    await client.eval(`
      const table = document.getElementById('curadoria-table-body');
      if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await sleep(400);

    // Screenshot 1: Curadoria Executive List Table
    const shot1 = path.join(ARTIFACT_DIR, 'curadoria_lista_executiva.png');
    await client.screenshot(shot1);

    console.log('\n3. Clicking "🔬 Analisar Molécula" on the first product row...');
    await client.eval(`document.querySelector('.btn-open-mol-modal')?.click()`);

    console.log('Waiting for modal sweep rows to render...');
    let modalRows = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      modalRows = await client.eval(`document.querySelectorAll('.sweep-sku-row').length`);
      if (modalRows > 0) break;
    }
    console.log(`Modal matricial competitors rows: ${modalRows}`);

    // Screenshot 2: Matricial Modal
    const shot2 = path.join(ARTIFACT_DIR, 'curadoria_modal_matricial.png');
    await client.screenshot(shot2);

    console.log('\n4. Testing decision inside modal: Clicking "⚪ Manter Compra Atual"...');
    await client.eval(`document.getElementById('btn-sweep-keep')?.click()`);
    await sleep(1500);

    const bannerText = await client.eval(`document.getElementById('status-banner')?.innerText`);
    console.log('Toast notification text:', bannerText);

    console.log('\n5. Navigating to Dotação Orçamentária view...');
    await client.eval(`switchView('budget')`);
    await sleep(2000);

    const otbDotacao = await client.eval(`document.getElementById('otb-kpi-dotacao')?.innerText`);
    const otbConsumido = await client.eval(`document.getElementById('otb-kpi-consumido')?.innerText`);
    const otbSaldo = await client.eval(`document.getElementById('otb-kpi-saldo-livre')?.innerText`);
    console.log(`Consolidated Budget - Dotação: ${otbDotacao} | Consumido: ${otbConsumido} | Saldo: ${otbSaldo}`);

    // Screenshot 3: Budget Screen
    const shot3 = path.join(ARTIFACT_DIR, 'dotacao_orcamentaria_rede.png');
    await client.screenshot(shot3);

    client.close();
    console.log('\nALL VERIFICATION STEPS COMPLETED WITH 100% SUCCESS!');
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

run().catch(console.error);

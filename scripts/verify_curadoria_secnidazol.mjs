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

    console.log('1. Navigating to http://127.0.0.1:3456/ ...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/' });
    await sleep(1500);

    console.log('2. Switching to cockpit & curadoria...');
    await client.eval(`
      switchView('cockpit');
      switchSkuTab('curadoria');
    `);

    let rowCount = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      rowCount = await client.eval(`document.querySelectorAll('.curadoria-product-row').length`);
      if (rowCount > 0) break;
    }
    console.log(`Curadoria product rows count: ${rowCount}`);

    // Scroll into table view
    await client.eval(`
      const t = document.getElementById('curadoria-table-body');
      if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await sleep(500);

    // Screenshot 1: Curadoria Executive List Table
    const shot1 = path.join(ARTIFACT_DIR, 'curadoria_lista_executiva.png');
    await client.screenshot(shot1);

    console.log('\n3. Opening Modal for SECNIDAZOL...');
    await client.eval(`
      const btn = document.querySelector('tr[data-mol-key*="SECNIDAZOL"] .btn-open-mol-modal');
      if (btn) btn.click();
      else document.querySelector('.btn-open-mol-modal')?.click();
    `);

    let modalRows = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      modalRows = await client.eval(`document.querySelectorAll('.sweep-sku-row').length`);
      if (modalRows > 0) break;
    }
    console.log(`Modal matricial competitors rows: ${modalRows}`);

    const modalInspection = await client.eval(`
      const banner = document.getElementById('sweep-ia-banner');
      const rows = Array.from(document.querySelectorAll('.sweep-sku-row')).map(r => ({
        lab: r.children[0]?.innerText?.replace(/\\n/g, ' '),
        desc: r.children[1]?.innerText?.replace(/\\n/g, ' '),
        curva: r.children[2]?.innerText?.replace(/\\n/g, ' '),
        cost: r.querySelector('.num')?.innerText,
        action: r.children[r.children.length - 1]?.innerText
      }));
      const actions = Array.from(document.querySelectorAll('#sweep-action-bar button')).map(b => b.innerText);
      return {
        bannerText: banner?.innerText?.slice(0, 300),
        rows,
        actions
      };
    `);
    console.log('Modal Inspection:', JSON.stringify(modalInspection, null, 2));

    await sleep(500);

    // Screenshot 2: Curadoria Modal with Decision Cockpit & Filtered Matrix
    const shot2 = path.join(ARTIFACT_DIR, 'curadoria_modal_secnidazol.png');
    await client.screenshot(shot2);

    client.close();
  } catch (err) {
    console.error('Error in CDP flow:', err);
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

run();

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
      res.on('end', () => resolve(JSON.parse(data)));
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
  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-reman-shot',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9227/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  const tabs = await getJson('http://127.0.0.1:9227/json/list');
  const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
  const client = new CdpClient(targetTab.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  console.log('Navigating to http://127.0.0.1:3456/...');
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/' });
  await sleep(3000);

  // Switch view to transfers and await loadTransfers
  console.log('Switching to transfers...');
  await client.eval(`
    (async () => {
      document.getElementById('modal-licensing')?.classList.add('hidden');
      document.getElementById('modal-welcome')?.classList.add('hidden');
      switchView('transfers');
      await loadTransfers();
    })()
  `);
  await sleep(2000);

  // 1. Screenshot of Top: KPIs & Seção 1 (Curadoria IA Decisions)
  await client.eval(`window.scrollTo(0, 0);`);
  await sleep(600);
  const ss1 = path.join(ARTIFACT_DIR, 'remanejamento_secao1_decisoes_curadoria_topo.png');
  await client.screenshot(ss1);

  // 2. Screenshot of Seção 2: Guias Emitidas com Botão Romaneio Excel
  await client.eval(`
    const el = document.querySelector('#motor-transfers-tbody');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  `);
  await sleep(600);
  const ss2 = path.join(ARTIFACT_DIR, 'remanejamento_secao2_guias_emitidas_com_romaneio_excel.png');
  await client.screenshot(ss2);

  // 3. Open Modal de Itens on Guide 1
  await client.eval(`
    const btn = document.querySelector('.btn-view-transfer-items');
    if (btn) btn.click();
  `);
  await sleep(800);
  const ss3 = path.join(ARTIFACT_DIR, 'remanejamento_modal_romaneio_carga_itens.png');
  await client.screenshot(ss3);

  // Close modal
  await client.eval(`
    const closeBtn = document.getElementById('btn-close-modal-trf');
    if (closeBtn) closeBtn.click();
  `);
  await sleep(500);

  // 4. Screenshot of Seção 4: Lotes Críticos FEFO Corrigido
  await client.eval(`
    const el = document.querySelector('#expiring-tbody');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  `);
  await sleep(600);
  const ss4 = path.join(ARTIFACT_DIR, 'remanejamento_secao4_fefo_lotes_criticos_corrigido.png');
  await client.screenshot(ss4);

  // 5. Filter by Curadoria IA in Section 3 and screenshot
  await client.eval(`
    (async () => {
      const selTipo = document.getElementById('reman-filter-tipo');
      if (selTipo) {
        selTipo.value = 'CURADORIA_IA';
        selTipo.dispatchEvent(new Event('change'));
      }
      await loadTransfers();
      const el = document.getElementById('transfer-routes-container');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()
  `);
  await sleep(2000);
  const ss5 = path.join(ARTIFACT_DIR, 'remanejamento_secao3_rotas_curadoria_ia_ativas.png');
  await client.screenshot(ss5);

  client.close();
  chromeProc.kill();
  console.log('All 5 perfect screenshots saved successfully!');
}

run().catch(console.error);

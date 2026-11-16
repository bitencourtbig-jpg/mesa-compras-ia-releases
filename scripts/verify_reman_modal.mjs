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
    '--window-size=1600,1200',
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
    await sleep(2000);

    console.log('2. Switching to Curadoria tab...');
    await client.eval(`
      switchSkuTab('curadoria');
    `);
    await sleep(1500);

    console.log('3. Capturing executive list with remanejamento indicators...');
    await client.screenshot(path.join(ARTIFACT_DIR, 'curadoria_lista_com_remanejamento.png'));

    console.log('4. Opening modal for Ondansetrona 8mg...');
    const modalOpened = await client.eval(`
      (async () => {
        const rows = Array.from(document.querySelectorAll('.curadoria-product-row'));
        const ondanRow = rows.find(r => r.dataset.search && r.dataset.search.includes('ondansetrona'));
        if (ondanRow) {
          const btn = ondanRow.querySelector('.btn-open-mol-modal');
          if (btn) { btn.click(); return { ok: true, via: 'button' }; }
          ondanRow.click();
          return { ok: true, via: 'row' };
        }
        // Fallback direto
        openMoleculeSweep('CLORIDRATO DE ONDANSETRONA|8MG|CPR_ESP|10UN', 78967857, 2);
        return { ok: true, via: 'direct' };
      })()
    `);
    console.log('Modal trigger result:', modalOpened);

    await sleep(2500);

    console.log('5. Auditing DOM elements of the modal...');
    const domAudit = await client.eval(`
      (() => {
        const modal = document.getElementById('molecule-sweep-modal');
        const isVisible = modal && !modal.classList.contains('hidden');
        const storeDiag = document.getElementById('sweep-store-diagnostic');
        const remanSynergy = document.getElementById('sweep-reman-synergy');
        const btnApplyReman = document.getElementById('btn-sweep-apply-reman');
        const btnSuspend = document.getElementById('btn-sweep-suspend-dead');
        const btnDiscount = document.getElementById('btn-sweep-discount');

        return {
          modalVisible: isVisible,
          storeDiagVisible: storeDiag && storeDiag.style.display !== 'none',
          storeDiagCardsCount: storeDiag ? storeDiag.querySelectorAll('div[style*="border:1.5px solid"]').length : 0,
          remanSynergyVisible: remanSynergy && remanSynergy.style.display !== 'none',
          remanRoutesCount: remanSynergy ? remanSynergy.querySelectorAll('div[style*="border:1px solid #c4b5fd"]').length : 0,
          btnApplyRemanText: btnApplyReman ? btnApplyReman.innerText.trim() : null,
          btnSuspendText: btnSuspend ? btnSuspend.innerText.trim() : null,
          btnDiscountText: btnDiscount ? btnDiscount.innerText.trim() : null,
        };
      })()
    `);
    console.log('DOM Audit of Modal:', JSON.stringify(domAudit, null, 2));

    console.log('6. Capturing modal screenshot...');
    await client.screenshot(path.join(ARTIFACT_DIR, 'curadoria_modal_sinergia_remanejamento.png'));

    client.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

run();

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
    '--remote-debugging-port=9223',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-reman-profile',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9223/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  try {
    const tabs = await getJson('http://127.0.0.1:9223/json/list');
    const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
    const client = new CdpClient(targetTab.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('1. Navigating to http://127.0.0.1:3456/?view=transfers...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/?view=transfers' });

    await sleep(2000);

    // Close any modal if open and switch to transfers
    await client.eval(`
      const licModal = document.getElementById('modal-licensing');
      if (licModal) licModal.classList.add('hidden');
      const welcomeModal = document.getElementById('modal-welcome');
      if (welcomeModal) welcomeModal.classList.add('hidden');
      if (typeof switchView === 'function') switchView('view-transfers');
    `);

    await sleep(2000);

    // Verify Curadoria decisions table in Section 1
    const decStats = await client.eval(`
      const rows = document.querySelectorAll('#curadoria-decisions-tbody tr');
      const firstRow = rows[0] ? rows[0].innerText.replace(/\\n+/g, ' | ') : '';
      ({ rowCount: rows.length, firstRow })
    `);
    console.log('Seção 1 (Curadoria Decisions) stats:', decStats);

    const ss1 = path.join(ARTIFACT_DIR, 'remanejamento_secao1_decisoes_comprador.png');
    await client.screenshot(ss1);

    // Test clicking "Ver Itens" on first emitted guide to open modal
    console.log('2. Opening transfer items modal on emitted guide...');
    const hasGuideBtn = await client.eval(`
      const btn = document.querySelector('.btn-view-transfer-items');
      if (btn) { btn.click(); true; } else { false; }
    `);

    if (hasGuideBtn) {
      await sleep(800);
      const modalStats = await client.eval(`
        const modal = document.getElementById('modal-transfer-items');
        const rows = document.querySelectorAll('#modal-trf-tbody tr');
        ({ display: modal.style.display, rowsCount: rows.length, title: document.getElementById('modal-trf-title')?.textContent })
      `);
      console.log('Modal stats:', modalStats);
      const ss2 = path.join(ARTIFACT_DIR, 'remanejamento_modal_itens_guia.png');
      await client.screenshot(ss2);

      // Close modal
      await client.eval(`
        const cBtn = document.getElementById('btn-close-modal-trf');
        if (cBtn) cBtn.click();
      `);
      await sleep(500);
    }

    // Test Filter by Curadoria IA • Transfer-First in Section 3
    console.log('3. Applying filter: Curadoria IA • Transfer-First...');
    await client.eval(`
      const selTipo = document.getElementById('reman-filter-tipo');
      if (selTipo) {
        selTipo.value = 'CURADORIA_IA';
        selTipo.dispatchEvent(new Event('change'));
      }
    `);

    await sleep(2000);

    const curadoriaRoutesStats = await client.eval(`
      const cards = document.querySelectorAll('.transfer-route-card');
      const countEl = document.getElementById('transfer-routes-count');
      ({ cardsCount: cards.length, countText: countEl ? countEl.textContent : '' })
    `);
    console.log('Section 3 (Curadoria IA Routes) stats:', curadoriaRoutesStats);

    const ss3 = path.join(ARTIFACT_DIR, 'remanejamento_filtro_curadoria_ia_com_rotas.png');
    await client.screenshot(ss3);

    // Test FEFO / Lotes Críticos Section (Section 4)
    console.log('4. Scrolling to FEFO / Lotes Críticos section...');
    await client.eval(`
      const expTable = document.getElementById('expiring-tbody');
      if (expTable) expTable.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);

    await sleep(1000);

    const fefoStats = await client.eval(`
      const rows = document.querySelectorAll('#expiring-tbody tr');
      const firstRow = rows[0] ? rows[0].innerText.replace(/\\n+/g, ' | ') : '';
      ({ rowCount: rows.length, firstRow })
    `);
    console.log('Section 4 (FEFO / Lotes Críticos) stats:', fefoStats);

    const ss4 = path.join(ARTIFACT_DIR, 'remanejamento_fefo_lotes_criticos_corrigido.png');
    await client.screenshot(ss4);

    // Test operational button on FEFO
    console.log('5. Clicking FEFO action button...');
    const fefoActionRes = await client.eval(`
      const btn = document.querySelector('.btn-fefo-op');
      if (btn) {
        btn.click();
        ({ clicked: true, desc: btn.dataset.desc, acao: btn.dataset.acao });
      } else {
        ({ clicked: false });
      }
    `);
    console.log('FEFO Action clicked:', fefoActionRes);

    await sleep(1500);

    // Test emitting a Curadoria guide
    console.log('6. Emitting a Curadoria Transfer Guide...');
    await client.eval(`window.scrollTo(0, 0);`);
    await sleep(500);

    const emitRes = await client.eval(`
      const btn = document.querySelector('.btn-emit-curadoria-single');
      if (btn) {
        btn.click();
        ({ clicked: true, pid: btn.dataset.pid });
      } else {
        ({ clicked: false });
      }
    `);
    console.log('Curadoria Emit clicked:', emitRes);

    await sleep(2500);

    const ss5 = path.join(ARTIFACT_DIR, 'remanejamento_apos_emitir_guia_curadoria.png');
    await client.screenshot(ss5);

    client.close();
    chromeProc.kill();
    console.log('Verification completed successfully!');
  } catch (err) {
    console.error('Error during CDP verification:', err);
    chromeProc.kill();
    process.exit(1);
  }
}

run();

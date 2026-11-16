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
  console.log('Spawning headless Chrome...');
  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-reman-profile-2',
    '--window-size=1600,1050',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const v = await getJson('http://127.0.0.1:9224/json/version');
      if (v?.Browser) break;
    } catch {}
  }

  try {
    const tabs = await getJson('http://127.0.0.1:9224/json/list');
    const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
    const client = new CdpClient(targetTab.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Navigating to http://127.0.0.1:3456/?view=transfers...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3456/?view=transfers' });

    // Wait for init to complete
    await sleep(2500);

    // Explicitly switch to transfers view
    console.log('Calling switchView("transfers")...');
    await client.eval(`
      const licModal = document.getElementById('modal-licensing');
      if (licModal) licModal.classList.add('hidden');
      const welcomeModal = document.getElementById('modal-welcome');
      if (welcomeModal) welcomeModal.classList.add('hidden');
      switchView('transfers');
    `);

    await sleep(2500);

    // 1. Check Section 1 (Decisões da Rodada do Comprador)
    const curadoriaDecsStats = await client.eval(`
      (() => {
        const rows = document.querySelectorAll('#curadoria-decisions-tbody tr');
        const items = Array.from(rows).map(r => r.innerText.replace(/\\n+/g, ' | '));
        return { count: rows.length, sample: items.slice(0, 3) };
      })()
    `);
    console.log('Seção 1 (Curadoria Decisions) stats:', curadoriaDecsStats);

    const ss1 = path.join(ARTIFACT_DIR, 'remanejamento_secao1_decisoes_comprador.png');
    await client.screenshot(ss1);

    // 2. Check Section 2 (Guias Emitidas)
    const guidesStats = await client.eval(`
      (() => {
        const rows = document.querySelectorAll('#motor-transfers-tbody tr');
        const items = Array.from(rows).map(r => r.innerText.replace(/\\n+/g, ' | '));
        return { count: rows.length, sample: items.slice(0, 2) };
      })()
    `);
    console.log('Seção 2 (Guias Emitidas) stats:', guidesStats);

    // Open transfer items modal
    console.log('Opening modal for first guide...');
    await client.eval(`
      const btn = document.querySelector('.btn-view-transfer-items');
      if (btn) btn.click();
    `);
    await sleep(800);

    const modalStats = await client.eval(`
      (() => {
        const modal = document.getElementById('modal-transfer-items');
        const rows = document.querySelectorAll('#modal-trf-tbody tr');
        return {
          display: modal ? modal.style.display : null,
          title: document.getElementById('modal-trf-title')?.textContent,
          rowsCount: rows.length,
          itemSample: rows[0] ? rows[0].innerText.replace(/\\n+/g, ' | ') : null
        };
      })()
    `);
    console.log('Modal stats:', modalStats);
    const ss2 = path.join(ARTIFACT_DIR, 'remanejamento_modal_itens_guia.png');
    await client.screenshot(ss2);

    // Close modal
    await client.eval(`
      const closeBtn = document.getElementById('btn-close-modal-trf');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(500);

    // 3. Section 3: Filter by Curadoria IA • Transfer-First
    console.log('Filtering by Curadoria IA in Section 3...');
    await client.eval(`
      const selTipo = document.getElementById('reman-filter-tipo');
      if (selTipo) {
        selTipo.value = 'CURADORIA_IA';
        selTipo.dispatchEvent(new Event('change'));
      }
    `);
    await sleep(2000);

    const curRoutesStats = await client.eval(`
      (() => {
        const cards = document.querySelectorAll('.transfer-route-card');
        const countEl = document.getElementById('transfer-routes-count');
        const cardTitles = Array.from(cards).map(c => c.querySelector('.transfer-route-title')?.textContent.trim());
        return { cardsCount: cards.length, countText: countEl?.textContent, cardTitles };
      })()
    `);
    console.log('Section 3 (Curadoria Routes) stats:', curRoutesStats);
    const ss3 = path.join(ARTIFACT_DIR, 'remanejamento_filtro_curadoria_ia_com_rotas.png');
    await client.screenshot(ss3);

    // 4. Section 4: FEFO / Lotes Críticos
    console.log('Scrolling to FEFO / Lotes Críticos section...');
    await client.eval(`
      const expTable = document.getElementById('expiring-tbody');
      if (expTable) expTable.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await sleep(1000);

    const fefoStats = await client.eval(`
      (() => {
        const rows = document.querySelectorAll('#expiring-tbody tr');
        const items = Array.from(rows).slice(0, 4).map(r => r.innerText.replace(/\\n+/g, ' | '));
        return { count: rows.length, sample: items };
      })()
    `);
    console.log('Section 4 (FEFO / Lotes Críticos) stats:', fefoStats);
    const ss4 = path.join(ARTIFACT_DIR, 'remanejamento_fefo_lotes_criticos_corrigido.png');
    await client.screenshot(ss4);

    client.close();
    chromeProc.kill();
    console.log('All tests completed successfully!');
  } catch (err) {
    console.error('Error during test:', err);
    chromeProc.kill();
    process.exit(1);
  }
}

run();

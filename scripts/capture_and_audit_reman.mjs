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

async function check() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner3',
    '--window-size=1600,1200',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);
  const tabs = await getJson('http://127.0.0.1:9222/json/list');
  const targetTab = tabs[0];
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const pending = new Map();
  let reqId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(new Error(d.error.message));
      else resolve(d.result);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456/' });
  await sleep(2500);

  // Switch to curadoria tab
  await send('Runtime.evaluate', {
    expression: 'switchSkuTab("curadoria")',
    awaitPromise: true
  });
  await sleep(1500);

  // Screenshot curadoria executive list
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_lista_com_remanejamento.png'), Buffer.from(ss1.data, 'base64'));
  console.log('Saved curadoria_lista_com_remanejamento.png');

  // Trigger sweep for Ondansetrona
  console.log('Opening sweep for Ondansetrona...');
  await send('Runtime.evaluate', {
    expression: 'openMoleculeSweep("CLORIDRATO DE ONDANSETRONA|8MG|CPR_ESP|10UN", 78967857, 2)',
    awaitPromise: true
  });
  await sleep(2500);

  // Evaluate modal state
  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById("molecule-sweep-modal");
      const storeDiag = document.getElementById("sweep-store-diagnostic");
      const reman = document.getElementById("sweep-reman-synergy");
      const btnReman = document.getElementById("btn-sweep-apply-reman");
      const btnSuspend = document.getElementById("btn-sweep-suspend-dead");
      const btnDiscount = document.getElementById("btn-sweep-discount");

      return {
        diagDisplay: storeDiag?.style?.display,
        diagTextPreview: storeDiag?.innerText?.slice(0, 300),
        remanDisplay: reman?.style?.display,
        remanTextPreview: reman?.innerText?.slice(0, 300),
        btnRemanText: btnReman?.innerText?.trim(),
        btnSuspendText: btnSuspend?.innerText?.trim(),
        btnDiscountText: btnDiscount?.innerText?.trim(),
        cardsCount: storeDiag?.querySelectorAll('div[style*="border:1.5px solid"]').length,
        routesCount: reman?.querySelectorAll('div[style*="border:1px solid #c4b5fd"]').length,
      };
    })()`,
    returnByValue: true
  });
  console.log('Modal audit:', JSON.stringify(info.result.value, null, 2));

  // Screenshot modal top
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_modal_sinergia_remanejamento.png'), Buffer.from(ss2.data, 'base64'));
  console.log('Saved curadoria_modal_sinergia_remanejamento.png');

  // Scroll down in modal-body to see the table and action bar
  await send('Runtime.evaluate', {
    expression: 'document.querySelector("#molecule-sweep-modal .modal-body").scrollTop = 600'
  });
  await sleep(600);

  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_modal_tabela_e_acoes.png'), Buffer.from(ss3.data, 'base64'));
  console.log('Saved curadoria_modal_tabela_e_acoes.png');

  ws.close();
  chromeProc.kill();
}
check();

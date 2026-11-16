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
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner7',
    '--window-size=1600,1100',
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

  // Trigger sweep for Levotiroxina 88mcg (exactly user screenshot)
  console.log('Opening sweep for Levotiroxina 88mcg...');
  await send('Runtime.evaluate', {
    expression: 'openMoleculeSweep("LEVOTIROXINA SODICA|88MCG|CPR|~30UN", 6199, 2)',
    awaitPromise: true
  });
  await sleep(2500);

  // Evaluate modal state
  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById("molecule-sweep-modal");
      const btnMaster = document.getElementById("btn-master-ia-1click");
      const cards = Array.from(document.querySelectorAll(".store-action-card"));
      const cardButtons = Array.from(document.querySelectorAll(".btn-cancel-card-purchase"));
      const matrixContainer = document.getElementById("sweep-matrix-container");
      const matrixCountBadge = document.getElementById("sweep-matrix-count-badge");

      return {
        modalVisible: modal && !modal.classList.contains("hidden"),
        btnMasterText: btnMaster ? btnMaster.innerText.trim() : null,
        cardsCount: cards.length,
        cardStoreIds: cards.map(c => c.id),
        cardButtonsCount: cardButtons.length,
        cardButtonsLabels: cardButtons.map(b => b.innerText.trim()),
        matrixIsHidden: matrixContainer ? matrixContainer.style.display === "none" : null,
        matrixCountText: matrixCountBadge ? matrixCountBadge.innerText : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Modal audit (Levotiroxina):', JSON.stringify(info.result.value, null, 2));

  // Screenshot modal default (desafogada, com cards de ação e botão master 1-clique)
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_modal_levotiroxina_desafogada.png'), Buffer.from(ss1.data, 'base64'));
  console.log('Saved curadoria_modal_levotiroxina_desafogada.png');

  // Test expanding the matrix table
  console.log('Expanding matrix table...');
  await send('Runtime.evaluate', {
    expression: 'document.getElementById("sweep-matrix-header").click()'
  });
  await sleep(600);

  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_modal_levotiroxina_matriz_expandida.png'), Buffer.from(ss2.data, 'base64'));
  console.log('Saved curadoria_modal_levotiroxina_matriz_expandida.png');

  // Test clicking direct button on card L05
  console.log('Testing direct card action on L05...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btnL05 = document.querySelector('.btn-cancel-card-purchase[data-filial-id="5"]');
      if (btnL05) btnL05.click();
    })()`
  });
  await sleep(1500);

  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_modal_card_l05_cancelado.png'), Buffer.from(ss3.data, 'base64'));
  console.log('Saved curadoria_modal_card_l05_cancelado.png');

  ws.close();
  chromeProc.kill();
}
check();

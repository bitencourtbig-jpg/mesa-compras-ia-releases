import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('--- Gravando Screenshots Finais de Responsividade & Polish ---');

  const cdpPort = 9280;
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-final-shots',
    '--window-size=1366,768',
    'about:blank'
  ]);

  let tabs = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(600);
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        tabs = await res.json();
        if (tabs && tabs.length > 0) break;
      }
    } catch {}
  }

  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = msgId++;
    const handler = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(d);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const setViewport = async (w, h, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
    await sleep(300);
  };

  const takeScreenshot = async (filename) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.result.data, 'base64'));
    console.log(`[Screenshot gravado]: ${filename}`);
  };

  // 1. Curadoria em Notebook 1366x768
  console.log('1. Carregando Curadoria em 1366x768...');
  await setViewport(1366, 768, false);
  await send('Page.navigate', { url: 'http://127.0.0.1:3456?view=cockpit' });
  await sleep(3500);

  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        state.tab = 'curadoria';
        document.querySelectorAll('#sku-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'curadoria'));
        document.getElementById('table-wrap-skus')?.classList.add('hidden');
        document.getElementById('view-groups-summary')?.classList.add('hidden');
        document.getElementById('view-curadoria-container')?.classList.remove('hidden');
        await loadAndRenderCuradoria();
      })()
    `,
    awaitPromise: true
  });
  await sleep(1500);
  await takeScreenshot('curadoria_notebook_1366_final.png');

  // 2. Abre a modal de análise da molécula
  console.log('2. Abrindo Modal da Molécula...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.btn-open-mol-modal');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(3500);
  await takeScreenshot('curadoria_notebook_1366_modal_final.png');

  // 3. Mesma modal em Mobile (390x844)
  console.log('3. Modal em Mobile 390x844...');
  await setViewport(390, 844, true);
  await sleep(800);
  await takeScreenshot('molecula_mobile_390_final.png');

  // Fecha modal
  await send('Runtime.evaluate', {
    expression: `document.getElementById('btn-close-sweep-modal')?.click()`
  });
  await sleep(500);

  // 4. Remanejamento em Notebook 1366x768
  console.log('4. Remanejamento em 1366x768...');
  await setViewport(1366, 768, false);
  await send('Runtime.evaluate', {
    expression: `switchView('transfers')`
  });
  await sleep(2500);
  await takeScreenshot('remanejamento_notebook_1366_final.png');

  // 5. Remanejamento em Mobile (390x844)
  console.log('5. Remanejamento em Mobile 390x844...');
  await setViewport(390, 844, true);
  await sleep(800);
  await takeScreenshot('remanejamento_mobile_390_final.png');

  // 6. Home em Notebook 1366x768
  console.log('6. Home em 1366x768...');
  await setViewport(1366, 768, false);
  await send('Runtime.evaluate', {
    expression: `switchView('home')`
  });
  await sleep(2000);
  await takeScreenshot('home_notebook_1366_final.png');

  console.log('=== Todos os screenshots finais concluídos com sucesso! ===');
  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(console.error);
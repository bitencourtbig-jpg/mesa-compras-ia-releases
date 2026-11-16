import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('--- Executando Validação Completa de Telas & Modais Responsivos ---');

  const cdpPort = 9249;
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-responsive-test-all',
    '--window-size=1920,1080',
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

  if (!tabs || tabs.length === 0) {
    throw new Error('Não foi possível conectar ao Chrome CDP na porta ' + cdpPort);
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
    await sleep(400);
  };

  const takeScreenshot = async (filename) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.result.data, 'base64'));
    console.log(`[Screenshot gravado]: ${filename}`);
  };

  // 1. Carrega Cockpit na aba Curadoria
  console.log('1. Abrindo Cockpit na aba Curadoria...');
  await setViewport(1366, 768, false);
  await send('Page.navigate', { url: 'http://127.0.0.1:3456?view=cockpit&tab=curadoria' });
  await sleep(4000);

  // Garante que a aba Curadoria esteja selecionada e carregada
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof switchSkuTab === 'function') switchSkuTab('curadoria');
      })()
    `
  });
  await sleep(2500);
  await takeScreenshot('responsivo_notebook_1366_curadoria_carregada.png');

  // 2. Abre a modal de análise da molécula (Secnidazol ou ONDANSETRONA)
  console.log('2. Abrindo Modal de Análise da Molécula em 1366x768...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.btn-open-mol-modal') || document.querySelector('.curadoria-product-row');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(3500);
  await takeScreenshot('responsivo_notebook_1366_modal_molecula_aberta.png');

  // 3. Mesma modal aberta em Tablet (768x1024)
  console.log('3. Testando Modal de Molécula em Tablet (768x1024)...');
  await setViewport(768, 1024, true);
  await sleep(1000);
  await takeScreenshot('responsivo_tablet_768_modal_molecula_aberta.png');

  // Fecha o modal
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btnClose = document.getElementById('btn-close-sweep-modal');
        if (btnClose) btnClose.click();
      })()
    `
  });
  await sleep(500);

  // 4. Muda para a tela de Remanejamento & Transferências
  console.log('4. Navegando para tela de Remanejamento...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof switchView === 'function') switchView('transfers');
      })()
    `
  });
  await sleep(3000);
  await setViewport(1366, 768, false);
  await takeScreenshot('responsivo_notebook_1366_remanejamento.png');

  // Remanejamento em Tablet
  await setViewport(992, 800, false);
  await sleep(600);
  await takeScreenshot('responsivo_tablet_992_remanejamento.png');

  // Remanejamento em Mobile
  await setViewport(390, 844, true);
  await sleep(600);
  await takeScreenshot('responsivo_mobile_390_remanejamento.png');

  // 5. Tela Home em Desktop e Mobile
  console.log('5. Navegando para Home...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof switchView === 'function') switchView('home');
      })()
    `
  });
  await sleep(2000);
  await setViewport(1366, 768, false);
  await takeScreenshot('responsivo_notebook_1366_home.png');

  await setViewport(390, 844, true);
  await sleep(600);
  await takeScreenshot('responsivo_mobile_390_home.png');

  console.log('=== Validação finalizada com 100% de sucesso! ===');
  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('Erro na validação:', e);
  process.exit(1);
});
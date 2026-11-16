import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('--- Iniciando Verificação de Responsividade & Polish Cross-Device ---');

  const cdpPort = 9245;
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-responsive-test',
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
    await sleep(500);
  };

  const takeScreenshot = async (filename) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.result.data, 'base64'));
    console.log(`[Screenshot gravado]: ${filename}`);
  };

  // 1. Desktop Full HD (1920x1080)
  console.log('\n--- 1. Desktop Full HD (1920x1080) ---');
  await setViewport(1920, 1080, false);
  await send('Page.navigate', { url: 'http://127.0.0.1:3456?view=cockpit&tab=curadoria' });
  await sleep(4000);
  await takeScreenshot('responsivo_desktop_1920_curadoria.png');

  // Teste de recálculo de perfil na topbar
  console.log('\n--- Testando Recálculo de Perfil na TopBar via Browser ---');
  const recalcEval = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const selProfile = document.getElementById('ctrl-profile');
        if (selProfile) {
          selProfile.value = 'enxuto';
          selProfile.dispatchEvent(new Event('change'));
        }
        return 'Triggered';
      })()
    `,
    awaitPromise: true
  });
  console.log('Recálculo disparado:', recalcEval);
  await sleep(4000);

  // Verifica o banner pós recálculo
  const bannerCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const b = document.getElementById('top-banner');
        return {
          bannerText: b ? b.innerText : null,
          isError: b ? b.classList.contains('error') : false
        };
      })()
    `
  });
  console.log('Status do banner pós recálculo:', bannerCheck.result?.value);
  await takeScreenshot('responsivo_desktop_1920_pos_recalculo.png');

  // 2. Notebook Padrão Farmácia (1366x768)
  console.log('\n--- 2. Notebook Padrão Farmácia (1366x768) ---');
  await setViewport(1366, 768, false);
  await sleep(1000);
  await takeScreenshot('responsivo_notebook_1366_curadoria.png');

  // Abre Modal de Análise da Molécula em 1366x768
  console.log('\n--- Abrindo Modal de Análise da Molécula (1366x768) ---');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const firstBtn = document.querySelector('.btn-open-mol-modal');
        if (firstBtn) firstBtn.click();
        return !!firstBtn;
      })()
    `
  });
  await sleep(3500);
  await takeScreenshot('responsivo_notebook_1366_modal_molecula.png');

  // Fecha o modal
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const closeBtn = document.getElementById('btn-close-sweep-modal');
        if (closeBtn) closeBtn.click();
      })()
    `
  });
  await sleep(800);

  // 3. Tablet Paisagem (1024x768)
  console.log('\n--- 3. Tablet Paisagem (1024x768) ---');
  await setViewport(1024, 768, false);
  await sleep(1000);
  await takeScreenshot('responsivo_tablet_1024_curadoria.png');

  // 4. Tablet Retrato (768x1024)
  console.log('\n--- 4. Tablet Retrato (768x1024) ---');
  await setViewport(768, 1024, true);
  await sleep(1000);
  await takeScreenshot('responsivo_tablet_768_curadoria.png');

  // Abre Modal de Análise da Molécula em Tablet Retrato (768px)
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const firstBtn = document.querySelector('.btn-open-mol-modal');
        if (firstBtn) firstBtn.click();
      })()
    `
  });
  await sleep(3500);
  await takeScreenshot('responsivo_tablet_768_modal_molecula.png');

  // Fecha o modal
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const closeBtn = document.getElementById('btn-close-sweep-modal');
        if (closeBtn) closeBtn.click();
      })()
    `
  });
  await sleep(800);

  // 5. Smartphone / Mobile Balcão (390x844)
  console.log('\n--- 5. Smartphone / Mobile Balcão (390x844) ---');
  await setViewport(390, 844, true);
  await sleep(1000);
  await takeScreenshot('responsivo_mobile_390_curadoria.png');

  // Navega para Remanejamento em Mobile
  console.log('\n--- Remanejamento em Mobile (390x844) ---');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456?view=transfers' });
  await sleep(3000);
  await takeScreenshot('responsivo_mobile_390_remanejamento.png');

  // Navega para Home em Mobile
  console.log('\n--- Home em Mobile (390x844) ---');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456?view=home' });
  await sleep(3000);
  await takeScreenshot('responsivo_mobile_390_home.png');

  console.log('\n=== Todos os testes de responsividade concluídos com sucesso! ===');
  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
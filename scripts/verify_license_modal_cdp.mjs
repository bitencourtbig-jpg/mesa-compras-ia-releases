import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9234',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-lic-modal2',
    '--window-size=1600,1100',
    'about:blank'
  ]);
  await sleep(1500);

  const tabs = await fetch('http://127.0.0.1:9234/json/list').then(r => r.json());
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const curId = id++;
    const handler = (msg) => {
      const d = JSON.parse(msg.data);
      if (d.id === curId) {
        ws.removeEventListener('message', handler);
        res(d);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navegando para http://127.0.0.1:3456 ...');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await sleep(3500);

  console.log('Abrindo modal de Licenciamento com await openWelcomeGate...');
  const res = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        await openWelcomeGate(false);
        return {
          statusText: document.getElementById('gate-status-text')?.innerText.trim(),
          subText: document.getElementById('gate-license-sub')?.innerText.trim(),
          cnpj: document.getElementById('gate-client-cnpj')?.innerText.trim(),
          machineId: document.getElementById('gate-machine-id')?.innerText.trim(),
          clientName: document.getElementById('gate-client-name')?.innerText.trim(),
          planBadge: document.getElementById('gate-license-plan-badge')?.innerText.trim()
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Dados do modal:', res.result?.result?.value);
  await sleep(1000);

  // Screenshot do modal
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'licenciamento_ativado_sucesso.png'), Buffer.from(ss.result.data, 'base64'));
  console.log('Screenshot salvo: licenciamento_ativado_sucesso.png');

  ws.close();
  chromeProc.kill();
}

run().catch(console.error);

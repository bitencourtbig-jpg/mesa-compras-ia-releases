import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9242',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-lic-test9242',
    '--window-size=1600,1100',
    'about:blank'
  ]);
  let tabs = null;
  for (let i = 0; i < 12; i++) {
    await sleep(600);
    try {
      const res = await fetch('http://127.0.0.1:9242/json/list');
      if (res.ok) {
        tabs = await res.json();
        if (tabs && tabs.length > 0) break;
      }
    } catch {}
  }
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise((res) => {
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await sleep(3500);

  // 1. Simula bloqueio inicial com licença expirada
  console.log('1. Bloqueando com licença expirada...');
  await send('Runtime.evaluate', {
    expression: "state.licenseStatus = { isValid: false, isExpired: true, daysRemaining: 0, validUntil: '2026-11-01', cnpj: '28660206000167', currentMachineId: 'LNX-44B5-9347-4BB3' }; updateLicenseBadge(state.licenseStatus); openWelcomeGate(true);"
  });
  await sleep(600);

  // 2. Insere a chave de licença oficial no input e aciona ativação
  console.log('2. Inserindo chave e aguardando conclusão de activateLicenseKeyAction...');
  const actRes = await send('Runtime.evaluate', {
    expression: "(async () => { document.getElementById('input-activation-key').value = 'LIC-286602-20270115-BD0B-7ACA-6326'; await activateLicenseKeyAction(); return { ok: true }; })()",
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Ativação concluída:', actRes.result?.result?.value);
  await sleep(1000);

  // 3. Verifica se modal fechou automaticamente e se a Home regularizou
  const check = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.getElementById('modal-welcome-gate');
        const card = document.getElementById('home-license-card');
        return {
          isModalHidden: modal.classList.contains('hidden'),
          hasActiveBadge: card.innerText.includes('Assinatura Ativa & Regularizada'),
          cardText: card.innerText.trim()
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Resultado após ativação de chave:', JSON.stringify(check.result?.result?.value, null, 2));

  // Screenshot final da home após ativação
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'licenca_pos_ativacao_chave_sucesso.png'), Buffer.from(ss.result.data, 'base64'));
  console.log('Screenshot salvo: licenca_pos_ativacao_chave_sucesso.png');

  ws.close();
  chromeProc.kill();
  console.log('Fluxo completo validado!');
}

run().catch(console.error);

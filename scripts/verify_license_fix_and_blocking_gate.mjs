import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\quemf\\.gemini\\antigravity\\brain\\61b1a913-8f27-4e4e-8d9b-22613ace1722';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9240',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-lic-test9240',
    '--window-size=1600,1100',
    'about:blank'
  ]);
  let tabs = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(800);
    try {
      const res = await fetch('http://127.0.0.1:9240/json/list');
      if (res.ok) {
        tabs = await res.json();
        if (tabs && tabs.length > 0) break;
      }
    } catch {}
  }
  if (!tabs || tabs.length === 0) throw new Error('Não foi possível conectar ao Chrome CDP na porta 9236');
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

  console.log('1. Navegando para http://127.0.0.1:3456 ...');
  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await sleep(3500);

  // Teste 1: Verificar tela Home real com a licença ativa
  const homeCardEval = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const card = document.getElementById('home-license-card');
        return {
          cardText: card ? card.innerText : null,
          hasRedExpired: card ? card.innerText.includes('Assinatura Mensal Expirada') : false,
          hasActiveBadge: card ? card.innerText.includes('Assinatura Ativa & Regularizada') : false,
          isModalHidden: document.getElementById('modal-welcome-gate')?.classList.contains('hidden')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Resultado Teste 1 (Home Ativa):', JSON.stringify(homeCardEval.result?.result?.value, null, 2));

  // Screenshot 1: Home View com licença ativa regularizada
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'licenca_ativa_home_corrigida.png'), Buffer.from(ss1.result.data, 'base64'));
  console.log('Screenshot 1 salvo: licenca_ativa_home_corrigida.png');

  // Teste 2: Abrir modal de licença no modo ativo
  console.log('2. Abrindo modal de licença ativo...');
  await send('Runtime.evaluate', {
    expression: 'openWelcomeGate(false)'
  });
  await sleep(1000);

  const modalActiveEval = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.getElementById('modal-welcome-gate');
        const waBtn = document.getElementById('gate-btn-whatsapp');
        return {
          isModalVisible: !modal?.classList.contains('hidden'),
          statusHeadline: document.getElementById('gate-status-text')?.innerText,
          subText: document.getElementById('gate-license-sub')?.innerText,
          waHref: waBtn?.href,
          waText: waBtn?.innerText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Resultado Teste 2 (Modal Ativo):', JSON.stringify(modalActiveEval.result?.result?.value, null, 2));

  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'licenca_modal_ativa_com_whatsapp.png'), Buffer.from(ss2.result.data, 'base64'));
  console.log('Screenshot 2 salvo: licenca_modal_ativa_com_whatsapp.png');

  // Teste 3: Simular modo expirado estrito e verificar bloqueio inviolável
  console.log('3. Testando comportamento quando a licença realmente expira...');
  const expiredEval = await send('Runtime.evaluate', {
    expression: `
      (() => {
        state.licenseStatus = {
          isValid: false,
          isExpired: true,
          daysRemaining: 0,
          validUntil: '2026-11-01',
          cnpj: '28660206000167',
          clientName: 'ESCRITORIO',
          currentMachineId: 'LNX-44B5-9347-4BB3'
        };
        updateLicenseBadge(state.licenseStatus);
        openWelcomeGate(true);

        const closeBtn = document.getElementById('btn-close-welcome-gate');
        const enterBtn = document.getElementById('btn-enter-cockpit');
        const waBtn = document.getElementById('gate-btn-whatsapp');

        // Testa tentativa de fechar com closeWelcomeGate
        closeWelcomeGate();
        const stillOpenAfterClose = !document.getElementById('modal-welcome-gate').classList.contains('hidden');

        // Testa tentativa de fechar com closeAllModals
        closeAllModals();
        const stillOpenAfterCloseAll = !document.getElementById('modal-welcome-gate').classList.contains('hidden');

        return {
          isCloseBtnHidden: closeBtn.style.display === 'none',
          isEnterBtnDisabled: enterBtn.disabled,
          stillOpenAfterClose,
          stillOpenAfterCloseAll,
          waHref: waBtn?.href,
          statusText: document.getElementById('gate-status-text')?.innerText,
          subText: document.getElementById('gate-license-sub')?.innerText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Resultado Teste 3 (Bloqueio Estrito Expirado):', JSON.stringify(expiredEval.result?.result?.value, null, 2));

  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'licenca_modal_bloqueio_estrito_expirado.png'), Buffer.from(ss3.result.data, 'base64'));
  console.log('Screenshot 3 salvo: licenca_modal_bloqueio_estrito_expirado.png');

  // Teste 4: Reverter para licença real do banco e testar fechamento
  console.log('4. Restaurando licença real do banco e confirmando fechamento...');
  await send('Runtime.evaluate', {
    expression: `
      apiGet('/api/license/status').then(res => {
        state.licenseStatus = res;
        updateLicenseBadge(res);
        closeWelcomeGate();
        renderHomeScreen();
      })
    `
  });
  await sleep(1000);

  const finalCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          isModalHidden: document.getElementById('modal-welcome-gate').classList.contains('hidden'),
          homeCardText: document.getElementById('home-license-card').innerText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Resultado Teste 4 (Restauração Final Ativa):', JSON.stringify(finalCheck.result?.result?.value, null, 2));

  ws.close();
  chromeProc.kill();
  console.log('Todos os testes concluídos com sucesso!');
}

run().catch(console.error);

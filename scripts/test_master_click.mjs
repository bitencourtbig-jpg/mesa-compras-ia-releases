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

async function testMaster1Click() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-profile-runner9',
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

  // Switch to cockpit
  await send('Runtime.evaluate', { expression: 'switchView("cockpit"); switchSkuTab("curadoria");', awaitPromise: true });
  await sleep(2000);

  // Open sweep for Levotiroxina
  await send('Runtime.evaluate', {
    expression: 'openMoleculeSweep("LEVOTIROXINA SODICA|88MCG|CPR|~30UN", 6199, 2)',
    awaitPromise: true
  });
  await sleep(2000);

  // Click Master 1-Click Action
  console.log('Clicking Master 1-Click button...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById("btn-master-ia-1click");
      if (btn) { btn.click(); return { ok: true, text: btn.innerText }; }
      return { ok: false, notFound: true };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', res.result?.value);
  await sleep(2500);

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'curadoria_apos_1clique_sucesso.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved curadoria_apos_1clique_sucesso.png');

  ws.close();
  chromeProc.kill();
}
testMaster1Click();

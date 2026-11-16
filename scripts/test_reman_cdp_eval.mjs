import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
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

  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await new Promise(r => setTimeout(r, 3000));

  const val = (r) => r.result?.result?.value;

  const viewBefore = await send('Runtime.evaluate', {
    expression: 'document.querySelector(".view-section:not(.hidden)") ? document.querySelector(".view-section:not(.hidden)").id : "none"',
    returnByValue: true
  });
  console.log('Active view before switch:', val(viewBefore));

  console.log('Calling switchView("transfers")...');
  await send('Runtime.evaluate', {
    expression: 'switchView("transfers");'
  });
  await new Promise(r => setTimeout(r, 2500));

  const viewAfter = await send('Runtime.evaluate', {
    expression: 'document.querySelector(".view-section:not(.hidden)") ? document.querySelector(".view-section:not(.hidden)").id : "none"',
    returnByValue: true
  });
  console.log('Active view after switch:', val(viewAfter));

  const panelCheck = await send('Runtime.evaluate', {
    expression: '!!document.getElementById("reman-filters-panel")',
    returnByValue: true
  });
  console.log('reman-filters-panel exists:', val(panelCheck));

  const summaryText = await send('Runtime.evaluate', {
    expression: 'document.getElementById("reman-filter-summary") ? document.getElementById("reman-filter-summary").innerText : "none"',
    returnByValue: true
  });
  console.log('Summary text:', val(summaryText));

  const routeCards = await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll(".transfer-route-card").length',
    returnByValue: true
  });
  console.log('Route cards count:', val(routeCards));

  const kpis = await send('Runtime.evaluate', {
    expression: 'document.getElementById("transfers-kpi-strip") ? document.getElementById("transfers-kpi-strip").innerText.replace(/\\s+/g, " ") : "none"',
    returnByValue: true
  });
  console.log('KPI Strip:', val(kpis));

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

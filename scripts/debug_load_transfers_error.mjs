import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval5',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9229/json/list').then(r => r.json());
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const errors = [];
  const logs = [];
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push(d.params.exceptionDetails);
    }
    if (d.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${d.params.type}] ` + d.params.args.map(a => a.value || a.description).join(' '));
    }
  };

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
  await send('Page.navigate', { url: 'http://127.0.0.1:3456' });
  await new Promise(r => setTimeout(r, 3500));

  console.log('Navigating to transfers...');
  const res = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          switchView('transfers');
          await loadTransfers();
          return 'loadTransfers finished successfully';
        } catch (e) {
          return 'ERROR in loadTransfers: ' + e.message + ' \\nStack: ' + e.stack;
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Execution result:', res.result?.result?.value);
  console.log('Console logs:', logs);
  console.log('Exceptions:', errors);

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval3',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9225/json/list').then(r => r.json());
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const errors = [];
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push(d.params.exceptionDetails);
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      errors.push(d.params.args);
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

  console.log('Console errors count:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', JSON.stringify(errors, null, 2));
  }

  // Now call switchView('transfers')
  const res = await send('Runtime.evaluate', {
    expression: `
      try {
        switchView('transfers');
        'success';
      } catch (e) {
        'error: ' + e.message + ' stack: ' + e.stack;
      }
    `,
    returnByValue: true
  });
  console.log('Direct switchView result:', res.result?.result?.value);

  const viewState = await send('Runtime.evaluate', {
    expression: `
      ({
        stateView: state.view,
        transfersHidden: document.getElementById('view-transfers')?.classList.contains('hidden'),
        homeHidden: document.getElementById('view-home')?.classList.contains('hidden')
      })
    `,
    returnByValue: true
  });
  console.log('View state after direct call:', viewState.result?.result?.value);

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

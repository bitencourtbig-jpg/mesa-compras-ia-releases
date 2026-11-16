import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval2',
    '--window-size=1600,1000',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9224/json/list').then(r => r.json());
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

  // Click on the transfers tab directly!
  console.log('Clicking transfers nav item or button...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find nav button with data-view="transfers"
        const navBtn = document.querySelector('[data-view="transfers"]');
        if (navBtn) {
          navBtn.click();
          return 'Clicked navBtn';
        }
        // Otherwise try btn-goto-transfers
        const gotoBtn = document.getElementById('btn-goto-transfers');
        if (gotoBtn) {
          gotoBtn.click();
          return 'Clicked gotoBtn';
        }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Click result:', val(clickRes));
  await new Promise(r => setTimeout(r, 2000));

  const visibleSections = await send('Runtime.evaluate', {
    expression: `
      Array.from(document.querySelectorAll('.view-section')).map(s => ({
        id: s.id,
        hidden: s.classList.contains('hidden'),
        display: window.getComputedStyle(s).display
      }))
    `,
    returnByValue: true
  });
  console.log('Visible sections:', val(visibleSections));

  const searchInputVal = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inp = document.getElementById('reman-search-input');
        const selT = document.getElementById('reman-filter-tipo');
        const selC = document.getElementById('reman-filter-curva');
        return {
          hasInput: !!inp,
          tipoVal: selT ? selT.value : null,
          curvaVal: selC ? selC.value : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Filter inputs:', val(searchInputVal));

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

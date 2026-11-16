import { spawn } from 'child_process';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-allow-origins=*',
    '--user-data-dir=C:\\Users\\quemf\\.gemini\\antigravity\\scratch\\cdp-test-eval4',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await fetch('http://127.0.0.1:9227/json/list').then(r => r.json());
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

  const navItems = await send('Runtime.evaluate', {
    expression: `
      Array.from(document.querySelectorAll('.nav-item')).map(b => ({
        tag: b.tagName,
        text: b.innerText.trim(),
        dataset: Object.assign({}, b.dataset),
        classes: b.className
      }))
    `,
    returnByValue: true
  });
  console.log('Nav items:', navItems.result?.result?.value);

  // Let's see what happens when we click the button with text containing 'Remanejamento'
  console.log('Clicking the Remanejamento nav button...');
  await send('Runtime.evaluate', {
    expression: `
      const b = Array.from(document.querySelectorAll('.nav-item')).find(x => x.innerText.includes('Remanejamento'));
      if (b) b.click();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const activeInfo = await send('Runtime.evaluate', {
    expression: `
      ({
        stateView: state.view,
        activeNav: document.querySelector('.nav-item.active')?.innerText.trim(),
        viewTransfersDisplay: window.getComputedStyle(document.getElementById('view-transfers')).display,
        viewHomeDisplay: window.getComputedStyle(document.getElementById('view-home')).display
      })
    `,
    returnByValue: true
  });
  console.log('Active info after click:', activeInfo.result?.result?.value);

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

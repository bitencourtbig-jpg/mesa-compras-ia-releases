import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('public/index.html', 'utf8');
const code = fs.readFileSync('public/app.js', 'utf8');

// Build a mock DOM containing all IDs from html
const elementStore = {};
const allIds = [...html.matchAll(/id=['"]([^'"]+)['"]/g)].map(m => m[1]);

class MockElement {
  constructor(id) {
    this.id = id;
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    };
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.listeners = {};
    this.checked = false;
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
}

for (const id of allIds) {
  elementStore[id] = new MockElement(id);
}

const mockDoc = {
  getElementById(id) {
    if (!elementStore[id]) {
      elementStore[id] = new MockElement(id);
    }
    return elementStore[id];
  },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {},
  body: new MockElement('body'),
  createElement(tag) { return new MockElement(tag); }
};

const sandbox = {
  document: mockDoc,
  window: {
    addEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
  },
  fetch: () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      overview: { latestRun: null },
      rows: [],
      total: 0,
      sumRs: 0,
      glossary: [],
      profile: { name: 'Teste' },
      filiais: []
    })
  }),
  console: console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  URLSearchParams: URLSearchParams,
  encodeURIComponent: encodeURIComponent,
  confirm: () => false,
  alert: console.log,
  navigator: { clipboard: { writeText: () => {} } }
};

vm.createContext(sandbox);

try {
  vm.runInContext(code, sandbox);
  console.log('>>> Script parsed successfully without syntax errors!');
} catch (e) {
  console.error('>>> SYNTAX / PARSE ERROR:', e);
}


import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('public/index.html', 'utf8');
const code = fs.readFileSync('public/app.js', 'utf8');

const elementStore = {};
const allIds = [...html.matchAll(/id=['"]([^'"]+)['"]/g)].map(m => m[1]);

class MockElement {
  constructor(id) {
    this.id = id;
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); },
      contains(c) { return this._classes.has(c); }
    };
    this.style = {};
    this.value = '1';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = { tab: 'comprar', qidx: '0', sourceId: '1', targetId: '2', qty: '10' };
    this.listeners = {};
    this.checked = false;
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  removeEventListener() {}
  querySelector() { return new MockElement('inner'); }
  querySelectorAll() { return [new MockElement('inner')]; }
  closest() { return this; }
  click() {
    if (this.listeners['click']) {
      for (const fn of this.listeners['click']) {
        fn({ target: this, preventDefault: () => {}, stopPropagation: () => {} });
      }
    }
  }
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
  querySelectorAll() { return [new MockElement('query')]; },
  querySelector() { return new MockElement('query'); },
  addEventListener(evt, fn) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  },
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
      overview: { latestRun: { id: 1, summary: { elapsedMs: 1000 } } },
      rows: [
        {
          filial_id: 2,
          produto_id: 100,
          descricao: 'DIPIRONA 500MG 20CP',
          barras: '789000000',
          labora: 'EMS',
          macro_categoria: 'MEDICAMENTO_ETICO',
          abc_class: 'A',
          xyz_class: 'X',
          preco_venda: 10,
          custo_unit: 5,
          sugestao_compra_un: 10,
          sugestao_compra_rs: 50,
          molecule_key: 'DIPIRONA|500MG|CPR|~20UN',
          excecoes: []
        }
      ],
      total: 1,
      sumRs: 50,
      glossary: [],
      profile: { name: 'Drogaria Teste', buyer_filial_id: 2 },
      filiais: [],
      skus: [],
      transfers: [],
      expiringLots: [],
      rowsPbm: []
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
vm.runInContext(code, sandbox);

// Let's test triggering clicks on all major buttons!
console.log('Testing button clicks...');
const buttonsToTest = [
  'btn-open-db-config',
  'btn-close-db-config',
  'btn-open-quotation-modal',
  'btn-close-quotation',
  'btn-open-glossary',
  'btn-close-glossary',
  'btn-open-sync-big-apres',
  'btn-close-sync-big-apres',
  'btn-test-db-connection',
  'btn-save-db-config',
  'btn-recalc'
];

for (const btnId of buttonsToTest) {
  try {
    console.log(`Clicking ${btnId}...`);
    elementStore[btnId]?.click();
  } catch (err) {
    console.error(`ERROR clicking ${btnId}:`, err);
    process.exit(1);
  }
}

console.log('>>> ALL TEST BUTTONS CLICKED CLEANLY WITH ZERO ERRORS!');


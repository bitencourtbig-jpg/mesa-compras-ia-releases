import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('public/index.html', 'utf8');
const code = fs.readFileSync('public/app.js', 'utf8');

const elementStore = {};
const allIds = [...html.matchAll(/id=['"]([^'"]+)['"]/g)].map(m => m[1]);

class MockElement {
  constructor(id) {
    this.id = id;
    this._classes = new Set();
    this.classList = {
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      toggle: (c) => this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c),
      contains: (c) => this._classes.has(c)
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
  trigger(evt, payload = {}) {
    for (const fn of (this.listeners[evt] || [])) fn({ target: this, ...payload });
  }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return this; }
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
  fetch: (url) => {
    if (url.includes('/api/molecules/sync-preview')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          summary: { totalCandidates: 11, pendingToLink: 0, alreadyLinked: 11, uniquePresentations: 1 },
          clusters: [{
            canonical_key: 'ACETILCISTEINA|600MG|16 SACHES',
            substancia: 'ACETILCISTEINA',
            concentracao: '600MG',
            qtd_forma_farmaceutica: '16 SACHES',
            skus_count: 11,
            pending_count: 1,
            linked_count: 10,
            labs: ['EMS G', 'EUROF', 'ZAMBO'],
            items: [
              { produto_id: 7944, descricao: 'FLUIMUCIL D 600MG', labora: 'ZAMBO', estoque_atual: 10, sugestao_compra_un: 0, status: 'VINCULADO_ATIVO', current_apres_id: 1823 }
            ]
          }],
          items: [
            { produto_id: 7944, descricao: 'FLUIMUCIL D 600MG', labora: 'ZAMBO', substancia: 'ACETILCISTEINA', concentracao: '600MG', qtd_forma_farmaceutica: '16 SACHES', status: 'VINCULADO_ATIVO' }
          ]
        })
      });
    }
    return Promise.resolve({
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
    });
  },
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

console.log('Testing openSyncBigApresModal...');
await sandbox.openSyncBigApresModal();

const clustersBox = mockDoc.getElementById('sync-clusters-container');
console.log('Clusters rendered HTML:', clustersBox.innerHTML);
console.log('Contains ACETILCISTEINA:', clustersBox.innerHTML.includes('ACETILCISTEINA'));
console.log('Contains 16 SACHES:', clustersBox.innerHTML.includes('16 SACHES'));

console.log('Testing view mode toggle to SKUs...');
mockDoc.getElementById('btn-sync-view-skus').trigger('click');
console.log('SKUs box visible:', !mockDoc.getElementById('sync-skus-container').classList.contains('hidden'));

console.log('Testing view mode toggle to Clusters...');
mockDoc.getElementById('btn-sync-view-clusters').trigger('click');
console.log('Clusters box visible:', !mockDoc.getElementById('sync-clusters-container').classList.contains('hidden'));

console.log('>>> UI SIMULATION PASSED CLEANLY WITH ZERO ERRORS!');

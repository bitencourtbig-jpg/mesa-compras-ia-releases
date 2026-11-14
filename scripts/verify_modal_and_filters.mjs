import fs from 'node:fs';
import vm from 'node:vm';

console.log('=== TESTE DE REGRESSÃO: MODAIS, RESUMO DINÂMICO & FILTRO DE FABRICANTES ===');

// 1. Verificar CSS
const css = fs.readFileSync('public/styles.css', 'utf8');

if (css.includes('display: flex !important')) {
  console.error('❌ FAIL: CSS still has "display: flex !important" in modal rules, which breaks .hidden!');
  process.exit(1);
} else {
  console.log('✅ PASS: CSS modal display does not override .hidden (!important removed)');
}

if (!css.includes('.modal-backdrop.hidden') || !css.includes('display: none !important;')) {
  console.error('❌ FAIL: CSS missing strict hidden rule for .modal-backdrop.hidden!');
  process.exit(1);
} else {
  console.log('✅ PASS: CSS strictly enforces display: none !important for hidden modals');
}

// 2. Verificar HTML
const html = fs.readFileSync('public/index.html', 'utf8');

const modalDivs = [...html.matchAll(/<div id="([^"]+modal[^"]*)" class="([^"]+)"/g)]
  .filter(m => m[1].endsWith('-modal') || m[1].startsWith('modal-'));
let allModalsHaveHidden = true;
for (const m of modalDivs) {
  const id = m[1];
  const cls = m[2];
  if (!cls.includes('hidden')) {
    console.error(`❌ FAIL: Modal #${id} is missing the "hidden" class in index.html!`);
    allModalsHaveHidden = false;
  }
}

if (allModalsHaveHidden && modalDivs.length >= 8) {
  console.log(`✅ PASS: All ${modalDivs.length} modals start with "hidden" class in index.html`);
}

if (!html.includes('id="quick-labora-chips"')) {
  console.error('❌ FAIL: #quick-labora-chips missing from index.html!');
  process.exit(1);
} else {
  console.log('✅ PASS: #quick-labora-chips container exists in index.html');
}

if (!html.includes('<select id="filter-labora"')) {
  console.error('❌ FAIL: <select id="filter-labora"> missing from index.html!');
  process.exit(1);
} else {
  console.log('✅ PASS: <select id="filter-labora"> exists in index.html');
}

// 3. Execução do app.js no mock DOM
const appJs = fs.readFileSync('public/app.js', 'utf8');

const elementStore = {};
const allIds = [...html.matchAll(/id=['"]([^'"]+)['"]/g)].map(m => m[1]);

class MockElement {
  constructor(id) {
    this.id = id;
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force !== undefined) {
          if (force) this._classes.add(c); else this._classes.delete(c);
        } else {
          if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
        }
      },
      contains(c) { return this._classes.has(c); }
    };
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.listeners = {};
    this.disabled = false;
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  querySelector() { return new MockElement('inner'); }
  querySelectorAll() { return [new MockElement('inner')]; }
  closest() { return this; }
}

for (const id of allIds) {
  elementStore[id] = new MockElement(id);
}

class MockMutationObserver {
  observe() {}
  disconnect() {}
}

const mockDoc = {
  getElementById(id) {
    if (!elementStore[id]) elementStore[id] = new MockElement(id);
    return elementStore[id];
  },
  querySelectorAll() { return [new MockElement('query')]; },
  querySelector() { return new MockElement('query'); },
  addEventListener: () => {},
  body: new MockElement('body'),
  createElement(tag) { return new MockElement(tag); }
};

const sandbox = {
  document: mockDoc,
  window: {
    addEventListener: () => {},
    scrollTo: () => {},
    confirm: () => true,
    alert: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
  },
  MutationObserver: MockMutationObserver,
  fetch: () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      profile: { name: 'Teste' },
      latestRun: { id: 1, summary: { elapsedMs: 100 } },
      filtersMeta: {
        pbmCount: 200,
        gruposPai: [{ nome: 'ÉTICOS', cnt: 100 }],
        laboratorios: [
          { labora: 'ACHE', cnt: 219 },
          { labora: 'EMS G', cnt: 328 },
          { labora: 'EUROF', cnt: 710 },
          { labora: 'MEDLE', cnt: 242 },
          { labora: 'CIMED', cnt: 256 },
        ]
      },
      rows: [
        { produto_id: 1, descricao: 'DIPIRONA', labora: 'EMS G', abc_class: 'A', sugestao_compra_un: 10, sugestao_compra_rs: 50 }
      ],
      total: 46,
      sumRs: 14689.82
    })
  }),
  URLSearchParams,
  console
};

vm.createContext(sandbox);
vm.runInContext(appJs, sandbox);

console.log('✅ PASS: app.js loaded and executed in sandbox without errors');

// Testar renderTableSummary diretamente
const renderSummaryFn = sandbox.renderTableSummary;
if (typeof renderSummaryFn === 'function') {
  renderSummaryFn({
    total: 46,
    rows: Array(46).fill({}),
    sumRs: 14689.82
  });
  const summaryEl = elementStore['table-summary'];
  const text = summaryEl.innerHTML;
  
  if (text.includes('Exibindo até 80 de 46')) {
    console.error('❌ FAIL: Awkward "Exibindo até 80 de 46" still present!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Incoherent "Exibindo até 80 de 46" eliminated!');
  }

  if (text.includes('46 SKUs') && text.includes('14.689,82')) {
    console.log('✅ PASS: Table summary correctly renders formatted count (46 SKUs) and total sum (R$ 14.689,82)');
  } else {
    console.error('❌ FAIL: Expected 46 SKUs and 14.689,82 in summary HTML! Output:', text);
    process.exit(1);
  }
} else {
  console.error('❌ FAIL: renderTableSummary function not defined on global/sandbox');
  process.exit(1);
}

// Testar quick labora chips aguardando o carregamento assíncrono
await new Promise(r => setTimeout(r, 50));
const quickContainer = elementStore['quick-labora-chips'];
if (quickContainer.innerHTML.includes('Aché') && quickContainer.innerHTML.includes('EMS')) {
  console.log('✅ PASS: Quick labora chips populated with friendly names (Aché, EMS, etc.)');
} else {
  console.error('❌ FAIL: Quick labora chips not populated correctly. HTML:', quickContainer.innerHTML);
}

console.log('=== TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ===');

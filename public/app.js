const state = {
  view: 'home',
  tab: 'exceptions',
  q: '',
  abc: '',
  abcxyz: '',
  macro: '',
  grupoPai: '',
  grupoFilho: '',
  grupoId: null,
  limit: 80,
  offset: 0,
  page: 1,
  totalMatchingSkus: 0,
  labora: '',
  stockStatus: '',
  pbmFilter: '',
  coverageHorizonDays: null,
  sortKey: '',
  sortDir: 'desc',
  exc: '',
  sort: 'impact',
  budget: 0,
  molQ: '',
  molOnlySavings: true,
  pbmQ: '',
  expandedSkuKeys: new Set(),
  expandedMolKeys: new Set(),
  visibleSkus: [],
  selectedSkus: new Map(), // key -> { rs, desc }
  overview: null,
  glossary: null,
  glossarySec: 'all',
  glossaryQ: '',
  syncBigCandidates: [],
  syncBigSelectedIds: new Set(),
  pendingSuspendSku: null,
  groupsTreeData: null,
  budgetAuditData: null,
  paretoA: 55,
  paretoB: 35,
  paretoC: 10,
};

const brl = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const num = (v, dec = 0) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toTitleCase(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/(?:^|\s|\/|-)[a-zà-ÿ]/g, (c) => c.toUpperCase());
}

function formatFriendlyProduct(r) {
  const rawDesc = String(r.descricao || '').trim();
  const labora = String(r.labora || '').trim();
  const medType = r.tipo_produto_cmed || (r.macro_categoria === 'MEDICAMENTO' ? 'Medicamento' : '');

  // 1. Título comercial: SEMPRE a descrição comercial cadastrada no ERP BIG (REV-012)
  const commercialTitle = rawDesc;

  // 2. Se for medicamento efetivo com molécula identificada pela IA
  let moleculeBadge = '';
  if (r.molecule_key) {
    const [subst = '', conc = '', form = '', pack = ''] = r.molecule_key.split('|');
    const cleanSubst = toTitleCase(subst);
    const cleanPack = pack && pack !== '?' ? (pack.startsWith('~') ? pack.slice(1) : pack) : '';
    let formDesc = 'Comprimidos';
    if (form === 'CAPS' || form === 'CAPS_LP') formDesc = 'Cápsulas';
    else if (form === 'GOTAS') formDesc = 'Gotas';
    else if (form === 'XAROPE') formDesc = 'Xarope';
    else if (form === 'CREME') formDesc = 'Creme';
    else if (form === 'POMADA') formDesc = 'Pomada';
    else if (form === 'GEL') formDesc = 'Gel';
    else if (form === 'SOL') formDesc = 'Solução';

    const presentationText = cleanPack ? ` • ${cleanPack.replace('UN', ` ${formDesc}`)}` : '';
    moleculeBadge = `🔬 ${cleanSubst}${conc ? ` ${conc}` : ''}${presentationText}`;
  }

  // 3. Auditoria de cadastro BIG pela IA (minimizando erros de cadastro do ERP)
  let auditAnomaly = '';
  let auditAnomalyTooltip = '';
  if (r.medicamento_flag === 'S' && r.macro_categoria !== 'MEDICAMENTO') {
    auditAnomaly = '⚠️ Cadastro BIG: Flag Medicamento em Perfumaria/HPC';
    auditAnomalyTooltip = 'No ERP BIG este item está com medicamento="S", mas foi classificado como Perfumaria/HPC pela IA para evitar distorções de molécula.';
  } else if (r.medicamento_flag !== 'S' && r.medicamento_efetivo === 1) {
    auditAnomaly = '💡 Medicamento Identificado via EAN/Anvisa';
    auditAnomalyTooltip = 'No ERP BIG a flag medicamento está vazia ou "N", mas a IA localizou registro MS/Anvisa e EAN ativo na CMED.';
  }

  return {
    title: commercialTitle,
    labora: labora || (r.macro_categoria === 'MEDICAMENTO' ? 'Indústria Farmacêutica' : 'Fabricante'),
    medType,
    moleculeBadge,
    auditAnomaly,
    auditAnomalyTooltip,
    rawDesc,
  };
}

function showBanner(msg, isError = false) {
  const el = document.getElementById('status-banner');
  if (!msg) {
    el.classList.add('hidden');
    return;
  }
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
}

async function apiGet(url, signal = null) {
  const masterToken = sessionStorage.getItem('big_master_token');
  const headers = {};
  if (masterToken) headers['x-master-token'] = masterToken;
  const opts = { headers, ...(signal ? { signal } : {}) };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || res.statusText);
    err.data = data;
    throw err;
  }
  return res.json();
}

async function apiPost(url, body) {
  const masterToken = sessionStorage.getItem('big_master_token');
  const headers = { 'Content-Type': 'application/json' };
  if (masterToken) headers['x-master-token'] = masterToken;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || res.statusText);
    err.data = data;
    throw err;
  }
  return res.json();
}

function formatFilialTag(filialId, nomeReduz, nomeCompleto) {
  const fId = Number(filialId || 2);
  let short = (nomeReduz || '').trim();
  if (!short && nomeCompleto) short = nomeCompleto.slice(0, 15).trim();
  if (!short) short = `Filial ${fId}`;
  return `L${String(fId).padStart(2, '0')} • ${short}`;
}

function badgeForException(code) {
  if (code.startsWith('RUPTURA_') || code === 'LOTE_VENCIDO') return `<span class="badge badge-danger">${esc(code)}</span>`;
  if (code.includes('PBM') || code.includes('MOLECULA')) return `<span class="badge badge-info">${esc(code)}</span>`;
  if (code.includes('LOTE') || code.includes('PERDA') || code.includes('ALTA_CUSTO') || code.includes('NEGATIVO'))
    return `<span class="badge badge-warn">${esc(code)}</span>`;
  if (code.includes('REMANEJAMENTO')) return `<span class="badge badge-success">${esc(code)}</span>`;
  return `<span class="badge badge-neutral">${esc(code)}</span>`;
}

function badgeForAction(ia) {
  const map = {
    danger: 'badge-danger',
    warn: 'badge-warn',
    success: 'badge-success',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };
  return `<span class="badge ${map[ia.acaoTom] || 'badge-neutral'}">${esc(ia.acaoLabel)}</span>`;
}

function confClass(nivel) {
  if (nivel === 'ALTA') return 'conf-high';
  if (nivel === 'MÉDIA') return 'conf-med';
  return 'conf-low';
}

function macroLabel(m) {
  const map = {
    MEDICAMENTO: 'Medicamento',
    PERFUMARIA_HPC: 'Perfumaria/HPC',
    SUPLEMENTO_VITAMINA: 'Suplemento',
    DERMOCOSMETICO: 'Dermocosmético',
    CONVENIENCIA_VAREJO: 'Varejo/Conv.',
  };
  return map[m] || m;
}

const LAB_FRIENDLY_NAMES = {
  ACHE: 'Aché',
  'ACHE-': 'Aché Hospitalar',
  'EMS G': 'EMS Genéricos',
  EUROF: 'Eurofarma',
  MEDLE: 'Medley',
  CIMED: 'Cimed',
  BIOLA: 'Biolab',
  NEOPA: 'Neo Química',
  LIBBS: 'Libbs',
  SANDO: 'Sandoz',
  TEUTO: 'Teuto',
  MERCK: 'Merck',
  APSEN: 'Apsen',
  GERME: 'Germed',
  SIGMA: 'Sigma Pharma',
  FARMA: 'Farmasa',
  BIOSI: 'Biosintética',
  UNIAO: 'União Química',
  MYRAL: 'Myralis',
  HYPER: 'Hypera Pharma',
  VULT: 'Vult Cosméticos',
  RUBY: 'Ruby Rose',
  UNILE: 'Unilever',
  JOHNS: 'Johnson & Johnson',
  SALON: 'Salon Line',
  PROCT: 'Procter & Gamble',
  HASKE: 'Haskell',
  COLGA: 'Colgate-Palmolive',
  DAILU: 'Dailus',
  RISQU: 'Risqué',
  NESTL: 'Nestlé',
  NIVEA: 'Nivea',
  LOREA: 'L\'Oréal',
  KIMBE: 'Kimberly-Clark',
  ARCOR: 'Arcor',
  KOBBE: 'Kopenhagen',
  REVIS: 'Outros / Sob Revisão',
};

function getLabFriendlyName(code) {
  if (!code) return 'Todos';
  return LAB_FRIENDLY_NAMES[code] || code;
}

function renderQuickLaboraChips(labs = []) {
  const container = document.getElementById('quick-labora-chips');
  if (!container) return;

  const topLabs = labs
    .filter(l => l && l.labora && l.labora !== 'REVIS')
    .slice(0, 18);

  const chipsHtml = [
    `<button type="button" class="quick-chip ${!state.labora ? 'active' : ''}" data-lab="">🏢 Todos</button>`,
    ...topLabs.map(l => `
      <button type="button" class="quick-chip ${state.labora === l.labora ? 'active' : ''}" data-lab="${esc(l.labora)}" title="${esc(getLabFriendlyName(l.labora))} (${l.cnt} SKUs)">
        ${esc(getLabFriendlyName(l.labora))} <span class="quick-chip-count">${num(l.cnt)}</span>
      </button>
    `),
  ];

  container.innerHTML = chipsHtml.join('');
}

function syncQuickLaboraChips() {
  document.querySelectorAll('#quick-labora-chips .quick-chip').forEach((chip) => {
    const lab = chip.dataset.lab || '';
    chip.classList.toggle('active', (!state.labora && !lab) || (state.labora && state.labora === lab));
  });
}

function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === viewName));
  state.view = viewName;
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.add('hidden'));
  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) targetSec.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });

  const isHome = viewName === 'home';
  const kpiStrip = document.getElementById('kpi-strip');
  const filialStrip = document.getElementById('filial-selector-strip');
  const topControls = document.querySelector('.topbar-controls');
  if (kpiStrip) kpiStrip.style.display = isHome ? 'none' : '';
  if (filialStrip) filialStrip.style.display = isHome ? 'none' : '';
  if (topControls) topControls.style.display = isHome ? 'none' : '';

  const titles = {
    home: ['Início & Apresentação Executiva', 'Mesa de Compras IA • Motor de Inteligência em Abastecimento Farmacêutico'],
    cockpit: ['Mesa de Compras por Exceção', '100% Mix com Veredito Direto, Confiança IA e Exportação Cotefácil'],
    bi: ['BI Executivo de Estoque & Compras', 'Onde o capital está parado, retorno por categoria e impacto da Inteligência Artificial'],
    molecules: ['Compra de Molécula & Curadoria CMED', 'Consolidação por Princípio Ativo + Dosagem + Regra 28–30 CP'],
    transfers: ['Remanejamento Multi-Loja & Controle de Lotes', 'Cascata transfer-first e prevenção de perdas por validade'],
    pbm: ['Auditoria & Regras PBM', 'Identificação real por NSU, Autorização e Cartão/CPF'],
  };
  const titleInfo = titles[viewName] || ['Mesa de Compras', ''];
  const elTitle = document.getElementById('view-title');
  const elSub = document.getElementById('view-subtitle');
  if (elTitle) elTitle.textContent = titleInfo[0];
  if (elSub) elSub.textContent = titleInfo[1];

  if (isHome) {
    renderHomeScreen();
  } else {
    refreshActiveView();
  }
}

function renderHomeScreen() {
  const container = document.getElementById('view-home');
  if (!container) return;

  const lic = state.licenseStatus || { isValid: false, isExpired: true, daysRemaining: 0 };
  const ov = state.overview || {};
  const profile = ov.profile || {};
  const cmed = ov.cmedImport || null;
  const days = Number(lic.daysRemaining || 0);
  const isExp = lic.isExpired || !lic.isValid || days <= 0;
  const isNear = !isExp && days <= 10;

  // 1. Renderiza o Card de Assinatura & Suporte com Alerta de 10 dias / WhatsApp
  const licenseCard = document.getElementById('home-license-card');
  if (licenseCard) {
    if (isExp) {
      licenseCard.innerHTML = `
        <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #991b1b; display: flex; align-items: center; gap: 8px;">
              <span>🚨 Assinatura Mensal Expirada!</span>
              <span class="badge" style="background:#fee2e2; color:#b91c1c;">Acesso Bloqueado</span>
            </div>
            <div style="font-size: 13px; color: #b91c1c; margin-top: 4px; line-height: 1.4;">
              Seu período de uso venceu em <strong>${lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : 'Data não informada'}</strong>.<br>
              Para continuar calculando suas cotações e gerando pedidos, renove a licença com a <strong>FSConsultoria</strong>.
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Meu sistema Mesa de Compras IA expirou (Máquina: ' + (lic.currentMachineId || '') + '). Gostaria de receber a chave de renovação mensal.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#25d366; border:1px solid #16a34a; color:#fff; font-weight:700; padding:11px 20px; font-size:13.5px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; border-radius:8px; box-shadow:0 4px 12px rgba(37,211,102,0.3);">
              <span>📲 Renovar no WhatsApp (17) 98120-5660</span>
            </a>
            <button id="btn-home-quick-activate" class="btn btn-secondary" type="button">🔑 Inserir Nova Chave</button>
          </div>
        </div>
      `;
    } else if (isNear) {
      licenseCard.innerHTML = `
        <div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #92400e; display: flex; align-items: center; gap: 8px;">
              <span>⚠️ Licença a Vencer: Restam ${days} dias de Assinatura!</span>
              <span class="badge" style="background:#fef3c7; color:#b45309;">Renovação Próxima</span>
            </div>
            <div style="font-size: 13px; color: #b45309; margin-top: 4px; line-height: 1.4;">
              Sua licença mensal vence em <strong>${lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : ''}</strong> (${days} dias restantes).<br>
              Garanta a continuidade do cálculo da sua drogaria sem interrupções solicitando a renovação à FSConsultoria.
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Meu sistema Mesa de Compras IA vence em ' + days + ' dias (Máquina: ' + (lic.currentMachineId || '') + '). Gostaria de antecipar a renovação.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#25d366; border:1px solid #16a34a; color:#fff; font-weight:700; padding:11px 20px; font-size:13.5px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; border-radius:8px; box-shadow:0 4px 12px rgba(37,211,102,0.3);">
              <span>📲 Falar com FSConsultoria no WhatsApp (17) 98120-5660</span>
            </a>
            <button id="btn-home-quick-activate" class="btn btn-secondary" type="button">🔑 Inserir Chave</button>
          </div>
        </div>
      `;
    } else {
      licenseCard.innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 14.5px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block;"></span>
              <span>Assinatura Ativa • ${days} dias restantes</span>
              <span class="badge" style="background:#dcfce7; color:#15803d; font-size:11px;">Válida até ${lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : ''}</span>
            </div>
            <div style="font-size: 12px; color: #15803d; margin-top: 3px;">
              Farmácia: <strong>${esc(lic.clientName || profile.name || 'Drogaria')}</strong> • Hardware ID: <code>${lic.currentMachineId || ''}</code>
            </div>
          </div>
          <div>
            <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Gostaria de tirar uma dúvida sobre o Mesa de Compras IA.')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
              <span>💬 Suporte FSConsultoria (17) 98120-5660</span>
            </a>
          </div>
        </div>
      `;
    }
  }

  // 2. Renderiza o Grid de Setup do Ambiente (MariaDB & CMED)
  const setupGrid = document.getElementById('home-setup-status-grid');
  if (setupGrid) {
    const isDbConnected = profile && profile.db_host && !profile.isMasterLocked;
    const isCmedReady = cmed && cmed.total_rows > 0;

    setupGrid.innerHTML = `
      <div class="setup-card">
        <div class="setup-card-info">
          <div class="setup-card-title">
            <span>${isDbConnected ? '🟢' : '🔌'} Conexão Banco de Dados (MariaDB)</span>
          </div>
          <div class="setup-card-desc">
            ${isDbConnected
              ? `Conectado ao servidor <strong>${esc(profile.db_host)}:${profile.db_port || 3306}</strong> (Banco: ${esc(profile.db_name || 'gerente')}, Filial ${profile.buyer_filial_id || 2})`
              : 'Configuração protegida por Senha Master. Clique para conectar ao banco do cliente.'}
          </div>
        </div>
        <button id="btn-home-card-db" class="btn btn-secondary btn-sm" type="button">
          ${isDbConnected ? '⚙️ Ajustar' : '🔒 Conectar'}
        </button>
      </div>

      <div class="setup-card">
        <div class="setup-card-info">
          <div class="setup-card-title">
            <span>${isCmedReady ? '🟢' : '⚠️'} Catálogo Oficial CMED / ANVISA</span>
          </div>
          <div class="setup-card-desc">
            ${isCmedReady
              ? `Base oficial ativa com <strong>${num(cmed.total_rows)} apresentações</strong> indexadas (${esc(cmed.source_file || 'Lista_PMC.xlsx')})`
              : 'Base CMED não importada. Baixe a planilha da Anvisa e importe para habilitar análise de molécula.'}
          </div>
        </div>
        <button id="btn-home-card-cmed" class="btn btn-secondary btn-sm" type="button">
          ${isCmedReady ? '🔄 Atualizar CMED' : '⚡ Importar Planilha'}
        </button>
      </div>
    `;

    document.getElementById('btn-home-card-db')?.addEventListener('click', () => {
      promptMasterAuth(() => openDbConfigModal());
    });
    document.getElementById('btn-home-card-cmed')?.addEventListener('click', () => {
      openCmedImportModal();
    });
  }

  document.getElementById('btn-home-quick-activate')?.addEventListener('click', () => {
    openWelcomeGate(false);
  });
}

let _selectedCmedFile = null;

function openCmedImportModal() {
  const modal = document.getElementById('modal-cmed-import');
  if (!modal) return;
  modal.classList.remove('hidden');
  _selectedCmedFile = null;
  const lbl = document.getElementById('cmed-selected-file-label');
  const btnSubmit = document.getElementById('btn-submit-cmed-import');
  const feedback = document.getElementById('cmed-import-feedback');
  const prog = document.getElementById('cmed-import-progress');
  if (lbl) lbl.textContent = '';
  if (btnSubmit) btnSubmit.disabled = true;
  if (feedback) feedback.style.display = 'none';
  if (prog) prog.style.display = 'none';
}

function closeCmedImportModal() {
  const modal = document.getElementById('modal-cmed-import');
  if (modal) modal.classList.add('hidden');
}

async function submitCmedImport() {
  if (!_selectedCmedFile) return;
  const btnSubmit = document.getElementById('btn-submit-cmed-import');
  const prog = document.getElementById('cmed-import-progress');
  const feedback = document.getElementById('cmed-import-feedback');

  if (btnSubmit) btnSubmit.disabled = true;
  if (prog) prog.style.display = 'block';
  if (feedback) feedback.style.display = 'none';

  try {
    const base64 = await readFileAsBase64(_selectedCmedFile);
    const res = await apiPost('/api/cmed/import', {
      fileName: _selectedCmedFile.name,
      fileBase64: base64
    });

    if (prog) prog.style.display = 'none';
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#f0fdf4';
      feedback.style.color = '#166534';
      feedback.style.border = '1px solid #bbf7d0';
      feedback.innerHTML = `<strong>✓ Sucesso!</strong> ${esc(res.message || 'CMED importado com sucesso!')}`;
    }
    await loadOverview();
    renderHomeScreen();
    setTimeout(() => {
      closeCmedImportModal();
    }, 2500);
  } catch (err) {
    if (prog) prog.style.display = 'none';
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#fef2f2';
      feedback.style.color = '#991b1b';
      feedback.style.border = '1px solid #fecaca';
      feedback.innerHTML = `<strong>Erro:</strong> ${esc(err.message)}`;
    }
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(new Error('Erro ao ler arquivo: ' + e));
    reader.readAsDataURL(file);
  });
}

function copyTextToClipboard(text, btnElement, successMsg = '✓ Copiado!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnElement.textContent;
      btnElement.textContent = successMsg;
      setTimeout(() => { btnElement.textContent = orig; }, 2000);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const orig = btnElement.textContent;
    btnElement.textContent = successMsg;
    setTimeout(() => { btnElement.textContent = orig; }, 2000);
  }
}

function renderHeroQuotationCard() {
  const hero = document.getElementById('hero-quotation-card');
  if (!hero) return;
  const count = state.selectedSkus.size;
  if (count === 0) {
    hero.classList.add('hidden');
    return;
  }
  let totalRs = 0;
  let totalUn = 0;
  for (const item of state.selectedSkus.values()) {
    totalRs += Number(item.rs || 0);
    totalUn += Number(item.un || 1);
  }
  hero.innerHTML = `
    <div class="hero-quote-left">
      <div class="hero-quote-badge">
        <span>🛒 <strong>${num(count)} SKUs Marcados</strong></span>
      </div>
      <div class="hero-quote-kpis">
        <div class="hero-quote-metric">
          <span class="metric-label">Total Cotado</span>
          <span class="metric-val-rs">${brl(totalRs)}</span>
        </div>
        <div class="hero-quote-metric">
          <span class="metric-label">Volume Físico</span>
          <span class="metric-val-units">${num(totalUn)} un</span>
        </div>
      </div>
    </div>
    <div class="hero-quote-right">
      <button id="btn-hero-view-selected" class="btn btn-hero-filter" type="button" title="Ver apenas os produtos que foram marcados">
        ⭐ Ver Apenas Selecionados
      </button>
      <button id="btn-hero-checkout" class="btn btn-hero-checkout" type="button" title="Revisar e exportar para Cotefácil ou gravar no BIG">
        📋 Fechar Pedido & Cotefácil (F8)
      </button>
      <button id="btn-hero-clear" class="btn btn-hero-clear" type="button" title="Desmarcar todos os produtos">
        ✕ Limpar
      </button>
    </div>
  `;
  hero.classList.remove('hidden');

  document.getElementById('btn-hero-view-selected')?.addEventListener('click', () => {
    state.tab = 'selected';
    state.offset = 0;
    state.page = 1;
    document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'selected'));
    loadSkus();
  });

  document.getElementById('btn-hero-checkout')?.addEventListener('click', openQuotationModal);
  document.getElementById('btn-hero-clear')?.addEventListener('click', () => {
    state.selectedSkus.clear();
    if (state.tab === 'selected') {
      state.tab = 'buy';
      document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'buy'));
    }
    loadSkus();
  });
}

function updateSelectionUi() {
  const pill = document.getElementById('selection-status');
  const clearBtn = document.getElementById('btn-clear-selection');
  const count = state.selectedSkus.size;
  if (count === 0) {
    pill.textContent = 'Nenhum item marcado (exportará todos os sugeridos da lista)';
    clearBtn.classList.add('hidden');
  } else {
    let sum = 0;
    for (const item of state.selectedSkus.values()) sum += Number(item.rs || 0);
    pill.textContent = `Selecionados para cotação: ${num(count)} SKUs (${brl(sum)})`;
    clearBtn.classList.remove('hidden');
  }

  const selectedTabCount = document.getElementById('selected-tab-count');
  if (selectedTabCount) selectedTabCount.textContent = num(count);

  const btnCount = document.getElementById('btn-quotation-count');
  if (btnCount) {
    const sugCount = state.visibleSkus ? state.visibleSkus.filter((r) => (r.budget_qtd ?? r.sugestao_compra_un) > 0).length : 0;
    btnCount.textContent = count > 0 ? num(count) : num(sugCount);
  }

  const chip = document.getElementById('active-extra-chip');
  const parts = [];
  if (state.abcxyz) parts.push(`Quadrante: ${state.abcxyz}`);
  if (state.exc) parts.push(`Exceção: ${state.exc}`);
  if (parts.length > 0) {
    chip.textContent = `${parts.join(' · ')} ×`;
    chip.classList.remove('hidden');
  } else {
    chip.classList.add('hidden');
  }

  renderHeroQuotationCard();
}

async function loadGlossary() {
  const data = await apiGet('/api/glossary');
  state.glossary = data;
  if (data.hints) {
    document.querySelectorAll('.th-hint[data-hint]').forEach((el) => {
      const hint = data.hints[el.dataset.hint];
      if (hint) el.title = `${hint} (Clique para abrir Legenda completa)`;
    });
  }
}

function renderGlossary() {
  if (!state.glossary) return;
  const tabsEl = document.getElementById('glossary-section-tabs');
  const secs = state.glossary.sections || [];
  tabsEl.innerHTML = [
    `<button class="tab ${state.glossarySec === 'all' ? 'active' : ''}" data-gsec="all">Todas</button>`,
    ...secs.map((s) => `<button class="tab ${state.glossarySec === s.id ? 'active' : ''}" data-gsec="${s.id}">${esc(s.title.split(' ')[0])}</button>`),
  ].join('');

  const q = state.glossaryQ.trim().toLowerCase();
  const filteredSecs = secs.filter((s) => state.glossarySec === 'all' || s.id === state.glossarySec);

  const html = [];
  for (const s of filteredSecs) {
    const items = s.items.filter(
      (i) =>
        !q ||
        i.code.toLowerCase().includes(q) ||
        i.meaning.toLowerCase().includes(q) ||
        i.detail.toLowerCase().includes(q) ||
        i.action.toLowerCase().includes(q)
    );
    if (items.length === 0) continue;
    html.push(`
      <div class="glossary-sec">
        <h3>${esc(s.title)}</h3>
        <div class="muted">${esc(s.description)}</div>
        <div class="glossary-grid">
          ${items
            .map(
              (i) => `
              <div class="glossary-item">
                <div class="glossary-code">${esc(i.code)}</div>
                <div class="glossary-meaning">${esc(i.meaning)}</div>
                <div class="glossary-detail">${esc(i.detail)}</div>
                <div class="glossary-action"><strong>Na prática:</strong> ${esc(i.action)}</div>
              </div>`
            )
            .join('')}
        </div>
      </div>
    `);
  }

  document.getElementById('glossary-body').innerHTML =
    html.length > 0 ? html.join('') : '<div class="muted" style="text-align:center;padding:24px;">Nenhuma sigla encontrada para esse termo.</div>';
}

function openGlossary(sectionId = 'all') {
  state.glossarySec = sectionId;
  renderGlossary();
  document.getElementById('glossary-modal').classList.remove('hidden');
}

function closeGlossary() {
  document.getElementById('glossary-modal').classList.add('hidden');
}

async function runPurchasingEngine() {
  const btn = document.getElementById('btn-recalc');
  if (btn) btn.disabled = true;
  showBanner('Sincronizando com o banco do BIG e recalculando o motor completo...');
  try {
    const res = await apiPost('/api/engine/run', {
      weeksWindow: Number(document.getElementById('ctrl-weeks')?.value || 13),
      serviceProfile: document.getElementById('ctrl-profile')?.value || 'equilibrado',
      recentEntriesLimit: Number(document.getElementById('ctrl-entries')?.value || 5),
      forceSync: true,
    });
    showBanner(`Recálculo concluído (Run #${res.runId} em ${(res.summary.elapsedMs / 1000).toFixed(2)}s).`);
    await loadOverview();
    await refreshActiveView();
  } catch (err) {
    showBanner(`Falha ao recalcular: ${err.message}`, true);
    if (err.message && (err.message.includes('Licença') || err.message.includes('expirada') || err.message.includes('assinatura') || err.message.includes('Assinatura'))) {
      openWelcomeGate(true);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function triggerTopBarParamChange() {
  const weeks = Number(document.getElementById('ctrl-weeks')?.value || 13);
  const profile = document.getElementById('ctrl-profile')?.value || 'equilibrado';
  const profileLabels = { enxuto: 'Enxuto', equilibrado: 'Equilibrado', alta: 'Alta Disponibilidade' };
  showBanner(`Aplicando Perfil "${profileLabels[profile] || profile}" (${weeks} sem) e recalculando compras...`, false);
  try {
    const res = await apiPost('/api/engine/run', {
      weeksWindow: weeks,
      serviceProfile: profile,
      fastRecalc: true,
      forceSync: false,
    });
    showBanner(`✓ Perfil "${profileLabels[profile] || profile}" aplicado! Sugestão recalculada (Run #${res.runId} em ${(res.summary.elapsedMs / 1000).toFixed(2)}s).`, false);
    await loadOverview();
    await refreshActiveView();
  } catch (err) {
    showBanner(`Falha ao recalcular perfil: ${err.message}`, true);
  }
}

function renderMultilojaBar() {
  const container = document.getElementById('multiloja-chips');
  if (!container) return;

  const profile = state.overview?.profile || state.clientProfile || {};
  const rawPolicies = state.overview?.filiaisPolicies || [];
  // Exclui escritório central (ID=1) das lojas de vendas operacionais
  const policies = rawPolicies.filter((p) => Number(p.filial_id) !== 1 && p.nome_reduz !== 'ESCR');

  const isSingleStore = profile.operation_mode === 'local' || policies.length <= 1;

  const btnTransf = document.getElementById('btn-goto-transfers');
  const btnPol = document.getElementById('btn-open-filiais-policies');

  if (isSingleStore) {
    const activeStore = policies[0] || {
      filial_id: profile.buyer_filial_id || 2,
      nome_reduz: profile.name || 'Loja Local',
      nome_loja: profile.name || 'Loja Local',
    };
    const cleanLabel = formatFilialTag(activeStore.filial_id, activeStore.nome_reduz, activeStore.nome_loja);

    container.innerHTML = `
      <div class="multiloja-single-pill" style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;font-size:12.5px;color:#0f766e;font-weight:600;">
        <span>📍 Loja Local / Filial:</span>
        <span style="font-weight:700;color:#115e59;">${esc(cleanLabel)}</span>
        <span class="badge badge-success" style="font-size:10.5px;padding:2px 6px;">Cálculos &amp; Cotação Travados na Loja</span>
      </div>
    `;

    if (btnTransf) btnTransf.style.display = 'none';
    if (btnPol) btnPol.style.display = 'none';
    return;
  }

  if (btnTransf) btnTransf.style.display = 'inline-flex';
  if (btnPol) btnPol.style.display = 'inline-flex';

  const chips = [
    `<button type="button" class="filial-chip ${state.selectedFilial === 'all' ? 'active' : ''}" data-filial="all">
      <span class="filial-chip-icon">🏬</span>
      <span class="filial-chip-label">Rede Consolidada</span>
      <span class="filial-chip-badge">${policies.length} Lojas</span>
    </button>`
  ];

  for (const pol of policies) {
    const fId = String(pol.filial_id);
    const isCarencia = Boolean(pol.emCarencia || pol.bloquear_doacao_remanejamento === 1 || (pol.diasOperacao && pol.diasOperacao <= (pol.dias_carencia || 90)));
    const cleanLabel = formatFilialTag(pol.filial_id, pol.nome_reduz, pol.nome_loja);

    const badgeText = isCarencia ? `Carência ${pol.diasOperacao || 41}d` : 'Ativa';
    const isActive = state.selectedFilial === fId;

    chips.push(`
      <button type="button" class="filial-chip ${isCarencia ? 'carencia' : ''} ${isActive ? 'active' : ''}" data-filial="${esc(fId)}" title="${esc(pol.nome_loja)} ${isCarencia ? '(Recém-inaugurada sob proteção de carência)' : ''}">
        <span class="filial-chip-icon">${isCarencia ? '🐣' : '🏪'}</span>
        <span class="filial-chip-label">${esc(cleanLabel)}</span>
        <span class="filial-chip-badge">${badgeText}</span>
      </button>
    `);
  }

  container.innerHTML = chips.join('');
  container.querySelectorAll('.filial-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fId = btn.dataset.filial;
      if (state.selectedFilial === fId) return;
      state.selectedFilial = fId;
      renderMultilojaBar();
      state.offset = 0;
      state.page = 1;
      loadSkus();
    });
  });
}

async function openFiliaisPoliciesModal() {
  const modal = document.getElementById('modal-filiais-policies');
  if (!modal) return;
  modal.classList.remove('hidden');

  const container = document.getElementById('filiais-policies-list');
  container.innerHTML = '<div class="muted" style="text-align:center;padding:24px;">Carregando políticas de filiais...</div>';

  try {
    const res = await apiGet('/api/filiais/policies');
    const policies = res.policies || [];
    if (policies.length === 0) {
      container.innerHTML = '<div class="muted" style="text-align:center;padding:20px;">Nenhuma filial configurada. Execute uma sincronização primeiro.</div>';
      return;
    }

    container.innerHTML = policies.map((pol) => {
      const isCarencia = pol.diasOperacao !== undefined ? pol.diasOperacao < pol.dias_carencia : pol.bloquear_doacao_remanejamento === 1;
      const statusBadge = isCarencia
        ? `<span class="badge badge-warn" style="font-size:11px;">🐣 Recém-Inaugurada (${pol.diasOperacao || 42} dias de operação)</span>`
        : `<span class="badge badge-success" style="font-size:11px;">🏬 Loja Madura (${pol.diasOperacao || '180+'} dias de operação)</span>`;

      return `
        <div class="filial-policy-card ${isCarencia ? 'is-carencia' : ''}" data-filial-id="${pol.filial_id}">
          <div class="filial-policy-card-head">
            <div class="filial-policy-card-title">
              <span>🏪 Filial ${pol.filial_id}: <strong>${esc(pol.nome_loja)}</strong></span>
              <span class="muted" style="font-size:12px;">(${esc(pol.nome_reduz || '')})</span>
              ${statusBadge}
            </div>
            <div class="muted" style="font-size:11.5px;">
              ${pol.data_inauguracao ? `Inauguração: ${pol.data_inauguracao}` : 'Histórico Consolidado'}
            </div>
          </div>

          <div class="filial-policy-grid">
            <div class="filial-policy-field">
              <label>Período de Carência (Dias)</label>
              <select class="pol-dias-carencia" data-filial="${pol.filial_id}">
                <option value="60" ${pol.dias_carencia === 60 ? 'selected' : ''}>60 dias</option>
                <option value="90" ${pol.dias_carencia === 90 ? 'selected' : ''}>90 dias (Recomendado pela IA)</option>
                <option value="120" ${pol.dias_carencia === 120 ? 'selected' : ''}>120 dias (Conservador)</option>
                <option value="180" ${pol.dias_carencia === 180 ? 'selected' : ''}>180 dias</option>
              </select>
              <span class="muted" style="font-size:10px;">Tempo até o motor liberar curva estatística própria</span>
            </div>

            <div class="filial-policy-field">
              <label>Trava de Remanejamento (Doação)</label>
              <select class="pol-bloquear-doacao" data-filial="${pol.filial_id}">
                <option value="1" ${pol.bloquear_doacao_remanejamento === 1 ? 'selected' : ''}>🔒 Bloquear Doação (Protege estoque de inauguração)</option>
                <option value="0" ${pol.bloquear_doacao_remanejamento === 0 ? 'selected' : ''}>🔓 Permitir Doação (Ceder excesso a outras lojas)</option>
              </select>
              <span class="muted" style="font-size:10px;">Impede desfalque do mix inicial para abastecer outras lojas</span>
            </div>

            <div class="filial-policy-field">
              <label>Modelo de Reposição de Compras</label>
              <select class="pol-tipo-reposicao" data-filial="${pol.filial_id}">
                <option value="sellout_1to1" ${pol.tipo_reposicao === 'sellout_1to1' ? 'selected' : ''}>🐣 Sell-Out 1:1 Validado na Rede (Recomendado loja nova)</option>
                <option value="curva_motor" ${pol.tipo_reposicao === 'curva_motor' ? 'selected' : ''}>📊 Curva Estatística do Motor (Lojas maduras)</option>
              </select>
              <span class="muted" style="font-size:10px;">Repõe apenas o que vendeu mediante validação com L02/L03</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="order-batch-alert error">Erro ao carregar políticas: ${esc(err.message)}</div>`;
  }
}

async function saveFiliaisPolicies() {
  const cards = document.querySelectorAll('.filial-policy-card');
  const btnSave = document.getElementById('btn-save-filiais-policies');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
  }

  try {
    for (const card of cards) {
      const fId = Number(card.dataset.filialId);
      const dias = Number(card.querySelector('.pol-dias-carencia')?.value || 90);
      const bloquear = Number(card.querySelector('.pol-bloquear-doacao')?.value || 0);
      const reposicao = card.querySelector('.pol-tipo-reposicao')?.value || 'sellout_1to1';

      await apiPost('/api/filiais/policies', {
        filial_id: fId,
        dias_carencia: dias,
        bloquear_doacao_remanejamento: bloquear,
        tipo_reposicao: reposicao,
      });
    }

    document.getElementById('modal-filiais-policies')?.classList.add('hidden');
    showBanner('✓ Políticas de filiais e carência atualizadas com sucesso!', false);
    await loadOverview();
  } catch (err) {
    showBanner(`Falha ao salvar políticas: ${err.message}`, true);
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Salvar Políticas';
    }
  }
}

async function loadOverview() {
  const data = await apiGet('/api/overview');
  state.overview = data;
  renderMultilojaBar();
  const { profile, latestRun, cmedImport } = data;

  if (profile) {
    document.getElementById('client-badge').textContent = `${profile.name} (Filial Compra: ${profile.buyer_filial_id})`;
    document.getElementById('ctrl-weeks').value = String(profile.default_weeks || 13);
    document.getElementById('ctrl-profile').value = profile.service_profile || 'equilibrado';
    document.getElementById('ctrl-entries').value = String(profile.recent_entries_limit || 5);

    // REV-008: Tela de remanejamento só visível se houver mais de 1 loja no modo central
    let activeCount = 1;
    if (Array.isArray(profile.active_sales_filials)) {
      activeCount = profile.active_sales_filials.length;
    } else if (typeof profile.active_sales_filials === 'string') {
      try { activeCount = JSON.parse(profile.active_sales_filials).length; } catch { activeCount = 1; }
    }
    const isMultiStore = (profile.operation_mode === 'central') && (activeCount > 1);

    const navTransfers = document.querySelector('.nav-item[data-view="transfers"]');
    if (navTransfers) {
      navTransfers.style.display = isMultiStore ? '' : 'none';
    }

    // Atualiza badge de rotas disponíveis de remanejamento no topo (apenas multi-loja)
    const topBadge = document.getElementById('badge-top-transfers');
    if (isMultiStore) {
      apiGet('/api/remanejamento/routes').then((rData) => {
        if (topBadge && rData && Array.isArray(rData.routes)) {
          const rLen = rData.routes.length;
          if (rLen > 0) {
            topBadge.textContent = `${rLen} rota${rLen > 1 ? 's' : ''} (${num(rData.totalGeralUnidades || 0)} un)`;
            topBadge.style.display = 'inline-block';
          } else {
            topBadge.style.display = 'none';
          }
        }
      }).catch(() => {});
    } else if (topBadge) {
      topBadge.style.display = 'none';
    }
  }

  const dismissedTabCount = document.getElementById('dismissed-tab-count');
  if (dismissedTabCount) {
    dismissedTabCount.textContent = String(data.dismissedCount || 0);
  }

  const pbmTabCount = document.getElementById('pbm-tab-count');
  if (pbmTabCount) {
    pbmTabCount.textContent = String(data.filtersMeta?.pbmCount || 0);
  }

  if (data.filtersMeta?.gruposPai && Array.isArray(data.filtersMeta.gruposPai)) {
    const paiSelect = document.getElementById('filter-grupo-pai');
    if (paiSelect) {
      const currentVal = state.grupoPai;
      paiSelect.innerHTML = '<option value="">Grupo Pai: Todos</option>' +
        data.filtersMeta.gruposPai
          .filter(g => g && g.nome)
          .map(g => `<option value="${esc(g.nome)}"${currentVal === g.nome ? ' selected' : ''}>${esc(g.nome)} (${g.cnt} SKUs${g.buy_skus ? ` • ${g.buy_skus} comprar` : ''})</option>`)
          .join('');
    }
  }

  if (data.filtersMeta?.laboratorios && Array.isArray(data.filtersMeta.laboratorios)) {
    const labSelect = document.getElementById('filter-labora');
    if (labSelect) {
      const currentLab = state.labora;
      labSelect.innerHTML = '<option value="">🏢 Fabricante: Todos (70+ marcas)</option>' +
        data.filtersMeta.laboratorios
          .filter(l => l && l.labora)
          .map(l => `<option value="${esc(l.labora)}"${currentLab === l.labora ? ' selected' : ''}>${esc(getLabFriendlyName(l.labora))} (${num(l.cnt)} SKUs)</option>`)
          .join('');
    }

    renderQuickLaboraChips(data.filtersMeta.laboratorios);
  }

  document.getElementById('cmed-status').textContent = cmedImport
    ? `CMED: ${cmedImport.source_file} (${num(cmedImport.total_rows)} ap.)`
    : 'CMED: não importada (alerta)';

  if (latestRun) {
    const s = latestRun.summary;
    document.getElementById('run-meta').textContent =
      `Run #${latestRun.id} | Ref ${s.referenceDate} (${s.weeksWindow}s, ${(s.elapsedMs / 1000).toFixed(1)}s)`;

    document.getElementById('kpi-strip').innerHTML = `
      <div class="kpi-cell">
        <div class="kpi-label">Rupturas Curva A / B</div>
        <div class="kpi-val kpi-danger">${num(s.rupturasCurvaA)} / ${num(s.rupturasCurvaB)}</div>
        <div class="kpi-sub">${num(s.skusComExcecao)} itens com exceção IA</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Venda Perdida Est. (91d)</div>
        <div class="kpi-val kpi-danger">${brl(s.vendaPerdidaEstimadaRs91d)}</div>
        <div class="kpi-sub">Via estoque_posterior + giro</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Sugestão Compra Líquida</div>
        <div class="kpi-val kpi-accent">${brl(s.totalSugestaoCompraRs)}</div>
        <div class="kpi-sub">${num(s.skusSugestaoCompra)} SKUs (100% mix)</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Economia Compra Molécula</div>
        <div class="kpi-val kpi-accent">${brl(s.economiaMoleculaRs)}</div>
        <div class="kpi-sub">${num(s.economiaMoleculaUn)} un evitadas na rede</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Excesso &gt; Máx + Parado D</div>
        <div class="kpi-val kpi-warn">${brl(s.capitalExcessoAcimaMaxRs)}</div>
        <div class="kpi-sub">+ ${brl(s.capitalParadoCurvaDRs)} sem giro (D)</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Risco Validade (lote_novo)</div>
        <div class="kpi-val kpi-warn">${brl(s.lotesVencendo90dRs)}</div>
        <div class="kpi-sub">+ ${brl(s.lotesVencidosRs)} já vencido em saldo</div>
      </div>
    `;
  } else {
    document.getElementById('run-meta').textContent = 'Nenhuma sincronização realizada ainda nesta base.';
    document.getElementById('kpi-strip').innerHTML = `
      <div class="kpi-cell" style="grid-column: 1 / -1; padding: 18px 24px; text-align: center; background: #f0fdf4; border: 1px dashed #16a34a; border-radius: var(--radius);">
        <div style="font-size: 16px; font-weight: 700; color: #166534; margin-bottom: 4px;">
          🚀 Conectado à base: ${esc(profile?.name || 'Cliente')} (${esc(profile?.db_host || '127.0.0.1')} / ${esc(profile?.db_name || 'gerente')})
        </div>
        <div style="font-size: 13px; color: #15803d; margin-bottom: 12px;">
          Nenhum cálculo processado ainda para esta loja. Clique abaixo para ler o estoque em tempo real, calcular o giro dos últimos 90 dias e gerar a sugestão de compra inteligente com IA.
        </div>
        <button id="btn-recalc-empty-cta" class="btn btn-primary" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; padding: 8px 18px; font-weight: 600;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Sincronizar &amp; Calcular Demanda Agora</span>
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-recalc-empty-cta');
    if (btnEmpty) btnEmpty.addEventListener('click', runPurchasingEngine);
  }

  // Versão Oficial do Sistema
  if (data.appVersion) {
    const vText = `v${data.appVersion}`;
    const elBadge = document.getElementById('app-version-badge');
    if (elBadge) elBadge.textContent = `🚀 Versão: ${vText}`;
    const elHomePill = document.getElementById('home-version-pill');
    if (elHomePill) elHomePill.textContent = vText;
  }

  // Atualização e Verificação de Licença de Uso (SaaS Gate)
  if (data.licenseStatus) {
    state.licenseStatus = data.licenseStatus;
    updateLicenseBadge(data.licenseStatus);
    const days = Number(data.licenseStatus.daysRemaining || 0);
    const isExp = Boolean(data.licenseStatus.isExpired || !data.licenseStatus.isValid || days <= 0);

    // O modal bloqueante SÓ abre automaticamente se a licença estiver REALMENTE EXPIRADA!
    // Se a licença estiver ativa com dias normais, entra direto na Home Page sem popups invasivos.
    if (isExp) {
      openWelcomeGate(true);
    } else if (days <= 10) {
      // Aviso sutil se faltarem 10 dias ou menos para renovar
      showBanner(`⚠️ Sua licença mensal da Mesa de Compras IA vence em ${days} dia(s). Contate a FSConsultoria no WhatsApp (17) 98120-5660 para renovar.`);
    }
  }
}

function renderTableSummary(data) {
  const summaryEl = document.getElementById('table-summary');
  if (!summaryEl) return;

  const total = Number(data.total || 0);
  const rowsCount = (data.rows || []).length;
  const sumRs = Number(data.sumRs || 0);

  // 1. Escopo da Aba Ativa
  const tabTitles = {
    buy: '🛒 Sugestões de Compra (Reposição Imediata)',
    selected: '⭐ Meus Selecionados (Cotação Ativa)',
    rupture: '🔴 Ruptura Crítica (Estoque Zerado / Negativo)',
    excess: '⚠️ Excesso de Estoque (Capital Parado)',
    pbm_replenish: '💊 Reposição Automática PBM (Deduzida da Indústria)',
    all: '📦 Mix Geral (Todos os SKUs Cadastrados)',
    dismissed: '🚫 Não Comprar Agora (Descartados / Suspensos)',
    exceptions: '⚡ Alertas de Exceção (Auditoria Operacional)',
  };
  const scopeTitle = tabTitles[state.tab] || 'Mesa de Compras';

  // 2. Contagem Dinâmica Sem Incoerência
  let countHtml = '';
  if (total === 0) {
    countHtml = '<span class="summary-count-badge" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5;">0 SKUs</span>';
  } else if (total <= rowsCount) {
    countHtml = `<span class="summary-count-badge">${num(total)} SKUs</span>`;
  } else {
    countHtml = `<span class="summary-count-badge">${num(rowsCount)} de ${num(total)} SKUs</span>`;
  }

  // 3. Coleta de Filtros Ativos
  const pills = [];
  if (state.labora) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Fabricante">
        🏢 <strong>${esc(getLabFriendlyName(state.labora))}</strong>
        <button type="button" class="btn-clear-pill" data-clear="labora" title="Remover filtro de fabricante">✕</button>
      </span>
    `);
  }
  if (state.grupoPai) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Grupo Pai">
        📁 <strong>${esc(state.grupoPai)}</strong>
        <button type="button" class="btn-clear-pill" data-clear="grupoPai" title="Remover filtro de grupo">✕</button>
      </span>
    `);
  }
  if (state.grupoFilho) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Subgrupo">
        📂 <strong>${esc(state.grupoFilho)}</strong>
        <button type="button" class="btn-clear-pill" data-clear="grupoFilho" title="Remover filtro de subgrupo">✕</button>
      </span>
    `);
  }
  if (state.grupoId) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Código BIG">
        🏷️ Cód BIG: <strong>${esc(String(state.grupoId))}</strong>
        <button type="button" class="btn-clear-pill" data-clear="grupoId" title="Remover filtro de código">✕</button>
      </span>
    `);
  }
  if (state.abc) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Curva ABC">
        ⭐ Curva <strong>${esc(state.abc)}</strong>
        <button type="button" class="btn-clear-pill" data-clear="abc" title="Remover filtro de curva">✕</button>
      </span>
    `);
  }
  if (state.macro) {
    pills.push(`
      <span class="summary-pill" title="Filtrado por Macro Categoria">
        🏷️ <strong>${esc(macroLabel(state.macro))}</strong>
        <button type="button" class="btn-clear-pill" data-clear="macro" title="Remover filtro de categoria">✕</button>
      </span>
    `);
  }
  if (state.stockStatus) {
    const stLabel = state.stockStatus === 'zero' ? 'Zerado (0)' : state.stockStatus === 'positive' ? 'Positivo (>0)' : 'Em Trânsito';
    pills.push(`
      <span class="summary-pill" title="Filtrado por Status de Estoque">
        📦 <strong>${stLabel}</strong>
        <button type="button" class="btn-clear-pill" data-clear="stockStatus" title="Remover filtro de estoque">✕</button>
      </span>
    `);
  }
  if (state.pbmFilter) {
    const pbmTxt = state.pbmFilter === 'pbm_auto_deducted' ? 'PBM Deduzido' : state.pbmFilter === 'with_pbm' ? 'Com PBM' : 'Compra Pura';
    pills.push(`
      <span class="summary-pill" title="Filtrado por PBM">
        💊 <strong>${pbmTxt}</strong>
        <button type="button" class="btn-clear-pill" data-clear="pbmFilter" title="Remover filtro de PBM">✕</button>
      </span>
    `);
  }
  if (state.q) {
    pills.push(`
      <span class="summary-pill" title="Busca Textual">
        🔍 <strong>"${esc(state.q)}"</strong>
        <button type="button" class="btn-clear-pill" data-clear="q" title="Limpar busca">✕</button>
      </span>
    `);
  }
  if (state.budget > 0) {
    pills.push(`
      <span class="summary-pill" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;" title="Simulação de Verba">
        💰 Verba: <strong>${brl(state.budget)}</strong>
        <button type="button" class="btn-clear-pill" data-clear="budget" title="Remover teto de verba">✕</button>
      </span>
    `);
  }

  const activeFiltersHtml = pills.length > 0
    ? `<div class="summary-active-filters">${pills.join('')}<button type="button" class="btn btn-ghost btn-sm btn-clear-all-summary" style="font-size:11px;padding:2px 7px;color:var(--danger);font-weight:600;">✕ Limpar Filtros</button></div>`
    : '';

  // 4. Detalhes Financeiros
  let sumHtml = '';
  if (data.budgetApplied) {
    sumHtml = `
      <div class="summary-sum-box">
        <span class="sum-label" style="color:var(--text-muted);">Soma Filtrada:</span>
        <strong class="summary-sum-val">${brl(sumRs)}</strong>
        <span class="badge badge-accent" style="font-size:11px;">Verba: ${brl(data.budgetApplied)}</span>
      </div>
    `;
  } else {
    sumHtml = `
      <div class="summary-sum-box">
        <span class="sum-label" style="color:var(--text-muted);">Soma Sugestão:</span>
        <strong class="summary-sum-val">${brl(sumRs)}</strong>
      </div>
    `;
  }

  summaryEl.innerHTML = `
    <div class="summary-left">
      ${countHtml}
      <span class="summary-scope-title">${scopeTitle}</span>
      ${activeFiltersHtml}
    </div>
    <div class="summary-right">
      ${sumHtml}
      <div class="summary-action-hint">💡 Marque para cotar • Clique na linha para IA</div>
    </div>
  `;

  summaryEl.querySelectorAll('.btn-clear-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = btn.dataset.clear;
      if (target === 'labora') {
        state.labora = '';
        const sel = document.getElementById('filter-labora');
        if (sel) sel.value = '';
        syncQuickLaboraChips();
      } else if (target === 'grupoPai') {
        state.grupoPai = '';
        state.grupoFilho = '';
        state.grupoId = null;
        const selPai = document.getElementById('filter-grupo-pai');
        if (selPai) selPai.value = '';
        const selFilho = document.getElementById('filter-grupo-filho');
        if (selFilho) selFilho.value = '';
      } else if (target === 'grupoFilho') {
        state.grupoFilho = '';
        state.grupoId = null;
        const selFilho = document.getElementById('filter-grupo-filho');
        if (selFilho) selFilho.value = '';
      } else if (target === 'grupoId') {
        state.grupoId = null;
      } else if (target === 'abc') {
        state.abc = '';
        const selAbc = document.getElementById('filter-abc');
        if (selAbc) selAbc.value = '';
      } else if (target === 'macro') {
        state.macro = '';
        const selMacro = document.getElementById('filter-macro');
        if (selMacro) selMacro.value = '';
      } else if (target === 'stockStatus') {
        state.stockStatus = '';
        const selStock = document.getElementById('filter-stock-status');
        if (selStock) selStock.value = '';
      } else if (target === 'pbmFilter') {
        state.pbmFilter = '';
        const selPbm = document.getElementById('filter-pbm');
        if (selPbm) selPbm.value = '';
      } else if (target === 'q') {
        state.q = '';
        const inpQ = document.getElementById('filter-q');
        if (inpQ) inpQ.value = '';
      } else if (target === 'budget') {
        state.budget = 0;
        const inpBudget = document.getElementById('filter-budget');
        if (inpBudget) inpBudget.value = '';
        document.getElementById('btn-budget-clear')?.classList.add('hidden');
      }
      state.offset = 0;
      state.page = 1;
      loadSkus();
    });
  });
}

function renderPagination(data) {
  const container = document.getElementById('table-pagination');
  if (!container) return;
  const total = Number(data.total || 0);
  const rowsCount = (data.rows || []).length;

  if (total === 0 || state.tab === 'groups_summary') {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const limit = state.limit || 80;
  const offset = state.offset || 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;
  state.page = currentPage;

  const startItem = offset + 1;
  const endItem = Math.min(total, offset + rowsCount);

  container.innerHTML = `
    <div class="pagination-info">
      Mostrando <strong>${num(startItem)}–${num(endItem)}</strong> de <strong>${num(total)}</strong> SKUs recomendados
    </div>
    <div class="pagination-controls">
      <button id="btn-page-prev" class="btn-page-nav" ${currentPage <= 1 ? 'disabled' : ''} type="button">
        ◀ Anterior
      </button>
      <span class="pagination-page-indicator">
        Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong>
      </span>
      <button id="btn-page-next" class="btn-page-nav" ${currentPage >= totalPages ? 'disabled' : ''} type="button">
        Próxima ▶
      </button>
    </div>
    <div class="pagination-density">
      <span class="pagination-density-label">Exibir:</span>
      <button class="btn-density-opt ${limit === 50 ? 'active' : ''}" data-limit="50" type="button">50</button>
      <button class="btn-density-opt ${limit === 80 ? 'active' : ''}" data-limit="80" type="button">80</button>
      <button class="btn-density-opt ${limit === 150 ? 'active' : ''}" data-limit="150" type="button">150</button>
      <button class="btn-density-opt ${limit === 300 ? 'active' : ''}" data-limit="300" type="button">300</button>
    </div>
  `;

  document.getElementById('btn-page-prev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      state.offset = Math.max(0, (currentPage - 2) * limit);
      window.scrollTo({ top: 380, behavior: 'smooth' });
      loadSkus();
    }
  });

  document.getElementById('btn-page-next')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      state.offset = currentPage * limit;
      window.scrollTo({ top: 380, behavior: 'smooth' });
      loadSkus();
    }
  });

  container.querySelectorAll('.btn-density-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newLimit = Number(btn.dataset.limit || 80);
      if (newLimit !== state.limit) {
        state.limit = newLimit;
        state.offset = 0;
        state.page = 1;
        loadSkus();
      }
    });
  });
}

async function loadSkus() {
  if (state.tab === 'groups_summary') {
    document.getElementById('table-wrap-skus')?.classList.add('hidden');
    document.getElementById('view-groups-summary')?.classList.remove('hidden');
    document.getElementById('table-summary').textContent = '🌳 Resumo por Grupo & Árvore ERP do Linx BIG — Visão consolidada de SKUs, estoque e orçamento por categoria pai e filho.';
    document.getElementById('table-pagination')?.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadAndRenderGroupsTree();
    return;
  }

  document.getElementById('table-wrap-skus')?.classList.remove('hidden');
  document.getElementById('view-groups-summary')?.classList.add('hidden');

  if (state.activeSkusAbortController) {
    try { state.activeSkusAbortController.abort(); } catch {}
  }
  state.activeSkusAbortController = new AbortController();
  const currentSignal = state.activeSkusAbortController.signal;

  updateSelectionUi();
  const params = new URLSearchParams({
    tab: state.tab,
    q: state.q,
    abc: state.abc,
    abcxyz: state.abcxyz,
    macro: state.macro,
    grupo_pai: state.grupoPai,
    grupo_filho: state.grupoFilho,
    grupo_id: state.grupoId ? String(state.grupoId) : '',
    labora: state.labora || '',
    stock_status: state.stockStatus,
    pbm_filter: state.pbmFilter || '',
    exc: state.exc,
    sort: state.sort,
    sort_key: state.sortKey,
    sort_dir: state.sortDir,
    budget: state.budget > 0 ? String(state.budget) : '0',
    limit: String(state.limit || 80),
    offset: String(state.offset || 0),
  });
  if (state.selectedFilial && state.selectedFilial !== 'all') {
    params.set('filial_id', state.selectedFilial);
  }
  if (state.tab === 'dismissed') {
    params.set('dismissed', 'true');
  }
  if (state.tab === 'selected') {
    if (state.selectedSkus.size === 0) {
      state.visibleSkus = [];
      state.budgetAuditData = null;
      updateSelectionUi();
      renderTableSummary({ total: 0, sumRs: 0, rows: [] });
      renderPagination({ total: 0, rows: [] });
      const tbody = document.getElementById('sku-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="13">
          <div class="empty-state-box">
            <div class="empty-icon">⭐</div>
            <div class="empty-title">Nenhum produto marcado para cotação ainda</div>
            <div class="empty-sub">Navegue pelas abas "Sugestão de Compra" ou "Exceções IA" e selecione os itens desejados para montar seu pedido.</div>
          </div>
        </td></tr>`;
      }
      document.getElementById('chk-select-all').checked = false;
      return;
    }
    const pids = Array.from(state.selectedSkus.keys()).map((k) => k.split('|')[1]).filter(Boolean);
    params.set('selected_pids', pids.join(','));
  }
  if (state.coverageHorizonDays) {
    params.set('horizon_days', String(state.coverageHorizonDays));
  }

  // Skeleton shimmer placeholder rows para eliminar layout shift ao alternar abas/filtros
  const tbody = document.getElementById('sku-tbody');
  if (tbody) {
    tbody.innerHTML = Array(8).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-shimmer" style="width:18px;"></div></td>
        <td><div class="skeleton-shimmer" style="width:85%;"></div><div class="skeleton-shimmer" style="width:45%;margin-top:6px;height:10px;"></div></td>
        <td><div class="skeleton-shimmer" style="width:65%;"></div></td>
        <td><div class="skeleton-shimmer" style="width:40px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:45px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:30px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:50px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:40px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:55px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:35px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:60px;margin-left:auto;"></div></td>
        <td><div class="skeleton-shimmer" style="width:75%;"></div></td>
        <td><div class="skeleton-shimmer" style="width:50px;margin:auto;"></div></td>
      </tr>
    `).join('');
  }

  try {
    const data = await apiGet(`/api/skus?${params.toString()}`, currentSignal);
  state.visibleSkus = data.rows || [];
  state.budgetAuditData = data.budgetAudit || null;
  updateSelectionUi();

  const btnAudit = document.getElementById('btn-budget-audit');
  if (btnAudit) {
    if (data.budgetAudit && state.budget > 0) {
      btnAudit.classList.remove('hidden');
      btnAudit.textContent = `📊 Detalhes do Corte (${data.budgetAudit.cutCount} SKUs)`;
    } else {
      btnAudit.classList.add('hidden');
    }
  }

  renderTableSummary(data);
  renderPagination(data);

  if (!data.rows || data.rows.length === 0) {
    if (!state.overview?.latestRun) {
      tbody.innerHTML = '<tr><td colspan="13" class="muted" style="text-align:center;padding:36px;"><div style="font-size:26px;margin-bottom:8px;">📦</div><div style="font-weight:600;font-size:14px;color:var(--text);">Aguardando Primeira Sincronização</div><div style="font-size:12px;margin-top:4px;">Clique em "Sincronizar &amp; Calcular" no topo para ler os dados do banco BIG e carregar as sugestões.</div></td></tr>';
    } else {
      tbody.innerHTML = `<tr><td colspan="13">
        <div class="empty-state-box">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Nenhum produto encontrado com os filtros selecionados</div>
          <div class="empty-sub">Experimente redefinir os filtros de Grupo, Curva ou termo de busca.</div>
          <button id="btn-empty-clear-filters" class="btn btn-secondary btn-sm" type="button">Limpar Todos os Filtros</button>
        </div>
      </td></tr>`;
      document.getElementById('btn-empty-clear-filters')?.addEventListener('click', clearAllFilters);
    }
    document.getElementById('chk-select-all').checked = false;
    return;
  }

  const allChecked = data.rows.every((r) => state.selectedSkus.has(`${r.filial_id}|${r.produto_id}`));
  document.getElementById('chk-select-all').checked = allChecked;

  const html = [];
  for (const r of data.rows) {
    const key = `${r.filial_id}|${r.produto_id}`;
    const isOpen = state.expandedSkuKeys.has(key);
    const isChecked = state.selectedSkus.has(key);
    const buyQty = r.budget_qtd !== undefined ? r.budget_qtd : r.sugestao_compra_un;
    const buyRs = r.budget_rs !== undefined ? r.budget_rs : r.sugestao_compra_rs;
    const ia = r.ia_analysis || { acaoLabel: '—', acaoTom: 'neutral', parecerCurto: r.justificativa_ia, confiancaNivel: 'MÉDIA', confiancaScore: 70, passos: [] };
    const friendly = formatFriendlyProduct(r);

    let molSweepPill = '';
    if (r.molecule_key) {
      const hasCoveredEx = (r.excecoes || []).includes('MOLECULA_COBERTA_OUTRO_LAB');
      if (hasCoveredEx) {
        molSweepPill = `<div style="margin-top:4px;"><button class="btn-sweep-pill covered btn-trigger-sweep" data-mol-key="${esc(r.molecule_key)}" data-sku-id="${r.produto_id}" data-filial-id="${r.filial_id || ''}" type="button">⚠️ Molécula com Estoque em Outro Lab (Varredura IA)</button></div>`;
      } else {
        molSweepPill = `<div style="margin-top:4px;"><button class="btn-sweep-pill neutral btn-trigger-sweep" data-mol-key="${esc(r.molecule_key)}" data-sku-id="${r.produto_id}" data-filial-id="${r.filial_id || ''}" type="button">🔬 Varredura da Molécula (Ver Labs)</button></div>`;
      }
    }

    html.push(`
      <tr class="row-main" data-sku-key="${key}">
        <td style="text-align:center;" class="td-chk">
          <input type="checkbox" class="chk-sku" data-chk-key="${key}" data-chk-rs="${buyRs}" ${isChecked ? 'checked' : ''} />
        </td>
        <td>
          <div class="friendly-name-box">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
              <span class="badge" style="font-weight:700;font-size:11px;padding:2px 7px;border-radius:4px;letter-spacing:0.2px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;">
                🏪 ${formatFilialTag(r.filial_id, r.filial_reduz, r.filial_nome)}
              </span>
              <span class="friendly-title" style="font-weight:600;font-size:13.5px;">${esc(friendly.title)}</span>
            </div>
            <div class="friendly-sub-tags" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:3px;">
              <span class="tag-lab">${esc(friendly.labora)}</span>
              ${friendly.medType ? `<span class="tag-med-type">${esc(friendly.medType)}</span>` : ''}
              ${friendly.moleculeBadge ? `<span class="tag-molecule" style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:500;">${esc(friendly.moleculeBadge)}</span>` : ''}
              ${friendly.auditAnomaly ? `<span class="tag-anomaly" style="background:#fef3c7;color:#b45309;padding:1px 6px;border-radius:4px;font-size:10.5px;cursor:help;" title="${esc(friendly.auditAnomalyTooltip)}">${esc(friendly.auditAnomaly)}</span>` : ''}
              ${r.suspensao_info ? `<span class="badge ${r.suspensao_info.origem === 'BIG_SYNCED' ? 'badge-danger' : 'badge-warning'}" style="font-size:10.5px;padding:1px 6px;border-radius:4px;" title="Motivo: ${esc(r.suspensao_info.motivo)}">${r.suspensao_info.origem === 'BIG_SYNCED' ? '🏛️ Suspenso no BIG &amp; Motor' : '🔒 Suspenso no Motor'} até ${r.suspensao_info.data_fim_bloqueio}</span>` : ''}
              <span class="muted" style="font-size:11px;">(Cód: ${r.produto_id} | EAN: ${esc(r.barras || '—')})</span>
            </div>
            ${molSweepPill}
          </div>
        </td>
        <td>
          <div>${macroLabel(r.macro_categoria)}</div>
          <div class="sku-sub" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:2px;">
            <span class="badge-curve badge-curve-${r.abc_class ? r.abc_class.toLowerCase() : 'd'}">Curva ${r.abc_class}</span>
            <button type="button" class="btn-curve-info" data-motor-curva="${r.abc_class}" data-motor-pareto="${r.pareto_pct || 0}" data-erp-ranking="${esc(r.curva_erp_ranking || 'Sem ranking no BIG')}" data-sku-name="${esc(friendly.title)}" title="Auditar Curva ABC (Motor vs Linx BIG)">ⓘ</button>
            ${r.is_traffic_builder ? '<span class="badge badge-neutral">Chamariz</span>' : ''}
          </div>
          ${r.dias_estoque_min ? `<div class="sku-sub muted" style="font-size:10.5px;">Cobertura: ${r.dias_estoque_min}d a ${r.dias_estoque_max}d</div>` : ''}
        </td>
        <td class="num">${num(r.estoque_atual)}${r.transito_real > 0 ? `<div class="sku-sub">+${num(r.transito_real)} tr.</div>` : ''}</td>
        <td class="num">${num(r.ddv_projetada, 2)}<div class="sku-sub">Saz ${num(r.indice_sazonalidade, 2)}x</div></td>
        <td class="num">${num(r.lead_time_dias, 1)}d</td>
        <td class="num">${num(r.estoque_min)} / ${num(r.estoque_max)}<div class="sku-sub">Seg: ${num(r.estoque_seg)}</div></td>
        <td class="num">${r.cobertura_dias >= 999 ? '999+' : `${num(r.cobertura_dias, 1)}d`}</td>
        <td class="num">${brl(r.custo_unit)}<div class="sku-sub">Mg ${num(r.margem_pct, 1)}%</div></td>
        <td class="num">
          <strong>${num(buyQty)}</strong>
          ${r.ddv_pbm_auto > 0 ? `<div class="sku-sub" style="color:#047857;font-weight:600;font-size:10px;" title="Reposição automática PBM estimada: -${num(r.ddv_pbm_auto * 30, 0)} un/mês abatidas da sugestão de compra">💊 PBM: -${num(r.ddv_pbm_auto * 30, 0)} un</div>` : ''}
        </td>
        <td class="num"><strong>${brl(buyRs)}</strong></td>
        <td>
          <div>
            ${badgeForAction(ia)}
            <span class="conf-pill ${confClass(ia.confiancaNivel)}" title="${esc(ia.confiancaMotivo || '')}">Conf. ${esc(ia.confiancaNivel)} (${ia.confiancaScore}%)</span>
          </div>
          <div class="sku-sub">${esc(ia.parecerCurto || r.justificativa_ia || '—')}</div>
        </td>
        <td style="text-align:center;">
          <div class="row-actions-micro">
            ${r.dismissed ? `
              <button class="btn btn-secondary btn-sm btn-action-sku btn-undo-dismiss" data-filial="${r.filial_id}" data-pid="${r.produto_id}" title="Reativar e incluir na compra" type="button" style="font-size:11px;padding:3px 6px;">
                ↩️
              </button>
            ` : `
              <button class="btn-micro-action btn-action-sku btn-dismiss-sku" data-filial="${r.filial_id}" data-pid="${r.produto_id}" title="Não comprar agora (ignorar SKU)" type="button">
                🚫
              </button>
              <button class="btn-micro-action btn-action-sku btn-suspend-sku" data-pid="${r.produto_id}" data-desc="${esc(r.descricao)}" title="Suspender compra no Linx BIG (ERP)" type="button">
                🛑
              </button>
            `}
          </div>
        </td>
      </tr>
    `);

    if (isOpen) {
      let networkMatrixHtml = '';
      const net = r.rede_distribuicao || [];
      if (net.length > 0) {
        let totEstoque = 0;
        let totTransito = 0;
        let totVendas13s = 0;
        let totDdv = 0;
        let totSugUn = 0;
        let totSugRs = 0;

        const netRowsHtml = net.map((n) => {
          totEstoque += Number(n.estoque_atual || 0);
          totTransito += Number(n.transito_real || 0);
          totVendas13s += Number(n.vendas_13s || 0);
          totDdv += Number(n.ddv_projetada || 0);
          totSugUn += Number(n.sugestao_compra_un || 0);
          totSugRs += Number(n.sugestao_compra_rs || 0);

          const isCurrent = Number(n.filial_id) === Number(r.filial_id);
          const fTag = formatFilialTag(n.filial_id, n.filial_reduz, n.filial_nome);
          const isLojaCarencia = Boolean(n.is_carencia);

          return `
            <tr style="${isCurrent ? 'background:#f0fdf4;font-weight:600;' : ''}">
              <td style="white-space:nowrap;">
                <span class="badge" style="font-size:10.5px;padding:2px 6px;margin-right:4px;background:${n.filial_id === 2 ? '#dbeafe;color:#1e40af;' : n.filial_id === 3 ? '#ede9fe;color:#5b21b6;' : '#fef3c7;color:#92400e;'}">
                  ${fTag}
                </span>
                ${isCurrent ? '<span class="badge badge-accent" style="font-size:9.5px;padding:1px 5px;">ESTA LINHA</span>' : ''}
              </td>
              <td style="font-size:11px;">
                ${isLojaCarencia ? '<span class="badge badge-warn" style="font-size:10px;">🐣 Carência</span>' : '<span class="badge badge-neutral" style="font-size:10px;">Ativa (Madura)</span>'}
              </td>
              <td class="num" style="font-weight:${Number(n.estoque_atual) <= 0 ? '700;color:#dc2626;' : '600;'}">${num(n.estoque_atual)} un</td>
              <td class="num">${num(n.transito_real)} un</td>
              <td class="num">${num(n.vendas_13s)} un</td>
              <td class="num">${num(n.ddv_projetada, 2)}/d</td>
              <td class="num">${num(n.estoque_min)} / ${num(n.estoque_max)}</td>
              <td class="num">${n.cobertura_dias >= 999 ? '999+' : `${num(n.cobertura_dias, 1)}d`}</td>
              <td class="num" style="font-weight:700;color:${Number(n.sugestao_compra_un) > 0 ? 'var(--accent)' : 'inherit'};">
                ${Number(n.sugestao_compra_un) > 0 ? `🛒 ${num(n.sugestao_compra_un)} un (${brl(n.sugestao_compra_rs)})` : '<span class="muted">0 un</span>'}
              </td>
              <td style="font-size:11px;max-width:280px;" class="sku-sub">${esc(n.justificativa_ia || 'Estoque suficiente')}</td>
            </tr>
          `;
        }).join('');

        networkMatrixHtml = `
          <div class="network-matrix-card" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:var(--radius); padding:14px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <div style="font-weight:700; font-size:13px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span style="font-size:16px;">🏬</span>
                <span>Panorama Multi-Loja do Produto na Rede</span>
                <span class="badge badge-neutral" style="font-size:11px; font-weight:600;">Cód BIG: ${r.produto_id} &bull; EAN: ${esc(r.barras || '—')}</span>
              </div>
              <div class="muted" style="font-size:11px;">Visão simultânea das 3 lojas operacionais da rede</div>
            </div>
            <div style="overflow-x:auto;">
              <table class="data-table" style="font-size:11.5px; margin:0; width:100%; border:1px solid #e2e8f0; border-radius:6px;">
                <thead>
                  <tr style="background:#f8fafc; color:#475569;">
                    <th>Loja / Filial</th>
                    <th>Maturidade</th>
                    <th class="num">Estoque Físico</th>
                    <th class="num">Trânsito</th>
                    <th class="num">Vendas (13 sem)</th>
                    <th class="num">DDV Diária</th>
                    <th class="num">Mín / Máx</th>
                    <th class="num">Cobertura</th>
                    <th class="num" style="color:var(--accent);">Sugestão Compra</th>
                    <th>Diagnóstico na Filial</th>
                  </tr>
                </thead>
                <tbody>
                  ${netRowsHtml}
                  <tr style="background:#f1f5f9; font-weight:700; border-top:2px solid #cbd5e1;">
                    <td colspan="2"><span style="font-size:12px;">🏬 TOTAL DA REDE (CONSOLIDADO)</span></td>
                    <td class="num">${num(totEstoque)} un</td>
                    <td class="num">${num(totTransito)} un</td>
                    <td class="num">${num(totVendas13s)} un</td>
                    <td class="num">${num(totDdv, 2)}/d</td>
                    <td class="num">—</td>
                    <td class="num">${totDdv > 0 ? `${num(totEstoque / totDdv, 1)}d` : '—'}</td>
                    <td class="num" style="color:var(--accent); font-size:12.5px;">${totSugUn > 0 ? `🛒 ${num(totSugUn)} un (${brl(totSugRs)})` : '0 un'}</td>
                    <td style="font-size:11px; color:#0f766e;">${totSugUn > 0 ? 'Necessidade líquida na rede distribuída por filial' : 'Rede totalmente abastecida'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ${(() => {
              if (Number(r.sugestao_compra_un) <= 0) return '';
              const donorCandidates = net
                .filter((n) => Number(n.filial_id) !== Number(r.filial_id) && Number(n.estoque_atual) > 0)
                .map((n) => {
                  const isLojaCarencia = Number(n.filial_id) === 4;
                  const safeBuffer = isLojaCarencia
                    ? Math.min(35, Math.floor(Number(n.estoque_atual) * 0.5))
                    : Math.max(Number(n.estoque_max || 0), Number(n.estoque_min || 0), 2);
                  const excessAvailable = Math.max(0, Number(n.estoque_atual) - safeBuffer);
                  return { ...n, isLojaCarencia, safeBuffer, excessAvailable };
                })
                .filter((n) => n.excessAvailable > 0)
                .sort((a, b) => b.excessAvailable - a.excessAvailable);

              const donor = donorCandidates[0] || null;
              if (!donor) return '';
              const isLojaCarencia = donor.isLojaCarencia;
              const excessAvailable = donor.excessAvailable;
              const transferQty = Math.min(Number(r.sugestao_compra_un), excessAvailable);
              if (transferQty <= 0) return '';
              const cost = Number(r.custo_unit || 0);
              const economyRs = Math.round(transferQty * cost * 100) / 100;
              const remainingStock = Number(donor.estoque_atual) - transferQty;
              const donorTag = formatFilialTag(donor.filial_id, donor.filial_reduz, donor.filial_nome);
              const destTag = formatFilialTag(r.filial_id, r.filial_reduz, r.filial_nome);
              const isZeroed = transferQty >= Number(r.sugestao_compra_un);

              return `
                <div class="network-remanejamento-opportunity-card" style="margin-top:12px; background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border:1px solid #86efac; border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div style="flex:1; min-width:280px;">
                    <div style="font-weight:700; color:#166534; font-size:12.5px; display:flex; align-items:center; gap:6px;">
                      <span>💡</span>
                      <span>Oportunidade de Remanejamento: Transferência Interna Evita Pedido Externo</span>
                    </div>
                    <div style="font-size:11.5px; color:#14532d; margin-top:4px; line-height:1.45;">
                      A <strong>${donorTag}</strong> possui <strong>${num(donor.estoque_atual)} un</strong> em estoque ${isLojaCarencia ? '(lote em carência com excedente seguro)' : `(excesso de +${excessAvailable} un acima do máx)`}.<br>
                      Transferir <strong>${transferQty} un</strong> para a <strong>${destTag}</strong> ${isZeroed ? '<strong>ZERA 100% da compra externa no distribuidor</strong>' : `abate ${transferQty} un do pedido`} 
                      (Economia imediata de <strong>${brl(economyRs)}</strong>), mantendo <strong>${remainingStock} un</strong> de segurança no estoque da loja cedente.
                    </div>
                  </div>
                  <div>
                    <button class="btn btn-primary btn-sm btn-action-extraordinary-transfer" 
                            data-produto-id="${r.produto_id}" 
                            data-origem="${donor.filial_id}" 
                            data-destino="${r.filial_id}" 
                            data-qtd="${transferQty}" 
                            data-custo="${cost}" 
                            data-economia="${economyRs}"
                            data-desc="${esc(r.descricao)}" 
                            data-barras="${esc(r.barras || '')}" 
                            type="button" 
                            style="font-weight:700; background:#059669; border-color:#059669; padding:8px 14px; white-space:nowrap;">
                      🚚 Transferir ${transferQty} un (${donorTag.split('•')[0].trim()} ➔ ${destTag.split('•')[0].trim()}) e Abater Compra
                    </button>
                  </div>
                </div>
              `;
            })()}
          </div>
        `;
      }

      const bestCost = Number(ia.precoAlvoCotacao || 0);
      const entriesRows = (r.ultimas_entradas || [])
        .map((e) => {
          const isBest = bestCost > 0 && Math.abs(Number(e.custo_item) - bestCost) < 0.01;
          return `
            <tr class="${isBest ? 'entry-best' : ''}">
              <td>${esc(e.datanota)}</td>
              <td>${esc(e.numnota)}</td>
              <td>${esc(e.fornecedor_nome)}</td>
              <td class="num">${num(e.quantiuni)}</td>
              <td class="num">${brl(e.precouni)}</td>
              <td class="num"><strong>${brl(e.custo_item)}</strong>${isBest ? ' <span class="badge badge-success">Menor</span>' : ''}</td>
              <td class="num">${brl(e.preco_ult_ent)}</td>
              <td>${e.reposicao_pbm === 'S' ? '<span class="badge badge-info">PBM</span>' : 'Normal'}</td>
            </tr>
          `;
        })
        .join('');

      const flowHtml = (ia.passos || [])
        .map((p) => {
          if (p.linhas && p.linhas.length > 0) {
            const linesHtml = p.linhas
              .map(
                (l) => `
                <div class="flow-step-line ${l.destaque ? 'flow-line-highlight' : ''} ${l.tom ? 'flow-line-' + l.tom : ''}">
                  <div class="flow-line-left">
                    <span class="flow-line-icon">${l.icone || '•'}</span>
                    <span class="flow-line-label">${esc(l.rotulo)}</span>
                  </div>
                  <div class="flow-line-right">
                    <span class="flow-line-val">${esc(l.valor)}</span>
                    ${l.sub ? `<div class="flow-line-sub">${esc(l.sub)}</div>` : ''}
                  </div>
                </div>
              `
              )
              .join('');
            return `
              <div class="flow-step">
                <div class="flow-step-title">${esc(p.titulo)}</div>
                <div class="flow-step-structured">${linesHtml}</div>
              </div>
            `;
          }
          return `
            <div class="flow-step">
              <div class="flow-step-title">${esc(p.titulo)}</div>
              <div class="flow-step-body">${esc(p.texto)}</div>
            </div>
          `;
        })
        .join('');

      const excBadges = (r.excecoes || []).map(badgeForException).join('');

      const mc = ia.memoriaCalculo;
      let auditCardHtml = '';
      if (mc) {
        auditCardHtml = `
          <div class="audit-math-card">
            <div class="audit-math-header">
              <div class="audit-math-title">🧮 Trilha de Auditoria Matemática da Compra (Transparência Total)</div>
              <div class="audit-math-formula">${esc(mc.formulaTexto || '')}</div>
            </div>
            <div class="audit-math-grid">
              <div class="audit-math-item">
                <span class="audit-math-label">DDV Projetada</span>
                <span class="audit-math-val">${num(mc.ddvDiaria, 2)} un/dia</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">Horizonte Cobertura</span>
                <span class="audit-math-val">${num(mc.diasAlvo)} dias</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">Demanda no Período</span>
                <span class="audit-math-val highlight">${num(mc.consumoAlvoPeriodo, 1)} un</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">+ Estoque Segurança</span>
                <span class="audit-math-val">${num(mc.estoqueSeguranca, 1)} un</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">- Estoque Físico</span>
                <span class="audit-math-val">${num(mc.estoqueFisico)} un</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">- Pedido em Trânsito</span>
                <span class="audit-math-val">${num(mc.pedidosTransito)} un</span>
              </div>
              <div class="audit-math-item">
                <span class="audit-math-label">= Sugestão Final</span>
                <span class="audit-math-val highlight-final">${num(mc.sugestaoLiquida)} un (${brl(mc.valorTotalRs)})</span>
              </div>
            </div>
          </div>
        `;
      }

      html.push(`
        <tr class="detail-row">
          <td colspan="13">
            <div class="detail-stack">
              ${networkMatrixHtml}
              ${auditCardHtml}
              <div class="detail-analysis-box">
                <div class="analysis-top">
                  <div>
                    ${badgeForAction(ia)}
                    <strong style="margin-left:6px;">${esc(ia.parecerCurto)}</strong>
                  </div>
                  <div class="muted">
                    Confiabilidade: <strong>${esc(ia.confiancaNivel)} (${ia.confiancaScore}%)</strong> — ${esc(ia.confiancaMotivo || 'Base estavel')}
                  </div>
                </div>
                <div class="flow-steps">${flowHtml}</div>
                ${excBadges ? `<div style="margin-top:8px;"><span class="muted" style="margin-right:6px;">Alertas detectados:</span>${excBadges}</div>` : ''}
              </div>

              <!-- CARD DE AÇÃO DIRETA DA MOLÉCULA -->
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: var(--radius); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: #1e293b;">🔬 Varredura Inteligente &amp; De-Para da Molécula: <code>${esc(r.molecule_key || 'Sem molécula')}</code></div>
                  <div class="muted" style="font-size: 12px; margin-top: 2px;">Compare estoque, vendas e custos de todos os laboratórios concorrentes na loja para decidir se desconta a compra ou troca de laboratório.</div>
                </div>
                ${r.molecule_key ? `
                  <button class="btn btn-secondary btn-sm btn-trigger-sweep" data-mol-key="${esc(r.molecule_key)}" data-sku-id="${r.produto_id}" data-filial-id="${r.filial_id || ''}" type="button" style="font-weight: 600;">
                    🔬 Abrir Varredura Completa da Molécula
                  </button>
                ` : '<span class="muted" style="font-size:11px;">Produto sem molécula associada</span>'}
              </div>

              <div class="detail-grid">
                <div class="detail-box">
                  <h4>Memória de Cálculo &amp; Indicadores do SKU</h4>
                  <table class="mini-table">
                    <tr><td>Vendas 6 sem / 9 sem / 13 sem</td><td class="num">${num(r.vendas_6s)} / ${num(r.vendas_9s)} / ${num(r.vendas_13s)} un</td></tr>
                    <tr><td>Vendas PBM confirmadas (13 sem)</td><td class="num">${num(r.vendas_pbm_13s)} un (DDV PBM ${num(r.ddv_pbm_auto, 2)}/d)</td></tr>
                    <tr><td>Ruptura silenciosa estimada (13 sem)</td><td class="num">${num(r.dias_sem_estoque_13s)}d | ${num(r.venda_perdida_est_un, 1)} un (${brl(r.venda_perdida_est_rs)})</td></tr>
                    <tr><td>Preço médio praticado / Alvo Cotação</td><td class="num">${brl(r.preco_venda)} / <strong>${brl(ia.precoAlvoCotacao || r.custo_unit)}</strong></td></tr>
                    <tr><td>Variação custo última entrada</td><td class="num">${r.custo_variacao_pct >= 0 ? '+' : ''}${num(r.custo_variacao_pct, 1)}%</td></tr>
                    <tr><td>Lotes lote_novo (&le;90d / Vencidos)</td><td class="num">${num(r.lote_vencendo_90d_qtd)} un / ${num(r.lote_vencido_qtd)} un (Menor: ${esc(r.lote_menor_validade || '—')})</td></tr>
                    <tr><td>Perdas registradas (365d)</td><td class="num">${num(r.perda_2026_un)} un (${brl(r.perda_2026_rs)})</td></tr>
                    <tr><td>Descrição Bruta no ERP BIG</td><td class="num"><code>${esc(r.descricao)}</code></td></tr>
                    <tr><td>Curva &amp; Ranking Linx BIG</td><td class="num"><strong style="color:#7c3aed;">${esc(r.curva_erp_ranking || r.abc_class)}</strong>${r.dias_estoque_min ? ` (${r.dias_estoque_min}d mín / ${r.dias_estoque_max}d máx)` : ''}</td></tr>
                    <tr><td>Previsibilidade da Demanda (XYZ)</td><td class="num">Classe ${esc(r.xyz_class)} (${r.xyz_class === 'X' ? 'Demanda constante e previsível' : r.xyz_class === 'Y' ? 'Demanda moderada' : 'Demanda sazonal / oscilante'})</td></tr>
                  </table>
                </div>
                <div class="detail-box">
                  <h4>Últimas Entradas Absorvidas pelo BIG (${(r.ultimas_entradas || []).length} exibidas)</h4>
                  ${
                    entriesRows
                      ? `<table class="mini-table">
                          <thead><tr><th>Data NF</th><th>Nota</th><th>Fornecedor</th><th class="num">Qtd</th><th class="num">Preço NF</th><th class="num">Custo Absorvido</th><th class="num">Ult. Ent</th><th>Tipo</th></tr></thead>
                          <tbody>${entriesRows}</tbody>
                        </table>`
                      : '<div class="muted">Sem entradas registradas nos últimos 18 meses.</div>'
                  }
                </div>
              </div>
            </div>
          </td>
        </tr>
      `);
    }
  }
  tbody.innerHTML = html.join('');
} catch (err) {
  if (err.name === 'AbortError') return;
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="13">
      <div class="order-batch-alert error" style="margin:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-weight:700;">⚠️ Falha ao carregar lista de produtos</div>
          <div style="font-size:12px;margin-top:2px;color:var(--text-muted);">${esc(err.message)}</div>
        </div>
        <button id="btn-retry-skus" class="btn btn-secondary btn-sm" type="button" style="font-weight:600;">🔄 Tentar Novamente</button>
      </div>
    </td></tr>`;
    document.getElementById('btn-retry-skus')?.addEventListener('click', () => loadSkus());
  }
}
}

/* ==========================================================================
   VARREDURA INTELIGENTE DA MOLÉCULA & DECISÃO DIRETA DO COMPRADOR
   ========================================================================== */
async function openMoleculeSweep(molKey, skuId, filialId = null) {
  const modal = document.getElementById('molecule-sweep-modal');
  modal.classList.remove('hidden');

  const banner = document.getElementById('sweep-ia-banner');
  const tbody = document.getElementById('sweep-tbody');
  const actionBar = document.getElementById('sweep-action-bar');

  banner.className = 'sweep-banner info';
  banner.innerHTML = '<strong>Consultando laboratórios, fabricantes e curvas da molécula em tempo real...</strong>';
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;" class="muted">Carregando dados da molécula...</td></tr>';
  actionBar.innerHTML = '';

  const fId = filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2);

  try {
    const res = await apiGet(`/api/molecules/sweep?key=${encodeURIComponent(molKey)}&skuId=${skuId || 0}&filialId=${fId || 2}`);
    const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice } = res;

    // 1. Atualizar Título da Modal
    document.getElementById('sweep-modal-title').innerHTML = `
      <span>🔬 ${esc(toTitleCase(substancia))} ${esc(concentracao)}</span>
      <span class="badge badge-accent">${esc(forma)} &bull; ${esc(packBucket)}</span>
    `;

    // 2. Banner de Diagnóstico da IA (com suporte a Curva D / Estoque Parado - REV-020)
    if (ia_advice) {
      banner.className = `sweep-banner ${ia_advice.severity || 'warning'}`;
      banner.innerHTML = `
        <div style="font-size:14px; font-weight:700; margin-bottom:4px;">${ia_advice.title}</div>
        <div style="font-size:12.5px; line-height:1.5;">${esc(ia_advice.message)}</div>
      `;
    } else if (targetSku && targetSku.sugestao_compra_un > 0 && otherStockTotal > 0 && otherCoverageDays >= 14) {
      banner.className = 'sweep-banner warning';
      banner.innerHTML = `
        <div style="font-size:14px; font-weight:700;">⚠️ Estoque Existente da Mesma Molécula em Outros Laboratórios</div>
        <div>
          O motor sugeriu a compra de <strong>${targetSku.sugestao_compra_un} un de ${esc(targetSku.descricao)} (${esc(targetSku.labora)})</strong> totalizando <strong>${brl(targetSku.sugestao_compra_rs)}</strong>.<br>
          Porém, sua loja já possui <strong>${otherStockTotal} unidades em estoque</strong> de outros laboratórios desta mesma apresentação, com <strong>${otherCoverageDays} dias de cobertura</strong> garantida!
        </div>
      `;
    } else if (cheapestSku && targetSku && targetSku.produto_id !== cheapestSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit) {
      const diffUnit = targetSku.custo_unit - cheapestSku.custo_unit;
      banner.className = 'sweep-banner info';
      banner.innerHTML = `
        <div style="font-size:14px; font-weight:700;">💡 Oportunidade de Maior Margem / Menor Custo</div>
        <div>
          O fabricante <strong>${esc(cheapestSku.labora)} (${esc(cheapestSku.descricao)})</strong> tem o menor custo de compra registrado: <strong>${brl(cheapestSku.custo_unit)}</strong> vs <strong>${brl(targetSku.custo_unit)}</strong> da marca sugerida (Economia de <strong>${brl(diffUnit)}</strong> por unidade).
        </div>
      `;
    } else {
      banner.className = 'sweep-banner success';
      banner.innerHTML = `
        <div style="font-size:14px; font-weight:700;">✓ Varredura da Molécula Concluída</div>
        <div>
          Total de <strong>${skus.length} produtos</strong> cadastrados nesta molécula na loja. Estoque total somado: <strong>${summary.estoque_total} un</strong> (Cobertura média: <strong>${summary.cobertura_molecula_dias} dias</strong>).
        </div>
      `;
    }

    // 3. Renderizar tabela comparativa de SKUs com Laboratório e Colunas por Loja (Visão Matricial Dinâmica)
    const activeFiliaisList = (res.filiais && res.filiais.length > 0)
      ? res.filiais
      : (state.overview?.filiaisPolicies || []).filter((p) => Number(p.filial_id) !== 1).map((p) => ({
          filial_id: Number(p.filial_id),
          label: formatFilialTag(p.filial_id, p.nome_reduz, p.nome_loja),
          short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
        }));

    if (activeFiliaisList.length === 0) {
      const bId = Number(state.overview?.profile?.buyer_filial_id || 2);
      activeFiliaisList.push({
        filial_id: bId,
        label: formatFilialTag(bId, state.overview?.profile?.name),
        short: `L${String(bId).padStart(2, '0')}`
      });
    }

    const isMultiStore = activeFiliaisList.length > 1;

    const thead = document.getElementById('sweep-thead');
    if (thead) {
      let storeColsHeader = '';
      if (isMultiStore) {
        storeColsHeader = activeFiliaisList.map((f, i) => {
          const bg = i === 0 ? '#eff6ff' : i === 1 ? '#f5f3ff' : '#fefce8';
          const color = i === 0 ? '#1e40af' : i === 1 ? '#5b21b6' : '#854d0e';
          return `<th class="num" style="background:${bg}; color:${color}; min-width:95px;">${esc(f.short || f.label)}</th>`;
        }).join('') + `<th class="num" style="background:#f1f5f9; color:#0f172a; font-weight:700; border-right:1px solid #cbd5e1; min-width:110px;">TOTAL REDE</th>`;
      } else {
        const s = activeFiliaisList[0];
        storeColsHeader = `<th class="num" style="background:#eff6ff; color:#1e40af; min-width:115px;">Estoque (${esc(s.short || s.label)})</th>`;
      }

      thead.innerHTML = `
        <tr style="background: var(--bg-subtle);">
          <th style="min-width:140px;">Laboratório / Fabricante</th>
          <th style="min-width:220px;">Apresentação &amp; Descrição</th>
          <th style="min-width:110px;">Curva &amp; Giro</th>
          ${storeColsHeader}
          <th class="num" style="min-width:90px;">Último Custo</th>
          <th style="text-align:center; min-width:120px;">Ação Direta</th>
        </tr>
      `;
    }

    tbody.innerHTML = skus.map((s) => {
      const isTarget = targetSku && s.produto_id === targetSku.produto_id;
      const isCheapest = cheapestSku && s.produto_id === cheapestSku.produto_id;

      const isCurvaD = s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '');
      const isCurvaA = s.abc_class === 'A' || /A/i.test(s.curva_erp_classe || '');
      const isCurvaB = s.abc_class === 'B' || /B/i.test(s.curva_erp_classe || '');
      const badgeStyle = isCurvaA
        ? 'background:#dcfce7;color:#15803d;'
        : isCurvaB
        ? 'background:#e0f2fe;color:#0369a1;'
        : isCurvaD
        ? 'background:#fee2e2;color:#b91c1c;'
        : 'background:#fef3c7;color:#92400e;';
      const badgeLabel = `Curva ${s.abc_class || 'D'}`;
      const giroLabel = Number(s.total_ddv) > 0 ? `${num(s.total_ddv, 2)}/d` : 'Sem Giro';
      const isDead = isCurvaD && Number(s.total_estoque) > 0;

      const cobStr = (d) => (Number(d) >= 999 ? '999+d' : `${num(d, 1)}d`);

      // Células dinâmicas para cada filial operacional
      const storeCellsHtml = activeFiliaisList.map((f, i) => {
        const l = (s.lojas && s.lojas[f.filial_id]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0 };
        const bg = i === 0 ? 'rgba(239,246,255,0.4)' : i === 1 ? 'rgba(245,243,255,0.4)' : 'rgba(254,252,232,0.4)';
        return `
          <td class="num" style="background:${bg};">
            <div><strong>${num(l.estoque_atual)} un</strong> <span class="muted" style="font-size:10px;">(${cobStr(l.cobertura_dias)})</span></div>
            ${l.sugestao_compra_un > 0 ? `<div style="color:var(--accent);font-weight:700;font-size:10px;margin-top:1px;">🛒 ${num(l.sugestao_compra_un)} un</div>` : ''}
          </td>
        `;
      }).join('');

      const totalRedeCell = isMultiStore
        ? `
          <td class="num" style="background:#f8fafc; font-weight:700; border-right:1px solid #cbd5e1;">
            <div style="font-size:12px; color:#0f172a;">${num(s.total_estoque)} un</div>
            <div class="muted" style="font-size:10px; font-weight:normal;">(${cobStr(s.cobertura_rede)})</div>
            ${s.total_sugestao_un > 0 ? `<div style="color:var(--accent);font-weight:700;font-size:10.5px;">🛒 ${num(s.total_sugestao_un)} un</div>` : ''}
          </td>
        `
        : '';

      return `
        <tr class="sweep-sku-row ${isTarget ? 'is-target' : ''} ${isCheapest ? 'is-cheapest' : ''} ${isDead ? 'is-dead' : ''}">
          <td>
            <div style="font-weight:700; color:#0f172a;">${esc(s.labora || 'Laboratório Não Informado')}</div>
            <div style="margin-top:2px;">
              ${isTarget ? ' <span class="badge badge-accent" style="font-size:9.5px;padding:1px 5px;">Item Sugerido</span>' : ''}
              ${isCheapest ? ' <span class="badge badge-success" style="font-size:9.5px;padding:1px 5px;">Menor Custo</span>' : ''}
            </div>
          </td>
          <td>
            <div style="font-weight:600; color:#1e293b;">${esc(s.descricao)}</div>
            <div class="muted" style="font-size:11px;">Cód BIG: <strong>${s.produto_id}</strong> &bull; EAN ${esc(s.barras || '—')}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span class="badge" style="font-size:10px;font-weight:700;${badgeStyle}">${badgeLabel}</span>
              ${isDead ? '<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:9px;font-weight:700;">💤 Parado</span>' : ''}
            </div>
            <div class="muted" style="font-size:10.5px;margin-top:3px;">
              Giro: <strong>${giroLabel}</strong>${s.curva_erp_ranking ? ` &bull; ${esc(s.curva_erp_ranking)}` : ''}
            </div>
          </td>
          ${storeCellsHtml}
          ${totalRedeCell}
          <td class="num">
            <div style="font-weight:700; font-size:12px;">${brl(s.custo_unit)}</div>
          </td>
          <td style="text-align:center;">
            ${!isTarget && s.custo_unit > 0 && targetSku && targetSku.total_sugestao_un > 0 ? `
              <button class="btn btn-secondary btn-sm btn-action-switch" data-source-id="${targetSku.produto_id}" data-target-id="${s.produto_id}" data-qty="${targetSku.total_sugestao_un}" data-target-name="${esc(s.descricao)}" type="button" style="padding:4px 8px;font-size:11px;font-weight:600;">
                Comprar Deste
              </button>
            ` : isDead ? `
              <span class="badge" style="background:#fee2e2;color:#991b1b;font-size:9.5px;padding:3px 6px;">Desovar no Balcão</span>
            ` : isTarget ? `
              <span class="badge badge-accent" style="font-size:9.5px;padding:3px 6px;">Item Alvo</span>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');

    // 4. Barra de Ações Práticas (com suspensão para desova de Curva D)
    let actionsHtml = '';
    const targetSugUn = Number(targetSku?.total_sugestao_un || targetSku?.sugestao_compra_un || 0);
    const targetSugRs = Number(targetSku?.total_sugestao_rs || targetSku?.sugestao_compra_rs || 0);

    if (targetSku && targetSugUn > 0) {
      actionsHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:13px; font-weight:600; color:var(--text);">Ação para ${esc(targetSku.descricao)}:</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${ia_advice && ia_advice.canSuspend ? `
            <button id="btn-sweep-suspend-dead" class="btn btn-warning btn-sm" type="button" style="font-weight:700; background:#d97706; color:#ffffff; border:none; padding:6px 12px;">
              🚫 Suspender Compra (Priorizar Giro de Balcão)
            </button>
          ` : ''}
          ${otherStockTotal > 0 ? `
            <button id="btn-sweep-discount" class="btn btn-danger btn-sm" type="button" style="font-weight:600;">
              🔴 Descontar do Pedido (Economizar ${brl(targetSugRs)})
            </button>
          ` : ''}
          ${cheapestSku && cheapestSku.produto_id !== targetSku.produto_id && targetSku.custo_unit > cheapestSku.custo_unit ? `
            <button id="btn-sweep-switch-cheapest" class="btn btn-primary btn-sm" type="button" style="font-weight:600;">
              🟢 Trocar para ${esc(cheapestSku.labora)} (${brl(cheapestSku.custo_unit)}/un)
            </button>
          ` : ''}
          <button id="btn-sweep-keep" class="btn btn-ghost btn-sm" type="button">
            ⚪ Manter Compra Atual
          </button>
          <button id="btn-sweep-teach-ia" class="btn btn-secondary btn-sm" type="button" title="Corrigir apresentação farmacológica ou princípio ativo desta molécula">
            🧠 Ensinar IA
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="muted" style="font-size:12px;">Produto com compra zerada ou já coberto pela molécula.</div>
        <div style="display:flex; gap:8px;">
          <button id="btn-sweep-teach-ia" class="btn btn-secondary btn-sm" type="button" title="Corrigir apresentação farmacológica ou princípio ativo desta molécula">
            🧠 Ensinar IA
          </button>
          <button id="btn-sweep-keep" class="btn btn-ghost btn-sm" type="button">Fechar</button>
        </div>
      `;
    }
    actionBar.innerHTML = actionsHtml;

    // Vincular evento de suspensão preventiva para priorizar o balcão (REV-020)
    const btnSuspendDead = document.getElementById('btn-sweep-suspend-dead');
    if (btnSuspendDead && targetSku) {
      btnSuspendDead.onclick = async () => {
        btnSuspendDead.disabled = true;
        try {
          await apiPost('/api/skus/suspend-big', {
            filialId: targetSku.filial_id || fId || 2,
            produtoId: targetSku.produto_id,
            days: 30,
            motivo: 'IA Molécula: Priorizar desova de marcas/laboratórios de baixo giro (Curva D) existentes em estoque.',
            target: 'motor'
          });
          showBanner(`✓ Compra de ${targetSku.descricao} suspensa no Motor por 30 dias para priorizar o balcão!`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(`Erro ao suspender compra: ${err.message}`, true);
          btnSuspendDead.disabled = false;
        }
      };
    }
    actionBar.innerHTML = actionsHtml;

    // Vincular eventos dos botões de ação
    const btnDiscount = document.getElementById('btn-sweep-discount');
    if (btnDiscount && targetSku) {
      btnDiscount.onclick = async () => {
        btnDiscount.disabled = true;
        try {
          await apiPost('/api/molecules/action/discount', { skuId: targetSku.produto_id, filialId: fId || 2 });
          showBanner(`✓ Compra de ${targetSku.descricao} cancelada! Economia de ${brl(targetSugRs)} confirmada aproveitando o estoque existente de outros laboratórios.`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(`Erro ao descontar produto: ${err.message}`, true);
        }
      };
    }

    const btnSwitchCheapest = document.getElementById('btn-sweep-switch-cheapest');
    if (btnSwitchCheapest && targetSku && cheapestSku) {
      btnSwitchCheapest.onclick = async () => {
        btnSwitchCheapest.disabled = true;
        try {
          await apiPost('/api/molecules/action/switch-lab', {
            sourceSkuId: targetSku.produto_id,
            targetSkuId: cheapestSku.produto_id,
            qty: targetSugUn,
            filialId: fId || 2,
          });
          showBanner(`✓ Compra transferida de ${targetSku.descricao} para ${cheapestSku.descricao} (${cheapestSku.labora}) pelo menor custo!`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(`Erro ao transferir compra: ${err.message}`, true);
        }
      };
    }

    tbody.querySelectorAll('.btn-action-switch').forEach((btn) => {
      btn.onclick = async () => {
        const sourceId = Number(btn.dataset.sourceId);
        const targetId = Number(btn.dataset.targetId);
        const qty = Number(btn.dataset.qty);
        const targetName = btn.dataset.targetName;
        try {
          await apiPost('/api/molecules/action/switch-lab', {
            sourceSkuId: sourceId,
            targetSkuId: targetId,
            qty: qty || targetSugUn || 1,
            filialId: fId || 2,
          });
          showBanner(`✓ Compra transferida para ${targetName}!`);
          closeMoleculeSweep();
          await loadSkus();
        } catch (err) {
          showBanner(`Erro ao transferir compra: ${err.message}`, true);
        }
      };
    });

    const btnKeep = document.getElementById('btn-sweep-keep');
    if (btnKeep) btnKeep.onclick = closeMoleculeSweep;

    const btnTeachIa = document.getElementById('btn-sweep-teach-ia');
    if (btnTeachIa) {
      btnTeachIa.onclick = () => {
        closeMoleculeSweep();
        openTeachMoleculeModal({
          produto_id: targetSku?.produto_id || 0,
          descricao: targetSku?.descricao || '',
          substancia: substancia || '',
          concentracao: concentracao || '',
          forma: forma || 'CPR',
          pack_bucket: packBucket || '30UN',
        });
      };
    }
  } catch (err) {
    banner.className = 'sweep-banner warning';
    banner.innerHTML = `Erro ao carregar varredura da molécula: ${esc(err.message)}`;
  }
}

function closeMoleculeSweep() {
  document.getElementById('molecule-sweep-modal').classList.add('hidden');
}

async function loadBi() {
  const data = await apiGet('/api/bi');
  const container = document.getElementById('bi-content');
  if (data.empty) {
    container.innerHTML = '<div class="muted" style="padding:24px;text-align:center;">Execute o motor ao menos uma vez para gerar os dados de BI.</div>';
    return;
  }

  const ch = data.capitalHealth;
  const ia = data.iaImpact;
  const capDenom = Math.max(1, ch.capitalSaudavel + ch.capitalExcesso + ch.capitalParadoD);
  const pSaud = Math.round((ch.capitalSaudavel / capDenom) * 100);
  const pExc = Math.round((ch.capitalExcesso / capDenom) * 100);
  const pPar = Math.max(0, 100 - pSaud - pExc);

  const maxMacroBuy = Math.max(1, ...(data.byMacro || []).map((m) => Number(m.compra_sugerida_rs || 0)));
  const maxSupBuy = Math.max(1, ...(data.topSuppliers || []).map((s) => Number(s.compra_rs || 0)));

  const matrixRows = ['A', 'B', 'C', 'D'].map((abc) => {
    const cells = ['X', 'Y', 'Z']
      .map((xyz) => {
        const key = `${abc}${xyz}`;
        const cell = data.matrix[key] || { skus: 0, estoque_rs: 0, compra_rs: 0, zerados: 0 };
        const bg =
          abc === 'A'
            ? 'background:#e6f4f1;'
            : abc === 'B'
              ? 'background:#f0f9ff;'
              : abc === 'D' && cell.estoque_rs > 0
                ? 'background:#fef2f2;'
                : 'background:#ffffff;';
        return `
          <td class="heatmap-cell" data-hm="${key}" style="${bg}" title="Clique para filtrar ${key} na Mesa de Compras">
            <div class="hm-top">${key} (${num(cell.skus)})</div>
            <div class="hm-sub">Est: ${brl(cell.estoque_rs)}</div>
            <div class="hm-sub">Comp: <strong>${brl(cell.compra_rs)}</strong></div>
          </td>
        `;
      })
      .join('');
    return `<tr><th>Curva ${abc}</th>${cells}</tr>`;
  });

  container.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Saúde do Capital em Estoque &amp; Retorno da IA (Run #${data.runId} — Ref ${esc(data.referenceDate)})</h2>
        <span class="muted">Proporção entre giro saudável (${pSaud}%), excesso acima do máximo (${pExc}%) e capital parado Curva D (${pPar}%)</span>
      </div>
      <div class="cap-bar" aria-label="Composicao do capital">
        <div class="cap-seg" style="width:${pSaud}%;background:#0f766e;" title="Capital Saudavel: ${brl(ch.capitalSaudavel)}"></div>
        <div class="cap-seg" style="width:${pExc}%;background:#d97706;" title="Excesso > Maximo: ${brl(ch.capitalExcesso)}"></div>
        <div class="cap-seg" style="width:${pPar}%;background:#b91c1c;" title="Parado Curva D: ${brl(ch.capitalParadoD)}"></div>
      </div>
      <div class="bi-stat-strip">
        <div class="bi-mini-card"><div class="label">Capital Total em Estoque</div><div class="val">${brl(ch.capitalTotal)}</div></div>
        <div class="bi-mini-card"><div class="label">Capital Saudável em Giro</div><div class="val kpi-accent">${brl(ch.capitalSaudavel)}</div></div>
        <div class="bi-mini-card"><div class="label">Capital em Excesso (&gt; Máx)</div><div class="val kpi-warn">${brl(ch.capitalExcesso)}</div></div>
        <div class="bi-mini-card"><div class="label">Parado Curva D (0 vendas)</div><div class="val kpi-danger">${brl(ch.capitalParadoD)}</div></div>
        <div class="bi-mini-card"><div class="label">Economia IA (Molécula + PBM/mês)</div><div class="val kpi-accent">${brl(ia.economiaMoleculaRs + ia.economiaMensalPbmRs)}</div></div>
      </div>
    </div>

    <div class="bi-grid-2">
      <div class="panel">
        <div class="panel-head">
          <h2>100% do Mix: Compra Sugerida vs Capital em Estoque</h2>
          <span class="muted">Clique em qualquer categoria para filtrar na Mesa de Compras</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th class="num">SKUs</th>
                <th class="num">Estoque (Custo)</th>
                <th class="num">Sug. Compra</th>
                <th class="num">V. Perdida 91d</th>
                <th class="num">Margem Méd.</th>
                <th class="num">Rupt. A/B</th>
              </tr>
            </thead>
            <tbody>
              ${(data.byMacro || [])
                .map((m) => {
                  const w = Math.max(4, Math.round((Number(m.compra_sugerida_rs || 0) / maxMacroBuy) * 100));
                  return `
                  <tr class="row-clickable" data-bi-macro="${esc(m.macro_categoria)}">
                    <td>
                      <strong>${macroLabel(m.macro_categoria)}</strong>
                      <div class="hbar-track" style="margin-top:4px;height:6px;"><div class="hbar-fill" style="width:${w}%"></div></div>
                    </td>
                    <td class="num">${num(m.skus_comprar)} / ${num(m.skus_total)}</td>
                    <td class="num">${brl(m.estoque_rs)}</td>
                    <td class="num"><strong class="kpi-accent">${brl(m.compra_sugerida_rs)}</strong></td>
                    <td class="num kpi-danger">${brl(m.venda_perdida_rs)}</td>
                    <td class="num">${num(m.margem_media_pct, 1)}%</td>
                    <td class="num">${num(m.rupturas_ab)}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Matriz Estratégica ABC × XYZ (Clicável)</h2>
          <span class="muted">X = Estável · Y = Moderada · Z = Irregular/Picos</span>
        </div>
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>Curva</th>
              <th>X (Estável)</th>
              <th>Y (Oscilante)</th>
              <th>Z (Irregular)</th>
            </tr>
          </thead>
          <tbody>${matrixRows.join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="bi-grid-2">
      <div class="panel">
        <div class="panel-head">
          <h2>Top 12 Fornecedores na Sugestão de Compra</h2>
          <span class="muted">Baseado na última entrada absorvida pelo BIG</span>
        </div>
        <div class="hbar-list">
          ${(data.topSuppliers || [])
            .map((s) => {
              const w = Math.max(4, Math.round((Number(s.compra_rs || 0) / maxSupBuy) * 100));
              return `
              <div class="hbar-row">
                <div class="hbar-label" title="${esc(s.fornecedor)}">${esc(s.fornecedor)} <span class="muted">(${s.skus} skus · LT ${num(s.lt_medio_dias, 0)}d)</span></div>
                <div class="hbar-track"><div class="hbar-fill" style="width:${w}%"></div></div>
                <div class="hbar-val">${brl(s.compra_rs)}</div>
              </div>`;
            })
            .join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Exceções IA Detectadas (Clique para Investigar)</h2>
          <span class="muted">Priorização automática de risco e divergência</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Alerta / Exceção</th><th class="num">SKUs</th><th class="num">Compra Envolvida</th></tr>
            </thead>
            <tbody>
              ${(data.exceptionsBreakdown || [])
                .map(
                  (e) => `
                  <tr class="row-clickable" data-bi-exc="${esc(e.code)}">
                    <td>${badgeForException(e.code)}</td>
                    <td class="num"><strong>${num(e.skus)}</strong></td>
                    <td class="num">${brl(e.compra_rs)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- REV-009: Disponibilidade dos Mais Vendidos (Curva A) e Fabricante Mais Rentável -->
    <div class="bi-grid-2" style="margin-top:16px;">
      <div class="panel">
        <div class="panel-head">
          <h2>Disponibilidade dos Mais Vendidos (Curva A)</h2>
          <span class="muted">Monitoramento de Ruptura na fatia crítica que gera 55% da receita</span>
        </div>
        <div style="padding:14px;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:14px;">
            <div class="bi-mini-card">
              <div class="label">Nível de Serviço A</div>
              <div class="val ${data.curvaAAvailability?.nivel_servico_pct >= 95 ? 'kpi-accent' : 'kpi-warn'}">
                ${num(data.curvaAAvailability?.nivel_servico_pct || 100, 1)}%
              </div>
            </div>
            <div class="bi-mini-card">
              <div class="label">Com Estoque</div>
              <div class="val kpi-accent">${num(data.curvaAAvailability?.com_estoque || 0)} SKUs</div>
            </div>
            <div class="bi-mini-card">
              <div class="label">Em Ruptura (Zerados)</div>
              <div class="val kpi-danger">${num(data.curvaAAvailability?.em_ruptura || 0)} SKUs</div>
            </div>
            <div class="bi-mini-card">
              <div class="label">Perda Estimada 91d</div>
              <div class="val kpi-danger">${brl(data.curvaAAvailability?.perda_ruptura_rs || 0)}</div>
            </div>
          </div>
          <div class="muted" style="font-size:11.5px;">
            💡 Itens da Curva A em ruptura devem ser repostos com prioridade absoluta para não perder faturamento de balcão.
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Oportunidades de Fabricante Mais Rentável (Genéricos/Similares)</h2>
          <span class="muted">Moléculas com variação de custo entre laboratórios</span>
        </div>
        <div class="table-wrap">
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Molécula / Apresentação</th>
                <th class="num">Labs</th>
                <th class="num">Menor Custo</th>
                <th class="num">Maior Custo</th>
                <th class="num">Econ. Potencial</th>
              </tr>
            </thead>
            <tbody>
              ${(data.genericOpportunities || []).length > 0 ? (data.genericOpportunities || []).map(g => `
                <tr>
                  <td><strong>${esc(g.molecule_key.split('|').slice(0, 2).join(' '))}</strong><br><span class="muted" style="font-size:10.5px;">${esc(g.molecule_key.split('|').slice(2).join(' • '))}</span></td>
                  <td class="num">${num(g.labs_count)} labs</td>
                  <td class="num" style="color:var(--success);font-weight:600;">${brl(g.menor_custo)}</td>
                  <td class="num" style="color:var(--danger);">${brl(g.maior_custo)}</td>
                  <td class="num"><strong class="kpi-accent">${brl(g.economia_potencial_rs)}</strong></td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:16px;">Sem discrepâncias relevantes de custos na rodada atual.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function loadMolecules() {
  const params = new URLSearchParams({
    q: state.molQ,
    onlySavings: state.molOnlySavings ? '1' : '0',
  });
  const data = await apiGet(`/api/molecules?${params.toString()}`);

  const bCount = data.backups?.length || 0;
  const lastBkp = data.backups?.[0];
  document.getElementById('mol-backups-bar').textContent =
    `De→Para salvos localmente: ${data.approvedDePara?.length || 0} vínculos | Backups automáticos registrados: ${bCount}${lastBkp ? ` (último: ${lastBkp.created_at})` : ''}`;

  const tbody = document.getElementById('mol-tbody');
  if (!data.rows || data.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;padding:24px;">Nenhuma molécula encontrada com esse filtro.</td></tr>';
    return;
  }

  const html = [];
  for (const m of data.rows) {
    const k = `${m.molecule_key}|${m.eh_referencia}`;
    const isOpen = state.expandedMolKeys.has(k);
    const skuIds = (m.detalhe_skus || []).map((s) => s.produto_id);

    html.push(`
      <tr class="row-main" data-mol-key="${esc(k)}">
        <td>
          <div class="sku-title">${esc(m.molecule_key)}</div>
          <div class="sku-sub">${m.eh_referencia ? '<span class="badge badge-warn">Referência / Ético</span>' : '<span class="badge badge-info">Intercambiável (Gen/Sim)</span>'}</div>
        </td>
        <td class="num">${m.skus_count} SKUs / ${m.labs_count} labs</td>
        <td class="num">${num(m.estoque_total)}</td>
        <td class="num">${num(m.ddv_proj_total, 2)}</td>
        <td class="num">${m.cobertura_molecula_dias >= 999 ? '999+' : `${num(m.cobertura_molecula_dias, 1)}d`}</td>
        <td class="num">${num(m.sugestao_sku_soma)}</td>
        <td class="num"><strong>${num(m.necessidade_liquida_molecula)}</strong></td>
        <td class="num"><strong class="kpi-accent">${brl(m.economia_rs_evitada)}</strong><div class="sku-sub">${num(m.economia_un_evitada)} un</div></td>
        <td>
          <div class="sku-sub">Melhor: <strong>${esc(m.melhor_sku_desc)}</strong> (${brl(m.melhor_custo_unit)})</div>
          <button class="btn btn-secondary btn-sm btn-approve-mol" data-mol-id="${esc(m.molecule_key)}" data-skus="${skuIds.join(',')}">Aprovar De→Para</button>
        </td>
      </tr>
    `);

    if (isOpen) {
      const sub = (m.detalhe_skus || [])
        .map(
          (s) => `
          <tr>
            <td>${s.produto_id}</td>
            <td>${esc(s.descricao)}</td>
            <td>${esc(s.labora || '—')}</td>
            <td class="num">${num(s.estoque)}</td>
            <td class="num">${num(s.ddv, 2)}</td>
            <td class="num">${brl(s.custo_unit)}</td>
            <td class="num">${num(s.sug_individual)}</td>
          </tr>
        `
        )
        .join('');
      html.push(`
        <tr class="detail-row">
          <td colspan="9">
            <table class="mini-table">
              <thead><tr><th>SKU</th><th>Descrição</th><th>Laboratório</th><th class="num">Estoque</th><th class="num">DDV Proj.</th><th class="num">Custo Un.</th><th class="num">Sug. Isolada</th></tr></thead>
              <tbody>${sub}</tbody>
            </table>
          </td>
        </tr>
      `);
    }
  }
  tbody.innerHTML = html.join('');
}

/* ==========================================================================
   SINCRONIZAÇÃO DE -> PARA COM LINX BIG (PRODUTO_APRESENTACAO)
   ========================================================================== */
async function openSyncBigApresModal() {
  const modal = document.getElementById('sync-big-apres-modal');
  modal.classList.remove('hidden');
  document.getElementById('sync-big-alert').classList.add('hidden');
  await loadSyncBigApresPreview();
}

function closeSyncBigApresModal() {
  document.getElementById('sync-big-apres-modal').classList.add('hidden');
}

async function loadSyncBigApresPreview() {
  const tbody = document.getElementById('sync-tbody');
  const clustersBox = document.getElementById('sync-clusters-container');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;" class="muted">Carregando candidatos e consultando status no MariaDB do Linx BIG...</td></tr>';
  if (clustersBox) clustersBox.innerHTML = '<div style="text-align:center;padding:24px;" class="muted">Carregando grupos de apresentações inteligentes...</div>';

  try {
    const data = await apiGet('/api/molecules/sync-preview?limit=2000');
    state.syncBigCandidates = data.items || [];
    state.syncBigClusters = data.clusters || [];
    state.syncBigViewMode = state.syncBigViewMode || 'clusters';

    // Atualizar KPIs
    document.getElementById('sync-kpi-total').textContent = num(data.summary.totalCandidates);
    document.getElementById('sync-kpi-pending').textContent = num(data.summary.pendingToLink);
    document.getElementById('sync-kpi-unique').textContent = num(data.summary.uniquePresentations);
    document.getElementById('sync-kpi-linked').textContent = num(data.summary.alreadyLinked);

    // Selecionar por padrão os não vinculados
    state.syncBigSelectedIds = new Set(
      state.syncBigCandidates
        .filter((it) => it.status === 'NAO_VINCULADO' || it.status === 'VINCULADO_INATIVO')
        .map((it) => it.produto_id)
    );

    renderSyncBigView();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#dc2626;">Erro ao carregar prévia: ${esc(err.message)}</td></tr>`;
    if (clustersBox) clustersBox.innerHTML = `<div style="text-align:center;padding:24px;color:#dc2626;">Erro ao carregar prévia: ${esc(err.message)}</div>`;
  }
}

function renderSyncBigView() {
  const clustersBox = document.getElementById('sync-clusters-container');
  const skusBox = document.getElementById('sync-skus-container');
  const btnClusters = document.getElementById('btn-sync-view-clusters');
  const btnSkus = document.getElementById('btn-sync-view-skus');

  if (state.syncBigViewMode === 'clusters') {
    if (clustersBox) clustersBox.classList.remove('hidden');
    if (skusBox) skusBox.classList.add('hidden');
    if (btnClusters) {
      btnClusters.style.background = '#0284c7';
      btnClusters.style.color = '#ffffff';
    }
    if (btnSkus) {
      btnSkus.style.background = '';
      btnSkus.style.color = '';
    }
    renderSyncBigClusters();
  } else {
    if (clustersBox) clustersBox.classList.add('hidden');
    if (skusBox) skusBox.classList.remove('hidden');
    if (btnSkus) {
      btnSkus.style.background = '#0284c7';
      btnSkus.style.color = '#ffffff';
    }
    if (btnClusters) {
      btnClusters.style.background = '';
      btnClusters.style.color = '';
    }
    renderSyncBigApresTable();
  }

  updateSyncBigSelectionCounts();
}

function updateSyncBigSelectionCounts() {
  const countEl = document.getElementById('sync-selection-count');
  if (countEl) {
    countEl.textContent = `${num(state.syncBigSelectedIds.size)} produtos selecionados para gravação (de ${num(state.syncBigCandidates.length)} candidatos)`;
  }
  const btnLabel = document.getElementById('btn-execute-sync-label');
  if (btnLabel) {
    btnLabel.textContent = `Autorizar e Gravar no Linx BIG (${num(state.syncBigSelectedIds.size)})`;
  }
}

window.toggleClusterAccordion = function (idx) {
  const body = document.getElementById(`cluster-body-${idx}`);
  const arrow = document.getElementById(`cluster-arrow-${idx}`);
  if (!body) return;
  const isHidden = body.style.display === 'none' || !body.style.display;
  body.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.toggleClusterSelection = function (idx, isChecked) {
  const cluster = (state.syncBigClusters || [])[idx];
  if (!cluster) return;
  for (const it of cluster.items) {
    if (isChecked) {
      state.syncBigSelectedIds.add(it.produto_id);
    } else {
      state.syncBigSelectedIds.delete(it.produto_id);
    }
  }
  renderSyncBigView();
};

function renderSyncBigClusters() {
  const container = document.getElementById('sync-clusters-container');
  if (!container) return;

  const q = (document.getElementById('sync-search-input')?.value || '').trim().toUpperCase();
  const filterStatus = document.getElementById('sync-filter-status')?.value || 'PENDING';

  const filteredClusters = (state.syncBigClusters || []).filter((c) => {
    if (filterStatus === 'PENDING' && c.pending_count === 0) return false;
    if (filterStatus === 'LINKED' && c.linked_count === 0) return false;
    if (q) {
      const txt = `${c.substancia} ${c.concentracao} ${c.qtd_forma_farmaceutica} ${c.labs.join(' ')} ${c.items.map(it => it.descricao).join(' ')}`.toUpperCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  });

  if (filteredClusters.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:32px;" class="muted">Nenhuma apresentação correspondente aos filtros atuais.</div>';
    return;
  }

  container.innerHTML = filteredClusters.map((c, idx) => {
    const clusterPids = c.items.map((it) => it.produto_id);
    const selectedCount = clusterPids.filter((pid) => state.syncBigSelectedIds.has(pid)).length;
    const isAllSelected = selectedCount === clusterPids.length && clusterPids.length > 0;

    const labsPreview = c.labs.length > 0 
      ? `<span class="tag" style="background:#f1f5f9;color:#334155;font-size:11px;">${esc(c.labs.slice(0, 5).join(', '))}${c.labs.length > 5 ? ` +${c.labs.length - 5}` : ''}</span>`
      : '';

    const statusPill = c.pending_count > 0 
      ? `<span class="badge-sync-pending" style="font-size:11px;">● ${c.pending_count} p/ vincular</span>`
      : `<span class="badge-sync-linked" style="font-size:11px;">✓ ${c.linked_count} vinculados</span>`;

    const itemsRows = c.items.map((it) => {
      const isChecked = state.syncBigSelectedIds.has(it.produto_id);
      const rowStatus = it.status === 'NAO_VINCULADO' 
        ? '<span class="badge-sync-pending" style="font-size:10px;">● Pendente</span>'
        : (it.status === 'VINCULADO_ATIVO' 
          ? `<span class="badge-sync-linked" style="font-size:10px;">✓ ID #${it.current_apres_id}</span>`
          : '<span class="badge-sync-inactive" style="font-size:10px;">⚠️ Inativo</span>');

      return `
        <tr style="font-size:12px;background:#fafbfc;">
          <td style="width:34px;text-align:center;">
            <input type="checkbox" class="sync-chk-item" data-pid="${it.produto_id}" ${isChecked ? 'checked' : ''} />
          </td>
          <td style="width:75px;"><code>${it.produto_id}</code></td>
          <td><strong>${esc(it.descricao)}</strong></td>
          <td style="width:120px;"><span class="tag-lab">${esc(it.labora)}</span></td>
          <td style="width:90px;text-align:right;">Estq: ${num(it.estoque_atual)}</td>
          <td style="width:90px;text-align:right;">Sug: <strong>${num(it.sugestao_compra_un)}</strong></td>
          <td style="width:120px;">${rowStatus}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="sync-cluster-card" style="border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.03);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;cursor:pointer;" onclick="toggleClusterAccordion(${idx})">
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" class="sync-chk-cluster" data-cidx="${idx}" ${isAllSelected ? 'checked' : ''} style="cursor:pointer;" onclick="event.stopPropagation(); toggleClusterSelection(${idx}, this.checked)" />
            <div>
              <span style="font-size:14px;font-weight:700;color:#0f172a;">${esc(c.substancia)}</span>
              <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;margin-left:6px;font-size:12px;">${esc(c.concentracao)}</span>
              <span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600;margin-left:4px;font-size:12px;">${esc(c.qtd_forma_farmaceutica)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;font-weight:600;color:#475569;">
              <strong>${c.skus_count}</strong> ${c.skus_count === 1 ? 'produto concorrente' : 'produtos concorrentes'} unificados
            </span>
            ${labsPreview}
            ${statusPill}
            <span id="cluster-arrow-${idx}" style="font-size:12px;color:#94a3b8;transition:transform 0.2s;">▼</span>
          </div>
        </div>
        <div id="cluster-body-${idx}" class="cluster-body" style="padding:0;display:none;">
          <table class="data-table" style="margin:0;width:100%;border-top:none;">
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function renderSyncBigApresTable() {
  const tbody = document.getElementById('sync-tbody');
  if (!tbody) return;

  const q = (document.getElementById('sync-search-input')?.value || '').trim().toUpperCase();
  const filterStatus = document.getElementById('sync-filter-status')?.value || 'PENDING';

  const filtered = (state.syncBigCandidates || []).filter((it) => {
    if (filterStatus === 'PENDING' && it.status === 'VINCULADO_ATIVO') return false;
    if (filterStatus === 'LINKED' && it.status !== 'VINCULADO_ATIVO') return false;
    if (q) {
      const txt = `${it.produto_id} ${it.descricao} ${it.labora} ${it.substancia} ${it.concentracao} ${it.qtd_forma_farmaceutica}`.toUpperCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  });

  const allFilteredChecked = filtered.length > 0 && filtered.every((it) => state.syncBigSelectedIds.has(it.produto_id));
  const chkAll = document.getElementById('sync-chk-all');
  if (chkAll) chkAll.checked = allFilteredChecked;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;" class="muted">Nenhum produto correspondente aos filtros atuais.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((it) => {
    const isChecked = state.syncBigSelectedIds.has(it.produto_id);
    let statusBadge = '';
    if (it.status === 'NAO_VINCULADO') {
      statusBadge = '<span class="badge-sync-pending">● Pronto p/ Vincular</span>';
    } else if (it.status === 'VINCULADO_ATIVO') {
      statusBadge = `<span class="badge-sync-linked" title="Apresentação ID ${it.current_apres_id} ativa">✓ Já Vinculado (#${it.current_apres_id})</span>`;
    } else {
      statusBadge = `<span class="badge-sync-inactive" title="ID ${it.current_apres_id} mas considera=N">⚠️ Inativo no BIG</span>`;
    }

    return `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" class="sync-chk-item" data-pid="${it.produto_id}" ${isChecked ? 'checked' : ''} />
        </td>
        <td><code>${it.produto_id}</code></td>
        <td><strong>${esc(it.descricao)}</strong></td>
        <td><span class="tag-lab">${esc(it.labora)}</span></td>
        <td>${esc(it.substancia)}</td>
        <td><strong>${esc(it.concentracao)}</strong></td>
        <td>${esc(it.qtd_forma_farmaceutica)}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

async function cleanupSyncBigApres() {
  const confirmMsg = `ATENÇÃO: Deseja realmente limpar as apresentações de teste criadas no MariaDB do Linx BIG (IDs >= 1019)?\n\nIsso irá:\n1. Desvincular os produtos no Linx BIG (produto_apresentacao_id = NULL, considera = 'N')\n2. Remover os registros poluídos de produto_apresentacao\n3. Permitir a re-sincronização limpa com o novo padrão da IA.\n\nDeseja continuar?`;
  if (!confirm(confirmMsg)) return;

  const alertEl = document.getElementById('sync-big-alert');
  alertEl.className = 'order-batch-alert info';
  alertEl.classList.remove('hidden');
  alertEl.innerHTML = '<strong>Limpando registros de teste no Linx BIG...</strong> Aguarde.';

  try {
    const res = await apiPost('/api/molecules/sync-cleanup', { fromId: 1019 });
    alertEl.className = 'order-batch-alert success';
    alertEl.innerHTML = `
      <strong>✓ Limpeza Concluída com Sucesso!</strong><br />
      &bull; <strong>${num(res.deletedPresentations)}</strong> apresentações de teste removidas de <code>produto_apresentacao</code>.<br />
      &bull; <strong>${num(res.unlinkedProducts)}</strong> produtos desvinculados com segurança.<br />
      O banco está limpo e pronto para receber o novo cadastro inteligente unificado.
    `;
    showBanner(`✓ Limpeza concluída: ${res.deletedPresentations} apresentações removidas.`);
    await loadSyncBigApresPreview();
  } catch (err) {
    alertEl.className = 'order-batch-alert error';
    alertEl.innerHTML = `<strong>Falha na limpeza:</strong> ${esc(err.message)}`;
    showBanner(`Erro na limpeza: ${err.message}`, true);
  }
}

async function executeSyncBigApres() {
  if (state.syncBigSelectedIds.size === 0) {
    alert('Selecione ao menos um produto para gravar no Linx BIG.');
    return;
  }

  const selectedItems = (state.syncBigCandidates || []).filter((it) => state.syncBigSelectedIds.has(it.produto_id));
  const options = {
    onlyUnlinked: document.getElementById('sync-opt-only-unlinked')?.checked ?? true,
    activateConsidera: document.getElementById('sync-opt-activate-considera')?.checked ?? true,
    updateQtdeApres: document.getElementById('sync-opt-update-qtde')?.checked ?? true,
  };

  const confirmMsg = `Deseja realmente gravar o De -> Para de ${selectedItems.length} produtos na tabela produto_apresentacao do Linx BIG?\n\nEsta operação cria as apresentações na base MariaDB e ativa o agrupamento no ERP sob transação ACID segura.`;
  if (!confirm(confirmMsg)) return;

  const btnExecute = document.getElementById('btn-execute-sync-big-apres');
  const alertEl = document.getElementById('sync-big-alert');
  if (btnExecute) btnExecute.disabled = true;

  alertEl.className = 'order-batch-alert info';
  alertEl.classList.remove('hidden');
  alertEl.innerHTML = '<strong>Gravando no MariaDB do Linx BIG...</strong> Aguarde a confirmação da transação ACID.';

  try {
    const res = await apiPost('/api/molecules/sync-execute', {
      items: selectedItems,
      options,
    });

    alertEl.className = 'order-batch-alert success';
    alertEl.innerHTML = `
      <strong>✓ Sincronização Concluída com Sucesso!</strong><br />
      &bull; <strong>${num(res.createdPresentations)}</strong> novas apresentações cadastradas em <code>produto_apresentacao</code>.<br />
      &bull; <strong>${num(res.linkedProducts)}</strong> produtos vinculados e ativados no Linx BIG com <code>considera_prod_apresentacao = 'S'</code>.<br />
      ${res.skippedAlreadyLinked > 0 ? `&bull; <strong>${num(res.skippedAlreadyLinked)}</strong> produtos já vinculados foram preservados.<br />` : ''}
      Tempo de processamento: <strong>${(res.elapsedMs / 1000).toFixed(2)}s</strong> sob transação segura.
    `;

    showBanner(`✓ De -> Para do BIG atualizado: ${res.linkedProducts} produtos vinculados com sucesso!`);
    await loadSyncBigApresPreview();
  } catch (err) {
    alertEl.className = 'order-batch-alert error';
    alertEl.innerHTML = `<strong>Falha na gravação no Linx BIG:</strong> ${esc(err.message)} (Rollback automático efetuado. Nenhuma alteração corrompida).`;
    showBanner(`Erro na sincronização do BIG: ${err.message}`, true);
  } finally {
    if (btnExecute) btnExecute.disabled = false;
  }
}

async function loadTransfers() {
  const [routesData, remanData] = await Promise.all([
    apiGet('/api/remanejamento/routes').catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0 })),
    apiGet('/api/remanejamento').catch(() => ({ transfers: [], expiringLots: [] })),
  ]);

  const routes = routesData.routes || [];
  const activeTransfers = routesData.transfers || [];
  const expiringLots = remanData.expiringLots || [];

  // KPI Strip
  const kpiEl = document.getElementById('transfers-kpi-strip');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi-cell">
        <div class="kpi-label">Rotas de Remanejamento</div>
        <div class="kpi-val kpi-accent">${num(routes.length)}</div>
        <div class="kpi-sub">Origem ➔ Destino identificadas</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Peças a Transferir</div>
        <div class="kpi-val kpi-accent">${num(routesData.totalGeralUnidades || 0)} un</div>
        <div class="kpi-sub">Resgate de excessos e FEFO</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Economia Gerada em Compras</div>
        <div class="kpi-val kpi-success" style="color:#047857;">${brl(routesData.totalGeralRs || 0)}</div>
        <div class="kpi-sub">Compras evitadas em distribuidores</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Guias Emitidas no Motor</div>
        <div class="kpi-val">${num(activeTransfers.length)}</div>
        <div class="kpi-sub">${activeTransfers.filter(t => t.status === 'PENDENTE_SEPARACAO').length} aguardando separação</div>
      </div>
    `;
  }

  // Rotas Container
  const routesContainer = document.getElementById('transfer-routes-container');
  const routesCount = document.getElementById('transfer-routes-count');
  if (routesCount) routesCount.textContent = `${routes.length} rotas identificadas`;

  if (routesContainer) {
    if (routes.length === 0) {
      routesContainer.innerHTML = '<div class="muted" style="text-align:center;padding:24px;">Nenhuma rota de remanejamento pendente na rodada atual.</div>';
    } else {
      routesContainer.innerHTML = routes.map((r, idx) => `
        <div class="transfer-route-card" data-route-idx="${idx}">
          <div class="transfer-route-header">
            <div>
              <div class="transfer-route-title">
                <span>🚚 Rota ${idx + 1}: <strong>${esc(r.filialOrigemNome)}</strong></span>
                <span style="color:#0f766e;font-size:16px;">➔</span>
                <span><strong>${esc(r.filialDestinoNome)}</strong></span>
              </div>
              <div class="transfer-route-meta">
                ${num(r.totalItens)} produtos &bull; <strong>${num(r.totalUnidades)} unidades a transferir</strong> &bull; Economia de Compra: <strong style="color:#047857;">${brl(r.valorTotalRs)}</strong>
              </div>
            </div>
            <div class="transfer-route-actions" style="display:flex;gap:8px;align-items:center;">
              <a href="/api/remanejamento/export-excel?origem=${r.filialOrigem}&destino=${r.filialDestino}" class="btn btn-secondary btn-sm" style="font-weight:600;" title="Baixar Guia de Separação em Excel desta rota">
                📥 Baixar Guia (Excel)
              </a>
              <button class="btn btn-primary btn-sm btn-approve-route" data-route-idx="${idx}" type="button" style="background:#0f766e;border-color:#0f766e;font-weight:600;">
                ✓ Aprovar Transferência
              </button>
            </div>
          </div>
          <div class="transfer-items-table">
            <table class="data-table" style="font-size:12px;margin:0;">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Barras (EAN)</th>
                  <th>Produto / Descrição</th>
                  <th>Tipo</th>
                  <th class="num">Qtd a Transferir</th>
                  <th class="num">Custo Unit</th>
                  <th class="num">Total R$</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${r.items.map(it => `
                  <tr>
                    <td><code>${it.produto_id}</code></td>
                    <td><code>${esc(it.barras || '—')}</code></td>
                    <td><div class="sku-title">${esc(it.descricao)}</div><div class="sku-sub">${esc(it.labora || '')}</div></td>
                    <td>${badgeForException(it.tipo)}</td>
                    <td class="num"><strong>${num(it.qtd_sugerida)} un</strong></td>
                    <td class="num">${brl(it.custo_unit)}</td>
                    <td class="num"><strong>${brl(it.valor_total)}</strong></td>
                    <td class="sku-sub">${esc(it.motivo)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('');

      routesContainer.querySelectorAll('.btn-approve-route').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rIdx = Number(btn.dataset.routeIdx);
          const route = routes[rIdx];
          if (!route) return;

          btn.disabled = true;
          btn.textContent = 'Aprovando...';
          try {
            const approveRes = await apiPost('/api/remanejamento/approve', {
              filialOrigem: route.filialOrigem,
              filialDestino: route.filialDestino,
              filialOrigemNome: route.filialOrigemNome,
              filialDestinoNome: route.filialDestinoNome,
              items: route.items,
              observacao: `Aprovado pelo comprador via Cockpit (${route.totalUnidades} un)`,
            });
            showBanner(`✓ Transferência ${approveRes.codigoTransferencia} criada com sucesso! Sugestão de compra deduzida no motor.`, false);
            await loadTransfers();
          } catch (err) {
            showBanner(`Falha ao aprovar transferência: ${err.message}`, true);
            btn.disabled = false;
            btn.textContent = '✓ Aprovar Transferência';
          }
        });
      });
    }
  }

  // Tabela de Guias Emitidas
  const activeCountEl = document.getElementById('active-transfers-count');
  if (activeCountEl) activeCountEl.textContent = `${activeTransfers.length} guias registradas`;

  const motorTbody = document.getElementById('motor-transfers-tbody');
  if (motorTbody) {
    if (activeTransfers.length === 0) {
      motorTbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhuma transferência emitida ainda. Aprove uma das rotas acima para emitir a guia.</td></tr>';
    } else {
      motorTbody.innerHTML = activeTransfers.map(t => {
        let statusBadge = `<span class="badge badge-warn">${t.status}</span>`;
        if (t.status === 'EM_TRANSITO') statusBadge = '<span class="badge badge-info">🚚 EM TRÂNSITO</span>';
        if (t.status === 'RECEBIDA') statusBadge = '<span class="badge badge-success">✅ RECEBIDA</span>';
        if (t.status === 'CANCELADA') statusBadge = '<span class="badge badge-neutral">✕ CANCELADA</span>';

        let nextActionBtn = '';
        if (t.status === 'PENDENTE_SEPARACAO') {
          nextActionBtn = `<button class="btn btn-secondary btn-xs btn-change-status" data-id="${t.id}" data-status="EM_TRANSITO">🚚 Despachar</button>`;
        } else if (t.status === 'EM_TRANSITO') {
          nextActionBtn = `<button class="btn btn-secondary btn-xs btn-change-status" data-id="${t.id}" data-status="RECEBIDA" style="color:#047857;font-weight:700;">✅ Receber</button>`;
        }

        return `
          <tr>
            <td><code>${esc(t.codigo_transferencia)}</code></td>
            <td><strong>${esc(t.filial_origem_nome || `F${t.filial_origem}`)}</strong> ➔ <strong>${esc(t.filial_destino_nome || `F${t.filial_destino}`)}</strong></td>
            <td style="font-size:11.5px;">${esc(t.data_emissao)}</td>
            <td class="num">${num(t.total_itens)}</td>
            <td class="num"><strong>${num(t.total_unidades)} un</strong></td>
            <td class="num"><strong>${brl(t.valor_total_rs)}</strong></td>
            <td>${statusBadge}</td>
            <td style="display:flex;gap:6px;align-items:center;">
              <a href="/api/remanejamento/export-excel?transferId=${t.id}" class="btn btn-secondary btn-xs" title="Baixar Guia de Separação em Excel">📥 Excel</a>
              ${nextActionBtn}
            </td>
          </tr>
        `;
      }).join('');

      motorTbody.querySelectorAll('.btn-change-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = Number(btn.dataset.id);
          const newStatus = btn.dataset.status;
          try {
            await apiPost('/api/remanejamento/transfer-status', { transferId: tId, status: newStatus });
            showBanner(`Status da transferência atualizado para ${newStatus}!`, false);
            await loadTransfers();
          } catch (err) {
            showBanner(`Erro: ${err.message}`, true);
          }
        });
      });
    }
  }

  // Tabela FEFO
  const eBody = document.getElementById('expiring-tbody');
  const expCountEl = document.getElementById('expiring-count');
  if (expCountEl) expCountEl.textContent = `${expiringLots.length} lotes em risco`;
  if (eBody) {
    eBody.innerHTML = expiringLots.length
      ? expiringLots.map(x => {
          const safeMaxDesc = Math.max(0, Math.round(x.margem_pct * 0.8));
          return `
            <tr>
              <td><span class="badge badge-neutral">L0${x.filial_id}</span></td>
              <td><div class="sku-title">${esc(x.descricao)}</div><div class="sku-sub">SKU ${x.produto_id} | Curva ${x.abc_class} | DDV ${num(x.ddv_projetada, 2)}</div></td>
              <td class="num">${esc(x.lote_menor_validade || '—')}</td>
              <td class="num">${num(x.lote_vencendo_90d_qtd)}</td>
              <td class="num">${num(x.lote_vencido_qtd)}</td>
              <td class="num"><strong class="kpi-warn">${brl(x.lote_vencendo_90d_rs)}</strong></td>
              <td class="num">Mg ${num(x.margem_pct, 1)}% | Desc. até ${safeMaxDesc}%</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px;">Nenhum lote crítico encontrado.</td></tr>';
  }
}

async function loadPbm() {
  const params = new URLSearchParams({ q: state.pbmQ });
  const data = await apiGet(`/api/pbm?${params.toString()}`);

  document.getElementById('pbm-rules-tbody').innerHTML = data.rules
    .map(
      (r) => `
      <tr>
        <td>Operadora ${esc(r.operadora || '—')}</td>
        <td><strong>${esc(r.projeto || '(Sem nome de projeto)')}</strong></td>
        <td class="num">${num(r.tx_count_91d)}</td>
        <td class="num">${num(r.unidades_91d)}</td>
        <td>
          <select class="pbm-rule-select" data-rule-id="${r.id}">
            <option value="S" ${r.auto_reposicao === 'S' ? 'selected' : ''}>Sim — 100% Auto-Reposto (Abate compra)</option>
            <option value="P" ${r.auto_reposicao === 'P' ? 'selected' : ''}>Parcial — 50% Abatido</option>
            <option value="N" ${r.auto_reposicao === 'N' ? 'selected' : ''}>Não — Compra Normal</option>
          </select>
        </td>
      </tr>`
    )
    .join('');

  document.getElementById('pbm-audit-tbody').innerHTML = data.auditRows
    .map(
      (a) => `
      <tr>
        <td>${esc(a.data_hora)}</td>
        <td>${esc(a.projeto || `Operadora ${a.operadora}`)}</td>
        <td><strong>${esc(a.nsu)}</strong></td>
        <td>${esc(a.autorizacao)}</td>
        <td>${esc(a.cartao_cpf)}</td>
        <td>${esc(a.descricao)} <span class="muted">(${a.produto_id})</span></td>
        <td class="num">${num(a.percentual_desconto, 1)}%</td>
        <td class="num">${brl(a.valor_desconto)}</td>
      </tr>`
    )
    .join('');
}

async function exportWorkbook(mode) {
  showBanner(`Gerando planilha Excel (${mode === 'cotefacil' ? 'Layout Cotefácil EAN' : 'Gerencial Decisão IA'})...`);
  try {
    const res = await fetch('/api/export/quotation.xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        tab: state.tab,
        q: state.q,
        abc: state.abc,
        abcxyz: state.abcxyz,
        macro: state.macro,
        exc: state.exc,
        sort: state.sort,
        budget: state.budget,
        selectedKeys: [...state.selectedSkus.keys()],
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'cotefacil' ? 'cotefacil_cotacao_ean.xlsx' : 'decisao_compras_ia.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBanner(`Planilha ${a.download} gerada (${state.selectedSkus.size > 0 ? `${state.selectedSkus.size} itens selecionados` : 'filtro atual aplicado'}).`);
  } catch (err) {
    showBanner(`Erro ao exportar Excel: ${err.message}`, true);
  }
}

/* ==========================================================================
   CONFIGURAÇÃO MULTI-CLIENTE & BANCO DE DADOS BIG
   ========================================================================== */
function formatCnpj(val) {
  if (!val) return '—';
  const clean = String(val).replace(/\D/g, '').padStart(14, '0');
  if (clean.length !== 14) return val;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function selectFilial(filialId, filiais = null) {
  const list = filiais || state.discoveredFiliais || [];
  const chosen = list.find((f) => Number(f.filial_id) === Number(filialId));
  if (!chosen) return;

  document.getElementById('cfg-buyer-filial').value = chosen.filial_id;
  const select = document.getElementById('cfg-buyer-filial-select');
  if (select) select.value = String(chosen.filial_id);

  if (chosen.cgc) {
    document.getElementById('cfg-buyer-cnpj').value = chosen.cgc;
  }
  const nameInput = document.getElementById('cfg-client-name');
  if (chosen.nome) {
    nameInput.value = chosen.nome;
  }

  // Atualizar visual dos cards
  document.querySelectorAll('.filial-card').forEach((card) => {
    const fid = Number(card.dataset.filialId);
    if (fid === Number(chosen.filial_id)) {
      card.classList.add('selected');
      const action = card.querySelector('.filial-card-action');
      if (action) action.innerHTML = '★ Filial Selecionada';
    } else {
      card.classList.remove('selected');
      const action = card.querySelector('.filial-card-action');
      if (action) action.innerHTML = '✓ Usar Esta Filial';
    }
  });

  const feedbackBanner = document.getElementById('filial-selected-banner');
  if (feedbackBanner) {
    feedbackBanner.innerHTML = `✓ Loja <strong>${chosen.filial_id} (${esc(chosen.nome)})</strong> ativa para compras &bull; CNPJ: <code>${formatCnpj(chosen.cgc)}</code>`;
    feedbackBanner.classList.remove('hidden');
  }
}

function getFormDbParams() {
  return {
    host: document.getElementById('cfg-db-host').value.trim(),
    port: Number(document.getElementById('cfg-db-port').value || 3306),
    user: document.getElementById('cfg-db-user').value.trim(),
    password: document.getElementById('cfg-db-password').value,
    database: document.getElementById('cfg-db-name').value.trim(),
  };
}

function buildSupplierLookupQueryString(extra = {}) {
  const p = getFormDbParams();
  const params = new URLSearchParams();
  if (p.host) params.set('host', p.host);
  if (p.port) params.set('port', String(p.port));
  if (p.user) params.set('user', p.user);
  if (p.password && p.password !== '••••••••' && p.password !== '********') {
    params.set('password', p.password);
  }
  if (p.database) params.set('database', p.database);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  }
  return params.toString();
}

async function openDbConfigModal() {
  const modal = document.getElementById('db-config-modal');
  modal.classList.remove('hidden');
  const feedback = document.getElementById('conn-test-feedback');
  feedback.className = 'conn-status-box hidden';
  feedback.textContent = '';

  try {
    const res = await apiGet('/api/config/profile');
    const p = res.profile || {};
    state.clientProfile = p;

    document.getElementById('cfg-operation-mode').value = p.operation_mode || 'central';
    document.getElementById('cfg-client-name').value = p.name || 'Drogaria Apresentação';
    document.getElementById('cfg-db-host').value = p.db_host || '127.0.0.1';
    document.getElementById('cfg-db-port').value = p.db_port || 3306;
    document.getElementById('cfg-db-user').value = p.db_user || 'root';
    document.getElementById('cfg-db-password').value = p.db_password || '';
    document.getElementById('cfg-db-name').value = p.db_name || 'gerente';
    document.getElementById('cfg-buyer-filial').value = p.buyer_filial_id || 2;
    document.getElementById('cfg-buyer-cnpj').value = p.buyer_cnpj || '';
    document.getElementById('cfg-supplier-id').value = p.default_supplier_id || 10;
    document.getElementById('cfg-force-reset').checked = false;

    // Detectar mudancas de host ou banco para marcar reset automaticamente
    const checkDbChanged = () => {
      const curHost = document.getElementById('cfg-db-host').value.trim().toLowerCase();
      const curDb = document.getElementById('cfg-db-name').value.trim().toLowerCase();
      const oldHost = String(p.db_host || '').trim().toLowerCase();
      const oldDb = String(p.db_name || '').trim().toLowerCase();
      if ((curHost && oldHost && curHost !== oldHost) || (curDb && oldDb && curDb !== oldDb)) {
        document.getElementById('cfg-force-reset').checked = true;
      }
    };
    document.getElementById('cfg-db-host').oninput = checkDbChanged;
    document.getElementById('cfg-db-name').oninput = checkDbChanged;

    await lookupSupplierLive(p.default_supplier_id || 10);
  } catch (err) {
    showBanner(`Erro ao carregar perfil de configuração: ${err.message}`, true);
  }
}

function closeDbConfigModal() {
  document.getElementById('db-config-modal').classList.add('hidden');
}

/* ==========================================================================
   PARÂMETROS DE GRUPOS & CURVAS ABC (DIAS DE ESTOQUE)
   ========================================================================== */
async function openGroupConfigModal() {
  const modal = document.getElementById('group-config-modal');
  modal.classList.remove('hidden');
  const alert = document.getElementById('group-config-alert');
  alert.className = 'order-batch-alert hidden';
  alert.textContent = '';
  document.getElementById('group-config-search').value = '';
  initParetoSliders();
  await loadGroupConfigs();
}

function closeGroupConfigModal() {
  document.getElementById('group-config-modal').classList.add('hidden');
}

async function loadGroupConfigs() {
  const tbody = document.getElementById('group-config-tbody');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px;" class="muted">Carregando grupos do Linx BIG...</td></tr>';
  try {
    const res = await apiGet('/api/config/groups');
    state.groupConfigs = res.groups || [];
    renderGroupConfigTable('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #dc2626;">Erro ao carregar grupos: ${esc(err.message)}</td></tr>`;
  }
}

function renderGroupConfigTable(filter = '') {
  const tbody = document.getElementById('group-config-tbody');
  const summary = document.getElementById('group-config-summary');
  const list = state.groupConfigs || [];

  const q = String(filter || '').toLowerCase().trim();
  const filtered = q
    ? list.filter((g) =>
        String(g.grupo_id).includes(q) ||
        String(g.grupo_nome || '').toLowerCase().includes(q) ||
        String(g.macro_categoria || '').toLowerCase().includes(q)
      )
    : list;

  const totalSkus = list.reduce((a, b) => a + Number(b.total_produtos || 0), 0);
  summary.innerHTML = `<strong>${list.length} grupos</strong> configurados &bull; <strong>${totalSkus} SKUs</strong> ativos vinculados`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px;" class="muted">Nenhum grupo encontrado com este filtro.</td></tr>';
    return;
  }

  const html = filtered.map((g) => {
    const isBig = g.source === 'LINX_BIG_GRUPO';
    const sourceBadge = isBig
      ? '<span class="badge badge-success" title="Parâmetros extraídos da tabela grupo do BIG">Linx BIG</span>'
      : '<span class="badge badge-info" title="Calibrado com inteligência farmacêutica pelo motor">IA Default</span>';

    return `
      <tr data-gid="${g.grupo_id}">
        <td><strong>${g.grupo_id}</strong></td>
        <td>
          <div style="font-weight: 600;">${esc(g.grupo_nome)}</div>
        </td>
        <td><span class="badge badge-neutral">${esc(g.macro_categoria || 'OUTROS')}</span></td>
        <td class="num"><strong>${num(g.total_produtos)}</strong></td>
        <td style="text-align: center;">
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_min_a" type="number" min="0" max="180" value="${g.dias_min_a ?? 3}" />
          <span class="muted" style="font-size: 11px;"> a </span>
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_max_a" type="number" min="0" max="180" value="${g.dias_max_a ?? 12}" />
          <span class="muted" style="font-size: 11px;">d</span>
        </td>
        <td style="text-align: center;">
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_min_b" type="number" min="0" max="180" value="${g.dias_min_b ?? 7}" />
          <span class="muted" style="font-size: 11px;"> a </span>
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_max_b" type="number" min="0" max="180" value="${g.dias_max_b ?? 15}" />
          <span class="muted" style="font-size: 11px;">d</span>
        </td>
        <td style="text-align: center;">
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_min_c" type="number" min="0" max="180" value="${g.dias_min_c ?? 10}" />
          <span class="muted" style="font-size: 11px;"> a </span>
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_max_c" type="number" min="0" max="180" value="${g.dias_max_c ?? 20}" />
          <span class="muted" style="font-size: 11px;">d</span>
        </td>
        <td style="text-align: center;">
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_min_d" type="number" min="0" max="180" value="${g.dias_min_d ?? 0}" />
          <span class="muted" style="font-size: 11px;"> a </span>
          <input class="group-days-input" data-gid="${g.grupo_id}" data-field="dias_max_d" type="number" min="0" max="180" value="${g.dias_max_d ?? 0}" />
          <span class="muted" style="font-size: 11px;">d</span>
        </td>
        <td>${sourceBadge}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

function syncInputsToState() {
  const inputs = document.querySelectorAll('#group-config-tbody .group-days-input');
  const map = new Map((state.groupConfigs || []).map((g) => [g.grupo_id, g]));
  inputs.forEach((inp) => {
    const gid = Number(inp.dataset.gid);
    const field = inp.dataset.field;
    const g = map.get(gid);
    if (g && field) {
      g[field] = Number(inp.value) || 0;
    }
  });
}

function applyGroupPreset(presetType) {
  syncInputsToState();
  const list = state.groupConfigs || [];
  for (const g of list) {
    const isMed = g.macro_categoria === 'MEDICAMENTO';
    const isPerfumaria = g.macro_categoria === 'PERFUMARIA_HPC' || g.macro_categoria === 'DERMOCOSMETICO';

    if (presetType === 'pharma') {
      g.dias_min_a = isMed ? 3 : isPerfumaria ? 5 : 7;
      g.dias_max_a = isMed ? 12 : isPerfumaria ? 15 : 18;
      g.dias_min_b = isMed ? 7 : isPerfumaria ? 10 : 12;
      g.dias_max_b = isMed ? 15 : isPerfumaria ? 20 : 22;
      g.dias_min_c = isMed ? 10 : isPerfumaria ? 15 : 15;
      g.dias_max_c = isMed ? 20 : isPerfumaria ? 25 : 28;
      g.dias_min_d = 0;
      g.dias_max_d = 0;
    } else if (presetType === 'enxuto') {
      g.dias_min_a = isMed ? 3 : 4;
      g.dias_max_a = isMed ? 7 : 10;
      g.dias_min_b = isMed ? 5 : 7;
      g.dias_max_b = isMed ? 10 : 14;
      g.dias_min_c = isMed ? 7 : 10;
      g.dias_max_c = isMed ? 14 : 18;
      g.dias_min_d = 0;
      g.dias_max_d = 0;
    } else if (presetType === 'alta') {
      g.dias_min_a = isMed ? 7 : 10;
      g.dias_max_a = isMed ? 15 : 20;
      g.dias_min_b = isMed ? 10 : 15;
      g.dias_max_b = isMed ? 20 : 28;
      g.dias_min_c = isMed ? 15 : 20;
      g.dias_max_c = isMed ? 30 : 35;
      g.dias_min_d = 0;
      g.dias_max_d = 0;
    }
  }
  const q = document.getElementById('group-config-search').value;
  renderGroupConfigTable(q);

  const alert = document.getElementById('group-config-alert');
  alert.className = 'order-batch-alert info';
  alert.innerHTML = `✓ Predefinição <strong>${presetType.toUpperCase()}</strong> aplicada a todos os grupos! Clique em "Salvar Parâmetros e Recalcular" para processar.`;
  alert.classList.remove('hidden');
}

async function saveGroupConfigsAndRecalc() {
  syncInputsToState();
  const alert = document.getElementById('group-config-alert');
  alert.className = 'order-batch-alert info';
  alert.textContent = 'Salvando parâmetros de grupos e recalculando compras...';
  alert.classList.remove('hidden');

  try {
    const configs = (state.groupConfigs || []).map((g) => ({
      ...g,
      source: 'CUSTOM',
    }));
    await apiPost('/api/config/groups', { configs });
    closeGroupConfigModal();
    showBanner('Parâmetros de grupos salvos! Recalculando motor de compras...', false);
    await triggerRecalculation();
  } catch (err) {
    alert.className = 'order-batch-alert error';
    alert.textContent = `Erro ao salvar: ${err.message}`;
  }
}

/* ==========================================================================
   RESUMO POR GRUPO & ÁRVORE ERP (LINX BIG)
   ========================================================================== */
async function loadAndRenderGroupsTree(forceReload = false) {
  const container = document.getElementById('view-groups-summary');
  if (!container) return;

  function renderTreeData(treeData) {
    if (!treeData || !treeData.length) {
      container.innerHTML = '<div class="muted" style="text-align:center;padding:30px;">Nenhum grupo encontrado nesta execução.</div>';
      return;
    }

    // Totais Consolidados para Header KPI
    let totalCategorias = treeData.length;
    let totalMixSkus = 0;
    let totalBuySkus = 0;
    let totalBuyUn = 0;
    let totalBuyRs = 0;

    for (const p of treeData) {
      totalMixSkus += Number(p.totalSkus || p.skusCount || 0);
      totalBuySkus += Number(p.buySkus || 0);
      totalBuyUn += Number(p.buyUn || p.sugestaoUn || 0);
      totalBuyRs += Number(p.buyRs || p.sugestaoRs || 0);
    }

    const kpiStripHtml = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom: 16px;">
        <div class="kpi-cell">
          <div class="kpi-label">Categorias Macro (BIG)</div>
          <div class="kpi-val" style="font-size:20px;">${num(totalCategorias)}</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Mix Total Cadastrado</div>
          <div class="kpi-val" style="font-size:20px;">${num(totalMixSkus)} <span class="kpi-sub">SKUs</span></div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">SKUs c/ Sugestão de Compra</div>
          <div class="kpi-val" style="font-size:20px; color:var(--accent);">${num(totalBuySkus)} <span class="kpi-sub">SKUs</span></div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Volume Total a Comprar</div>
          <div class="kpi-val" style="font-size:20px;">${num(totalBuyUn)} <span class="kpi-sub">unidades</span></div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Investimento Total Sugerido</div>
          <div class="kpi-val" style="font-size:20px; color:#047857;">${brl(totalBuyRs)}</div>
        </div>
      </div>
    `;

    const html = treeData.map((parent) => {
      const parentName = parent.name || parent.nome || 'OUTROS';
      const parentTotalSkus = Number(parent.totalSkus || parent.skusCount || 0);
      const parentBuySkus = Number(parent.buySkus || 0);
      const parentBuyUn = Number(parent.buyUn || parent.sugestaoUn || 0);
      const parentBuyRs = Number(parent.buyRs || parent.sugestaoRs || 0);
      const children = parent.children || [];
      const parentStockedCount = Math.max(0, parentTotalSkus - parentBuySkus);

      const childrenHtml = children.map((child) => {
        const childName = child.name || child.nome || 'DIVERSOS';
        const childTotalSkus = Number(child.totalSkus || child.skusCount || 0);
        const childBuySkus = Number(child.buySkus || 0);
        const childBuyUn = Number(child.buyUn || child.sugestaoUn || 0);
        const childBuyRs = Number(child.buyRs || child.sugestaoRs || 0);
        const childCode = child.grupoId || child.codigo || '—';
        const stockedCount = Math.max(0, childTotalSkus - childBuySkus);

        return `
          <div class="group-child-row">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;">
                <span>📂 ${esc(childName)}</span>
                ${childBuySkus > 0 ? `<span class="badge badge-accent" style="font-size:10.5px;padding:2px 7px;font-weight:700;">🛒 ${num(childBuySkus)} a comprar</span>` : '<span class="badge badge-neutral" style="font-size:10.5px;padding:2px 7px;color:#047857;font-weight:600;">✅ 100% Abastecido</span>'}
              </div>
              <div class="muted" style="font-size:11px;margin-top:3px;">
                Código BIG: <code>${esc(String(childCode))}</code> &bull; Mix: <strong>${num(childTotalSkus)} SKUs</strong> cadastrados (${num(childBuySkus)} c/ compra &bull; ${num(stockedCount)} abastecidos)
              </div>
            </div>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
              <span style="font-weight:600;font-size:13px;color:var(--text);min-width:55px;text-align:right;">${num(childBuyUn)} un</span>
              <span style="font-weight:700;font-size:13.5px;color:${childBuyRs > 0 ? '#047857' : 'var(--text-muted)'};min-width:90px;text-align:right;">${brl(childBuyRs)}</span>
              ${childBuySkus > 0 ? `
                <button class="btn btn-secondary btn-sm btn-filter-child-group" data-parent="${esc(parentName)}" data-child="${esc(childName)}" data-grupo-id="${esc(String(childCode))}" data-target-tab="buy" type="button" style="font-size:11px;padding:4px 9px;font-weight:600;" title="Filtrar apenas os produtos com sugestão de compra neste subgrupo">
                  🛒 Filtrar Sugestão (${num(childBuySkus)})
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-sm btn-filter-child-group" data-parent="${esc(parentName)}" data-child="${esc(childName)}" data-grupo-id="${esc(String(childCode))}" data-target-tab="all" type="button" style="font-size:11px;padding:4px 9px;font-weight:600;color:var(--text-muted);" title="Ver todos os produtos do mix deste subgrupo (com ou sem compra)">
                📦 Ver Mix (${num(childTotalSkus)})
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="group-parent-card">
          <div class="group-parent-header">
            <div>
              <div class="group-parent-title" style="display:flex;align-items:center;gap:8px;">
                <span>📁 ${esc(parentName)}</span>
                ${parentBuySkus > 0 ? `<span class="badge badge-accent" style="font-size:11px;padding:2px 8px;font-weight:700;">🛒 ${num(parentBuySkus)} a Comprar</span>` : '<span class="badge badge-neutral" style="font-size:11px;color:#047857;">✅ 100% Abastecido</span>'}
              </div>
              <div class="group-parent-meta" style="margin-top:3px;">
                ${children.length} subgrupo(s) vinculado(s) &bull; Mix total: <strong>${num(parentTotalSkus)} SKUs cadastrados</strong> (${num(parentBuySkus)} c/ compra &bull; ${num(parentStockedCount)} abastecidos)
              </div>
            </div>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
              <span style="font-size:13.5px;font-weight:600;min-width:65px;text-align:right;">${num(parentBuyUn)} un</span>
              <span style="font-size:16px;font-weight:800;color:${parentBuyRs > 0 ? '#047857' : 'var(--text-muted)'};min-width:110px;text-align:right;">${brl(parentBuyRs)}</span>
              ${parentBuySkus > 0 ? `
                <button class="btn btn-secondary btn-sm btn-filter-parent-group" data-parent="${esc(parentName)}" data-target-tab="buy" type="button" style="font-weight:600;" title="Filtrar todas as sugestões de compra desta categoria macro">
                  🛒 Filtrar Sugestões (${num(parentBuySkus)})
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-sm btn-filter-parent-group" data-parent="${esc(parentName)}" data-target-tab="all" type="button" style="font-weight:600;color:var(--text-muted);" title="Ver todos os produtos do mix desta categoria macro">
                📦 Ver Mix (${num(parentTotalSkus)})
              </button>
            </div>
          </div>
          ${childrenHtml ? `<div class="group-children-list">${childrenHtml}</div>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = kpiStripHtml + html;
  }

  // Se já temos em cache e não for forceReload, exibe imediatamente para evitar delay
  if (!forceReload && state.groupsTreeData && state.groupsTreeData.length > 0) {
    renderTreeData(state.groupsTreeData);
    return;
  }

  container.innerHTML = '<div class="muted" style="text-align:center;padding:30px;"><div style="font-size:24px;margin-bottom:8px;">🌳</div>Carregando árvore de grupos e consolidação de estoque do Linx BIG...</div>';

  try {
    const res = await apiGet('/api/groups/tree');
    state.groupsTreeData = res.tree || [];
    renderTreeData(state.groupsTreeData);
  } catch (err) {
    if (state.groupsTreeData && state.groupsTreeData.length > 0) {
      renderTreeData(state.groupsTreeData);
      showBanner(`Aviso: Árvore exibida a partir do cache local (${err.message})`, false);
      return;
    }
    container.innerHTML = `
      <div class="order-batch-alert error" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;margin:16px 0;">
        <div>
          <div style="font-weight:700;font-size:13.5px;">⚠️ Não foi possível carregar a árvore de grupos no momento</div>
          <div style="font-size:12px;margin-top:3px;color:var(--text-muted);">O motor pode estar concluindo um recálculo de estoque ou sincronização (${esc(err.message)}).</div>
        </div>
        <button id="btn-retry-groups-tree" class="btn btn-secondary btn-sm" type="button" style="white-space:nowrap;font-weight:600;">🔄 Tentar Novamente</button>
      </div>
    `;
    document.getElementById('btn-retry-groups-tree')?.addEventListener('click', () => loadAndRenderGroupsTree(true));
  }
}

/* ==========================================================================
   AÇÕES OPERACIONAIS: DESCARTAR SKU & SUSPENDER NO BIG
   ========================================================================== */
function openSuspendModal(sku) {
  state.pendingSuspendSku = sku;
  const modal = document.getElementById('modal-suspend-big');
  if (!modal) return;
  document.getElementById('suspend-sku-desc').textContent = `${sku.descricao} (Cód BIG: ${sku.produto_id})`;
  const feedback = document.getElementById('suspend-feedback');
  feedback.className = 'order-batch-alert hidden';
  feedback.textContent = '';
  modal.classList.remove('hidden');
}

function closeSuspendModal() {
  document.getElementById('modal-suspend-big')?.classList.add('hidden');
  state.pendingSuspendSku = null;
}

function showCurveInfoModal(skuName, motorCurva, motorPareto, erpRanking) {
  const modal = document.getElementById('curve-info-modal');
  const content = document.getElementById('curve-info-content');
  if (!modal || !content) return;

  const isDivergent = erpRanking && !erpRanking.startsWith(motorCurva);

  content.innerHTML = `
    <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:12px;">
      ${esc(skuName)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <div style="background:var(--accent-soft);border:1px solid rgba(15,118,110,0.25);border-radius:6px;padding:12px;">
        <div style="font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase;">Inteligência do Motor</div>
        <div style="font-size:22px;font-weight:700;color:var(--accent);margin:4px 0;">Curva ${esc(motorCurva)}</div>
        <div style="font-size:11.5px;color:var(--text-muted);">
          Representa <strong>${num(motorPareto, 1)}%</strong> do faturamento acumulado nos últimos 91 dias (Teorema de Pareto).
        </div>
      </div>
      <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Registro Linx BIG (ERP)</div>
        <div style="font-size:20px;font-weight:700;color:var(--text);margin:4px 0;">${esc(erpRanking)}</div>
        <div style="font-size:11.5px;color:var(--text-muted);">
          Posição e curva registradas historicamente na tabela <code>curvaabc</code> da filial.
        </div>
      </div>
    </div>
    ${isDivergent ? `
      <div style="background:var(--warning-soft);border:1px solid rgba(180,83,9,0.25);border-radius:6px;padding:10px;font-size:12px;color:var(--warning);">
        ⚠️ <strong>Divergência Detectada:</strong> O ERP ainda registra este item em outra curva (possivelmente devido a períodos desatualizados de cálculo no BIG). O motor utiliza as vendas reais ativas recentes para proteger o seu capital de giro.
      </div>
    ` : `
      <div style="background:var(--success-soft);border:1px solid rgba(21,128,61,0.25);border-radius:6px;padding:10px;font-size:12px;color:var(--success);">
        ✅ <strong>Sinergia Confirmada:</strong> A curva calculada pelo motor está alinhada com o perfil do produto no Linx BIG.
      </div>
    `}
  `;

  modal.classList.remove('hidden');
}

function closeCurveInfoModal() {
  document.getElementById('curve-info-modal')?.classList.add('hidden');
}

function clearAllFilters() {
  state.q = '';
  state.abc = '';
  state.macro = '';
  state.labora = '';
  state.grupoPai = '';
  state.grupoFilho = '';
  state.grupoId = null;
  state.stockStatus = '';
  state.pbmFilter = '';
  state.budget = 0;
  const filterQ = document.getElementById('filter-q');
  if (filterQ) filterQ.value = '';
  const filterPbm = document.getElementById('filter-pbm');
  if (filterPbm) filterPbm.value = '';
  const filterLab = document.getElementById('filter-labora');
  if (filterLab) filterLab.value = '';
  const filterBudget = document.getElementById('filter-budget');
  if (filterBudget) filterBudget.value = '';
  document.getElementById('btn-budget-clear')?.classList.add('hidden');
  document.getElementById('btn-budget-audit')?.classList.add('hidden');
  const searchInput = document.getElementById('search-sku');
  if (searchInput) searchInput.value = '';
  const selMacro = document.getElementById('filter-macro') || document.getElementById('sel-filter-macro');
  if (selMacro) selMacro.value = '';
  const selAbc = document.getElementById('filter-abc') || document.getElementById('sel-filter-abc');
  if (selAbc) selAbc.value = '';
  const selPai = document.getElementById('filter-grupo-pai') || document.getElementById('sel-filter-grupo-pai');
  if (selPai) selPai.value = '';
  const selFilho = document.getElementById('filter-grupo-filho') || document.getElementById('sel-filter-grupo-filho');
  if (selFilho) {
    selFilho.innerHTML = '<option value="">Grupo Filho: Todos</option>';
  }
  const selStock = document.getElementById('filter-stock-status');
  if (selStock) selStock.value = '';
  syncQuickLaboraChips();
  loadSkus();
}

function openBudgetAuditModal() {
  const audit = state.budgetAuditData;
  if (!audit) return;
  const modal = document.getElementById('modal-budget-audit');
  if (!modal) return;

  const cards = document.getElementById('budget-audit-summary-cards');
  if (cards) {
    cards.innerHTML = `
      <div class="summary-pill"><span class="label">Teto de Verba</span><span class="val highlight">${brl(audit.budget)}</span></div>
      <div class="summary-pill"><span class="label">Verba Alocada</span><span class="val highlight">${brl(audit.used)}</span></div>
      <div class="summary-pill"><span class="label">Necessidade Calculada</span><span class="val">${brl(audit.totalRequested)}</span></div>
      <div class="summary-pill"><span class="label">Total Cortado</span><span class="val savings" style="color:#b91c1c;">${brl(audit.cutTotalRs)} (${num(audit.cutCount)} itens)</span></div>
    `;
  }

  const tbody = document.getElementById('budget-audit-tbody');
  if (tbody) {
    if (audit.cutOffTop && audit.cutOffTop.length > 0) {
      tbody.innerHTML = audit.cutOffTop.map((item) => `
        <tr>
          <td><strong>${esc(item.descricao)}</strong><br><span class="muted" style="font-size:11px;">ID ${item.produto_id}</span></td>
          <td>${esc(item.labora || '—')}</td>
          <td><span class="badge-curve badge-curve-${(item.abc_class || 'd').toLowerCase()}">Curva ${item.abc_class}</span></td>
          <td class="num">${num(item.cut_qtd)} un</td>
          <td class="num"><strong>${brl(item.cut_rs)}</strong></td>
          <td><span class="muted" style="font-size:11.5px;">${esc(item.motivo)}</span></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px;">Nenhum item precisou ser cortado. A verba simulada cobre 100% da necessidade de compras!</td></tr>';
    }
  }

  modal.classList.remove('hidden');
}

function closeBudgetAuditModal() {
  document.getElementById('modal-budget-audit')?.classList.add('hidden');
}

function openPbmReplenishmentCheck() {
  // Verifica itens da cotação atual com vendas PBM registradas (REV-007)
  const quotationSkus = Array.from(state.selectedSkus.keys()).map((k) => {
    const [, pid] = k.split('|');
    return state.visibleSkus.find((s) => s.produto_id === Number(pid));
  }).filter(Boolean);

  const pbmItems = quotationSkus.filter((s) => Number(s.vendas_pbm_13s || 0) > 0);
  if (pbmItems.length === 0) {
    alert('📋 Conferência PBM:\n\nNenhum dos produtos selecionados na cotação atual possui histórico de reposição automática de PBM registrado nos últimos 91 dias.');
    return;
  }

  const msg = pbmItems.map((s) => `• ${s.descricao}: ${num(s.vendas_pbm_13s)} un vendidas em PBM (${(s.pbm_labels || []).join(', ') || 'Reposição Direta'})`).join('\n');
  alert(`📋 Conferência PBM (${pbmItems.length} SKUs com reposição direta de PBM):\n\n${msg}\n\n💡 Dica: Verifique se esses itens já serão repostos pela indústria parceira antes de fechar o pedido de compra.`);
}

function syncBodyModalState() {
  const hasOpen = Array.from(document.querySelectorAll('.modal-backdrop, .modal-overlay')).some((m) => !m.classList.contains('hidden'));
  document.body.classList.toggle('modal-open', hasOpen);
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach((m) => {
    m.classList.add('hidden');
  });
  syncBodyModalState();
}

async function confirmSuspendBig() {
  if (!state.pendingSuspendSku) return;
  const sku = state.pendingSuspendSku;
  const days = Number(document.getElementById('suspend-days').value || 30);
  const motivo = document.getElementById('suspend-motivo').value.trim() || 'Decisão Comprador';
  const targetRadio = document.querySelector('input[name="suspend-target"]:checked');
  const target = targetRadio ? targetRadio.value : 'motor'; // 'motor' ou 'big'
  const feedback = document.getElementById('suspend-feedback');
  const btn = document.getElementById('btn-confirm-suspend');

  btn.disabled = true;
  feedback.className = 'order-batch-alert';
  feedback.textContent = target === 'big'
    ? 'Gravando suspensão no ERP Linx BIG...'
    : 'Registrando suspensão exclusiva no Motor Inteligente...';
  feedback.classList.remove('hidden');

  try {
    const res = await apiPost('/api/skus/suspend-big', {
      filialId: sku.filial_id || 2,
      produtoId: sku.produto_id,
      days,
      motivo,
      target,
    });
    feedback.className = 'order-batch-alert success';
    feedback.textContent = target === 'big'
      ? `✅ Produto ${sku.produto_id} suspenso no Motor e no Linx BIG até ${res.endDate || ''}!`
      : `✅ Produto ${sku.produto_id} suspenso exclusivamente no Motor Inteligente até ${res.endDate || ''}! (Linx BIG inalterado)`;
    setTimeout(() => {
      closeSuspendModal();
      loadSkus();
      loadOverview();
    }, 1500);
  } catch (err) {
    feedback.className = 'order-batch-alert error';
    feedback.textContent = `Erro ao suspender produto: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

async function unsuspendSku(filialId, produtoId) {
  try {
    await apiFetch(`/api/skus/suspend?filialId=${filialId}&produtoId=${produtoId}`, { method: 'DELETE' });
    showBanner(`Suspensão do produto ${produtoId} cancelada com sucesso.`);
    await loadSkus();
    await loadOverview();
  } catch (err) {
    showBanner(`Erro ao reativar produto: ${err.message}`, true);
  }
}

let pendingTeachSku = null;

function openTeachMoleculeModal(sku) {
  pendingTeachSku = sku;
  const modal = document.getElementById('modal-teach-molecule');
  if (!modal) return;
  document.getElementById('teach-sku-desc').textContent = `${sku.descricao || ''} (Cód BIG: ${sku.produto_id})`;
  const substInput = document.getElementById('teach-substancia');
  const concInput = document.getElementById('teach-conc');
  const formaInput = document.getElementById('teach-forma');
  const packInput = document.getElementById('teach-pack');
  const feedback = document.getElementById('teach-feedback');
  if (substInput) substInput.value = sku.substancia || sku.princ_big || '';
  if (concInput) concInput.value = sku.concentracao || '';
  if (formaInput) formaInput.value = sku.forma || 'CPR';
  if (packInput) packInput.value = sku.pack_exact || sku.pack_bucket || '30UN';
  if (feedback) {
    feedback.className = 'order-batch-alert hidden';
    feedback.textContent = '';
  }
  modal.classList.remove('hidden');
}

function closeTeachMoleculeModal() {
  document.getElementById('modal-teach-molecule')?.classList.add('hidden');
  pendingTeachSku = null;
}

async function confirmTeachMolecule() {
  if (!pendingTeachSku) return;
  const sku = pendingTeachSku;
  const substancia = document.getElementById('teach-substancia')?.value.trim();
  const concentracao = document.getElementById('teach-conc')?.value.trim();
  const forma = document.getElementById('teach-forma')?.value.trim();
  const packBucket = document.getElementById('teach-pack')?.value.trim();
  const motivo = document.getElementById('teach-motivo')?.value.trim() || 'Correção manual do Comprador';
  const feedback = document.getElementById('teach-feedback');
  const btn = document.getElementById('btn-confirm-teach');

  if (!substancia) {
    if (feedback) {
      feedback.className = 'order-batch-alert error';
      feedback.textContent = 'Informe pelo menos o Princípio Ativo / Substância.';
      feedback.classList.remove('hidden');
    }
    return;
  }

  btn.disabled = true;
  if (feedback) {
    feedback.className = 'order-batch-alert';
    feedback.textContent = 'Gravando aprendizado na IA do Motor...';
    feedback.classList.remove('hidden');
  }

  try {
    const res = await apiPost('/api/molecules/teach', {
      produtoId: sku.produto_id,
      substancia,
      concentracao,
      forma,
      packBucket,
      motivo,
    });
    if (feedback) {
      feedback.className = 'order-batch-alert success';
      feedback.textContent = `🧠 Sucesso! A IA aprendeu a correlação da molécula [${res.canonKey}]. Aplicada aos cálculos futuros sem alterar o Linx BIG.`;
    }
    setTimeout(() => {
      closeTeachMoleculeModal();
      loadSkus();
      loadOverview();
    }, 1500);
  } catch (err) {
    if (feedback) {
      feedback.className = 'order-batch-alert error';
      feedback.textContent = `Erro ao ensinar IA: ${err.message}`;
    }
  } finally {
    btn.disabled = false;
  }
}

async function toggleDismissSku(filialId, produtoId, isDismissed) {
  try {
    await apiPost('/api/skus/dismiss', {
      filialId,
      produtoId,
      dismissed: !isDismissed,
    });
    if (isDismissed) {
      try {
        await apiFetch(`/api/skus/suspend?filialId=${filialId}&produtoId=${produtoId}`, { method: 'DELETE' });
      } catch {}
    }
    showBanner(
      !isDismissed
        ? `Produto ${produtoId} descartado da compra atual. Disponível na aba 'Não Comprar Agora'.`
        : `Produto ${produtoId} reativado e reincluído na proposta de compras.`
    );
    await loadSkus();
    await loadOverview();
  } catch (err) {
    showBanner(`Erro ao alterar status do produto: ${err.message}`, true);
  }
}

/* ==========================================================================
   CONFIGURAÇÃO DE PARETO & AUDITORIA DA IA GUARDIÃ
   ========================================================================== */
function initParetoSliders() {
  const sliderA = document.getElementById('slider-pareto-a');
  const sliderB = document.getElementById('slider-pareto-b');
  const sliderC = document.getElementById('slider-pareto-c');
  if (!sliderA || !sliderB || !sliderC) return;

  const savedA = Number(localStorage.getItem('big_pareto_a') || 55);
  const savedB = Number(localStorage.getItem('big_pareto_b') || 35);
  const savedC = Number(localStorage.getItem('big_pareto_c') || 10);
  state.paretoA = savedA;
  state.paretoB = savedB;
  state.paretoC = savedC;

  sliderA.value = savedA;
  sliderB.value = savedB;
  sliderC.value = savedC;
  document.getElementById('val-pareto-a').textContent = `${savedA}%`;
  document.getElementById('val-pareto-b').textContent = `${savedB}%`;
  document.getElementById('val-pareto-c').textContent = `${savedC}%`;

  const updateParetoUi = () => {
    const a = Number(sliderA.value);
    const b = Number(sliderB.value);
    const c = Number(sliderC.value);
    state.paretoA = a;
    state.paretoB = b;
    state.paretoC = c;
    localStorage.setItem('big_pareto_a', a);
    localStorage.setItem('big_pareto_b', b);
    localStorage.setItem('big_pareto_c', c);

    document.getElementById('val-pareto-a').textContent = `${a}%`;
    document.getElementById('val-pareto-b').textContent = `${b}%`;
    document.getElementById('val-pareto-c').textContent = `${c}%`;

    const total = a + b + c;
    const badge = document.getElementById('pareto-total-check');
    const guard = document.getElementById('pareto-ai-guard');

    if (total === 100) {
      badge.className = 'badge badge-success';
      badge.textContent = 'Total: 100%';
    } else {
      badge.className = 'badge badge-warn';
      badge.textContent = `Total: ${total}% (ajuste para 100%)`;
    }

    if (a > 65) {
      guard.style.background = '#fef3c7';
      guard.style.borderColor = '#fde68a';
      guard.style.color = '#92400e';
      guard.innerHTML = `⚠️ <strong>Alerta da IA Guardiã:</strong> Curva A muito ampla (${a}%). Concentrar acima de 65% do faturamento na Curva A pode classificar produtos de giro moderado como alta prioridade, inflando o capital de giro.`;
    } else if (c > 20) {
      guard.style.background = '#fef2f2';
      guard.style.borderColor = '#fca5a5';
      guard.style.color = '#991b1b';
      guard.innerHTML = `🚨 <strong>Alerta da IA Guardiã:</strong> Curva C muito ampla (${c}%). Sugestões automáticas para itens da Curva C com mais de 20% do corte podem imobilizar mais de R$ 90.000 em medicamentos parados nas prateleiras.`;
    } else {
      guard.style.background = '#eff6ff';
      guard.style.borderColor = '#bfdbfe';
      guard.style.color = '#1e40af';
      guard.innerHTML = `🛡️ <strong>IA Guardiã de Capital:</strong> Divisão equilibrada (${a}% A / ${b}% B / ${c}% C). Concentra o capital de compra nos itens de maior giro diário e protege contra rupturas essenciais.`;
    }
  };

  sliderA.oninput = updateParetoUi;
  sliderB.oninput = updateParetoUi;
  sliderC.oninput = updateParetoUi;
  updateParetoUi();
}

/* ==========================================================================
   DEV INSPECTOR / GRAVADOR DE CRÍTICAS EM TEMPO REAL
   ========================================================================== */
async function initDevInspector() {
  try {
    const res = await apiGet('/api/dev-inspector/status');
    const btn = document.getElementById('btn-floating-dev-inspector');
    if (!btn) return;
    if (res.enabled) {
      btn.classList.remove('hidden');
      updateInspectorBadge(res.countPending || 0);
    } else {
      btn.classList.add('hidden');
    }
  } catch (err) {
    console.debug('Dev inspector inativo:', err.message);
  }
}

function updateInspectorBadge(count) {
  const badge = document.getElementById('inspector-pending-count');
  const tabCount = document.getElementById('inspector-tab-count');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (tabCount) tabCount.textContent = count;
}

function openDevInspector() {
  const modal = document.getElementById('dev-inspector-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // Captura o contexto ativo da tela
  const viewMap = {
    cockpit: 'Mesa de Compras (Cockpit SKUs)',
    bi: 'BI Executivo & Indicadores',
    molecules: 'Varredura de Moléculas & Laboratórios',
    reman: 'Cascata de Remanejamento',
    expiring: 'Auditoria de Lotes & Validade',
    cmed: 'Catálogo CMED & Auditoria',
    auditpbm: 'Auditoria PBM Farmácia Popular',
  };
  const activeViewName = viewMap[state.activeView] || state.activeView || 'Geral';
  document.getElementById('inspector-ctx-view').textContent = activeViewName;

  const filters = [];
  if (state.filterMacro && state.filterMacro !== 'all') filters.push(`Macro: ${state.filterMacro}`);
  if (state.filterCurva && state.filterCurva !== 'all') filters.push(`Curva: ${state.filterCurva}`);
  if (state.filterText) filters.push(`Busca: "${state.filterText}"`);
  if (state.filterBuyOnly) filters.push('Apenas Sugestões');
  filters.push(`Janela: ${state.weeks} sem`);
  filters.push(`Perfil: ${state.profile}`);
  document.getElementById('inspector-ctx-filters').textContent = filters.join(' | ') || 'Nenhum filtro ativo';

  const skuWrap = document.getElementById('inspector-ctx-sku-wrap');
  const skuText = document.getElementById('inspector-ctx-sku');
  if (state.focusedSku) {
    skuWrap.classList.remove('hidden');
    skuText.innerHTML = `<strong>[${state.focusedSku.produto_id}]</strong> ${esc(state.focusedSku.descricao)} &bull; Estoque: ${state.focusedSku.estoque_atual} &bull; Sug: ${state.focusedSku.sugestao_compra_un} un`;
  } else {
    skuWrap.classList.add('hidden');
  }

  document.getElementById('inspector-ctx-time').textContent = new Date().toLocaleTimeString('pt-BR');
  document.getElementById('inspector-critica').value = '';
  document.getElementById('inspector-impacto').value = '';
  document.getElementById('inspector-feedback-msg').className = 'order-batch-alert hidden';

  // Abre na aba de formulário por padrão
  switchInspectorTab('form');
  setTimeout(() => document.getElementById('inspector-critica').focus(), 100);
}

function closeDevInspector() {
  const modal = document.getElementById('dev-inspector-modal');
  if (modal) modal.classList.add('hidden');
}

function switchInspectorTab(tab) {
  const paneForm = document.getElementById('inspector-pane-form');
  const paneList = document.getElementById('inspector-pane-list');
  const btnForm = document.getElementById('tab-inspector-form');
  const btnList = document.getElementById('tab-inspector-list');

  if (tab === 'form') {
    paneForm.classList.remove('hidden');
    paneList.classList.add('hidden');
    btnForm.className = 'btn btn-sm btn-primary';
    btnList.className = 'btn btn-sm btn-secondary';
  } else {
    paneForm.classList.add('hidden');
    paneList.classList.remove('hidden');
    btnForm.className = 'btn btn-sm btn-secondary';
    btnList.className = 'btn btn-sm btn-primary';
    loadDevInspectorReviews();
  }
}

async function saveDevReview() {
  const critica = document.getElementById('inspector-critica').value.trim();
  const impacto = document.getElementById('inspector-impacto').value.trim();
  const severidade = document.getElementById('inspector-severidade').value;
  const msgEl = document.getElementById('inspector-feedback-msg');

  if (!critica) {
    msgEl.className = 'order-batch-alert error';
    msgEl.textContent = 'Por favor, digite sua observação sobre o que deve ser melhorado.';
    msgEl.classList.remove('hidden');
    return;
  }

  msgEl.className = 'order-batch-alert info';
  msgEl.textContent = 'Gravando no backlog de melhorias...';
  msgEl.classList.remove('hidden');

  try {
    const payload = {
      tela_rota: state.activeView || 'cockpit',
      filtros_ativos: {
        activeView: state.activeView,
        macro: state.filterMacro,
        curva: state.filterCurva,
        search: state.filterText,
        buyOnly: state.filterBuyOnly,
        weeks: state.weeks,
        profile: state.profile,
      },
      sku_foco: state.focusedSku
        ? {
            produto_id: state.focusedSku.produto_id,
            descricao: state.focusedSku.descricao,
            barras: state.focusedSku.barras,
            labora: state.focusedSku.labora,
            curva: state.focusedSku.abc_class,
            curva_big: state.focusedSku.curva_erp_ranking,
            estoque: state.focusedSku.estoque_atual,
            ddv: state.focusedSku.ddv_projetada,
            sugestao_un: state.focusedSku.sugestao_compra_un,
            justificativa_ia: state.focusedSku.justificativa_ia,
          }
        : null,
      critica,
      sugestao_impacto: impacto,
      severidade,
    };

    const res = await apiPost('/api/dev-inspector/save', payload);
    msgEl.className = 'order-batch-alert success';
    msgEl.innerHTML = `✓ Crítica <strong>${res.review.id}</strong> gravada com sucesso em <code>dev_reviews/backlog_melhorias.json</code>!`;

    // Atualiza contagem do badge
    const statusRes = await apiGet('/api/dev-inspector/status');
    updateInspectorBadge(statusRes.countPending || 0);

    setTimeout(() => {
      closeDevInspector();
    }, 1200);
  } catch (err) {
    msgEl.className = 'order-batch-alert error';
    msgEl.textContent = `Erro ao gravar: ${err.message}`;
  }
}

async function loadDevInspectorReviews() {
  const container = document.getElementById('inspector-reviews-container');
  container.innerHTML = 'Carregando críticas do backlog...';
  try {
    const res = await apiGet('/api/dev-inspector/reviews');
    const list = res.reviews || [];
    updateInspectorBadge(list.filter((r) => r.status === 'pendente').length);

    if (list.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center;" class="muted">Nenhuma crítica gravada ainda. Navegue no sistema e use o botão flutuante para registrar melhorias!</div>';
      return;
    }

    const html = list.map((r) => {
      const sevClass = `inspector-tag-${r.severidade || 'media'}`;
      const statusBadge =
        r.status === 'pendente'
          ? '<span class="badge badge-warn">Pendente</span>'
          : r.status === 'implementado'
            ? '<span class="badge badge-success">Implementado</span>'
            : '<span class="badge badge-neutral">' + esc(r.status) + '</span>';

      const skuSnippet = r.contexto_operacional?.sku_foco
        ? `<div class="muted" style="font-size: 11px;"><strong>SKU em foco:</strong> [${r.contexto_operacional.sku_foco.produto_id}] ${esc(r.contexto_operacional.sku_foco.descricao)}</div>`
        : '';

      return `
        <div class="inspector-review-item">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong>${esc(r.id)}</strong>
              <span class="inspector-tag ${sevClass}">${esc(r.severidade || 'MÉDIA')}</span>
              ${statusBadge}
            </div>
            <span class="muted" style="font-size: 11px;">${new Date(r.timestamp).toLocaleString('pt-BR')} &bull; Tela: <strong>${esc(r.tela_rota)}</strong></span>
          </div>
          <div style="font-size: 13px; font-weight: 500; color: #1e293b; margin-top: 4px;">
            ${esc(r.critica)}
          </div>
          ${r.sugestao_impacto ? `<div style="font-size: 12px; color: #475569;"><strong>Impacto esperado:</strong> ${esc(r.sugestao_impacto)}</div>` : ''}
          ${skuSnippet}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color: #ef4444; padding: 16px;">Erro ao carregar backlog: ${esc(err.message)}</div>`;
  }
}

async function lookupSupplierLive(supplierId) {
  const card = document.getElementById('supplier-live-feedback');
  if (!supplierId || String(supplierId).trim() === '') {
    card.className = 'supplier-lookup-card';
    card.textContent = 'Digite o ID do fornecedor ou clique em "Procurar na Lista do Banco" para selecionar.';
    return;
  }
  card.className = 'supplier-lookup-card';
  card.textContent = 'Consultando fornecedor no banco BIG...';
  try {
    const qs = buildSupplierLookupQueryString({ id: supplierId });
    const res = await apiGet(`/api/config/supplier-lookup?${qs}`);
    if (res.found && res.supplier) {
      const s = res.supplier;
      state.selectedSupplier = s;
      card.className = 'supplier-lookup-card found';
      card.innerHTML = `✓ <strong>[${s.fornece_id}] ${esc(s.nome)}</strong> ${s.fantasia ? `(${esc(s.fantasia)})` : ''} &bull; CNPJ: <strong>${formatCnpj(s.cgc)}</strong> &bull; ${esc(s.cidade || '')}/${esc(s.estado || '')}`;
    } else {
      card.className = 'supplier-lookup-card not-found';
      card.innerHTML = `⚠️ Fornecedor ID ${supplierId} não foi localizado na tabela fornece do BIG.<br><span style="font-size:11px;">Clique em <strong>"Procurar na Lista do Banco"</strong> para ver os fornecedores cadastrados nesta base.</span>`;
    }
  } catch (err) {
    card.className = 'supplier-lookup-card not-found';
    card.textContent = `Aviso: não foi possível consultar fornecedor (${err.message}). Teste a conexão antes para validar as credenciais.`;
  }
}

/* ==========================================================================
   BUSCADOR / MODAL DE FORNECEDORES DO LINX BIG
   ========================================================================== */
async function openSupplierPicker() {
  const modal = document.getElementById('supplier-picker-modal');
  modal.classList.remove('hidden');
  const searchInput = document.getElementById('supplier-picker-search');
  searchInput.value = '';
  await fetchAndRenderSuppliers('');
  searchInput.focus();
}

function closeSupplierPicker() {
  document.getElementById('supplier-picker-modal').classList.add('hidden');
}

async function fetchAndRenderSuppliers(query = '') {
  const container = document.getElementById('supplier-picker-results');
  const loading = document.getElementById('supplier-picker-loading');
  loading.classList.remove('hidden');
  container.innerHTML = '';

  try {
    const qs = buildSupplierLookupQueryString({ q: query });
    const res = await apiGet(`/api/config/supplier-lookup?${qs}`);
    loading.classList.add('hidden');

    const suppliers = res.suppliers || [];
    if (suppliers.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Nenhum fornecedor encontrado no banco BIG com este termo.</div>';
      return;
    }

    const html = suppliers
      .map((s) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border); gap: 12px;" class="supplier-row-hover">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: var(--text);">
              <span style="display: inline-block; min-width: 38px; color: var(--accent); font-weight: 700;">#${s.fornece_id}</span>
              ${esc(s.nome)}
              ${s.fantasia ? `<span style="font-size: 11px; color: var(--text-muted); font-weight: 400;">(${esc(s.fantasia)})</span>` : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              CNPJ: <strong>${formatCnpj(s.cgc)}</strong> &bull; ${esc(s.cidade || '')}/${esc(s.estado || '')}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-pick-supplier" data-id="${s.fornece_id}" data-nome="${esc(s.nome)}" data-cgc="${esc(s.cgc || '')}" type="button">
            Selecionar
          </button>
        </div>
      `)
      .join('');

    container.innerHTML = html;

    container.querySelectorAll('.btn-pick-supplier').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        document.getElementById('cfg-supplier-id').value = id;
        closeSupplierPicker();
        lookupSupplierLive(id);
      });
    });
  } catch (err) {
    loading.classList.add('hidden');
    container.innerHTML = `<div style="padding: 16px; color: var(--danger);">Erro ao buscar fornecedores no BIG: ${esc(err.message)}</div>`;
  }
}

async function testDbConnection() {
  const feedback = document.getElementById('conn-test-feedback');
  feedback.className = 'conn-status-box';
  feedback.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="spinner" style="width:14px; height:14px; border:2px solid var(--primary); border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite;"></span>
      <span>Testando conectividade e permissões no MariaDB do Linx BIG...</span>
    </div>
  `;
  feedback.classList.remove('hidden');

  const payload = getFormDbParams();

  try {
    const res = await apiPost('/api/config/test-connection', payload);
    state.discoveredFiliais = res.filiais || [];
    feedback.className = 'conn-active-panel';

    const latencyClass = (res.latencyMs && res.latencyMs < 120) ? 'latency-fast' : 'latency-warn';
    const latencyLabel = res.latencyMs ? `⚡ ${res.latencyMs}ms` : '⚡ <15ms';
    const productCountLabel = res.totalProducts ? `📦 ~${Number(res.totalProducts).toLocaleString('pt-BR')} SKUs` : '📦 Mix Ativo';
    const verifiedTablesCount = Array.isArray(res.verifiedTables) ? res.verifiedTables.length : 5;

    // Preencher select legacy/fallback de filiais
    const select = document.getElementById('cfg-buyer-filial-select');
    select.innerHTML = '<option value="">-- Selecione a Loja / Filial --</option>' +
      state.discoveredFiliais
        .map((f) => `<option value="${f.filial_id}">Loja ${f.filial_id}: ${esc(f.nome)} ${f.cgc ? `(CNPJ: ${formatCnpj(f.cgc)})` : ''}</option>`)
        .join('');
    select.classList.remove('hidden');

    // Determina a filial ativa ou inicial
    const currentFilial = Number(document.getElementById('cfg-buyer-filial').value || 2);
    let chosen = state.discoveredFiliais.find((f) => Number(f.filial_id) === currentFilial);
    if (!chosen) {
      chosen = state.discoveredFiliais.find((f) => f.cgc && String(f.cgc).trim().length >= 11 && Number(f.filial_id) !== 1) || state.discoveredFiliais[0];
    }

    if (chosen) {
      document.getElementById('cfg-buyer-filial').value = chosen.filial_id;
      select.value = String(chosen.filial_id);
      if (chosen.cgc) {
        document.getElementById('cfg-buyer-cnpj').value = chosen.cgc;
      }
      const nameInput = document.getElementById('cfg-client-name');
      const curName = nameInput.value.trim();
      if (!curName || curName.includes('Bandeirante') || curName.includes('Apresentação') || curName === 'Farmácia Cliente') {
        nameInput.value = chosen.nome;
      }
    }

    // Se o banco ou IP for diferente do perfil salvo, sugere limpar dados antigos
    const p = state.clientProfile || {};
    if (payload.host !== p.db_host || payload.database !== p.db_name) {
      document.getElementById('cfg-force-reset').checked = true;
    }

    // Gerar grid de cards de filiais
    const filiaisCardsHtml = state.discoveredFiliais.map((f) => {
      const isSelected = chosen && Number(chosen.filial_id) === Number(f.filial_id);
      const isEscritorio = Number(f.filial_id) === 1 || String(f.nome).toUpperCase().includes('ESCRITORIO');
      const badgeHtml = isEscritorio 
        ? `<span class="filial-badge-matriz">🏢 Matriz / Escritório</span>`
        : `<span class="filial-badge-loja">🏪 Farmácia Ativa</span>`;

      return `
        <div class="filial-card ${isSelected ? 'selected' : ''}" data-filial-id="${f.filial_id}">
          <div>
            <div class="filial-card-header">
              <span style="font-size:12px; font-weight:800; color:var(--text);">Loja ${f.filial_id}</span>
              ${badgeHtml}
            </div>
            <div class="filial-card-title" style="margin-top:4px;">${esc(f.nome)}</div>
            <div class="filial-card-cnpj" style="margin-top:2px;">CNPJ: ${formatCnpj(f.cgc)}</div>
          </div>
          <div class="filial-card-action">
            ${isSelected ? '★ Filial Selecionada' : '✓ Usar Esta Filial'}
          </div>
        </div>
      `;
    }).join('');

    feedback.innerHTML = `
      <div class="conn-health-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>
          <strong style="color:var(--text); font-size:13px;">Conexão Ativa &amp; Homologada</strong>
        </div>
        <div class="conn-health-chips">
          <span class="conn-chip ${latencyClass}">${latencyLabel}</span>
          <span class="conn-chip">🖥️ ${esc(payload.host)}:${esc(payload.port)}</span>
          <span class="conn-chip">💾 ${esc(res.version)}</span>
          <span class="conn-chip">📁 Base: <code>${esc(res.dbName)}</code></span>
          <span class="conn-chip">${productCountLabel}</span>
          <span class="conn-chip table-verified">🛡️ ${verifiedTablesCount}/5 Tabelas BIG</span>
        </div>
      </div>

      <div class="filiais-section">
        <div class="filiais-section-title">
          <span>🏪 Lojas Descobertas no Linx BIG (${state.discoveredFiliais.length})</span>
          <span class="muted" style="font-size:11px; font-weight:400;">Clique no card da loja para alternar a filial compradora</span>
        </div>
        <div id="filial-selected-banner" class="alert alert-success" style="padding:6px 10px; font-size:11.5px; margin:0;">
          ✓ Loja <strong>${chosen ? chosen.filial_id : '2'} (${esc(chosen ? chosen.nome : '')})</strong> ativa para compras &bull; CNPJ: <code>${formatCnpj(chosen ? chosen.cgc : '')}</code>
        </div>
        <div class="filiais-cards-grid">
          ${filiaisCardsHtml}
        </div>
      </div>
    `;

    // Vincular clique nos cards de filial
    feedback.querySelectorAll('.filial-card').forEach((card) => {
      card.addEventListener('click', () => {
        const fid = card.dataset.filialId;
        selectFilial(fid);
      });
    });

    // Atualiza a busca do fornecedor com os dados do banco testado
    await lookupSupplierLive(document.getElementById('cfg-supplier-id').value.trim());
  } catch (err) {
    feedback.className = 'conn-diagnostic-card';
    const diag = err.data?.diagnostic || null;

    if (diag && diag.type === 'ACCESS_DENIED') {
      const sqlCommand = diag.sqlGrantCommand || `GRANT ALL PRIVILEGES ON \`${payload.database || 'gerente'}\`.* TO '${payload.user || 'root'}'@'%' IDENTIFIED BY 'sua_senha'; FLUSH PRIVILEGES;`;
      const dedicatedCommand = diag.sqlDedicatedUserCommand || '';

      feedback.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="font-size:13px; font-weight:800; color:#e11d48; display:flex; align-items:center; gap:6px;">
            <span>❌</span>
            <span>${esc(diag.title)}</span>
          </div>
          <span style="font-size:11px; background:#fecdd3; color:#9f1239; padding:2px 6px; border-radius:4px; font-weight:700;">Erro 1045</span>
        </div>

        <div style="margin-bottom:8px;">
          ${esc(diag.explanation)}
        </div>

        <div style="font-size:11.5px; font-weight:700; color:#475569; margin-top:10px; margin-bottom:4px;">
          Opção 1: Liberar o usuário '${esc(diag.user || 'root')}' para acesso externo no MariaDB (HeidiSQL):
        </div>
        <div class="sql-code-box">
          <button type="button" class="btn-copy-code" data-copy="${esc(sqlCommand)}">Copiar SQL</button>
          <code>${esc(sqlCommand)}</code>
        </div>

        ${dedicatedCommand ? `
          <div style="font-size:11.5px; font-weight:700; color:#475569; margin-top:8px; margin-bottom:4px;">
            Opção 2: Criar usuário dedicado exclusivo para o Motor (Recomendado):
          </div>
          <div class="sql-code-box">
            <button type="button" class="btn-copy-code" data-copy="${esc(dedicatedCommand)}">Copiar SQL</button>
            <code>${esc(dedicatedCommand)}</code>
          </div>
        ` : ''}

        <div style="margin-top:8px; font-size:11px; color:#64748b;">
          💡 <strong>Como aplicar:</strong> Conecte no MariaDB diretamente no servidor da farmácia (via HeidiSQL ou Prompt de Comando) e execute um dos scripts acima.
        </div>
      `;

      feedback.querySelectorAll('.btn-copy-code').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const text = btn.dataset.copy;
          try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.textContent;
            btn.textContent = '✓ Copiado!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
          } catch {
            alert('Copie o comando manualmente:\n\n' + text);
          }
        });
      });
    } else {
      feedback.innerHTML = `
        <div style="font-size:13px; font-weight:800; color:#e11d48; margin-bottom:6px;">
          ❌ Falha na conexão com o MariaDB
        </div>
        <div style="font-size:12px; margin-bottom:6px;">
          ${esc(err.message)}
        </div>
        <div style="font-size:11px; color:#64748b;">
          Verifique o IP, porta (3306), se a senha foi digitada corretamente e se o banco de dados está rodando.
        </div>
      `;
    }
  }
}

async function saveDbConfig() {
  const payload = {
    operation_mode: document.getElementById('cfg-operation-mode').value || 'central',
    name: document.getElementById('cfg-client-name').value.trim(),
    db_host: document.getElementById('cfg-db-host').value.trim(),
    db_port: Number(document.getElementById('cfg-db-port').value || 3306),
    db_user: document.getElementById('cfg-db-user').value.trim(),
    db_password: document.getElementById('cfg-db-password').value,
    db_name: document.getElementById('cfg-db-name').value.trim(),
    buyer_filial_id: Number(document.getElementById('cfg-buyer-filial').value || 2),
    buyer_cnpj: document.getElementById('cfg-buyer-cnpj').value.trim(),
    default_supplier_id: Number(document.getElementById('cfg-supplier-id').value || 10),
    forceReset: document.getElementById('cfg-force-reset').checked,
  };

  try {
    const res = await apiPost('/api/config/profile', payload);
    state.clientProfile = res.profile;

    if (res.dbChanged) {
      state.visibleSkus = [];
      state.selectedSkus.clear();
      showBanner(`✓ Banco de dados alterado para ${res.profile.name} (${res.profile.db_host} / ${res.profile.db_name})! Dados do cliente anterior foram resetados.`);
      closeDbConfigModal();
      await loadOverview();
      await loadSkus();

      // Convite amigavel para iniciar a 1ª sincronizacao imediata
      setTimeout(() => {
        if (confirm(`🎉 Banco de dados configurado com sucesso para ${res.profile.name}!\n\nDeseja realizar a primeira Sincronização & Cálculo de Demanda agora?`)) {
          runPurchasingEngine();
        }
      }, 300);
    } else {
      showBanner('Configurações do cliente e banco de dados salvas com sucesso!');
      closeDbConfigModal();
      await loadOverview();
      await loadSkus();
    }
  } catch (err) {
    showBanner(`Erro ao salvar configurações: ${err.message}`, true);
  }
}

/* ==========================================================================
   REVISÃO E FECHAMENTO DE COTAÇÃO / PEDIDO
   ========================================================================== */
function openQuotationModal() {
  let sourceItems = [];
  if (state.selectedSkus.size > 0) {
    sourceItems = [...state.selectedSkus.values()];
  } else {
    sourceItems = (state.visibleSkus || []).filter((r) => (r.budget_qtd !== undefined ? r.budget_qtd : r.sugestao_compra_un) > 0);
  }

  if (sourceItems.length === 0) {
    showBanner('Nenhum produto com sugestão de compra disponível para cotar. Ajuste os filtros ou selecione os itens desejados.', true);
    return;
  }

  document.getElementById('qmodal-order-feedback').classList.add('hidden');
  document.getElementById('qmodal-order-feedback').textContent = '';

  state.quotationItems = sourceItems.map((item) => {
    const origQty = Math.max(1, Math.round(Number(item.budget_qtd !== undefined ? item.budget_qtd : item.sugestao_compra_un || 1)));
    const best30d = item.melhor_fornecedor_30d || null;
    const targetPrice = best30d?.menor_custo > 0 ? Number(best30d.menor_custo) : Number(item.custo_unit || 0);

    return {
      produto_id: item.produto_id,
      barras: item.barras || '',
      descricao: item.descricao || '',
      labora: item.labora || 'DIVERSOS',
      macro_categoria: item.macro_categoria || '',
      abc_class: item.abc_class || 'A',
      estoque_atual: Number(item.estoque_atual || 0),
      ddv_projetada: Number(item.ddv_projetada || 0),
      sugestao_compra_un: origQty,
      quantidade: origQty,
      custo_unit: Number(item.custo_unit || 0),
      preco_venda: Number(item.preco_venda || 0),
      fornecedor_id: item.fornecedor_id || 0,
      fornecedor_nome: item.fornecedor_nome || '',
      fornecedor_cnpj: item.fornecedor_cnpj || '',
      melhor_fornecedor_30d_id: best30d?.fornece_id || item.fornecedor_id || 0,
      melhor_fornecedor_30d_nome: best30d?.fornecedor_nome || item.fornecedor_nome || '',
      melhor_fornecedor_30d_cnpj: best30d?.fornecedor_cnpj || item.fornecedor_cnpj || '',
      preco_target: targetPrice,
      melhor_fornecedor_30d: best30d,
      checked: true,
    };
  });

  renderQuotationTable();
  recalcQuotationSummary();
  document.getElementById('quotation-modal').classList.remove('hidden');
}

function closeQuotationModal() {
  document.getElementById('quotation-modal').classList.add('hidden');
}

function renderQuotationTable() {
  const tbody = document.getElementById('qmodal-tbody');
  tbody.innerHTML = state.quotationItems
    .map((item, idx) => {
      const subtotal = item.quantidade * (item.preco_target || item.custo_unit);
      const hasBetterPrice = item.melhor_fornecedor_30d && item.melhor_fornecedor_30d.menor_custo < item.custo_unit;

      let supplierBadgeHtml = '';
      if (item.melhor_fornecedor_30d) {
        const diffPct = item.custo_unit > 0
          ? Math.round(((item.melhor_fornecedor_30d.menor_custo - item.custo_unit) / item.custo_unit) * 100)
          : 0;
        const diffBadge = diffPct < 0 ? `<span style="color:#15803d;font-weight:700;"> (${diffPct}%)</span>` : '';
        supplierBadgeHtml = `
          <div class="best-price-badge ${hasBetterPrice ? 'saving' : ''}">
            ★ ${brl(item.melhor_fornecedor_30d.menor_custo)} &bull; ${esc(item.melhor_fornecedor_30d.fornecedor_nome || 'FORNECEDOR')}${diffBadge}
          </div>
        `;
      } else {
        supplierBadgeHtml = `<span class="muted">${esc(item.fornecedor_nome || 'Última compra')}</span>`;
      }

      return `
        <tr data-qidx="${idx}">
          <td style="text-align:center;">
            <input type="checkbox" class="qmodal-chk-item" data-qidx="${idx}" ${item.checked ? 'checked' : ''} />
          </td>
          <td>
            <div style="font-weight:600;">${esc(item.descricao)}</div>
            <div class="muted" style="font-size:11px;">SKU ${item.produto_id} &bull; ${macroLabel(item.macro_categoria)} &bull; Curva ${item.abc_class}</div>
          </td>
          <td><code>${esc(item.barras || '—')}</code></td>
          <td>${esc(item.labora || '—')}</td>
          <td class="num">${num(item.estoque_atual)}</td>
          <td class="num">${num(item.ddv_projetada, 2)}</td>
          <td class="num"><span class="badge badge-neutral">${item.sugestao_compra_un}</span></td>
          <td class="num">
            <input type="number" min="1" class="order-qty-input qmodal-qty-input" data-qidx="${idx}" value="${item.quantidade}" />
          </td>
          <td class="num">${brl(item.custo_unit)}</td>
          <td>${supplierBadgeHtml}</td>
          <td class="num" style="font-weight:700;color:var(--text);">${brl(subtotal)}</td>
        </tr>
      `;
    })
    .join('');
}

function recalcQuotationSummary() {
  const checkedItems = (state.quotationItems || []).filter((i) => i.checked);
  let totalUnits = 0;
  let totalRs = 0;
  let totalSavingsRs = 0;

  for (const it of checkedItems) {
    totalUnits += it.quantidade;
    const itemPrice = it.preco_target || it.custo_unit;
    totalRs += it.quantidade * itemPrice;
    if (it.custo_unit > itemPrice) {
      totalSavingsRs += it.quantidade * (it.custo_unit - itemPrice);
    }
  }

  document.getElementById('qmodal-total-skus').textContent = num(checkedItems.length);
  document.getElementById('qmodal-total-units').textContent = `${num(totalUnits)} un`;
  document.getElementById('qmodal-total-rs').textContent = brl(totalRs);
  document.getElementById('qmodal-savings-rs').textContent = brl(totalSavingsRs);

  const profile = state.overview?.profile || {};
  const filialId = profile.buyer_filial_id || 2;
  const cnpj = profile.buyer_cnpj || '28660206000167';
  document.getElementById('qmodal-store-desc').textContent = `Filial ${filialId} (CNPJ ${cnpj})`;
}

async function exportCotefacilTxtFile() {
  const checkedItems = (state.quotationItems || []).filter((i) => i.checked && i.quantidade > 0);
  if (checkedItems.length === 0) {
    showBanner('Selecione ao menos um produto com quantidade para exportar Cotefácil.', true);
    return;
  }
  showBanner('Gerando arquivo TXT no formato oficial Cotefácil 3.0...');
  try {
    const profile = state.overview?.profile || {};
    const res = await fetch('/api/export/cotefacil.txt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientCnpj: profile.buyer_cnpj || '28660206000167',
        items: checkedItems,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    const txt = await res.text();
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStr = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    a.download = `COTAC_${nowStr}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBanner(`Arquivo Cotefácil baixado: ${a.download} (${checkedItems.length} SKUs formatados).`);
  } catch (err) {
    showBanner(`Erro ao exportar Cotefácil TXT: ${err.message}`, true);
  }
}

async function exportBigNativeXlsxFile() {
  const checkedItems = (state.quotationItems || []).filter((i) => i.checked && i.quantidade > 0);
  if (checkedItems.length === 0) {
    showBanner('Selecione ao menos um produto com quantidade para exportar a planilha do ERP.', true);
    return;
  }
  showBanner('Gerando planilha Excel de importação no padrão do ERP (10 colunas)...');
  try {
    const profile = state.overview?.profile || {};
    const res = await fetch('/api/export/big-compras.xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientCnpj: profile.buyer_cnpj || '28660206000167',
        buyerFilialId: profile.buyer_filial_id || 2,
        items: checkedItems,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStr = new Date().toISOString().replace(/\D/g, '').slice(0, 8);
    a.download = `importacao_compras_erp_${nowStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBanner(`Planilha do ERP baixada: ${a.download} (${checkedItems.length} SKUs com EAN formatado).`);
  } catch (err) {
    showBanner(`Erro ao exportar Planilha ERP: ${err.message}`, true);
  }
}

async function saveDirectToBigDb() {
  const checkedItems = (state.quotationItems || []).filter((i) => i.checked && i.quantidade > 0);
  if (checkedItems.length === 0) {
    showBanner('Selecione ao menos um produto para gravar no ERP.', true);
    return;
  }

  const confirmMsg = `Confirmar gravação de ${checkedItems.length} produtos diretamente na tabela de pedidos do ERP? O sistema reconhecerá a cotação/pedido automaticamente.`;
  if (!window.confirm(confirmMsg)) return;

  const btn = document.getElementById('btn-qmodal-save-big');
  btn.disabled = true;
  showBanner('Gravando cotação sob transação no banco MariaDB da farmácia...');
  try {
    const profile = state.overview?.profile || {};
    const res = await apiPost('/api/pedidos/save-big', {
      items: checkedItems,
      supplierId: profile.default_supplier_id || 10,
      supplierName: profile.default_supplier_name || 'COTAÇÃO MOTOR INTELIGENTE',
    });

    const alertBox = document.getElementById('qmodal-order-feedback');
    alertBox.classList.remove('hidden');
    alertBox.innerHTML = `
      ✓ <strong>Lote #${res.numlanc} gravado com sucesso no Linx BIG!</strong><br>
      Foram inseridos <strong>${res.totalItems} itens</strong> (${res.totalUnits} unidades) na tabela <code>pedidos</code> para a Filial ${res.filialId}. Total: <strong>${brl(res.totalRs)}</strong>.
    `;
    showBanner(`Pedido gravado no Linx BIG: Lote #${res.numlanc} (${res.totalItems} itens).`);
  } catch (err) {
    showBanner(`Erro ao gravar no banco BIG: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function refreshActiveView() {
  try {
    if (state.view === 'cockpit') await loadSkus();
    else if (state.view === 'bi') await loadBi();
    else if (state.view === 'molecules') await loadMolecules();
    else if (state.view === 'transfers') await loadTransfers();
    else if (state.view === 'pbm') await loadPbm();
  } catch (err) {
    showBanner(`Erro ao carregar dados: ${err.message}`, true);
  }
}

// ========================================================
// SISTEMA SAAS: LICENCIAMENTO, ASSINATURA & MASTER AUTH
// ========================================================

function updateLicenseBadge(lic) {
  const dot = document.getElementById('license-indicator-dot');
  const txt = document.getElementById('txt-license-badge');
  const gateDot = document.getElementById('gate-status-dot');
  const gateTxt = document.getElementById('gate-status-text');
  const gateSub = document.getElementById('gate-license-sub');
  const gateBanner = document.getElementById('gate-license-banner');
  const gateBadge = document.getElementById('gate-license-plan-badge');
  const gateMach = document.getElementById('gate-machine-id');
  const gateClient = document.getElementById('gate-client-name');
  const gateCnpj = document.getElementById('gate-client-cnpj');

  if (!lic) return;

  const isExpired = lic.isExpired || !lic.isValid;
  const days = lic.daysRemaining !== undefined ? lic.daysRemaining : 0;
  const validUntilFmt = lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : '--/--/----';

  if (gateMach) gateMach.textContent = lic.currentMachineId || lic.machineId || 'LNX-UNKNOWN';
  if (gateClient && lic.clientName) gateClient.textContent = lic.clientName;
  if (gateCnpj && lic.cnpj) {
    const rawCnpj = String(lic.cnpj).replace(/\D/g, '');
    gateCnpj.textContent = rawCnpj.length === 14
      ? `CNPJ: ${rawCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`
      : `CNPJ: ${rawCnpj}`;
  }

  if (dot && txt) {
    if (isExpired) {
      dot.className = 'sub-dot expired';
      txt.textContent = 'Assinatura Expirada';
    } else if (days <= 5) {
      dot.className = 'sub-dot warn';
      txt.textContent = `Assinatura: ${days}d (Renovar)`;
    } else {
      dot.className = 'sub-dot active';
      txt.textContent = `Assinatura: ${days}d`;
    }
  }

  if (gateBanner && gateTxt && gateSub) {
    if (isExpired) {
      gateBanner.className = 'gate-badge-expired';
      if (gateDot) gateDot.style.background = '#ef4444';
      gateTxt.textContent = 'Assinatura Expirada ou Bloqueada';
      gateTxt.style.color = '#991b1b';
      gateSub.textContent = `Venceu em ${validUntilFmt}. Ative uma nova chave mensal para continuar utilizando o motor de compras.`;
      gateSub.style.color = '#7f1d1d';
      if (gateBadge) {
        gateBadge.className = 'badge badge-danger';
        gateBadge.textContent = 'EXPIRADO';
      }
      const btnEnter = document.getElementById('btn-enter-cockpit');
      if (btnEnter) {
        btnEnter.disabled = true;
        btnEnter.style.opacity = '0.5';
        btnEnter.style.cursor = 'not-allowed';
      }
    } else {
      gateBanner.className = 'gate-badge-active';
      if (gateDot) gateDot.style.background = '#10b981';
      gateTxt.textContent = 'Assinatura Ativa & Regularizada';
      gateTxt.style.color = '#065f46';
      gateSub.textContent = `Válida até ${validUntilFmt} • ${days} dia${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'}`;
      gateSub.style.color = '#047857';
      if (gateBadge) {
        gateBadge.className = 'badge badge-success';
        gateBadge.textContent = (lic.planType || 'mensal').toUpperCase();
      }
      const btnEnter = document.getElementById('btn-enter-cockpit');
      if (btnEnter) {
        btnEnter.disabled = false;
        btnEnter.style.opacity = '1';
        btnEnter.style.cursor = 'pointer';
      }
    }
  }
}

function openWelcomeGate(forceBlocking = false) {
  const modal = document.getElementById('modal-welcome-gate');
  const closeBtn = document.getElementById('btn-close-welcome-gate');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (state.licenseStatus) {
    updateLicenseBadge(state.licenseStatus);
  }
  if (forceBlocking) {
    if (closeBtn) closeBtn.style.display = 'none';
  } else {
    if (closeBtn) closeBtn.style.display = '';
  }
}

function closeWelcomeGate() {
  const lic = state.licenseStatus;
  if (lic && (lic.isExpired || !lic.isValid)) {
    alert('Assinatura expirada! É necessário informar uma nova chave mensal válida para utilizar o sistema.');
    return;
  }
  sessionStorage.setItem('big_welcome_seen', 'true');
  const modal = document.getElementById('modal-welcome-gate');
  if (modal) modal.classList.add('hidden');
}

let _masterAuthCallback = null;

function isMasterAuthenticated() {
  return sessionStorage.getItem('big_master_auth') === 'true';
}

function promptMasterAuth(onSuccessCallback) {
  if (isMasterAuthenticated()) {
    if (typeof onSuccessCallback === 'function') onSuccessCallback();
    return;
  }
  _masterAuthCallback = onSuccessCallback;
  const modal = document.getElementById('modal-master-auth');
  const err = document.getElementById('master-auth-error');
  const input = document.getElementById('input-master-password');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  if (input) { input.value = ''; }
  if (modal) modal.classList.remove('hidden');
  if (input) setTimeout(() => input.focus(), 100);
}

function closeMasterAuthModal() {
  const modal = document.getElementById('modal-master-auth');
  if (modal) modal.classList.add('hidden');
  _masterAuthCallback = null;
}

async function verifyMasterPasswordAction() {
  const input = document.getElementById('input-master-password');
  const errBox = document.getElementById('master-auth-error');
  const pwd = input?.value || '';

  if (!pwd) {
    if (errBox) {
      errBox.textContent = 'Por favor, digite a Senha Master.';
      errBox.style.display = 'block';
    }
    return;
  }

  try {
    const res = await apiPost('/api/master/verify', { masterPassword: pwd });
    if (res && res.ok) {
      sessionStorage.setItem('big_master_auth', 'true');
      sessionStorage.setItem('big_master_token', pwd);
      closeMasterAuthModal();
      showBanner('🔓 Acesso Técnico Master desbloqueado com sucesso!');
      if (typeof _masterAuthCallback === 'function') {
        const cb = _masterAuthCallback;
        _masterAuthCallback = null;
        cb();
      }
    } else {
      throw new Error(res?.error || 'Senha Master incorreta.');
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = `Acesso negado: ${err.message || 'Senha Master incorreta.'}`;
      errBox.style.display = 'block';
    }
  }
}

function openMasterDbConfig() {
  promptMasterAuth(openDbConfigModal);
}

async function changeMasterPasswordAction() {
  const currentPwd = document.getElementById('input-master-password')?.value?.trim();
  const newPwd = document.getElementById('input-new-master-pwd')?.value?.trim();
  const confirmPwd = document.getElementById('input-confirm-new-master-pwd')?.value?.trim();
  const feedback = document.getElementById('change-pwd-feedback');

  if (!currentPwd) {
    if (feedback) {
      feedback.textContent = 'Digite a Senha Master atual no campo acima antes de alterar.';
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
    return;
  }

  if (!newPwd || newPwd.length < 6) {
    if (feedback) {
      feedback.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
    return;
  }

  if (newPwd !== confirmPwd) {
    if (feedback) {
      feedback.textContent = 'A confirmação de senha não confere.';
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
    return;
  }

  try {
    const res = await apiPost('/api/master/change-password', {
      currentPassword: currentPwd,
      newPassword: newPwd,
    });
    if (res && res.ok) {
      sessionStorage.setItem('big_master_token', newPwd);
      sessionStorage.setItem('big_master_auth', 'true');
      if (feedback) {
        feedback.textContent = res.message || '✓ Senha Master alterada com sucesso!';
        feedback.style.color = '#15803d';
        feedback.style.background = '#dcfce7';
        feedback.style.display = 'block';
      }
      showBanner('✓ Senha Master atualizada com sucesso!');
      setTimeout(() => {
        const box = document.getElementById('box-change-master-pwd');
        if (box) box.style.display = 'none';
      }, 2500);
    } else {
      throw new Error(res?.error || 'Erro ao alterar senha.');
    }
  } catch (err) {
    if (feedback) {
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
  }
}

function lockMasterTechnicalAccess() {
  sessionStorage.removeItem('big_master_auth');
  sessionStorage.removeItem('big_master_token');
  closeDbConfigModal();
  showBanner('🔒 Acesso técnico bloqueado com sucesso.');
}

async function activateLicenseKeyAction() {
  const input = document.getElementById('input-activation-key');
  const feedback = document.getElementById('activation-feedback');
  const key = input?.value?.trim();

  if (!key) {
    if (feedback) {
      feedback.textContent = 'Por favor, digite ou cole a chave de licença.';
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
    return;
  }

  try {
    if (feedback) {
      feedback.textContent = 'Validando chave e assinatura criptográfica...';
      feedback.style.color = '#0369a1';
      feedback.style.background = '#e0f2fe';
      feedback.style.display = 'block';
    }

    const res = await apiPost('/api/license/activate', { licenseKey: key });
    if (res && res.ok) {
      if (feedback) {
        feedback.textContent = res.message || '✓ Assinatura ativada com sucesso!';
        feedback.style.color = '#15803d';
        feedback.style.background = '#dcfce7';
        feedback.style.display = 'block';
      }
      showBanner('✓ Licença ativada com sucesso! Atualizando cockpit...');
      if (input) input.value = '';
      await loadOverview();
    } else {
      throw new Error(res?.error || 'Chave de licença inválida.');
    }
  } catch (err) {
    if (feedback) {
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.querySelectorAll('#sku-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.tab = tab.dataset.tab;
      loadSkus();
    });
  });

  let timer = null;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = e.target.value;
      loadSkus();
    }, 220);
  });

  document.getElementById('filter-abc').addEventListener('change', (e) => {
    state.abc = e.target.value;
    state.abcxyz = '';
    loadSkus();
  });

  document.getElementById('filter-macro').addEventListener('change', (e) => {
    state.macro = e.target.value;
    loadSkus();
  });

  const filterLabora = document.getElementById('filter-labora');
  if (filterLabora) {
    filterLabora.addEventListener('change', (e) => {
      state.labora = e.target.value.trim();
      syncQuickLaboraChips();
      loadSkus();
    });
  }

  const quickLaboraChips = document.getElementById('quick-labora-chips');
  if (quickLaboraChips) {
    quickLaboraChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-chip');
      if (!btn) return;
      const lab = btn.dataset.lab || '';
      if (state.labora === lab && lab !== '') {
        state.labora = '';
      } else {
        state.labora = lab;
      }
      const select = document.getElementById('filter-labora');
      if (select) select.value = state.labora;
      syncQuickLaboraChips();
      loadSkus();
    });
  }

  const tableSummary = document.getElementById('table-summary');
  if (tableSummary) {
    tableSummary.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('.btn-clear-pill');
      if (clearBtn) {
        const filterKey = clearBtn.dataset.clear;
        if (filterKey === 'labora') {
          state.labora = '';
          const s = document.getElementById('filter-labora');
          if (s) s.value = '';
          syncQuickLaboraChips();
        } else if (filterKey === 'grupoPai') {
          state.grupoPai = '';
          state.grupoFilho = '';
          const s = document.getElementById('filter-grupo-pai');
          if (s) s.value = '';
          const sf = document.getElementById('filter-grupo-filho');
          if (sf) sf.innerHTML = '<option value="">Grupo Filho: Todos</option>';
        } else if (filterKey === 'grupoFilho') {
          state.grupoFilho = '';
          const sf = document.getElementById('filter-grupo-filho');
          if (sf) sf.value = '';
        } else if (filterKey === 'grupoId') {
          state.grupoId = null;
          state.grupoFilho = '';
          const sf = document.getElementById('filter-grupo-filho');
          if (sf) sf.value = '';
        } else if (filterKey === 'abc') {
          state.abc = '';
          state.abcxyz = '';
          const s = document.getElementById('filter-abc');
          if (s) s.value = '';
        } else if (filterKey === 'macro') {
          state.macro = '';
          const s = document.getElementById('filter-macro');
          if (s) s.value = '';
        } else if (filterKey === 'stockStatus') {
          state.stockStatus = '';
          const s = document.getElementById('filter-stock-status');
          if (s) s.value = '';
        } else if (filterKey === 'pbmFilter') {
          state.pbmFilter = '';
          const s = document.getElementById('filter-pbm');
          if (s) s.value = '';
        } else if (filterKey === 'q') {
          state.q = '';
          const s = document.getElementById('filter-q');
          if (s) s.value = '';
        } else if (filterKey === 'budget') {
          state.budget = 0;
          const s = document.getElementById('filter-budget');
          if (s) s.value = '';
          document.getElementById('btn-budget-clear')?.classList.add('hidden');
          document.getElementById('btn-budget-audit')?.classList.add('hidden');
        }
        loadSkus();
        return;
      }

      if (e.target.closest('.btn-clear-all-summary')) {
        clearAllFilters();
      }
    });
  }

  const filterGrupoPai = document.getElementById('filter-grupo-pai');
  if (filterGrupoPai) {
    filterGrupoPai.addEventListener('change', async (e) => {
      state.grupoPai = e.target.value;
      state.grupoFilho = '';
      const filhoSelect = document.getElementById('filter-grupo-filho');
      if (filhoSelect) {
        filhoSelect.innerHTML = '<option value="">Grupo Filho: Todos</option>';
        if (state.grupoPai) {
          if (!state.groupsTreeData) {
            const res = await apiGet('/api/groups/tree');
            state.groupsTreeData = res.tree || [];
          }
          const parent = (state.groupsTreeData || []).find((p) => (p.name || p.nome) === state.grupoPai);
          if (parent && parent.children) {
            filhoSelect.innerHTML = '<option value="">Grupo Filho: Todos</option>' +
              parent.children.map((c) => `<option value="${esc(c.name || c.nome)}">${esc(c.name || c.nome)} (${c.totalSkus || c.skusCount || 0} SKUs)</option>`).join('');
          }
        }
      }
      loadSkus();
    });
  }

  const filterGrupoFilho = document.getElementById('filter-grupo-filho');
  if (filterGrupoFilho) {
    filterGrupoFilho.addEventListener('change', (e) => {
      state.grupoFilho = e.target.value;
      loadSkus();
    });
  }

  const filterStockStatus = document.getElementById('filter-stock-status');
  if (filterStockStatus) {
    filterStockStatus.addEventListener('change', (e) => {
      state.stockStatus = e.target.value;
      loadSkus();
    });
  }

  const filterPbm = document.getElementById('filter-pbm');
  if (filterPbm) {
    filterPbm.addEventListener('change', (e) => {
      state.pbmFilter = e.target.value;
      loadSkus();
    });
  }

  document.querySelectorAll('.btn-horizon').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-horizon').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const days = btn.dataset.days;
      state.coverageHorizonDays = days === 'padrao' ? null : Number(days);
      loadSkus();
    });
  });

  document.querySelectorAll('.th-sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const sortField = th.dataset.sort;
      if (state.sortKey === sortField) {
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortKey = sortField;
        state.sortDir = 'desc';
      }
      document.querySelectorAll('.th-sortable').forEach((h) => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      state.sort = `${state.sortKey}_${state.sortDir}`;
      loadSkus();
    });
  });

  document.getElementById('filter-sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    loadSkus();
  });

  document.getElementById('btn-budget').addEventListener('click', () => {
    const val = Number(document.getElementById('filter-budget').value || 0);
    state.budget = val;
    state.tab = 'buy';
    document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'buy'));
    document.getElementById('btn-budget-clear').classList.toggle('hidden', val <= 0);
    loadSkus();
  });

  document.getElementById('btn-budget-clear').addEventListener('click', () => {
    state.budget = 0;
    document.getElementById('filter-budget').value = '';
    document.getElementById('btn-budget-clear').classList.add('hidden');
    loadSkus();
  });

  document.getElementById('active-extra-chip').addEventListener('click', () => {
    state.abcxyz = '';
    state.exc = '';
    loadSkus();
  });

  document.getElementById('chk-select-all').addEventListener('change', (e) => {
    for (const r of state.visibleSkus) {
      const key = `${r.filial_id}|${r.produto_id}`;
      const rs = Number(r.budget_rs !== undefined ? r.budget_rs : r.sugestao_compra_rs || 0);
      if (e.target.checked) state.selectedSkus.set(key, { ...r, rs });
      else state.selectedSkus.delete(key);
    }
    loadSkus();
  });

  document.getElementById('btn-select-recommended').addEventListener('click', () => {
    for (const r of state.visibleSkus) {
      const buyQty = Number(r.budget_qtd !== undefined ? r.budget_qtd : r.sugestao_compra_un || 0);
      const rs = Number(r.budget_rs !== undefined ? r.budget_rs : r.sugestao_compra_rs || 0);
      if (buyQty > 0) state.selectedSkus.set(`${r.filial_id}|${r.produto_id}`, { ...r, rs });
    }
    loadSkus();
  });

  document.getElementById('btn-clear-selection').addEventListener('click', () => {
    state.selectedSkus.clear();
    loadSkus();
  });

  document.getElementById('sku-tbody').addEventListener('click', (e) => {
    const btnDismiss = e.target.closest('.btn-dismiss-sku');
    if (btnDismiss) {
      e.stopPropagation();
      const pid = Number(btnDismiss.dataset.pid);
      const filial = Number(btnDismiss.dataset.filial || 2);
      toggleDismissSku(filial, pid, false);
      return;
    }

    const btnUndoDismiss = e.target.closest('.btn-undo-dismiss');
    if (btnUndoDismiss) {
      e.stopPropagation();
      const pid = Number(btnUndoDismiss.dataset.pid);
      const filial = Number(btnUndoDismiss.dataset.filial || 2);
      toggleDismissSku(filial, pid, true);
      return;
    }

    const btnSuspend = e.target.closest('.btn-suspend-sku');
    if (btnSuspend) {
      e.stopPropagation();
      const pid = Number(btnSuspend.dataset.pid);
      const sku = (state.visibleSkus || []).find((x) => x.produto_id === pid);
      if (sku) openSuspendModal(sku);
      return;
    }

    const btnCurveInfo = e.target.closest('.btn-curve-info');
    if (btnCurveInfo) {
      e.stopPropagation();
      const motorCurva = btnCurveInfo.dataset.motorCurva;
      const motorPareto = Number(btnCurveInfo.dataset.motorPareto || 0);
      const erpRanking = btnCurveInfo.dataset.erpRanking;
      const skuName = btnCurveInfo.dataset.skuName;
      showCurveInfoModal(skuName, motorCurva, motorPareto, erpRanking);
      return;
    }

    const chk = e.target.closest('.chk-sku');
    if (chk) {
      e.stopPropagation();
      const key = chk.dataset.chkKey;
      const rs = Number(chk.dataset.chkRs || 0);
      if (chk.checked) {
        const found = state.visibleSkus.find((x) => `${x.filial_id}|${x.produto_id}` === key);
        state.selectedSkus.set(key, found ? { ...found, rs } : { rs });
      } else {
        state.selectedSkus.delete(key);
      }
      updateSelectionUi();
      return;
    }
    if (e.target.closest('.td-chk')) return;

    const row = e.target.closest('tr[data-sku-key]');
    if (!row) return;
    const key = row.dataset.skuKey;
    if (state.expandedSkuKeys.has(key)) {
      state.expandedSkuKeys.delete(key);
      if (state.focusedSku && `${state.focusedSku.filial_id}|${state.focusedSku.produto_id}` === key) {
        state.focusedSku = null;
      }
    } else {
      state.expandedSkuKeys.add(key);
      state.focusedSku = (state.visibleSkus || []).find((x) => `${x.filial_id}|${x.produto_id}` === key) || null;
    }
    loadSkus();
  });

  document.getElementById('bi-content').addEventListener('click', (e) => {
    const macroRow = e.target.closest('[data-bi-macro]');
    if (macroRow) {
      state.macro = macroRow.dataset.biMacro;
      state.tab = 'buy';
      document.getElementById('filter-macro').value = state.macro;
      document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'buy'));
      switchView('cockpit');
      return;
    }
    const hmCell = e.target.closest('[data-hm]');
    if (hmCell) {
      state.abcxyz = hmCell.dataset.hm;
      state.abc = '';
      state.tab = 'all';
      document.getElementById('filter-abc').value = '';
      document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'all'));
      switchView('cockpit');
      return;
    }
    const excRow = e.target.closest('[data-bi-exc]');
    if (excRow) {
      state.exc = excRow.dataset.biExc;
      state.tab = 'exceptions';
      document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'exceptions'));
      switchView('cockpit');
    }
  });

  document.getElementById('mol-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-approve-mol');
    if (btn) {
      e.stopPropagation();
      const moleculeKey = btn.dataset.molId;
      const skus = btn.dataset.skus.split(',').map(Number).filter(Boolean);
      btn.disabled = true;
      try {
        await apiPost('/api/molecules/approve', { moleculeKey, skus });
        showBanner(`De→Para aprovado para ${skus.length} SKUs em "${moleculeKey}" (backup gerado).`);
        loadMolecules();
      } catch (err) {
        showBanner(`Erro ao aprovar: ${err.message}`, true);
      } finally {
        btn.disabled = false;
      }
      return;
    }
    const row = e.target.closest('tr[data-mol-key]');
    if (!row) return;
    const key = row.dataset.molKey;
    if (state.expandedMolKeys.has(key)) state.expandedMolKeys.delete(key);
    else state.expandedMolKeys.add(key);
    loadMolecules();
  });

  document.getElementById('mol-q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.molQ = e.target.value;
      loadMolecules();
    }, 220);
  });

  document.getElementById('mol-only-savings').addEventListener('change', (e) => {
    state.molOnlySavings = e.target.checked;
    loadMolecules();
  });

  document.getElementById('pbm-q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.pbmQ = e.target.value;
      loadPbm();
    }, 220);
  });

  document.getElementById('pbm-rules-tbody').addEventListener('change', async (e) => {
    const sel = e.target.closest('.pbm-rule-select');
    if (!sel) return;
    try {
      await apiPost('/api/pbm/rule', { id: Number(sel.dataset.ruleId), autoReposicao: sel.value });
      showBanner('Regra de PBM atualizada. Clique em "Sincronizar & Calcular" para aplicar o novo desconto na demanda.');
    } catch (err) {
      showBanner(`Erro ao salvar regra PBM: ${err.message}`, true);
    }
  });

  document.getElementById('btn-export-xlsx').addEventListener('click', () => exportWorkbook('manager'));
  document.getElementById('btn-export-cotefacil').addEventListener('click', () => exportWorkbook('cotefacil'));

  document.getElementById('btn-open-glossary-side').addEventListener('click', () => openGlossary('all'));
  document.getElementById('btn-open-glossary-inline').addEventListener('click', () => openGlossary('all'));
  document.getElementById('btn-close-glossary').addEventListener('click', closeGlossary);
  document.getElementById('glossary-modal').addEventListener('click', (e) => {
    if (e.target.id === 'glossary-modal') closeGlossary();
  });
  document.getElementById('glossary-section-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gsec]');
    if (!btn) return;
    state.glossarySec = btn.dataset.gsec;
    renderGlossary();
  });
  document.getElementById('glossary-q').addEventListener('input', (e) => {
    state.glossaryQ = e.target.value;
    renderGlossary();
  });
  document.querySelectorAll('.th-hint[data-hint]').forEach((el) => {
    el.addEventListener('click', () => openGlossary('reposicao'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      openDevInspector();
    }
    if (e.key === 'Escape') {
      closeGlossary();
      closeDbConfigModal();
      closeGroupConfigModal();
      closeQuotationModal();
      closeSupplierPicker();
      closeMoleculeSweep();
      closeSyncBigApresModal();
      closeDevInspector();
    }
  });

  // Varredura Inteligente da Molécula
  document.getElementById('btn-close-sweep-modal').addEventListener('click', closeMoleculeSweep);
  document.getElementById('molecule-sweep-modal').addEventListener('click', (e) => {
    if (e.target.id === 'molecule-sweep-modal') closeMoleculeSweep();
  });

  document.body.addEventListener('click', (e) => {
    const sweepBtn = e.target.closest('.btn-trigger-sweep');
    if (sweepBtn) {
      e.stopPropagation();
      const molKey = sweepBtn.dataset.molKey;
      const skuId = Number(sweepBtn.dataset.skuId || 0);
      const filialId = Number(sweepBtn.dataset.filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2));
      if (molKey) openMoleculeSweep(molKey, skuId, filialId);
    }

    const transfBtn = e.target.closest('.btn-action-extraordinary-transfer');
    if (transfBtn) {
      e.stopPropagation();
      const produtoId = Number(transfBtn.dataset.produtoId);
      const origem = Number(transfBtn.dataset.origem);
      const destino = Number(transfBtn.dataset.destino);
      const qtd = Number(transfBtn.dataset.qtd);
      const custo = Number(transfBtn.dataset.custo || 0);
      const economia = Number(transfBtn.dataset.economia || 0);
      const desc = transfBtn.dataset.desc || '';
      const barras = transfBtn.dataset.barras || '';

      transfBtn.disabled = true;
      transfBtn.innerHTML = '⏳ Processando transferência...';

      apiPost('/api/remanejamento/approve', {
        filialOrigem: origem,
        filialDestino: destino,
        items: [
          {
            produto_id: produtoId,
            descricao: desc,
            barras: barras,
            tipo: 'SUPER_EXCESSO_LOJA_NOVA',
            qtd_sugerida: qtd,
            custo_unit: custo,
            valor_total: Math.round(qtd * custo * 100) / 100,
            motivo: `Cessão extraordinária de super-excesso da Filial ${origem} para suprir necessidade da Filial ${destino}`
          }
        ],
        observacao: `Aprovado pelo comprador via Panorama Multi-Loja (Economia de ${brl(economia)})`
      }).then((res) => {
        showBanner(`✓ Transferência interna #${res.transferId || ''} gerada com sucesso! ${qtd} un de ${desc} transferidas da L0${origem} para L0${destino}. Compra externa zerada!`);
        loadSkus();
      }).catch((err) => {
        showBanner(`Erro ao processar transferência: ${err.message}`, true);
        transfBtn.disabled = false;
        transfBtn.innerHTML = '🚚 Tentar Novamente';
      });
    }
  });

  // Configuração Multi-Cliente & Banco (Protegido por Senha Master)
  document.getElementById('btn-open-db-config').addEventListener('click', () => {
    promptMasterAuth(openDbConfigModal);
  });
  document.getElementById('btn-close-db-config').addEventListener('click', closeDbConfigModal);
  document.getElementById('btn-cancel-db-config').addEventListener('click', closeDbConfigModal);
  document.getElementById('db-config-modal').addEventListener('click', (e) => {
    if (e.target.id === 'db-config-modal') closeDbConfigModal();
  });

  // Eventos de Licenciamento SaaS & Capa de Abertura
  document.getElementById('btn-license-badge')?.addEventListener('click', () => openWelcomeGate(false));
  document.getElementById('btn-open-welcome-gate')?.addEventListener('click', () => openWelcomeGate(false));
  document.getElementById('btn-close-welcome-gate')?.addEventListener('click', closeWelcomeGate);
  document.getElementById('btn-enter-cockpit')?.addEventListener('click', closeWelcomeGate);
  document.getElementById('btn-activate-key')?.addEventListener('click', activateLicenseKeyAction);
  document.getElementById('input-activation-key')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') activateLicenseKeyAction();
  });
  document.getElementById('btn-copy-machine-id')?.addEventListener('click', () => {
    const mach = document.getElementById('gate-machine-id')?.textContent || '';
    if (mach) {
      navigator.clipboard?.writeText(mach);
      showBanner(`📋 ID da Máquina copiado: ${mach}`);
    }
  });
  document.getElementById('btn-open-master-tools')?.addEventListener('click', () => {
    promptMasterAuth(openDbConfigModal);
  });

  // Eventos de Autenticação Master
  document.getElementById('btn-close-master-auth')?.addEventListener('click', closeMasterAuthModal);
  document.getElementById('btn-cancel-master-auth')?.addEventListener('click', closeMasterAuthModal);
  document.getElementById('btn-confirm-master-auth')?.addEventListener('click', verifyMasterPasswordAction);
  document.getElementById('input-master-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyMasterPasswordAction();
  });
  document.getElementById('btn-toggle-change-master-pwd')?.addEventListener('click', () => {
    const box = document.getElementById('box-change-master-pwd');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btn-save-new-master-pwd')?.addEventListener('click', changeMasterPasswordAction);
  document.getElementById('btn-lock-db-config')?.addEventListener('click', lockMasterTechnicalAccess);

  // Seleção e sincronização de Filial Compradora
  const filialSelect = document.getElementById('cfg-buyer-filial-select');
  if (filialSelect) {
    filialSelect.addEventListener('change', (e) => {
      const fid = Number(e.target.value);
      if (!fid) return;
      document.getElementById('cfg-buyer-filial').value = fid;
      const f = (state.discoveredFiliais || []).find((x) => Number(x.filial_id) === fid);
      if (f) {
        if (f.cgc) document.getElementById('cfg-buyer-cnpj').value = f.cgc;
        if (f.nome) document.getElementById('cfg-client-name').value = f.nome;
      }
    });
  }

  document.getElementById('cfg-buyer-filial').addEventListener('input', (e) => {
    const fid = Number(e.target.value);
    const select = document.getElementById('cfg-buyer-filial-select');
    if (select && fid) {
      select.value = String(fid);
      const f = (state.discoveredFiliais || []).find((x) => Number(x.filial_id) === fid);
      if (f && f.cgc) {
        document.getElementById('cfg-buyer-cnpj').value = f.cgc;
      }
    }
  });

  let supDebounce = null;
  document.getElementById('cfg-supplier-id').addEventListener('input', (e) => {
    clearTimeout(supDebounce);
    supDebounce = setTimeout(() => {
      lookupSupplierLive(e.target.value.trim());
    }, 280);
  });
  document.getElementById('btn-search-supplier').addEventListener('click', () => {
    lookupSupplierLive(document.getElementById('cfg-supplier-id').value.trim());
  });
  document.getElementById('btn-browse-suppliers').addEventListener('click', openSupplierPicker);
  document.getElementById('btn-close-supplier-picker').addEventListener('click', closeSupplierPicker);
  document.getElementById('supplier-picker-modal').addEventListener('click', (e) => {
    if (e.target.id === 'supplier-picker-modal') closeSupplierPicker();
  });

  let pickerDebounce = null;
  document.getElementById('supplier-picker-search').addEventListener('input', (e) => {
    clearTimeout(pickerDebounce);
    pickerDebounce = setTimeout(() => {
      fetchAndRenderSuppliers(e.target.value.trim());
    }, 250);
  });

  document.getElementById('btn-test-db-connection').addEventListener('click', testDbConnection);
  document.getElementById('btn-save-db-config').addEventListener('click', saveDbConfig);

  // Revisão e Fechamento de Cotação / Pedido
  document.getElementById('btn-open-quotation-modal').addEventListener('click', openQuotationModal);
  document.getElementById('btn-close-quotation').addEventListener('click', closeQuotationModal);
  document.getElementById('quotation-modal').addEventListener('click', (e) => {
    if (e.target.id === 'quotation-modal') closeQuotationModal();
  });

  document.getElementById('qmodal-chk-all').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    for (const it of state.quotationItems || []) it.checked = isChecked;
    document.querySelectorAll('.qmodal-chk-item').forEach((c) => (c.checked = isChecked));
    recalcQuotationSummary();
  });

  document.getElementById('qmodal-tbody').addEventListener('input', (e) => {
    const qtyInput = e.target.closest('.qmodal-qty-input');
    if (qtyInput) {
      const idx = Number(qtyInput.dataset.qidx);
      const val = Math.max(1, Math.round(Number(qtyInput.value || 1)));
      if (state.quotationItems[idx]) {
        state.quotationItems[idx].quantidade = val;
        const row = qtyInput.closest('tr');
        if (row) {
          const item = state.quotationItems[idx];
          const subtotalCell = row.cells[row.cells.length - 1];
          subtotalCell.textContent = brl(val * (item.preco_target || item.custo_unit));
        }
      }
      recalcQuotationSummary();
    }
  });

  document.getElementById('qmodal-tbody').addEventListener('change', (e) => {
    const chk = e.target.closest('.qmodal-chk-item');
    if (chk) {
      const idx = Number(chk.dataset.qidx);
      if (state.quotationItems[idx]) {
        state.quotationItems[idx].checked = chk.checked;
      }
      recalcQuotationSummary();
    }
  });

  document.getElementById('btn-qmodal-cotefacil-txt').addEventListener('click', exportCotefacilTxtFile);
  document.getElementById('btn-qmodal-big-native-xlsx').addEventListener('click', exportBigNativeXlsxFile);
  document.getElementById('btn-qmodal-save-big').addEventListener('click', saveDirectToBigDb);

  // Sincronização De -> Para com Linx BIG (produto_apresentacao)
  const btnOpenSyncApres = document.getElementById('btn-open-sync-big-apres');
  if (btnOpenSyncApres) btnOpenSyncApres.addEventListener('click', openSyncBigApresModal);
  const btnCloseSyncApres = document.getElementById('btn-close-sync-big-apres');
  if (btnCloseSyncApres) btnCloseSyncApres.addEventListener('click', closeSyncBigApresModal);
  const btnCancelSyncApres = document.getElementById('btn-cancel-sync-big-apres');
  if (btnCancelSyncApres) btnCancelSyncApres.addEventListener('click', closeSyncBigApresModal);
  const modalSyncApres = document.getElementById('sync-big-apres-modal');
  if (modalSyncApres) {
    modalSyncApres.addEventListener('click', (e) => {
      if (e.target.id === 'sync-big-apres-modal') closeSyncBigApresModal();
    });
  }

  const btnExecSyncApres = document.getElementById('btn-execute-sync-big-apres');
  if (btnExecSyncApres) btnExecSyncApres.addEventListener('click', executeSyncBigApres);

  const btnViewClusters = document.getElementById('btn-sync-view-clusters');
  if (btnViewClusters) {
    btnViewClusters.addEventListener('click', () => {
      state.syncBigViewMode = 'clusters';
      renderSyncBigView();
    });
  }

  const btnViewSkus = document.getElementById('btn-sync-view-skus');
  if (btnViewSkus) {
    btnViewSkus.addEventListener('click', () => {
      state.syncBigViewMode = 'skus';
      renderSyncBigView();
    });
  }

  const btnCleanupApres = document.getElementById('btn-cleanup-sync-big-apres');
  if (btnCleanupApres) btnCleanupApres.addEventListener('click', cleanupSyncBigApres);

  const chkSyncAll = document.getElementById('sync-chk-all');
  if (chkSyncAll) {
    chkSyncAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const q = (document.getElementById('sync-search-input')?.value || '').trim().toUpperCase();
      const filterStatus = document.getElementById('sync-filter-status')?.value || 'PENDING';
      const filtered = (state.syncBigCandidates || []).filter((it) => {
        if (filterStatus === 'PENDING' && it.status === 'VINCULADO_ATIVO') return false;
        if (filterStatus === 'LINKED' && it.status !== 'VINCULADO_ATIVO') return false;
        if (q) {
          const txt = `${it.produto_id} ${it.descricao} ${it.labora} ${it.substancia} ${it.concentracao} ${it.qtd_forma_farmaceutica}`.toUpperCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      });
      for (const it of filtered) {
        if (isChecked) state.syncBigSelectedIds.add(it.produto_id);
        else state.syncBigSelectedIds.delete(it.produto_id);
      }
      renderSyncBigView();
    });
  }

  const syncClustersBox = document.getElementById('sync-clusters-container');
  if (syncClustersBox) {
    syncClustersBox.addEventListener('change', (e) => {
      const chk = e.target.closest('.sync-chk-item');
      if (chk) {
        const pid = Number(chk.dataset.pid);
        if (chk.checked) state.syncBigSelectedIds.add(pid);
        else state.syncBigSelectedIds.delete(pid);
        updateSyncBigSelectionCounts();
      }
    });
  }

  const syncTbody = document.getElementById('sync-tbody');
  if (syncTbody) {
    syncTbody.addEventListener('change', (e) => {
      const chk = e.target.closest('.sync-chk-item');
      if (chk) {
        const pid = Number(chk.dataset.pid);
        if (chk.checked) state.syncBigSelectedIds.add(pid);
        else state.syncBigSelectedIds.delete(pid);
        updateSyncBigSelectionCounts();
      }
    });
  }

  let syncSearchDebounce = null;
  const syncSearchInput = document.getElementById('sync-search-input');
  if (syncSearchInput) {
    syncSearchInput.addEventListener('input', () => {
      clearTimeout(syncSearchDebounce);
      syncSearchDebounce = setTimeout(renderSyncBigView, 250);
    });
  }

  const syncFilterStatus = document.getElementById('sync-filter-status');
  if (syncFilterStatus) {
    syncFilterStatus.addEventListener('change', renderSyncBigView);
  }

  // Configuração de Grupos & Curvas ABC
  const btnOpenGroupConfig = document.getElementById('btn-open-group-config');
  if (btnOpenGroupConfig) btnOpenGroupConfig.addEventListener('click', openGroupConfigModal);
  const btnCloseGroupConfig = document.getElementById('btn-close-group-config');
  if (btnCloseGroupConfig) btnCloseGroupConfig.addEventListener('click', closeGroupConfigModal);
  const btnCancelGroupConfig = document.getElementById('btn-cancel-group-config');
  if (btnCancelGroupConfig) btnCancelGroupConfig.addEventListener('click', closeGroupConfigModal);

  const modalGroupConfig = document.getElementById('group-config-modal');
  if (modalGroupConfig) {
    modalGroupConfig.addEventListener('click', (e) => {
      if (e.target.id === 'group-config-modal') closeGroupConfigModal();
    });
  }

  const groupSearchInput = document.getElementById('group-config-search');
  if (groupSearchInput) {
    groupSearchInput.addEventListener('input', (e) => {
      syncInputsToState();
      renderGroupConfigTable(e.target.value);
    });
  }

  const btnPresetPharma = document.getElementById('btn-preset-pharma');
  if (btnPresetPharma) btnPresetPharma.addEventListener('click', () => applyGroupPreset('pharma'));
  const btnPresetEnxuto = document.getElementById('btn-preset-enxuto');
  if (btnPresetEnxuto) btnPresetEnxuto.addEventListener('click', () => applyGroupPreset('enxuto'));
  const btnPresetAlta = document.getElementById('btn-preset-alta');
  if (btnPresetAlta) btnPresetAlta.addEventListener('click', () => applyGroupPreset('alta'));

  const btnSaveGroupConfig = document.getElementById('btn-save-group-config');
  if (btnSaveGroupConfig) btnSaveGroupConfig.addEventListener('click', saveGroupConfigsAndRecalc);

  // Dev Inspector / Copilot de Feedback em Tempo Real
  const btnFloatingInspector = document.getElementById('btn-floating-dev-inspector');
  if (btnFloatingInspector) btnFloatingInspector.addEventListener('click', openDevInspector);

  const btnCloseInspector = document.getElementById('btn-close-dev-inspector');
  if (btnCloseInspector) btnCloseInspector.addEventListener('click', closeDevInspector);

  const btnCancelInspector = document.getElementById('btn-cancel-dev-inspector');
  if (btnCancelInspector) btnCancelInspector.addEventListener('click', closeDevInspector);

  const modalInspector = document.getElementById('dev-inspector-modal');
  if (modalInspector) {
    modalInspector.addEventListener('click', (e) => {
      if (e.target.id === 'dev-inspector-modal') closeDevInspector();
    });
  }

  const tabInspectorForm = document.getElementById('tab-inspector-form');
  if (tabInspectorForm) tabInspectorForm.addEventListener('click', () => switchInspectorTab('form'));

  const tabInspectorList = document.getElementById('tab-inspector-list');
  if (tabInspectorList) tabInspectorList.addEventListener('click', () => switchInspectorTab('list'));

  const btnSaveInspector = document.getElementById('btn-save-dev-inspector');
  if (btnSaveInspector) btnSaveInspector.addEventListener('click', saveDevReview);

  // Árvore de Grupos - Filtros rápidos
  const groupsSummaryView = document.getElementById('view-groups-summary');
  if (groupsSummaryView) {
    groupsSummaryView.addEventListener('click', (e) => {
      const parentBtn = e.target.closest('.btn-filter-parent-group');
      if (parentBtn) {
        const parentName = parentBtn.dataset.parent;
        const targetTab = parentBtn.dataset.targetTab || 'buy';
        state.grupoId = null;
        state.grupoPai = parentName;
        state.grupoFilho = '';
        state.offset = 0;
        state.page = 1;
        state.tab = targetTab;
        document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === targetTab));
        const paiSelect = document.getElementById('filter-grupo-pai');
        if (paiSelect) paiSelect.value = parentName;
        const filhoSelect = document.getElementById('filter-grupo-filho');
        if (filhoSelect) filhoSelect.value = '';
        loadSkus();
        return;
      }
      const childBtn = e.target.closest('.btn-filter-child-group');
      if (childBtn) {
        const parentName = childBtn.dataset.parent;
        const childName = childBtn.dataset.child;
        const gId = childBtn.dataset.grupoId;
        const targetTab = childBtn.dataset.targetTab || 'buy';
        state.grupoId = gId && gId !== '—' && !isNaN(Number(gId)) ? Number(gId) : null;
        state.grupoPai = parentName;
        state.grupoFilho = childName;
        state.offset = 0;
        state.page = 1;
        state.tab = targetTab;
        document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === targetTab));
        const paiSelect = document.getElementById('filter-grupo-pai');
        if (paiSelect) paiSelect.value = parentName;
        loadSkus();
      }
    });
  }

  // Modal de Suspensão no Linx BIG
  const btnCloseSuspend = document.getElementById('btn-close-suspend-modal');
  if (btnCloseSuspend) btnCloseSuspend.addEventListener('click', closeSuspendModal);
  const btnCancelSuspend = document.getElementById('btn-cancel-suspend');
  if (btnCancelSuspend) btnCancelSuspend.addEventListener('click', closeSuspendModal);
  const btnConfirmSuspend = document.getElementById('btn-confirm-suspend');
  if (btnConfirmSuspend) btnConfirmSuspend.addEventListener('click', confirmSuspendBig);
  const modalSuspend = document.getElementById('modal-suspend-big');
  if (modalSuspend) {
    modalSuspend.addEventListener('click', (e) => {
      if (e.target.id === 'modal-suspend-big') closeSuspendModal();
    });
  }

  // Modal Ensinar / Corrigir Molécula (Aprendizado IA)
  const btnCloseTeach = document.getElementById('btn-close-teach-modal');
  if (btnCloseTeach) btnCloseTeach.addEventListener('click', closeTeachMoleculeModal);
  const btnCancelTeach = document.getElementById('btn-cancel-teach');
  if (btnCancelTeach) btnCancelTeach.addEventListener('click', closeTeachMoleculeModal);
  const btnConfirmTeach = document.getElementById('btn-confirm-teach');
  if (btnConfirmTeach) btnConfirmTeach.addEventListener('click', confirmTeachMolecule);
  const modalTeach = document.getElementById('modal-teach-molecule');
  if (modalTeach) {
    modalTeach.addEventListener('click', (e) => {
      if (e.target.id === 'modal-teach-molecule') closeTeachMoleculeModal();
    });
  }

  // Modal Informativo de Curva ABC (Motor vs BIG)
  document.getElementById('btn-close-curve-info')?.addEventListener('click', closeCurveInfoModal);
  document.getElementById('btn-ok-curve-info')?.addEventListener('click', closeCurveInfoModal);

  // Auditoria de Verba (REV-010)
  document.getElementById('btn-budget-audit')?.addEventListener('click', openBudgetAuditModal);
  document.getElementById('btn-close-budget-audit')?.addEventListener('click', closeBudgetAuditModal);
  document.getElementById('btn-ok-budget-audit')?.addEventListener('click', closeBudgetAuditModal);

  // Conferência PBM na Cotação (REV-007)
  document.getElementById('btn-qmodal-check-pbm')?.addEventListener('click', openPbmReplenishmentCheck);

  // Políticas de Filiais & Carência Multi-Loja
  document.getElementById('btn-open-filiais-policies')?.addEventListener('click', openFiliaisPoliciesModal);
  document.getElementById('btn-close-filiais-policies')?.addEventListener('click', () => {
    document.getElementById('modal-filiais-policies')?.classList.add('hidden');
  });
  document.getElementById('btn-cancel-filiais-policies')?.addEventListener('click', () => {
    document.getElementById('modal-filiais-policies')?.classList.add('hidden');
  });
  document.getElementById('btn-save-filiais-policies')?.addEventListener('click', saveFiliaisPolicies);
  document.getElementById('btn-refresh-transfers')?.addEventListener('click', loadTransfers);
  document.getElementById('btn-goto-transfers')?.addEventListener('click', () => switchView('transfers'));

  // =========================================================================
  // LISTENERS DA HOME PAGE, CMED IMPORT & USUÁRIO SELECT
  // =========================================================================
  document.getElementById('btn-home-start')?.addEventListener('click', () => switchView('cockpit'));
  document.getElementById('btn-home-open-config')?.addEventListener('click', () => {
    promptMasterAuth(() => openDbConfigModal());
  });
  document.getElementById('btn-home-open-cmed')?.addEventListener('click', () => {
    openCmedImportModal();
  });

  const sqlGrantCmd = "CREATE USER IF NOT EXISTS 'compras_consulta'@'%' IDENTIFIED BY 'Consultoria@2026';\nGRANT SELECT ON gerente.* TO 'compras_consulta'@'%';\nFLUSH PRIVILEGES;";
  document.getElementById('btn-copy-home-sql')?.addEventListener('click', function() {
    copyTextToClipboard(sqlGrantCmd, this);
  });
  document.getElementById('btn-copy-modal-sql')?.addEventListener('click', function() {
    copyTextToClipboard(sqlGrantCmd, this);
  });

  document.getElementById('btn-select-cmed-file')?.addEventListener('click', () => {
    document.getElementById('input-cmed-file')?.click();
  });

  document.getElementById('input-cmed-file')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      _selectedCmedFile = file;
      const lbl = document.getElementById('cmed-selected-file-label');
      const btnSubmit = document.getElementById('btn-submit-cmed-import');
      if (lbl) lbl.textContent = `Arquivo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });

  document.getElementById('btn-submit-cmed-import')?.addEventListener('click', submitCmedImport);
  document.getElementById('btn-close-cmed-import')?.addEventListener('click', closeCmedImportModal);
  document.getElementById('btn-cancel-cmed-import')?.addEventListener('click', closeCmedImportModal);

  // Acessibilidade Impeccable: Tecla ESC fecha qualquer modal ativo
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      closeCmedImportModal();
    }
  });

  // Fechamento automático ao clicar na área escura externa (backdrop)
  document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        syncBodyModalState();
      }
    });
  });

  document.getElementById('btn-recalc').addEventListener('click', runPurchasingEngine);
  document.getElementById('ctrl-weeks')?.addEventListener('change', triggerTopBarParamChange);
  document.getElementById('ctrl-profile')?.addEventListener('change', triggerTopBarParamChange);
}

(async function init() {
  bindEvents();
  await Promise.all([loadGlossary(), loadOverview()]);
  switchView('home');
})();

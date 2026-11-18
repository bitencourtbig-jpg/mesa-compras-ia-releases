const state = {
  remanFilters: {
    search: '',
    tipo: 'ALL',
    curva: 'ALL',
    origem: 'ALL',
    destino: 'ALL',
    minValor: 0,
  },
  view: 'home',
  tab: 'buy',
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
  if (!code) return '<span class="badge badge-neutral">—</span>';
  const str = String(code);
  if (str.startsWith('RUPTURA_') || str === 'LOTE_VENCIDO') return `<span class="badge badge-danger">${esc(str)}</span>`;
  if (str.includes('PBM') || str.includes('MOLECULA')) return `<span class="badge badge-info">${esc(str)}</span>`;
  if (str.includes('LOTE') || str.includes('PERDA') || str.includes('ALTA_CUSTO') || str.includes('NEGATIVO'))
    return `<span class="badge badge-warn">${esc(str)}</span>`;
  if (str.includes('REMANEJAMENTO')) return `<span class="badge badge-success">${esc(str)}</span>`;
  return `<span class="badge badge-neutral">${esc(str)}</span>`;
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

function isLicenseExpired() {
  const lic = state.licenseStatus;
  if (!lic) return false;
  const days = Number(lic.daysRemaining !== undefined ? lic.daysRemaining : 0);
  return Boolean(lic.isExpired || !lic.isValid || days <= 0);
}

function switchView(viewName) {
  if (isLicenseExpired() && viewName !== 'home') {
    openWelcomeGate(true);
    return;
  }
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
    budget: ['Dotação Orçamentária & Open-to-Buy (OTB)', 'Controle de Teto de Compras • Score Ponderado & CMV Ajustado por Tendência'],
    ols: ['Operações Logísticas (OL) & Compras Diretas da Indústria', 'Consultor IA de Canal • Projeção de Demanda, Pedidos Mínimos e Ganho de Margem (+8% a +15%)'],
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

  const lic = state.licenseStatus;
  const ov = state.overview || {};
  const profile = ov.profile || {};
  const cmed = ov.cmedImport || null;

  // 1. Renderiza o Card de Assinatura & Suporte com Alerta de 10 dias / WhatsApp
  const licenseCard = document.getElementById('home-license-card');
  if (licenseCard) {
    if (!lic) {
      // Estado de carregamento neutro — NUNCA acusa expirado antes de obter os dados reais do servidor!
      licenseCard.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 24px; display: flex; align-items: center; gap: 12px; color: #64748b; font-size: 13.5px;">
          <span style="font-size: 16px;">⏳</span>
          <span>Verificando autenticidade da assinatura e blindagem da máquina...</span>
        </div>
      `;
    } else {
      const days = Number(lic.daysRemaining !== undefined ? lic.daysRemaining : 0);
      const isExp = Boolean(lic.isExpired || !lic.isValid || days <= 0);
      const isNear = !isExp && days <= 10;
      const validUntilFmt = lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : '--/--/----';
      const clientTitle = lic.clientName || profile.name || 'Cliente Licenciado';
      const machId = lic.currentMachineId || lic.machineId || 'LNX-MAQUINA';
      const rawCnpj = String(lic.cnpj || '').replace(/\D/g, '');
      const formattedCnpj = rawCnpj.length === 14 ? rawCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : rawCnpj;

      if (isExp) {
        licenseCard.innerHTML = `
          <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #991b1b; display: flex; align-items: center; gap: 8px;">
                <span>🚨 Assinatura Mensal Expirada!</span>
                <span class="badge" style="background:#fee2e2; color:#b91c1c;">Acesso Bloqueado</span>
              </div>
              <div style="font-size: 13px; color: #b91c1c; margin-top: 4px; line-height: 1.4;">
                Seu período de uso venceu em <strong>${validUntilFmt}</strong>.<br>
                Para continuar calculando suas cotações e gerando pedidos, renove a licença com a <strong>FSConsultoria</strong>.
              </div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Meu sistema Mesa de Compras IA está bloqueado. CNPJ: ' + rawCnpj + ', Máquina: ' + machId + '. Gostaria de negociar os valores das chaves para liberação imediata.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#25d366; border:1px solid #16a34a; color:#fff; font-weight:700; padding:11px 20px; font-size:13.5px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; border-radius:8px; box-shadow:0 4px 12px rgba(37,211,102,0.3);">
                <span>📲 Negociar Licença no WhatsApp (17) 98120-5660</span>
              </a>
              <button id="btn-home-quick-activate" class="btn btn-secondary" type="button">🔑 Inserir Chave</button>
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
                Sua licença mensal vence em <strong>${validUntilFmt}</strong> (${days} dias restantes).<br>
                Garanta a continuidade do cálculo da sua drogaria sem interrupções solicitando a renovação à FSConsultoria.
              </div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Meu sistema Mesa de Compras IA vence em ' + days + ' dias (CNPJ: ' + rawCnpj + ', Máquina: ' + machId + '). Gostaria de antecipar a renovação.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#25d366; border:1px solid #16a34a; color:#fff; font-weight:700; padding:11px 20px; font-size:13.5px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; border-radius:8px; box-shadow:0 4px 12px rgba(37,211,102,0.3);">
                <span>📲 Falar com FSConsultoria no WhatsApp (17) 98120-5660</span>
              </a>
              <button id="btn-home-quick-activate" class="btn btn-secondary" type="button">🔑 Inserir Chave</button>
            </div>
          </div>
        `;
      } else {
        // ASSINATURA ATIVA E REGULARIZADA!
        licenseCard.innerHTML = `
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 8px;">
                <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; box-shadow: 0 0 0 3px rgba(16,185,129,0.25);"></span>
                <span>✓ Assinatura Ativa &amp; Regularizada • ${days} dias restantes</span>
                <span class="badge" style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700;">Válida até ${validUntilFmt}</span>
              </div>
              <div style="font-size: 12.5px; color: #15803d; margin-top: 4px;">
                Cliente: <strong>${esc(clientTitle)}</strong> ${formattedCnpj ? `• CNPJ: ${formattedCnpj}` : ''} • Blindagem Hardware: <code>${machId}</code>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <a href="https://wa.me/5517981205660?text=${encodeURIComponent('Olá FSConsultoria! Gostaria de tirar uma dúvida sobre a Mesa de Compras IA (Cliente: ' + clientTitle + ').')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                <span>💬 Suporte FSConsultoria (17) 98120-5660</span>
              </a>
              <button id="btn-home-quick-activate" class="btn btn-secondary btn-sm" type="button" title="Ver detalhes da licença ou renovar antecipadamente">🔑 Chave de Licença</button>
            </div>
          </div>
        `;
      }

      const quickBtn = document.getElementById('btn-home-quick-activate');
      if (quickBtn) {
        quickBtn.onclick = () => openWelcomeGate(false);
      }
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
    const isConnErr = /ETIMEDOUT|ECONNRESET|timeout/i.test(err.message || '');
    if (isConnErr) {
      showBanner(`Aviso: Conexão com o banco do Linx BIG demorou a responder (${err.message}). Clique em "Sincronizar & Calcular" para reconectar.`, true);
    } else {
      showBanner(`Falha ao recalcular perfil: ${err.message}`, true);
    }
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

  const multilojaTitleEl = document.querySelector('.multiloja-title');
  if (multilojaTitleEl) {
    multilojaTitleEl.innerHTML = isSingleStore ? '🏪 Loja Operacional:' : '🏬 Visão da Rede:';
  }

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

  const chips = [];
  chips.push(`
    <button type="button" class="filial-chip ${state.selectedFilial === 'all' ? 'active' : ''}" data-filial="all">
      <span class="filial-chip-icon">🏬</span>
      <span class="filial-chip-label">Rede Consolidada</span>
      <span class="filial-chip-badge">${policies.length} Lojas</span>
    </button>
  `);

  for (const pol of policies) {
    const fId = String(pol.filial_id);
    const isCarencia = Boolean(pol.emCarencia || pol.bloquear_doacao_remanejamento === 1 || (pol.diasOperacao && pol.diasOperacao <= (pol.dias_carencia || 90)));
    const cleanLabel = formatFilialTag(pol.filial_id, pol.nome_reduz, pol.nome_loja);

    const badgeText = isSingleStore ? 'Loja Única' : (isCarencia ? `Carência ${pol.diasOperacao || 41}d` : 'Ativa');
    const isActive = state.selectedFilial === fId;

    chips.push(`
      <button type="button" class="filial-chip ${isCarencia ? 'carencia' : ''} ${isActive ? 'active' : ''}" data-filial="${esc(fId)}" title="${esc(pol.nome_loja)} ${isCarencia ? '(Recém-inaugurada sob proteção de carência)' : ''}">
        <span class="filial-chip-icon">${isSingleStore ? '🏪' : (isCarencia ? '🐣' : '🏪')}</span>
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
      renderKpiStrip(state.selectedFilial);
      state.offset = 0;
      state.page = 1;
      refreshActiveView();
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
  try {
    if (data.filiaisPolicies && data.filiaisPolicies.length > 0) {
      localStorage.setItem('linx_farma_multiloja_cache', JSON.stringify({
        filiaisPolicies: data.filiaisPolicies,
        profile: data.profile
      }));
    }
  } catch {}
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

    renderKpiStrip(state.selectedFilial || 'all');
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

    // O modal bloqueante SÓ abre se a licença estiver REALMENTE EXPIRADA!
    // Se a licença estiver ativa com dias normais, entra direto na Home Page sem popups invasivos.
    if (isExp) {
      openWelcomeGate(true);
    } else {
      const modal = document.getElementById('modal-welcome-gate');
      if (modal && !sessionStorage.getItem('big_welcome_open_manual')) {
        modal.classList.add('hidden');
        syncBodyModalState();
      }
      if (days <= 10) {
        showBanner(`⚠️ Sua licença mensal da Mesa de Compras IA vence em ${days} dia(s). Contate a FSConsultoria no WhatsApp (17) 98120-5660 para renovar.`);
      }
    }

    // Se estiver na tela inicial, re-renderiza imediatamente com os dados de licença confirmados
    if (state.view === 'home' || !state.view) {
      renderHomeScreen();
    }
  }
}

function renderKpiStrip(targetFilial = 'all') {
  const latestRun = state.overview?.latestRun;
  if (!latestRun) return;
  const filialKpis = state.overview?.filialKpis || {};
  const s = (targetFilial && targetFilial !== 'all' && filialKpis[targetFilial])
    ? filialKpis[targetFilial]
    : latestRun.summary;

  const kpiEl = document.getElementById('kpi-strip');
  if (!kpiEl || !s) return;

  const scopeLabel = (targetFilial && targetFilial !== 'all') ? `Filial L0${targetFilial}` : 'Rede Consolidada';

  kpiEl.innerHTML = `
    <div class="kpi-cell">
      <div class="kpi-label">Rupturas Curva A / B <span class="badge badge-neutral" style="font-size:10px; margin-left:4px;">${scopeLabel}</span></div>
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
      <div class="kpi-sub">${num(s.skusSugestaoCompra)} SKUs a comprar</div>
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
      <div class="kpi-sub">+ ${brl(s.lotesVencidosRs)} vencido físico em saldo</div>
    </div>
  `;
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
  if (state.activeSkusAbortController) {
    try { state.activeSkusAbortController.abort(); } catch {}
  }
  state.activeSkusAbortController = new AbortController();
  const currentSignal = state.activeSkusAbortController.signal;

  if (state.tab === 'curadoria') {
    document.getElementById('table-wrap-skus')?.classList.add('hidden');
    document.getElementById('view-groups-summary')?.classList.add('hidden');
    document.getElementById('view-curadoria-container')?.classList.remove('hidden');
    document.getElementById('table-summary').textContent = '🧬 Curadoria IA de Moléculas • Homologação de De-Para e Substituições por Genéricos/Similares CMED antes da compra final.';
    document.getElementById('table-pagination')?.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadAndRenderCuradoria();
    return;
  }

  if (state.tab === 'groups_summary') {
    document.getElementById('table-wrap-skus')?.classList.add('hidden');
    document.getElementById('view-curadoria-container')?.classList.add('hidden');
    document.getElementById('view-groups-summary')?.classList.remove('hidden');
    document.getElementById('table-summary').textContent = '🌳 Resumo por Grupo & Árvore ERP do Linx BIG — Visão consolidada de SKUs, estoque e orçamento por categoria pai e filho.';
    document.getElementById('table-pagination')?.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadAndRenderGroupsTree();
    return;
  }

  document.getElementById('table-wrap-skus')?.classList.remove('hidden');
  document.getElementById('view-groups-summary')?.classList.add('hidden');
  document.getElementById('view-curadoria-container')?.classList.add('hidden');

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
    if (state.tab === 'buy') {
      data.rows = (data.rows || []).filter((r) => {
        const q = r.budget_qtd !== undefined ? Number(r.budget_qtd) : Number(r.sugestao_compra_un || 0);
        return q > 0 && r.ia_analysis?.acaoCodigo !== 'NAO_COMPRAR';
      });
    }
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
  checkOlOpportunityForManufacturer(state.labora);

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
    const isHomologadoComprador = (r.justificativa_ia && r.justificativa_ia.includes('Homologada pelo Comprador'));
    if (isHomologadoComprador) {
      molSweepPill = `<div style="margin-top:4px;"><span class="badge" style="background:#ecfdf5;color:#047857;border:1px solid #86efac;font-weight:700;font-size:11px;display:inline-flex;align-items:center;gap:4px;">🛡️ Marca Homologada pelo Comprador</span></div>`;
    } else if (r.molecule_key) {
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
      if (net.length > 1) {
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
                <span>Panorama Multi-Loja (${net.length} Lojas)</span>
                <span class="badge badge-neutral" style="font-size:11px; font-weight:600;">Cód BIG: ${r.produto_id} &bull; EAN: ${esc(r.barras || '—')}</span>
              </div>
              <div class="muted" style="font-size:11px;">Visão simultânea das ${net.length} lojas operacionais da rede</div>
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
                    <td colspan="2"><span style="font-size:12px;">🏬 TOTAL DA REDE (${net.length} LOJAS CONSOLIDADAS)</span></td>
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
  const storeDiagContainer = document.getElementById('sweep-store-diagnostic');
  const remanSynergyContainer = document.getElementById('sweep-reman-synergy');
  const matrixContainer = document.getElementById('sweep-matrix-container');
  const matrixHeader = document.getElementById('sweep-matrix-header');
  const matrixCountBadge = document.getElementById('sweep-matrix-count-badge');
  const toggleIcon = document.getElementById('btn-toggle-matrix-icon');
  const toggleText = document.getElementById('btn-toggle-matrix-text');

  // Reset visual do modal
  banner.className = 'sweep-banner info';
  banner.style = '';
  banner.innerHTML = '<strong>Consultando laboratórios, fabricantes e curvas da molécula em tempo real...</strong>';
  tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;" class="muted">Carregando dados da molécula...</td></tr>';
  actionBar.innerHTML = '';
  if (storeDiagContainer) { storeDiagContainer.style.display = 'none'; storeDiagContainer.innerHTML = ''; }
  if (remanSynergyContainer) { remanSynergyContainer.style.display = 'none'; remanSynergyContainer.innerHTML = ''; }
  if (matrixContainer) { matrixContainer.style.display = 'none'; }
  if (toggleIcon) toggleIcon.textContent = '▶';
  if (toggleText) toggleText.textContent = 'Ver Matriz Completa';

  const fId = filialId || (state.selectedFilial !== 'all' ? state.selectedFilial : 2);

  try {
    const res = await apiGet(`/api/molecules/sweep?key=${encodeURIComponent(molKey)}&skuId=${skuId || 0}&filialId=${fId || 2}`);
    const { targetSku, cheapestSku, otherStockTotal, otherCoverageDays, skus, summary, substancia, concentracao, forma, packBucket, ia_advice, store_analysis, remanejamento_sinergia } = res;

    // 1. Atualizar Título da Modal
    document.getElementById('sweep-modal-title').innerHTML = `
      <span>🔬 ${esc(toTitleCase(substancia))} ${esc(concentracao)}</span>
      <span class="badge badge-accent">${esc(forma)} &bull; ${esc(packBucket)}</span>
    `;

    // Atualizar badge da matriz de fabricantes
    if (matrixCountBadge) matrixCountBadge.textContent = `${skus.length} ${skus.length > 1 ? 'marcas' : 'marca'}`;

    const targetSugUn = Number(targetSku?.total_sugestao_un || targetSku?.sugestao_compra_un || 0);
    const targetSugRs = Number(targetSku?.total_sugestao_rs || targetSku?.sugestao_compra_rs || 0);
    const hasReman = remanejamento_sinergia && remanejamento_sinergia.hasOpportunities;
    const isDeadStock = ia_advice?.type === 'DEAD_STOCK_WARNING';
    const isEnoughStock = ia_advice?.type === 'ENOUGH_STOCK_WARNING';
    const isMargin = ia_advice?.type === 'MARGIN_OPPORTUNITY';

    // 2. Banner Executivo com Ação de 1 Clique (REV-024)
    let masterActionTitle = '';
    let masterActionBtnText = '';
    let masterActionType = '';
    let ecoHighlight = 0;

    if (hasReman) {
      ecoHighlight = remanejamento_sinergia.economiaRemanejamentoRs || targetSugRs;
      masterActionTitle = '🔄 A IA recomenda REMANEJAR INTERNAMENTE (Transfer-First)';
      masterActionBtnText = `⚡ 1-Clique: Aplicar Remanejamento & Bloquear Compras (${brl(ecoHighlight)})`;
      masterActionType = 'REMAN';
    } else if (isDeadStock) {
      ecoHighlight = targetSugRs > 0 ? targetSugRs : (ia_advice.ecoDead || 0);
      masterActionTitle = '🛑 A IA recomenda NÃO COMPRAR na distribuidora agora';
      masterActionBtnText = `⚡ 1-Clique: Bloquear Compras & Desovar Balcão (${brl(ecoHighlight)})`;
      masterActionType = 'BLOCK_ALL';
    } else if (isMargin && cheapestSku) {
      ecoHighlight = ia_advice.economiaTotal || 0;
      masterActionTitle = `🟢 A IA recomenda TROCAR para ${esc(cheapestSku.labora)} (Menor Custo)`;
      masterActionBtnText = `⚡ 1-Clique: Trocar Fabricante (Economizar ${brl(ecoHighlight)})`;
      masterActionType = 'SWITCH';
    } else if (isEnoughStock) {
      ecoHighlight = ia_advice.ecoDeducao || targetSugRs;
      masterActionTitle = '📉 A IA recomenda DESCONTAR ESTOQUE ALTERNATIVO do pedido';
      masterActionBtnText = `⚡ 1-Clique: Abater Estoque Existente (${brl(ecoHighlight)})`;
      masterActionType = 'DEDUCT';
    } else {
      masterActionTitle = '✓ Molécula Equilibrada na Rede';
      masterActionBtnText = '✓ Liberar Compra Homologada';
      masterActionType = 'KEEP';
    }

    banner.className = 'sweep-banner';
    banner.style = 'background:linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%); border:1.5px solid #f87171; border-radius:12px; padding:14px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.03);';
    if (!isDeadStock && !hasReman && isMargin) {
      banner.style = 'background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border:1.5px solid #60a5fa; border-radius:12px; padding:14px 18px;';
    } else if (!isDeadStock && !hasReman && !isMargin) {
      banner.style = 'background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1.5px solid #86efac; border-radius:12px; padding:14px 18px;';
    }

    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; width:100%;">
        <div style="flex:1; min-width:300px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:14.5px; font-weight:800; color:#0f172a;">${masterActionTitle}</span>
            ${ecoHighlight > 0 ? `<span style="background:#15803d; color:#ffffff; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px;">Economia: ${brl(ecoHighlight)}</span>` : ''}
            ${targetSugUn > 0 ? `<span style="background:#f1f5f9; color:#334155; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px;">Pedido: ${targetSugUn} un (${brl(targetSugRs)})</span>` : ''}
          </div>
          <div style="font-size:12px; color:#334155; margin-top:5px; line-height:1.45;">
            ${isDeadStock ? `Existem <strong>${ia_advice.deadTotalQty} un de Curva D (${esc(ia_advice.deadLabsList)})</strong> paradas na rede e lojas com marcas concorrentes. A prioridade da IA é desovar no balcão e proteger o capital de giro!`
              : hasReman ? `O motor localizou estoques excedentes e lotes com validade próxima em lojas doadoras que cobrem a demanda das filiais sem comprar de distribuidoras!`
              : isMargin ? `Existe opção idêntica de menor custo homologada (${esc(cheapestSku.labora)}) gerando economia imediata no pedido.`
              : 'Estoque distribuído em conformidade com as políticas da rede.'}
          </div>
        </div>

        ${targetSugUn > 0 ? `
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="btn-master-ia-1click" class="btn btn-primary" type="button" style="font-weight:800; font-size:13px; padding:10px 20px; border-radius:8px; border:none; box-shadow:0 2px 6px rgba(0,0,0,0.15); display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Executa a decisão recomendada da IA para toda a rede em 1 clique">
              <span>${masterActionBtnText}</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // 3. Renderizar Filiais com Ação Requerida (MOSTRAR APENAS O QUE DÁ PRA SER FEITO) (REV-024)
    if (storeDiagContainer && store_analysis && store_analysis.length > 0) {
      storeDiagContainer.style.display = 'flex';

      // Filtra estritamente as filiais que têm algo a ser feito
      const actionableStores = store_analysis.filter((st) =>
        st.targetSug > 0 ||
        st.deadEstTotal > 0 ||
        st.veredito === 'DOADORA_EXCESSO' ||
        st.veredito === 'RUPTURA_REAL' ||
        st.veredito === 'BLOQUEAR_COMPRA' ||
        st.veredito === 'DEDUZIR_PARCIAL'
      );
      const neutralStores = store_analysis.filter((st) => !actionableStores.includes(st));

      const isMulti = store_analysis.length > 1;

      storeDiagContainer.innerHTML = `
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:14px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <div>
              <div style="font-size:13.5px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>🏢 ${isMulti ? 'Filiais que Requerem Ação Direta do Comprador' : 'Diagnóstico da Filial: Ação Recomendada'}</span>
                <span class="badge badge-accent" style="font-size:10.5px;">${actionableStores.length} ${actionableStores.length > 1 ? 'Lojas com Ação' : 'Loja com Ação'}</span>
              </div>
              <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
                Mostrando apenas lojas com compras sugeridas, excedente ou itens parados. Você pode clicar no botão de cada card ou usar a ação master acima.
              </div>
            </div>
            ${neutralStores.length > 0 ? `
              <div style="font-size:11px; color:#64748b; background:#f8fafc; padding:4px 10px; border-radius:999px; border:1px solid #e2e8f0;">
                ✓ ${neutralStores.length} ${neutralStores.length > 1 ? 'outras filiais estão equilibradas' : 'outra filial está equilibrada'} (${neutralStores.map(n => n.short || n.label).join(', ')})
              </div>
            ` : ''}
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:10px;">
            ${actionableStores.map((st) => {
              const isBlock = st.veredito === 'BLOQUEAR_COMPRA';
              const isDeduct = st.veredito === 'DEDUZIR_PARCIAL';
              const isDonor = st.veredito === 'DOADORA_EXCESSO';
              const isDesova = st.veredito === 'DESOVAR_BALCAO';
              const isRupture = st.veredito === 'RUPTURA_REAL';

              const cardBg = isBlock ? '#fff5f5' : isDeduct ? '#fffbeb' : isDonor ? '#faf5ff' : isDesova ? '#fff7ed' : isRupture ? '#eff6ff' : '#f8fafc';
              const cardBorder = isBlock ? '#fca5a5' : isDeduct ? '#fde68a' : isDonor ? '#c4b5fd' : isDesova ? '#fdba74' : isRupture ? '#93c5fd' : '#e2e8f0';
              const badgeBg = isBlock ? '#dc2626' : isDeduct ? '#d97706' : isDonor ? '#7c3aed' : isDesova ? '#ea580c' : isRupture ? '#2563eb' : '#64748b';

              return `
                <div class="store-action-card" id="card-store-${st.filial_id}" style="background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                      <span style="font-weight:800; font-size:12.5px; color:#0f172a;">${esc(st.full_label || st.label)}</span>
                      <span style="background:${badgeBg}; color:#ffffff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; text-transform:uppercase;">
                        ${st.tituloVeredito}
                      </span>
                    </div>

                    <div style="display:flex; justify-content:space-between; font-size:11px; background:rgba(255,255,255,0.7); padding:5px 8px; border-radius:6px; margin-bottom:6px;">
                      <div>Sugestão: <strong style="color:${st.targetSug > 0 ? '#b91c1c' : '#334155'};">${st.targetSug} un</strong> ${st.sugRs > 0 ? `(${brl(st.sugRs)})` : ''}</div>
                      <div>Alt. Estoque: <strong>${st.altEstTotal} un</strong> <span class="muted">(${st.cobAltMedia >= 999 ? '999+d' : st.cobAltMedia + 'd'})</span></div>
                    </div>

                    <div style="font-size:11.5px; line-height:1.4; color:#1e293b; margin-bottom:8px;">
                      ${esc(st.orientacao)}
                    </div>
                  </div>

                  <!-- BOTÃO DE AÇÃO DIRETA DENTRO DO CARD -->
                  ${st.targetSug > 0 ? `
                    <button class="btn btn-sm btn-cancel-card-purchase" data-filial-id="${st.filial_id}" data-pid="${targetSku.produto_id}" data-un="${st.targetSug}" data-rs="${st.sugRs}" style="width:100%; margin-top:4px; font-weight:700; font-size:11px; padding:6px 10px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:6px; cursor:pointer;" type="button" title="Cancela a compra exclusivamente nesta loja">
                      🚫 Cancelar Compra Desta Filial (-${st.targetSug} un &bull; Salvar ${brl(st.sugRs)})
                    </button>
                  ` : isDonor ? `
                    <div style="padding:5px 8px; background:rgba(255,255,255,0.85); border-radius:6px; border:1px dashed #c4b5fd; font-size:11px; font-weight:700; color:#5b21b6; text-align:center;">
                      🚚 Loja disponível para transferir até ${st.surplus || st.altEstTotal} un
                    </div>
                  ` : `
                    <div style="padding:5px 8px; background:rgba(255,255,255,0.85); border-radius:6px; border:1px dashed ${cardBorder}; font-size:11px; font-weight:700; color:#334155; text-align:center;">
                      💡 Priorizar venda das ${st.deadEstTotal} un no balcão
                    </div>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // 4. Renderizar Sinergia com Remanejamento (Transfer-First) se houver
    if (remanSynergyContainer && hasReman) {
      remanSynergyContainer.style.display = 'flex';
      const routes = remanejamento_sinergia.routes || [];

      remanSynergyContainer.innerHTML = `
        <div style="background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border:1.5px solid #a78bfa; border-radius:12px; padding:12px 16px; box-shadow:0 2px 5px rgba(124,58,237,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="font-size:13.5px; font-weight:800; color:#5b21b6; display:flex; align-items:center; gap:8px;">
              <span>🔄 Oportunidades de Remanejamento Interno: Transfer-First</span>
              <span class="badge" style="background:#7c3aed; color:#fff; font-size:10px;">${routes.length} Rotas</span>
            </div>
            <span style="background:#15803d; color:#ffffff; font-size:11px; font-weight:800; padding:2px 10px; border-radius:999px;">
              Economia: ${brl(remanejamento_sinergia.economiaRemanejamentoRs)}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:8px;">
            ${routes.map((r) => `
              <div style="background:#ffffff; border:1px solid #c4b5fd; border-radius:8px; padding:8px 10px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:800; color:#4338ca;">🚚 ${esc(r.from_label)} ➔ ${esc(r.to_label)}</div>
                  <div style="color:#0f172a; margin-top:2px;"><strong>${r.qty} un</strong> &bull; ${esc(r.produto_desc || r.labora)}</div>
                  <div class="muted" style="font-size:10.5px;">${esc(r.motivo)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:800; color:#15803d;">${brl(r.economia_rs)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 5. Configurar Toggle da Matriz de Auditoria (Expansível / Accordion)
    if (matrixHeader && matrixContainer) {
      matrixHeader.onclick = () => {
        const isHidden = matrixContainer.style.display === 'none';
        matrixContainer.style.display = isHidden ? 'block' : 'none';
        if (toggleIcon) toggleIcon.textContent = isHidden ? '▼' : '▶';
        if (toggleText) toggleText.textContent = isHidden ? 'Ocultar Matriz' : 'Ver Matriz Completa';
      };
    }

    // 6. Preencher a Matriz de Laboratórios (Tabela Completa de Auditoria)
    const activeFiliaisList = (res.filiais && res.filiais.length > 0)
      ? res.filiais
      : (state.overview?.filiaisPolicies || []).filter((p) => Number(p.filial_id) !== 1).map((p) => ({
          filial_id: Number(p.filial_id),
          label: formatFilialTag(p.filial_id, p.nome_reduz, p.nome_loja),
          short: `L${String(p.filial_id).padStart(2, '0')} (${p.nome_reduz || `F${p.filial_id}`})`
        }));

    const isMultiStore = activeFiliaisList.length > 1;
    const thead = document.getElementById('sweep-thead');

    if (thead) {
      let storeColsHeader = '';
      if (isMultiStore) {
        storeColsHeader = activeFiliaisList.map((f, i) => {
          const bg = i === 0 ? '#eff6ff' : i === 1 ? '#f5f3ff' : '#fefce8';
          const color = i === 0 ? '#1e40af' : i === 1 ? '#5b21b6' : '#854d0e';
          return `<th class="num" style="background:${bg}; color:${color}; min-width:90px;">${esc(f.short || f.label)}</th>`;
        }).join('') + `<th class="num" style="background:#f1f5f9; color:#0f172a; font-weight:700; border-right:1px solid #cbd5e1; min-width:100px;">TOTAL REDE</th>`;
      } else {
        const s = activeFiliaisList[0];
        storeColsHeader = `<th class="num" style="background:#eff6ff; color:#1e40af; min-width:115px;">Estoque (${esc(s.short || s.label)})</th>`;
      }

      thead.innerHTML = `
        <tr style="background: var(--bg-subtle);">
          <th style="min-width:140px;">Laboratório</th>
          <th style="min-width:210px;">Apresentação</th>
          <th style="min-width:105px;">Curva &amp; Giro</th>
          ${storeColsHeader}
          <th class="num" style="min-width:85px;">Último Custo</th>
          <th style="text-align:center; min-width:110px;">Ação</th>
        </tr>
      `;
    }

    tbody.innerHTML = skus.map((s) => {
      const isTarget = targetSku && s.produto_id === targetSku.produto_id;
      const isCheapest = cheapestSku && s.produto_id === cheapestSku.produto_id;
      const isCurvaD = s.abc_class === 'D' || /D/i.test(s.curva_erp_classe || '');
      const isCurvaA = s.abc_class === 'A' || /A/i.test(s.curva_erp_classe || '');
      const isCurvaB = s.abc_class === 'B' || /B/i.test(s.curva_erp_classe || '');
      const badgeStyle = isCurvaA ? 'background:#dcfce7;color:#15803d;' : isCurvaB ? 'background:#e0f2fe;color:#0369a1;' : isCurvaD ? 'background:#fee2e2;color:#b91c1c;' : 'background:#fef3c7;color:#92400e;';
      const badgeLabel = `Curva ${s.abc_class || 'D'}`;
      const giroLabel = Number(s.total_ddv) > 0 ? `${num(s.total_ddv, 2)}/d` : 'Sem Giro';
      const isDead = isCurvaD && Number(s.total_estoque) > 0;
      const cobStr = (d) => (Number(d) >= 999 ? '999+d' : `${num(d, 1)}d`);

      const storeCellsHtml = activeFiliaisList.map((f, i) => {
        const l = (s.lojas && s.lojas[f.filial_id]) || { estoque_atual: 0, cobertura_dias: 0, sugestao_compra_un: 0 };
        const bg = i === 0 ? 'rgba(239,246,255,0.4)' : i === 1 ? 'rgba(245,243,255,0.4)' : 'rgba(254,252,232,0.4)';
        return `
          <td class="num" style="background:${bg}; font-size:11px;">
            <div><strong>${num(l.estoque_atual)} un</strong> <span class="muted" style="font-size:9.5px;">(${cobStr(l.cobertura_dias)})</span></div>
            ${l.sugestao_compra_un > 0 ? `<div style="color:var(--accent);font-weight:700;font-size:9.5px;margin-top:1px;">🛒 ${num(l.sugestao_compra_un)} un</div>` : ''}
          </td>
        `;
      }).join('');

      const totalRedeCell = isMultiStore
        ? `
          <td class="num" style="background:#f8fafc; font-weight:700; border-right:1px solid #cbd5e1; font-size:11.5px;">
            <div>${num(s.total_estoque)} un</div>
            <div class="muted" style="font-size:9.5px; font-weight:normal;">(${cobStr(s.cobertura_rede)})</div>
            ${s.total_sugestao_un > 0 ? `<div style="color:var(--accent);font-weight:700;font-size:10px;">🛒 ${num(s.total_sugestao_un)} un</div>` : ''}
          </td>
        `
        : '';

      return `
        <tr class="sweep-sku-row ${isTarget ? 'is-target' : ''} ${isCheapest ? 'is-cheapest' : ''} ${isDead ? 'is-dead' : ''}">
          <td>
            <div style="font-weight:700; color:#0f172a;">${esc(s.labora || 'Outro')}</div>
            <div style="margin-top:1px;">
              ${isTarget ? ' <span class="badge badge-accent" style="font-size:9px;padding:1px 4px;">Item Alvo</span>' : ''}
              ${isCheapest ? ' <span class="badge badge-success" style="font-size:9px;padding:1px 4px;">Menor Custo</span>' : ''}
            </div>
          </td>
          <td>
            <div style="font-weight:600; color:#1e293b; font-size:11.5px;">${esc(s.descricao)}</div>
            <div class="muted" style="font-size:10px;">Cód BIG: ${s.produto_id} &bull; EAN ${esc(s.barras || '—')}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span class="badge" style="font-size:9.5px;font-weight:700;${badgeStyle}">${badgeLabel}</span>
              ${isDead ? '<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:8.5px;font-weight:700;">💤 Parado</span>' : ''}
            </div>
          </td>
          ${storeCellsHtml}
          ${totalRedeCell}
          <td class="num">
            <div style="font-weight:700; font-size:11.5px;">${brl(s.custo_unit)}</div>
          </td>
          <td style="text-align:center;">
            ${!isTarget && s.custo_unit > 0 && targetSku && targetSugUn > 0 ? `
              <button class="btn btn-secondary btn-sm btn-action-switch" data-source-id="${targetSku.produto_id}" data-target-id="${s.produto_id}" data-qty="${targetSugUn}" data-target-name="${esc(s.descricao)}" type="button" style="padding:3px 7px;font-size:10.5px;font-weight:600;">
                Trocar p/ Este
              </button>
            ` : isDead ? `
              <span class="badge" style="background:#fee2e2;color:#991b1b;font-size:9px;">Desovar Balcão</span>
            ` : isTarget ? `
              <span class="badge badge-accent" style="font-size:9px;">Item Demandado</span>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');

    // 7. Barra Inferior de Opções Adicionais
    actionBar.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:700; color:var(--text);">Opções Complementares:</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${(ia_advice && ia_advice.canDiscount && otherStockTotal > 0) ? `
            <button id="btn-sweep-discount" class="btn btn-secondary btn-sm" type="button" style="font-weight:600; font-size:11.5px;" title="Abate as unidades existentes da sugestão do pedido">
              📉 Abater Apenas Unidades Paradas
            </button>
          ` : ''}
          <button id="btn-sweep-keep" class="btn btn-ghost btn-sm" type="button" style="font-weight:600; font-size:11.5px; border:1px solid #cbd5e1; border-radius:6px;" title="Mantém a compra do produto original homologado e o libera para a Sugestão de Compra">
            ⚪ Manter Compra Original
          </button>
          <button id="btn-sweep-teach-ia" class="btn btn-secondary btn-sm" type="button" style="padding:6px 10px; font-size:11px;" title="Corrigir apresentação farmacológica ou princípio ativo desta molécula">
            🧠 Ensinar IA
          </button>
        </div>
      </div>
    `;

    // 8. Vincular Ação Master 1-Clique
    const btnMaster1Click = document.getElementById('btn-master-ia-1click');
    if (btnMaster1Click && targetSku) {
      btnMaster1Click.onclick = async () => {
        btnMaster1Click.disabled = true;
        btnMaster1Click.innerHTML = '<span>⏳</span><span>Executando Solução da IA...</span>';
        try {
          const blockedStores = (store_analysis || []).filter((s) => s.veredito === 'BLOQUEAR_COMPRA' || s.veredito === 'DEDUZIR_PARCIAL');
          const res = await apiPost('/api/curadoria/decision', {
            action: 'EXECUTE_IA_1CLICK',
            filial_id: 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            blockedStores,
            routes: remanejamento_sinergia?.routes || [],
            deductQty: ia_advice?.dedQty || 0,
            target_sku_id: cheapestSku?.produto_id || null,
          });
          showBanner(`✓ ${res.message || 'Solução da IA executada com sucesso em 1 clique!'}`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(`Erro ao executar solução da IA: ${err.message}`, true);
          btnMaster1Click.disabled = false;
        }
      };
    }

    // 9. Vincular Ações Diretas em Cada Card de Loja (REV-024)
    document.querySelectorAll('.btn-cancel-card-purchase').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const fIdTarget = Number(btn.dataset.filialId);
        const pIdTarget = Number(btn.dataset.pid);
        const un = btn.dataset.un;
        const rs = btn.dataset.rs;
        btn.disabled = true;
        btn.textContent = 'Cancelando...';
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'CANCEL_STORE_PURCHASE',
            filial_id: fIdTarget,
            produto_id: pIdTarget,
            molecule_key: molKey,
            descricao: targetSku?.descricao,
            motivo: `Cancelada compra de ${un} un (R$ ${rs}) da filial ${fIdTarget} via card de curadoria`
          });
          showBanner(`✓ ${res.message || 'Compra da filial cancelada com sucesso!'}`);
          const card = document.getElementById(`card-store-${fIdTarget}`);
          if (card) {
            card.style.background = '#f0fdf4';
            card.style.borderColor = '#86efac';
            card.innerHTML = `
              <div style="font-weight:800; color:#15803d; font-size:12px; display:flex; align-items:center; gap:6px;">
                <span>✓ Compra Cancelada com Sucesso</span>
              </div>
              <div style="font-size:11px; color:#166534; margin-top:4px;">
                A compra de ${un} un desta filial foi zerada. Economia de R$ ${Number(rs).toFixed(2)} garantida no caixa!
              </div>
            `;
          }
          if (typeof updateCockpitBudgetPillForFilial === 'function') {
            updateCockpitBudgetPillForFilial(state.selectedFilial || 'all');
          }
        } catch (err) {
          showBanner(`Erro ao cancelar compra da filial: ${err.message}`, true);
          btn.disabled = false;
          btn.textContent = 'Tentar Novamente';
        }
      };
    });

    // 10. Vincular Botões Secundários
    const btnDiscount = document.getElementById('btn-sweep-discount');
    if (btnDiscount && targetSku) {
      btnDiscount.onclick = async () => {
        btnDiscount.disabled = true;
        try {
          const dedQty = Math.min(otherStockTotal, targetSugUn);
          const res = await apiPost('/api/curadoria/decision', {
            action: 'DEDUCT',
            filial_id: targetSku.filial_id || fId || 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            deduct_qty: dedQty,
            motivo: `Abatidas ${dedQty} un considerando estoque alternativo da molécula na rede`
          });
          showBanner(`✓ ${res.message || 'Estoque alternativo abatido do pedido com sucesso!'}`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
        } catch (err) {
          showBanner(`Erro ao descontar: ${err.message}`, true);
          btnDiscount.disabled = false;
        }
      };
    }

    const btnKeep = document.getElementById('btn-sweep-keep');
    if (btnKeep && targetSku) {
      btnKeep.onclick = async () => {
        btnKeep.disabled = true;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'KEEP',
            filial_id: targetSku.filial_id || fId || 0,
            produto_id: targetSku.produto_id,
            molecule_key: molKey,
            descricao: targetSku.descricao,
            motivo: 'Comprador manteve compra original homologada'
          });
          showBanner(`✓ ${res.message || 'Compra homologada e liberada para Sugestão de Compra!'}`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
        } catch (err) {
          showBanner(`Erro ao homologar: ${err.message}`, true);
          btnKeep.disabled = false;
        }
      };
    }

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

    tbody.querySelectorAll('.btn-action-switch').forEach((btn) => {
      btn.onclick = async () => {
        const sourceId = Number(btn.dataset.sourceId);
        const targetId = Number(btn.dataset.targetId);
        const qty = Number(btn.dataset.qty);
        const targetName = btn.dataset.targetName;
        try {
          const res = await apiPost('/api/curadoria/decision', {
            action: 'SWITCH',
            filial_id: fId || 2,
            produto_id: sourceId,
            target_sku_id: targetId,
            qty,
            molecule_key: molKey,
            descricao: targetSku?.descricao,
            labora_origem: targetSku?.labora,
            labora_proposto: targetName,
            motivo: `Troca homologada para laboratório ${targetName}`
          });
          showBanner(`✓ ${res.message || 'Troca de laboratório realizada com sucesso!'}`);
          closeMoleculeSweep();
          if (state.tab === 'curadoria') await loadAndRenderCuradoria();
          else await loadSkus();
        } catch (err) {
          showBanner(`Erro ao trocar laboratório: ${err.message}`, true);
        }
      };
    });

  } catch (err) {
    banner.className = 'sweep-banner error';
    banner.innerHTML = `<strong>Erro ao carregar molécula:</strong> ${esc(err.message)}`;
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;color:var(--danger);padding:24px;">${esc(err.message)}</td></tr>`;
  }
}

function closeMoleculeSweep() {
  document.getElementById('molecule-sweep-modal').classList.add('hidden');
}

async function loadBi() {
  const fParam = state.selectedFilial && state.selectedFilial !== 'all' ? `?filial_id=${state.selectedFilial}` : '';
  const data = await apiGet(`/api/bi${fParam}`);
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


let currentActiveTransfers = [];
let currentCuradoriaRoutes = [];

function openTransferItemsModal(transferId) {
  const modalEl = document.getElementById('modal-transfer-items');
  if (!modalEl) return;

  const t = currentActiveTransfers.find(x => Number(x.id) === Number(transferId));
  if (!t) {
    showBanner('Guia de transferência não encontrada.', true);
    return;
  }

  const titleEl = document.getElementById('modal-trf-title');
  const subEl = document.getElementById('modal-trf-sub');
  const metaEl = document.getElementById('modal-trf-meta');
  const tbodyEl = document.getElementById('modal-trf-tbody');
  const dlBtn = document.getElementById('btn-modal-trf-download');
  const emitBtn = document.getElementById('btn-modal-trf-emit-route');

  if (titleEl) titleEl.textContent = `📦 Guia de Transferência ${t.codigo_transferencia || `TRF-${t.id}`}`;
  if (subEl) subEl.textContent = `Origem: ${t.filial_origem_nome || `Loja ${t.filial_origem}`} ➔ Destino: ${t.filial_destino_nome || `Loja ${t.filial_destino}`}`;

  if (dlBtn) {
    dlBtn.href = `/api/remanejamento/export-excel?transferId=${t.id}`;
    dlBtn.classList.remove('hidden');
  }
  if (emitBtn) emitBtn.classList.add('hidden');

  if (metaEl) {
    metaEl.innerHTML = `
      <div><strong>Emissão:</strong> ${t.data_emissao ? t.data_emissao.slice(0, 16) : '—'}</div>
      <div><strong>Status:</strong> <span class="badge badge-accent">${t.status}</span></div>
      <div><strong>Total:</strong> ${num(t.total_itens)} itens &bull; <strong>${num(t.total_unidades)} un</strong> &bull; <strong style="color:#047857;">${brl(t.valor_total_rs)}</strong></div>
      ${t.observacao ? `<div style="width:100%;margin-top:4px;color:#6b21a8;font-weight:600;">${esc(t.observacao)}</div>` : ''}
    `;
  }

  const items = t.itens || [];
  if (tbodyEl) {
    if (items.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhum item registrado nesta guia.</td></tr>';
    } else {
      tbodyEl.innerHTML = items.map(it => `
        <tr>
          <td><code>${it.produto_id}</code></td>
          <td><code>${esc(it.barras || '—')}</code></td>
          <td><strong>${esc(it.descricao)}</strong></td>
          <td><span class="muted">${esc(it.labora || '—')}</span></td>
          <td class="num"><strong>${num(it.qtd_solicitada)} un</strong></td>
          <td class="num">${brl(it.custo_unit)}</td>
          <td class="num"><strong style="color:#047857;">${brl(it.valor_total)}</strong></td>
          <td style="font-size:11px;color:#475569;">${esc(it.motivo_decisao || it.motivo || '—')}</td>
        </tr>
      `).join('');
    }
  }

  modalEl.style.display = 'flex';
  modalEl.classList.remove('hidden');

  const closeBtn = document.getElementById('btn-close-modal-trf');
  const closeBtnBottom = document.getElementById('btn-close-modal-trf-bottom');
  const closeModal = () => {
    modalEl.style.display = 'none';
    modalEl.classList.add('hidden');
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeBtnBottom) closeBtnBottom.onclick = closeModal;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal();
  };
}

function openAuditPlannedRouteModal(routeKey) {
  const modalEl = document.getElementById('modal-transfer-items');
  if (!modalEl) return;

  const route = currentCuradoriaRoutes.find(r => r.routeKey === routeKey);
  if (!route) {
    showBanner('Rota não encontrada.', true);
    return;
  }

  const titleEl = document.getElementById('modal-trf-title');
  const subEl = document.getElementById('modal-trf-sub');
  const metaEl = document.getElementById('modal-trf-meta');
  const tbodyEl = document.getElementById('modal-trf-tbody');
  const dlBtn = document.getElementById('btn-modal-trf-download');
  const emitBtn = document.getElementById('btn-modal-trf-emit-route');

  if (titleEl) titleEl.textContent = `🔍 Auditoria de Transferência • ${route.filialOrigemNome} ➔ ${route.filialDestinoNome}`;
  if (subEl) subEl.textContent = `Visualização prévia dos produtos planejados pelo comprador antes da emissão formal`;

  if (route.transferEmitted) {
    if (dlBtn) {
      dlBtn.href = `/api/remanejamento/export-excel?transferId=${route.transferEmitted.id}`;
      dlBtn.classList.remove('hidden');
    }
    if (emitBtn) emitBtn.classList.add('hidden');
  } else {
    if (dlBtn) dlBtn.classList.add('hidden');
    if (emitBtn) {
      emitBtn.classList.remove('hidden');
      emitBtn.onclick = async () => {
        emitBtn.disabled = true;
        emitBtn.textContent = 'Emitindo guia consolidada...';
        try {
          const res = await apiPost('/api/curadoria/emit-transfer', { routeKey });
          showBanner(res.message || 'Guia de transferência emitida com sucesso!');
          modalEl.style.display = 'none';
          modalEl.classList.add('hidden');
          await loadTransfers();
        } catch (err) {
          showBanner(`Erro ao emitir guia: ${err.message}`, true);
          emitBtn.disabled = false;
          emitBtn.textContent = '📄 Confirmar & Emitir Guia Desta Loja';
        }
      };
    }
  }

  if (metaEl) {
    metaEl.innerHTML = `
      <div><strong>Status:</strong> ${route.transferEmitted ? `<span class="badge" style="background:#ede9fe;color:#5b21b6;font-weight:800;">✓ Guia ${esc(route.transferEmitted.codigo)}</span>` : '<span class="badge badge-accent">Planejado / Pendente de Emissão</span>'}</div>
      <div><strong>Total de Produtos:</strong> <strong>${num(route.totalItens)} produtos</strong></div>
      <div><strong>Total a Transferir:</strong> <strong>${num(route.totalUnidades)} un</strong></div>
      <div><strong>Economia Caixa:</strong> <strong style="color:#047857;">${brl(route.valorTotalRs)}</strong></div>
    `;
  }

  const items = route.items || [];
  if (tbodyEl) {
    if (items.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhum item nesta rota.</td></tr>';
    } else {
      tbodyEl.innerHTML = items.map(it => `
        <tr>
          <td><code>${it.produto_id}</code></td>
          <td><code>${esc(it.barras || '—')}</code></td>
          <td><strong>${esc(it.descricao)}</strong></td>
          <td><span class="muted">${esc(it.labora || '—')}</span></td>
          <td class="num"><strong style="color:#4c1d95;font-size:13px;">${num(it.qtd_sugerida)} un</strong></td>
          <td class="num">${brl(it.custo_unit)}</td>
          <td class="num"><strong style="color:#047857;">${brl(it.valor_total)}</strong></td>
          <td style="font-size:11px;color:#475569;">${esc(it.motivo_decisao || `Estoque disponível na doadora: ${it.estoque_doador || 0} un`)}</td>
        </tr>
      `).join('');
    }
  }

  modalEl.style.display = 'flex';
  modalEl.classList.remove('hidden');

  const closeBtn = document.getElementById('btn-close-modal-trf');
  const closeBtnBottom = document.getElementById('btn-close-modal-trf-bottom');
  const closeModal = () => {
    modalEl.style.display = 'none';
    modalEl.classList.add('hidden');
    if (dlBtn) dlBtn.classList.remove('hidden');
    if (emitBtn) emitBtn.classList.add('hidden');
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeBtnBottom) closeBtnBottom.onclick = closeModal;
}

async function loadTransfers() {
  if (!state.remanFilters) {
    state.remanFilters = { search: '', tipo: 'ALL', curva: 'ALL', laboratorio: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0, transito: 'ALL' };
  }

  const rf = state.remanFilters;
  const params = new URLSearchParams();
  if (state.selectedFilial && state.selectedFilial !== 'all') params.append('filial_id', state.selectedFilial);
  if (rf.origem && rf.origem !== 'ALL') params.append('origem', rf.origem);
  if (rf.destino && rf.destino !== 'ALL') params.append('destino', rf.destino);
  if (rf.tipo && rf.tipo !== 'ALL') params.append('tipo', rf.tipo);
  if (rf.curva && rf.curva !== 'ALL') params.append('curva', rf.curva);
  if (rf.laboratorio && rf.laboratorio !== 'ALL') params.append('laboratorio', rf.laboratorio);
  if (rf.minValor && Number(rf.minValor) > 0) params.append('min_valor', rf.minValor);
  if (rf.search && rf.search.trim()) params.append('search', rf.search.trim());

  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const routesData = await apiGet(`/api/remanejamento/routes${queryStr}`).catch(() => ({ routes: [], transfers: [], totalGeralRs: 0, totalGeralUnidades: 0, totalItens: 0, summary: {}, filiais: [], laboratorios: [] }));

  let routes = routesData.routes || [];
  if (rf.transito && rf.transito !== 'ALL') {
    routes = routes.map(r => {
      const filteredItems = r.items.filter(it => {
        const hasTransit = Boolean(it.transitoInfo && it.transitoInfo.temPendencias);
        return rf.transito === 'WITH_TRANSIT' ? hasTransit : !hasTransit;
      });
      if (filteredItems.length === 0) return null;
      return {
        ...r,
        items: filteredItems,
        totalItens: filteredItems.length,
        totalUnidades: filteredItems.reduce((acc, x) => acc + Number(x.qtd_sugerida || 0), 0),
        valorTotalRs: Math.round(filteredItems.reduce((acc, x) => acc + Number(x.valor_total || 0), 0) * 100) / 100,
      };
    }).filter(Boolean);
  }

  const activeTransfers = routesData.transfers || [];
  currentActiveTransfers = activeTransfers;
  const summary = routesData.summary || {};
  const filiaisList = routesData.filiais || [];
  const labsList = routesData.laboratorios || [];

  // Popular dropdowns de filiais caso ainda não estejam populados
  const selOrigem = document.getElementById('reman-filter-origem');
  const selDestino = document.getElementById('reman-filter-destino');
  if (selOrigem && selOrigem.options.length <= 1 && filiaisList.length > 0) {
    selOrigem.innerHTML = '<option value="ALL">Loja Origem (Doadora): Todas</option>' + filiaisList.map((f) => `<option value="${f.filial_id}">${esc(f.label || f.short || `Loja ${f.filial_id}`)}</option>`).join('');
    selOrigem.value = rf.origem || 'ALL';
  }
  if (selDestino && selDestino.options.length <= 1 && filiaisList.length > 0) {
    selDestino.innerHTML = '<option value="ALL">Loja Destino (Receptora): Todas</option>' + filiaisList.map((f) => `<option value="${f.filial_id}">${esc(f.label || f.short || `Loja ${f.filial_id}`)}</option>`).join('');
    selDestino.value = rf.destino || 'ALL';
  }

  // Popular dropdown de laboratórios
  const selLab = document.getElementById('reman-filter-laboratorio');
  if (selLab && selLab.options.length <= 1 && labsList.length > 0) {
    selLab.innerHTML = '<option value="ALL">Laboratório: Todos</option>' + labsList.map(lab => `<option value="${esc(lab)}">${esc(lab)}</option>`).join('');
    selLab.value = rf.laboratorio || 'ALL';
  }

  // Atualizar resumo do filtro
  const filterSummaryEl = document.getElementById('reman-filter-summary');
  if (filterSummaryEl) {
    filterSummaryEl.innerHTML = `
      Exibindo <strong>${num(routesData.totalItens || 0)} produtos</strong> em <strong>${num(routes.length)} rotas</strong> &bull; Economia de Compras: <strong style="color:#047857;">${brl(routesData.totalGeralRs || 0)}</strong>
    `;
  }

  // KPI Strip
  const kpiEl = document.getElementById('transfers-kpi-strip');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi-cell">
        <div class="kpi-label">Rotas de Remanejamento</div>
        <div class="kpi-val kpi-accent">${num(routes.length)}</div>
        <div class="kpi-sub">${num(routesData.totalItens || 0)} produtos mapeados</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-label">Peças a Transferir</div>
        <div class="kpi-val kpi-accent">${num(routesData.totalGeralUnidades || 0)} un</div>
        <div class="kpi-sub">
          ${num(summary.rupturasDestinoCount || summary.excessoCount || 0)} urgentes &bull; ${num(summary.curadoriaIaCount || 0)} Curadoria IA
        </div>
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

  // Rotas Container com Seleção de Itens pelo Comprador (REV-028/030)
  const routesContainer = document.getElementById('transfer-routes-container');
  const routesCount = document.getElementById('transfer-routes-count');
  if (routesCount) routesCount.textContent = `${routes.length} rotas (${num(routesData.totalItens || 0)} itens)`;

  if (routesContainer) {
    if (routes.length === 0) {
      routesContainer.innerHTML = `
        <div class="empty-state-box" style="padding:36px 20px; text-align:center; background:var(--card-bg); border:1px solid var(--border); border-radius:10px;">
          <div style="font-size:32px; margin-bottom:8px;">🚚✨</div>
          <div style="font-weight:700; font-size:14px; color:var(--text);">Nenhuma oportunidade de remanejamento com os filtros selecionados</div>
          <div class="muted" style="font-size:12px; margin-top:4px;">Todas as lojas estão equilibradas ou nenhum item atende aos filtros de valor, curva e trânsito.</div>
        </div>
      `;
    } else {
      routesContainer.innerHTML = routes.map((r, idx) => {
        const displayLimit = 50;
        const visibleItems = r.items.slice(0, displayLimit);
        const hasMore = r.items.length > displayLimit;

        const hasRouteTransit = r.items.some(it => it.transitoInfo && it.transitoInfo.temPendencias);
        const totalTransitUn = r.items.reduce((acc, it) => acc + Number(it.transitoInfo?.qtdPendenteDistribuidora || 0), 0);

        return `
          <div class="transfer-route-card" data-route-idx="${idx}" style="background:var(--card-bg); border:1.5px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.03); margin-bottom:16px;">
            <div class="transfer-route-header" style="padding:14px 18px; background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border);">
              <div>
                <div class="transfer-route-title" style="display:flex; align-items:center; gap:8px; font-size:14.5px; font-weight:800; color:#0f172a;">
                  <span>🚚 Rota ${idx + 1}: <strong>${esc(r.filialOrigemNome)}</strong></span>
                  <span style="color:#0f766e;font-size:16px;">➔</span>
                  <span><strong>${esc(r.filialDestinoNome)}</strong></span>
                </div>
                <div class="transfer-route-meta" style="margin-top:4px; font-size:12px; color:#475569; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span><strong>${num(r.totalItens)} produtos mapeados</strong></span> &bull;
                  <span><strong>${num(r.totalUnidades)} un a transferir</strong></span> &bull;
                  <span>Economia de Compras: <strong style="color:#047857;">${brl(r.valorTotalRs)}</strong></span>
                </div>
              </div>
              <div class="transfer-route-actions" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="route-sel-summary" data-route-idx="${idx}" style="font-size:11.5px; font-weight:700; color:#0f766e; background:#f0fdf4; border:1px solid #bbf7d0; padding:4px 8px; border-radius:6px;">
                  Selecionados: ${visibleItems.length} itens (${num(r.totalUnidades)} un • ${brl(r.valorTotalRs)})
                </span>
                <a href="/api/remanejamento/export-excel?origem=${r.filialOrigem}&destino=${r.filialDestino}" class="btn btn-secondary btn-sm" style="font-weight:600; font-size:11.5px;" title="Baixar Guia de Separação em Excel desta rota">
                  📥 Baixar Romaneio Excel
                </a>
                <button class="btn btn-primary btn-sm btn-approve-route" data-route-idx="${idx}" type="button" style="background:#0f766e; border-color:#0f766e; font-weight:700; font-size:11.5px;">
                  📄 Emitir Guia da Rota
                </button>
              </div>
            </div>

            ${hasRouteTransit ? `
              <div class="route-transit-banner" data-route-idx="${idx}" style="background:#fffbeb; border-bottom:1px solid #fef3c7; border-left:4px solid #f59e0b; padding:8px 18px; font-size:11.5px; color:#92400e; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div>
                  <strong>⚠️ Alerta de Trânsito Linx:</strong> Foram detectadas <strong>${num(totalTransitUn)} un</strong> faturadas ou em pedidos de compra a caminho desta filial destino.
                </div>
                <button type="button" class="btn btn-xs btn-deduct-route-transit" data-route-idx="${idx}" style="background:#f59e0b; color:#fff; border:none; font-weight:700; border-radius:4px; padding:4px 10px; cursor:pointer;" title="Abate automaticamente as quantidades com NFe faturada">
                  ⚡ Deduzir NFes Pendentes
                </button>
              </div>
            ` : ''}

            <div class="transfer-items-table" style="overflow-x:auto;">
              <table class="data-table" style="font-size:11.5px; margin:0; width:100%;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="width:36px; text-align:center;">
                      <input type="checkbox" class="chk-select-all-route" data-route-idx="${idx}" checked title="Selecionar/Desmarcar todos" />
                    </th>
                    <th style="min-width:65px;">Código</th>
                    <th style="min-width:90px;">Barras</th>
                    <th style="min-width:210px;">Produto / Descrição</th>
                    <th style="min-width:70px;">Curva Dest.</th>
                    <th style="min-width:80px;">Situação</th>
                    <th class="num" style="min-width:80px; color:#1e40af;">Est. Doadora</th>
                    <th class="num" style="min-width:80px; color:#b91c1c;">Est. Destino</th>
                    <th class="num" style="min-width:95px;">Qtd Transferir</th>
                    <th class="num" style="min-width:75px;">Restam Doadora</th>
                    <th style="min-width:145px;">Auditoria Linx / NFe</th>
                    <th class="num" style="min-width:75px;">Custo Unit</th>
                    <th class="num" style="min-width:85px;">Total R$</th>
                    <th style="min-width:160px;">Motivo Operacional</th>
                  </tr>
                </thead>
                <tbody>
                  ${visibleItems.map((it, itemIdx) => {
                    const estDest = Number(it.estoqueDestino ?? it.estoque_destino ?? 0);
                    const estOrig = Number(it.estoqueOrigem ?? it.estoque_origem ?? 0);
                    const qtdSugerida = Number(it.qtd_solicitada || it.qtd_sugerida || 0);
                    const restamOrig = Math.max(0, estOrig - qtdSugerida);
                    const curvaDest = (it.abc_destino || it.abc_class || 'C').toUpperCase();
                    const tInfo = it.transitoInfo || { temPendencias: false, alertMsgs: [] };

                    let curvaBadge = `<span class="badge badge-neutral" style="font-size:10px; font-weight:700;">Curva ${curvaDest}</span>`;
                    if (curvaDest === 'A') curvaBadge = `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:800; font-size:10px;">Curva A</span>`;
                    else if (curvaDest === 'B') curvaBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700; font-size:10px;">Curva B</span>`;

                    let situacaoBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700;">📦 Excesso</span>`;
                    if (estDest === 0) {
                      situacaoBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:10px; border:1px solid #fca5a5;">🚨 Ruptura</span>`;
                    } else if (it.tipo === 'PARADO' || (it.motivo && it.motivo.includes('Sem venda'))) {
                      situacaoBadge = `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:10px;">💤 Parado</span>`;
                    } else if (it.isCuradoriaIa) {
                      situacaoBadge = `<span class="badge" style="background:#ede9fe; color:#6d28d9; font-weight:700; font-size:10px;">🧬 IA</span>`;
                    }

                    let auditCellHtml = '';
                    if (tInfo.temPendencias) {
                      const tooltip = (tInfo.alertMsgs || []).join('\n');
                      const leadAlert = tInfo.alertMsgs[0] || 'NFe pendente';
                      auditCellHtml = `
                        <div style="cursor:help;" title="${esc(tooltip)}">
                          <span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; font-size:10px;">⚠️ ${esc(leadAlert)}</span>
                          ${tInfo.qtdPendenteDistribuidora > 0 ? `<div style="font-size:10px; color:#b45309; font-weight:600; margin-top:2px;">🚚 NFe pendente: +${tInfo.qtdPendenteDistribuidora} un</div>` : ''}
                        </div>
                      `;
                    } else {
                      auditCellHtml = `<span class="badge" style="background:#f0fdf4; color:#166534; font-size:10px;">✅ Sem NFe pendente</span>`;
                    }

                    return `
                      <tr>
                        <td style="text-align:center;">
                          <input type="checkbox" class="chk-item-route" data-route-idx="${idx}" data-item-idx="${itemIdx}" checked />
                        </td>
                        <td><code>${it.produto_id}</code></td>
                        <td><code>${esc(it.barras || '—')}</code></td>
                        <td>
                          <div class="sku-title" style="font-weight:700; font-size:12px; color:#0f172a;">${esc(it.descricao)}</div>
                          <div class="sku-sub" style="font-size:10.5px; color:#64748b;">${esc(it.labora || '')}</div>
                        </td>
                        <td>${curvaBadge}</td>
                        <td>${situacaoBadge}</td>
                        <td class="num"><span class="badge" style="background:#dbeafe; color:#1e40af; font-weight:700;">${num(estOrig)} un</span></td>
                        <td class="num"><span class="badge" style="background:${estDest === 0 ? '#fee2e2' : '#f1f5f9'}; color:${estDest === 0 ? '#b91c1c' : '#475569'}; font-weight:700;">${num(estDest)} un</span></td>
                        <td class="num">
                          <input type="number" min="1" max="${Math.max(1, estOrig)}" value="${qtdSugerida}" class="input-route-qtd" data-route-idx="${idx}" data-item-idx="${itemIdx}" style="width:62px; font-weight:800; text-align:center; padding:3px; border:1px solid #cbd5e1; border-radius:5px; color:#0f766e; background:#fff;" />
                        </td>
                        <td class="num cell-restam-orig" data-route-idx="${idx}" data-item-idx="${itemIdx}">
                          <span class="badge" style="background:${restamOrig <= 0 ? '#fee2e2' : '#f0fdf4'}; color:${restamOrig <= 0 ? '#b91c1c' : '#166534'}; font-weight:700;">${num(restamOrig)} un</span>
                        </td>
                        <td>${auditCellHtml}</td>
                        <td class="num">${brl(it.custo_unit)}</td>
                        <td class="num cell-total-rs" data-route-idx="${idx}" data-item-idx="${itemIdx}">
                          <strong style="color:#047857;">${brl(it.valor_total)}</strong>
                        </td>
                        <td class="sku-sub" style="font-size:11px; line-height:1.35; color:#334155;">${esc(it.motivo)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              ${hasMore ? `
                <div style="padding:10px 16px; background:#f8fafc; text-align:center; border-top:1px solid #e2e8f0; font-size:11.5px; color:#64748b;">
                  Mostrando os 50 itens com maior impacto financeiro desta rota (Total de ${r.items.length} itens). Use os filtros para refinar por curva, laboratório ou valor mínimo.
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Função auxiliar para atualizar o contador da rota
      const updateRouteSelectionSummary = (routeIdx) => {
        const routeCard = routesContainer.querySelector(`.transfer-route-card[data-route-idx="${routeIdx}"]`);
        if (!routeCard) return;
        const route = routes[routeIdx];
        if (!route) return;

        const itemCheckboxes = routeCard.querySelectorAll('.chk-item-route');
        let selCount = 0;
        let selUnidades = 0;
        let selValor = 0;

        itemCheckboxes.forEach(chk => {
          if (chk.checked) {
            const itemIdx = Number(chk.dataset.itemIdx);
            const item = route.items[itemIdx];
            if (item) {
              selCount += 1;
              selUnidades += Number(item.qtd_sugerida || 0);
              selValor += Number(item.valor_total || 0);
            }
          }
        });

        const summaryEl = routeCard.querySelector('.route-sel-summary');
        if (summaryEl) {
          summaryEl.textContent = `Selecionados: ${selCount} itens (${num(selUnidades)} un • ${brl(selValor)})`;
        }

        const approveBtn = routeCard.querySelector('.btn-approve-route');
        if (approveBtn) {
          approveBtn.disabled = selCount === 0;
          approveBtn.textContent = selCount === 0 ? 'Nenhum item selecionado' : '📄 Emitir Guia da Rota';
        }
      };

      // Edição direta de quantidade no input da tabela
      routesContainer.querySelectorAll('.input-route-qtd').forEach(input => {
        input.addEventListener('input', () => {
          const rIdx = Number(input.dataset.routeIdx);
          const iIdx = Number(input.dataset.itemIdx);
          const route = routes[rIdx];
          if (!route) return;
          const item = route.items[iIdx];
          if (!item) return;

          let val = Math.max(1, parseInt(input.value || 1, 10));
          item.qtd_sugerida = val;
          item.qtd_solicitada = val;
          item.valor_total = Math.round(val * Number(item.custo_unit || 0) * 100) / 100;

          const row = input.closest('tr');
          if (row) {
            const restamEl = row.querySelector('.cell-restam-orig');
            const estOrig = Number(item.estoqueOrigem ?? item.estoque_origem ?? 0);
            const restam = Math.max(0, estOrig - val);
            if (restamEl) {
              restamEl.innerHTML = `<span class="badge" style="background:${restam <= 0 ? '#fee2e2' : '#f0fdf4'}; color:${restam <= 0 ? '#b91c1c' : '#166534'}; font-weight:700;">${num(restam)} un</span>`;
            }
            const totalEl = row.querySelector('.cell-total-rs');
            if (totalEl) {
              totalEl.innerHTML = `<strong style="color:#047857;">${brl(item.valor_total)}</strong>`;
            }
          }
          updateRouteSelectionSummary(rIdx);
        });
      });

      // Botão para deduzir trânsito pendente da rota
      routesContainer.querySelectorAll('.btn-deduct-route-transit').forEach(btn => {
        btn.addEventListener('click', () => {
          const rIdx = Number(btn.dataset.routeIdx);
          const route = routes[rIdx];
          if (!route) return;

          const routeCard = routesContainer.querySelector(`.transfer-route-card[data-route-idx="${rIdx}"]`);
          if (!routeCard) return;

          let adjustedCount = 0;
          route.items.forEach((item, iIdx) => {
            const pend = Number(item.transitoInfo?.qtdPendenteDistribuidora || 0);
            if (pend > 0) {
              const novaQtd = Math.max(1, (item.qtd_sugerida || 0) - pend);
              item.qtd_sugerida = novaQtd;
              item.qtd_solicitada = novaQtd;
              item.valor_total = Math.round(novaQtd * Number(item.custo_unit || 0) * 100) / 100;
              adjustedCount++;

              const input = routeCard.querySelector(`.input-route-qtd[data-item-idx="${iIdx}"]`);
              if (input) input.value = novaQtd;

              const row = input ? input.closest('tr') : null;
              if (row) {
                const restamEl = row.querySelector('.cell-restam-orig');
                const estOrig = Number(item.estoqueOrigem ?? item.estoque_origem ?? 0);
                const restam = Math.max(0, estOrig - novaQtd);
                if (restamEl) {
                  restamEl.innerHTML = `<span class="badge" style="background:${restam <= 0 ? '#fee2e2' : '#f0fdf4'}; color:${restam <= 0 ? '#b91c1c' : '#166534'}; font-weight:700;">${num(restam)} un</span>`;
                }
                const totalEl = row.querySelector('.cell-total-rs');
                if (totalEl) {
                  totalEl.innerHTML = `<strong style="color:#047857;">${brl(item.valor_total)}</strong>`;
                }
              }
            }
          });

          updateRouteSelectionSummary(rIdx);
          showBanner(`✓ ${adjustedCount} produtos ajustados subtraindo as NFes de distribuidores a caminho!`);
        });
      });

      // Checkbox "Selecionar Todos"
      routesContainer.querySelectorAll('.chk-select-all-route').forEach(masterChk => {
        masterChk.addEventListener('change', () => {
          const routeIdx = Number(masterChk.dataset.routeIdx);
          const routeCard = routesContainer.querySelector(`.transfer-route-card[data-route-idx="${routeIdx}"]`);
          if (routeCard) {
            const itemCheckboxes = routeCard.querySelectorAll('.chk-item-route');
            itemCheckboxes.forEach(chk => { chk.checked = masterChk.checked; });
            updateRouteSelectionSummary(routeIdx);
          }
        });
      });

      // Checkbox individual por item
      routesContainer.querySelectorAll('.chk-item-route').forEach(itemChk => {
        itemChk.addEventListener('change', () => {
          const routeIdx = Number(itemChk.dataset.routeIdx);
          const routeCard = routesContainer.querySelector(`.transfer-route-card[data-route-idx="${routeIdx}"]`);
          if (routeCard) {
            const masterChk = routeCard.querySelector('.chk-select-all-route');
            const allItemChks = routeCard.querySelectorAll('.chk-item-route');
            const allChecked = Array.from(allItemChks).every(c => c.checked);
            if (masterChk) masterChk.checked = allChecked;
            updateRouteSelectionSummary(routeIdx);
          }
        });
      });

      // Emissão da guia apenas com os itens selecionados
      routesContainer.querySelectorAll('.btn-approve-route').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rIdx = Number(btn.dataset.routeIdx);
          const route = routes[rIdx];
          if (!route) return;

          const routeCard = routesContainer.querySelector(`.transfer-route-card[data-route-idx="${rIdx}"]`);
          const checkedItemIdxs = routeCard 
            ? Array.from(routeCard.querySelectorAll('.chk-item-route:checked')).map(c => Number(c.dataset.itemIdx))
            : [];
          
          const selectedItems = checkedItemIdxs.map(i => route.items[i]).filter(Boolean);
          if (selectedItems.length === 0) {
            showBanner('Selecione pelo menos um item para emitir a guia.', true);
            return;
          }

          const totUn = selectedItems.reduce((a, b) => a + Number(b.qtd_sugerida || 0), 0);

          btn.disabled = true;
          btn.textContent = 'Emitindo guia...';
          try {
            const approveRes = await apiPost('/api/remanejamento/approve', {
              filialOrigem: route.filialOrigem,
              filialDestino: route.filialDestino,
              filialOrigemNome: route.filialOrigemNome,
              filialDestinoNome: route.filialDestinoNome,
              items: selectedItems,
              observacao: `Aprovado pelo comprador via Cockpit (${selectedItems.length} itens, ${totUn} un)`,
            });
            showBanner(`✓ Transferência ${approveRes.codigoTransferencia} emitida com sucesso! Compras externas deduzidas no motor.`, false);
            await loadTransfers();
          } catch (err) {
            showBanner(`Falha ao emitir transferência: ${err.message}`, true);
            btn.disabled = false;
            btn.textContent = '📄 Emitir Guia da Rota';
          }
        });
      });
    }
  }

  // Tabela de Guias Emitidas & Trânsito Interno
  const activeCountEl = document.getElementById('active-transfers-count');
  if (activeCountEl) activeCountEl.textContent = `${activeTransfers.length} guias registradas`;

  const motorTbody = document.getElementById('motor-transfers-tbody');
  if (motorTbody) {
    if (activeTransfers.length === 0) {
      motorTbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Nenhuma transferência emitida ainda. Emita a guia de uma das rotas acima para gerar o romaneio.</td></tr>';
    } else {
      motorTbody.innerHTML = activeTransfers.map((t) => {
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

        const cancelBtn = (t.status !== 'RECEBIDA' && t.status !== 'CANCELADA')
          ? `<button class="btn btn-ghost btn-xs btn-cancel-transfer" data-id="${t.id}" style="color:#b91c1c;font-weight:600;" title="Cancelar guia e reverter compras">✕ Cancelar</button>`
          : '';

        return `
          <tr>
            <td>
              <code>${esc(t.codigo_transferencia)}</code>
            </td>
            <td><strong>${esc(t.filial_origem_nome || `Loja ${t.filial_origem}`)}</strong> ➔ <strong>${esc(t.filial_destino_nome || `Loja ${t.filial_destino}`)}</strong></td>
            <td><span class="muted" style="font-size:11px;">${esc(t.data_emissao ? t.data_emissao.slice(0, 16) : '—')}</span></td>
            <td class="num">${num(t.total_itens)}</td>
            <td class="num"><strong>${num(t.total_unidades)} un</strong></td>
            <td class="num"><strong style="color:#047857;">${brl(t.valor_total_rs)}</strong></td>
            <td>${statusBadge}</td>
            <td style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <a href="/api/remanejamento/export-excel?transferId=${t.id}" class="btn btn-secondary btn-xs" download style="display:inline-flex;align-items:center;gap:4px;font-weight:700;" title="Baixar Romaneio Excel de Separação">📥 Romaneio Excel</a>
              ${nextActionBtn}
              <button class="btn btn-ghost btn-xs btn-view-transfer-items" data-id="${t.id}" title="Ver itens desta guia">📦 Itens</button>
              ${cancelBtn}
            </td>
          </tr>
        `;
      }).join('');

      motorTbody.querySelectorAll('.btn-change-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = Number(btn.dataset.id);
          const nextStatus = btn.dataset.status;
          btn.disabled = true;
          try {
            await apiPost('/api/remanejamento/status', { id: tId, status: nextStatus });
            showBanner(`Status da transferência atualizado para ${nextStatus}!`);
            await loadTransfers();
          } catch (err) {
            showBanner(`Erro ao atualizar status: ${err.message}`, true);
            btn.disabled = false;
          }
        });
      });

      motorTbody.querySelectorAll('.btn-cancel-transfer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = Number(btn.dataset.id);
          if (!confirm('Deseja realmente cancelar esta guia de transferência? As compras correspondentes voltarão para a esteira de pedidos externos.')) return;
          btn.disabled = true;
          try {
            await apiPost('/api/remanejamento/status', { id: tId, status: 'CANCELADA' });
            showBanner('Guia de transferência cancelada com sucesso!');
            await loadTransfers();
          } catch (err) {
            showBanner(`Erro ao cancelar guia: ${err.message}`, true);
            btn.disabled = false;
          }
        });
      });

      motorTbody.querySelectorAll('.btn-view-transfer-items').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = Number(btn.dataset.id);
          openTransferItemsModal(tId);
        });
      });
    }
  }

  // Vincular eventos dos filtros de remanejamento (apenas uma vez)
  bindRemanFilterEvents();
}

let remanEventsBound = false;
function bindRemanFilterEvents() {
  if (remanEventsBound) return;
  remanEventsBound = true;

  const searchInput = document.getElementById('reman-search-input');
  const selTipo = document.getElementById('reman-filter-tipo');
  const selCurva = document.getElementById('reman-filter-curva');
  const selLab = document.getElementById('reman-filter-laboratorio');
  const selOrigem = document.getElementById('reman-filter-origem');
  const selDestino = document.getElementById('reman-filter-destino');
  const selMinVal = document.getElementById('reman-filter-min-val');
  const selTransito = document.getElementById('reman-filter-transito');
  const btnClear = document.getElementById('btn-reman-clear-filters');
  const btnConsolidate = document.getElementById('btn-reman-consolidate-guides');

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.remanFilters.search = searchInput.value;
        loadTransfers();
      }, 350);
    });
  }

  const triggerReload = () => {
    if (selTipo) state.remanFilters.tipo = selTipo.value;
    if (selCurva) state.remanFilters.curva = selCurva.value;
    if (selLab) state.remanFilters.laboratorio = selLab.value;
    if (selOrigem) state.remanFilters.origem = selOrigem.value;
    if (selDestino) state.remanFilters.destino = selDestino.value;
    if (selMinVal) state.remanFilters.minValor = Number(selMinVal.value || 0);
    if (selTransito) state.remanFilters.transito = selTransito.value;
    loadTransfers();
  };

  if (selTipo) selTipo.addEventListener('change', triggerReload);
  if (selCurva) selCurva.addEventListener('change', triggerReload);
  if (selLab) selLab.addEventListener('change', triggerReload);
  if (selOrigem) selOrigem.addEventListener('change', triggerReload);
  if (selDestino) selDestino.addEventListener('change', triggerReload);
  if (selMinVal) selMinVal.addEventListener('change', triggerReload);
  if (selTransito) selTransito.addEventListener('change', triggerReload);

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      state.remanFilters = { search: '', tipo: 'ALL', curva: 'ALL', laboratorio: 'ALL', origem: 'ALL', destino: 'ALL', minValor: 0, transito: 'ALL' };
      if (searchInput) searchInput.value = '';
      if (selTipo) selTipo.value = 'ALL';
      if (selCurva) selCurva.value = 'ALL';
      if (selLab) selLab.value = 'ALL';
      if (selOrigem) selOrigem.value = 'ALL';
      if (selDestino) selDestino.value = 'ALL';
      if (selMinVal) selMinVal.value = '0';
      if (selTransito) selTransito.value = 'ALL';
      loadTransfers();
    });
  }

  if (btnConsolidate) {
    btnConsolidate.addEventListener('click', async () => {
      btnConsolidate.disabled = true;
      btnConsolidate.textContent = 'Consolidando...';
      try {
        const res = await apiPost('/api/remanejamento/consolidate-routes', {});
        showBanner(res.message || 'Guias consolidadas com sucesso!', false);
        await loadTransfers();
      } catch (err) {
        showBanner(`Erro ao consolidar guias: ${err.message}`, true);
      } finally {
        btnConsolidate.disabled = false;
        btnConsolidate.textContent = '⚡ Consolidar Guias por Rota';
      }
    });
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

function switchSkuTab(targetTab) {
  const tabs = document.querySelectorAll('#sku-tabs .tab');
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === targetTab);
  });
  state.tab = targetTab;
  state.offset = 0;
  state.page = 1;
  loadSkus();
}

async function loadAndRenderCuradoria() {
  const container = document.getElementById('view-curadoria-container');
  if (!container) return;
  container.innerHTML = '<div class="muted" style="text-align:center;padding:40px;"><div style="font-size:32px;margin-bottom:12px;">🧬</div>Carregando Lista Executiva de Curadoria IA &amp; Oportunidades...</div>';

  try {
    const fId = state.selectedFilial || 'all';
    const [res, resHomol] = await Promise.all([
      apiGet(`/api/curadoria/opportunities?filial_id=${fId}`).catch(() => ({ molecules: [], totalEconomiaRs: 0 })),
      apiGet('/api/curadoria/homologated').catch(() => ({ decisions: [], count: 0 })),
    ]);
    const molecules = res.molecules || [];
    const totalEco = res.totalEconomiaRs || 0;
    const homologatedDecs = resHomol.decisions || [];

    const curBadge = document.getElementById('curadoria-tab-count');
    if (curBadge) curBadge.textContent = molecules.length;

    if (!state.curadoriaTab) state.curadoriaTab = 'pending';

    // =========================================================================
    // ABA: HOMOLOGADOS & AÇÕES FEITAS (DECISÕES DO COMPRADOR NA RODADA)
    // =========================================================================
    if (state.curadoriaTab === 'homologated') {
      const totEcoHomol = homologatedDecs.reduce((a, b) => a + Number(b.economia_rs || 0), 0);

      container.innerHTML = `
        <!-- SUB-ABAS DE NAVEGAÇÃO -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="btn-tab-curad-pending" class="btn btn-secondary btn-sm" type="button" style="font-weight:700;">
              ⏳ Oportunidades Pendentes (${molecules.length})
            </button>
            <button id="btn-tab-curad-homologated" class="btn btn-primary btn-sm" type="button" style="font-weight:700; background:#047857; border-color:#059669;">
              ✓ Homologados &amp; Ações Feitas (${homologatedDecs.length})
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" style="font-weight:700; border-color:#86efac; color:#166534;" onclick="switchSkuTab('buy')">
            🛒 Ir para Sugestão de Compra ➔
          </button>
        </div>

        <!-- BARRA EXECUTIVA DE HOMOLOGADOS -->
        <div style="background:linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border:1.5px solid #86efac; border-radius:14px; padding:18px 24px; margin-bottom:16px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="font-size:16px; font-weight:800; color:#14532d; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span>✓ Decisões do Comprador &amp; Ações Homologadas nesta Rodada</span>
                <span class="badge" style="background:#bbf7d0; color:#14532d; font-size:12px; font-weight:800;">${homologatedDecs.length} Decisões Registradas</span>
                <span class="badge badge-accent" style="font-size:12px; font-weight:800;">Economia Retida no Caixa: ${brl(totEcoHomol)}</span>
              </div>
              <div style="font-size:13px; color:#15803d; margin-top:4px; max-width:850px; line-height:1.4;">
                Histórico auditável de todas as decisões tomadas pelo comprador nesta rodada (Solução IA 1-Clique, transferências homologadas, deduções e desovas no balcão). Se precisar alterar ou corrigir alguma decisão, basta clicar em <strong>Desfazer Ação</strong> para reabrir o produto imediatamente.
              </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" type="button" onclick="loadTransfers(); state.view = 'transfers'; setActiveNav('nav-transfers');">
                🔄 Ver Guias no Remanejamento
              </button>
            </div>
          </div>
        </div>

        <!-- TABELA DE DECISÕES HOMOLOGADAS -->
        <div class="table-wrap" style="box-shadow:0 2px 6px rgba(0,0,0,0.03); border:1px solid var(--border); border-radius:12px; overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px; margin:0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="min-width:240px;">Produto Demandado</th>
                <th style="min-width:180px;">Molécula Ativa</th>
                <th style="min-width:160px;">Tipo de Ação Realizada</th>
                <th style="min-width:160px;">Destino / Rota</th>
                <th class="num" style="min-width:100px;">Qtd (un)</th>
                <th class="num" style="min-width:120px;">Economia Caixa</th>
                <th style="min-width:140px;">Data / Hora</th>
                <th style="text-align:center; min-width:110px;">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${homologatedDecs.length === 0 ? '<tr><td colspan="8" class="muted" style="text-align:center;padding:30px;">Nenhuma decisão homologada até o momento nesta rodada.</td></tr>' : homologatedDecs.map(d => {
                let badgeAction = '<span class="badge" style="background:#ede9fe;color:#5b21b6;font-weight:700;">Ação IA</span>';
                const acts = d.actions || [];
                if (acts.includes('EXECUTOU_SOLUCAO_IA_1CLIQUE')) {
                  badgeAction = '<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:800;">⚡ 1-Clique IA</span>';
                } else if (acts.includes('DEDUZIU_ESTOQUE_MOLECULA')) {
                  badgeAction = '<span class="badge" style="background:#dbeafe;color:#1e40af;font-weight:800;">📉 Dedução Estoque</span>';
                } else if (acts.includes('CANCELOU_COMPRA_FILIAL_INDIVIDUAL')) {
                  badgeAction = '<span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:800;">✕ Suspensão Balcão</span>';
                } else if (acts.includes('REMANEJOU_E_CANCELOU_COMPRA_EXTERNA')) {
                  badgeAction = '<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:800;">🚚 Transfer-First</span>';
                } else if (acts.includes('HOMOLOGOU_EM_LOTE')) {
                  badgeAction = '<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:800;">⚡ Lote Aprovado</span>';
                } else if (acts.includes('MANTEVE_COMPRA_ORIGINAL')) {
                  badgeAction = '<span class="badge" style="background:#ecfdf5;color:#047857;border:1px solid #86efac;font-weight:800;">🛡️ Marca Homologada</span>';
                } else if (acts.includes('TROCOU_MENOR_CUSTO')) {
                  badgeAction = '<span class="badge" style="background:#fdf4ff;color:#86198f;border:1px solid #f0abfc;font-weight:800;">🔄 Troca Menor Custo</span>';
                }

                let routeStr = '<span class="badge badge-success" style="font-size:10px;">🏠 Balcão Local</span>';
                if (acts.includes('MANTEVE_COMPRA_ORIGINAL')) {
                  routeStr = '<span class="badge" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10px;font-weight:700;">🛒 Sugestão Mantida</span>';
                } else if (d.transfer_emitted) {
                  routeStr = `<span class="badge" style="background:#ede9fe;color:#5b21b6;font-weight:800;font-size:10px;">✓ Guia ${esc(d.transfer_emitted.codigo)}</span>`;
                } else if (d.lojas_doadoras && d.lojas_doadoras.length > 0) {
                  const donor = d.lojas_doadoras[0];
                  const dest = d.lojas_canceladas && d.lojas_canceladas.length > 0 ? d.lojas_canceladas[0] : { nome: 'Loja' };
                  routeStr = `<span class="badge" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:10px;">🚚 ${esc(donor.nome)} ➔ ${esc(dest.nome)}</span>`;
                }

                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;color:#0f172a;">${esc(d.descricao)}</div>
                      <div class="muted" style="font-size:11px;">Cód BIG: <strong>${d.produto_id}</strong> ${d.barras ? `&bull; EAN: ${esc(d.barras)}` : ''} &bull; ${esc(d.labora || '—')}</div>
                    </td>
                    <td><span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600;font-size:10px;">${esc(d.molecule_key || '—')}</span></td>
                    <td>${badgeAction}</td>
                    <td>${routeStr}</td>
                    <td class="num"><strong style="color:#4c1d95;">${num(d.total_un_abatidas)} un</strong></td>
                    <td class="num"><strong style="color:#047857;">${brl(d.economia_rs)}</strong></td>
                    <td><span class="muted" style="font-size:11px;">${d.created_at ? d.created_at.slice(0, 16) : '—'}</span></td>
                    <td style="text-align:center;">
                      <button class="btn btn-ghost btn-xs btn-undo-curad" data-pid="${d.produto_id}" data-mol="${esc(d.molecule_key)}" style="color:#dc2626;font-weight:700;" title="Desfazer decisão e reabrir na Curadoria">
                        ↩️ Desfazer
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btn-tab-curad-pending')?.addEventListener('click', () => {
        state.curadoriaTab = 'pending';
        loadAndRenderCuradoria();
      });
      document.getElementById('btn-tab-curad-homologated')?.addEventListener('click', () => {
        state.curadoriaTab = 'homologated';
        loadAndRenderCuradoria();
      });

      container.querySelectorAll('.btn-undo-curad').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pId = Number(btn.dataset.pid);
          const molKey = btn.dataset.mol;
          if (!window.confirm('Deseja desfazer esta ação? O produto retornará para as oportunidades pendentes da Curadoria.')) return;
          btn.disabled = true;
          try {
            const resUndo = await apiPost('/api/curadoria/undo-decision', { produto_id: pId, molecule_key: molKey });
            showBanner(resUndo.message || 'Decisão desfeita com sucesso!');
            await loadAndRenderCuradoria();
          } catch (err) {
            showBanner(`Erro ao desfazer decisão: ${err.message}`, true);
            btn.disabled = false;
          }
        });
      });

      return;
    }

    // =========================================================================
    // ABA: OPORTUNIDADES PENDENTES (PADRÃO)
    // =========================================================================
    if (molecules.length === 0) {
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="btn-tab-curad-pending" class="btn btn-primary btn-sm" type="button" style="font-weight:700;">
              ⏳ Oportunidades Pendentes (0)
            </button>
            <button id="btn-tab-curad-homologated" class="btn btn-secondary btn-sm" type="button" style="font-weight:700;">
              ✓ Homologados &amp; Ações Feitas (${homologatedDecs.length})
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" style="font-weight:700; border-color:#86efac; color:#166534;" onclick="switchSkuTab('buy')">
            🛒 Ir para Sugestão de Compra ➔
          </button>
        </div>

        <div class="empty-state-box" style="padding:48px 24px; text-align:center; background:var(--card-bg); border:1.5px solid var(--border); border-radius:14px; margin-top:12px;">
          <div style="font-size:42px; margin-bottom:12px;">🧬✨</div>
          <div style="font-size:18px; font-weight:800; color:var(--text-primary);">Nenhum produto pendente de curadoria de moléculas</div>
          <div class="muted" style="font-size:13.5px; margin-top:6px; max-width:620px; margin-left:auto; margin-right:auto; line-height:1.5;">
            Todos os produtos demandados com concorrência já foram homologados, ajustados pelo menor custo ou não possuem compras pendentes. Todos os itens validados já estão liberados para cotação na Sugestão de Compra!
          </div>
          <div style="display:flex; justify-content:center; gap:12px; margin-top:20px; flex-wrap:wrap;">
            <button class="btn btn-primary" type="button" style="font-weight:700;" onclick="switchSkuTab('buy')">
              🛒 Ir para Sugestão de Compra
            </button>
            <button class="btn btn-secondary" type="button" id="btn-empty-see-homol" style="font-weight:700;">
              ✓ Ver Homologados &amp; Ações Feitas (${homologatedDecs.length})
            </button>
            <button class="btn btn-secondary" type="button" onclick="openDesovaItemsModal()">
              📦 Ver Produtos em Desova no Balcão
            </button>
            <button class="btn btn-secondary" type="button" onclick="openCuradoriaLearningLogModal()">
              📜 Ver Log de Aprendizado da IA
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-tab-curad-homologated')?.addEventListener('click', () => {
        state.curadoriaTab = 'homologated';
        loadAndRenderCuradoria();
      });
      document.getElementById('btn-empty-see-homol')?.addEventListener('click', () => {
        state.curadoriaTab = 'homologated';
        loadAndRenderCuradoria();
      });
      return;
    }

    container.innerHTML = `
      <!-- SUB-ABAS DE NAVEGAÇÃO -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <button id="btn-tab-curad-pending" class="btn btn-primary btn-sm" type="button" style="font-weight:700;">
            ⏳ Oportunidades Pendentes (${molecules.length})
          </button>
          <button id="btn-tab-curad-homologated" class="btn btn-secondary btn-sm" type="button" style="font-weight:700;">
            ✓ Homologados &amp; Ações Feitas (${homologatedDecs.length})
          </button>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-secondary btn-sm" type="button" style="font-weight:700; border-color:#86efac; color:#166534;" onclick="switchSkuTab('buy')">
            🛒 Avançar p/ Sugestão de Compra ➔
          </button>
        </div>
      </div>
      <!-- BARRA DE CONTROLE EXECUTIVO DA CURADORIA -->
      <div style="background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border:1.5px solid #86efac; border-radius:14px; padding:18px 24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
        <div>
          <div style="font-size:16px; font-weight:800; color:#166534; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span>🧬 Pré-Tela de Curadoria IA • Oportunidades de Substituição &amp; Desova</span>
            <span class="badge" style="background:#bbf7d0; color:#14532d; font-size:12px; font-weight:800;">${molecules.length} Produtos com Concorrência</span>
            ${totalEco > 0 ? `<span class="badge badge-accent" style="font-size:12px; font-weight:800;">Economia Projetada: ${brl(totalEco)}</span>` : ''}
          </div>
          <div style="font-size:13px; color:#15803d; margin-top:4px; max-width:850px; line-height:1.4;">
            Lista executiva dos produtos sugeridos para compra com concorrência ou estoque parado. <strong>Clique no produto</strong> ou no botão para abrir a tela com as moléculas por loja e definir a ação (suspender para balcão, deduzir estoque ou trocar fabricante) antes de liberar para a Sugestão de Compra.
          </div>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button id="btn-approve-all-curadoria" class="btn btn-primary btn-sm" type="button" style="font-weight:700; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            ⚡ Homologar Todas as Trocas
          </button>
          <button id="btn-view-desova-items" class="btn btn-secondary btn-sm" type="button" style="font-weight:600;">
            📦 Ver Itens em Desova
          </button>
          <button id="btn-view-learning-log" class="btn btn-secondary btn-sm" type="button" style="font-weight:600;">
            📜 Log de Aprendizado da IA
          </button>
          <button class="btn btn-secondary btn-sm" type="button" style="font-weight:700; border-color:#86efac; color:#166534;" onclick="switchSkuTab('buy')">
            🛒 Avançar p/ Sugestão de Compra ➔
          </button>
        </div>
      </div>

      <!-- BARRA DE FILTRO RÁPIDO -->
      <div style="margin-bottom:14px; display:flex; align-items:center; gap:12px; background:var(--card-bg); padding:10px 16px; border:1px solid var(--border); border-radius:10px;">
        <span style="font-size:16px;">🔍</span>
        <input type="text" id="curadoria-filter-input" placeholder="Filtrar por produto, código BIG, EAN, princípio ativo ou fabricante..." style="border:none; outline:none; background:transparent; width:100%; font-size:13.5px; color:var(--text-primary);" />
        <span id="curadoria-filter-count" class="muted" style="font-size:12px; white-space:nowrap;">Mostrando ${molecules.length} de ${molecules.length} produtos</span>
      </div>

      <!-- TABELA EXECUTIVA DE PRODUTOS DEMANDADOS (LISTA) -->
      <div class="table-wrap" style="box-shadow:0 2px 6px rgba(0,0,0,0.03); border:1px solid var(--border); border-radius:12px; overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="data-table" style="font-size:12.5px; margin:0;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="min-width:260px;">Produto Demandado (Sugerido p/ Compra)</th>
              <th style="min-width:210px;">Princípio Ativo &amp; Apresentação</th>
              <th class="num" style="min-width:120px;">Último Custo</th>
              <th class="num" style="min-width:125px;">Demanda Sugerida</th>
              <th style="min-width:250px;">Diagnóstico IA (Motivo da Retenção)</th>
              <th style="text-align:center; min-width:145px;">Ação</th>
            </tr>
          </thead>
          <tbody id="curadoria-table-body">
            ${molecules.map((mol) => {
              const target = mol.targetSku || {};
              const cheapest = mol.cheapestSku || {};
              const adv = mol.iaAdvice || {};
              const deadStocks = adv.deadStocks || [];
              const deadTotalQty = adv.deadTotalQty || deadStocks.reduce((a, s) => a + (s.estoque || 0), 0);
              const deadLabsList = adv.deadLabsList || Array.from(new Set(deadStocks.map(s => s.labora || 'Outro'))).join(', ');
              const diffUnit = adv.diffUnit || (target.custo_unit && cheapest.custo_unit ? (target.custo_unit - cheapest.custo_unit).toFixed(2) : 0);
              const economiaTotal = adv.economiaTotal || (Number(diffUnit) > 0 ? Math.round(Number(diffUnit) * (target.total_sugestao_un || 0) * 100) / 100 : 0);
              const otherStockTotal = mol.otherStockTotal || 0;
              const otherCoverageDays = mol.otherCoverageDays || 0;
              const searchText = `${target.descricao || ''} ${target.produto_id || ''} ${target.barras || ''} ${target.labora || ''} ${mol.substancia || ''} ${mol.concentracao || ''} ${mol.forma || ''}`.toLowerCase();

              return `
                <tr class="curadoria-product-row" data-mol-key="${esc(mol.molecule_key)}" data-pid="${target.produto_id || 0}" data-search="${esc(searchText)}" title="Clique para abrir a visão matricial das lojas com todos os fabricantes desta molécula">
                  <td>
                    <div style="font-weight:700; color:#0f172a; font-size:13px;">${esc(target.descricao || 'Produto Sem Descrição')}</div>
                    <div class="muted" style="font-size:11px; margin-top:2px;">
                      Cód BIG: <strong>${target.produto_id || '—'}</strong> &bull; EAN ${esc(target.barras || '—')}
                    </div>
                    <div style="margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span class="badge" style="background:#f1f5f9; color:#334155; font-size:10.5px; font-weight:700;">🏭 ${esc(target.labora || 'Fabricante')}</span>
                      <span class="badge badge-neutral" style="font-size:10px;">Curva ${esc(target.abc_class || 'A')}</span>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:700; color:#1e293b; font-size:12.5px;">🔬 ${esc(toTitleCase(mol.substancia || ''))} ${esc(mol.concentracao || '')}</div>
                    <div class="muted" style="font-size:11px; margin-top:2px;">${esc(mol.forma || '')} &bull; ${esc(mol.pack_bucket || '')}</div>
                    <div style="margin-top:3px;">
                      <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:11px;">🏷️ ${mol.labs_count || 1} Labs Concorrentes</span>
                    </div>
                  </td>
                  <td class="num">
                    <div style="font-weight:700; font-size:13px; color:#0f172a;">${brl(target.custo_unit || 0)}</div>
                    ${cheapest && cheapest.produto_id !== target.produto_id && cheapest.custo_unit < target.custo_unit && cheapest.custo_unit >= 0.50 && (cheapest.total_estoque > 0 || cheapest.total_sugestao_un > 0) ? `
                      <div style="font-size:11px; color:#059669; font-weight:600; margin-top:2px;" title="Fabricante com menor custo nesta molécula">
                        Menor Custo: <strong>${brl(cheapest.custo_unit)}</strong> <span class="muted">(${esc(cheapest.labora)})</span>
                      </div>
                    ` : ''}
                  </td>
                  <td class="num">
                    <div style="font-weight:800; font-size:13.5px; color:#0f172a;">${num(target.total_sugestao_un || 0)} un</div>
                    <div style="font-weight:700; font-size:12px; color:var(--accent);">${brl(target.total_sugestao_rs || 0)}</div>
                  </td>
                  <td>
                    ${mol.remanejamento_sinergia && mol.remanejamento_sinergia.hasOpportunities ? `
                      <span class="badge" style="background:#ede9fe; color:#5b21b6; border:1px solid #ddd6fe; font-weight:800; font-size:11px; display:inline-block; margin-bottom:3px;">
                        🔄 ${mol.remanejamento_sinergia.routes.length} Rotas de Remanejamento (${brl(mol.remanejamento_sinergia.economiaRemanejamentoRs)})
                      </span>
                      <div style="font-size:11px; color:#5b21b6; font-weight:600; line-height:1.3;">
                        Transfer-First disponível entre lojas. ${deadTotalQty > 0 ? `(${deadTotalQty} un Curva D paradas)` : ''}
                      </div>
                    ` : adv.type === 'DEAD_STOCK_WARNING' ? `
                      <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ ${deadTotalQty} un Curva D Parado
                      </span>
                      <div style="font-size:11px; color:#991b1b; line-height:1.3;">
                        ${esc(deadLabsList)} sem giro. Priorizar desova no balcão antes de comprar!
                      </div>
                    ` : adv.type === 'MARGIN_OPPORTUNITY' ? `
                      <span class="badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        💡 Troca Menor Custo (${esc(cheapest.labora)})
                      </span>
                      <div style="font-size:11px; color:#047857; font-weight:600; line-height:1.3;">
                        Economia de ${brl(diffUnit)}/un &bull; ${brl(economiaTotal)} no pedido!
                      </div>
                    ` : adv.type === 'ENOUGH_STOCK_WARNING' ? `
                      <span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ⚠️ ${otherStockTotal} un de Outros Labs em Estoque
                      </span>
                      <div style="font-size:11px; color:#92400e; line-height:1.3;">
                        ${otherCoverageDays}d de cobertura em marcas alternativas na rede.
                      </div>
                    ` : `
                      <span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; font-size:11px; display:inline-block; margin-bottom:3px;">
                        ✓ Validar Fornecedor
                      </span>
                      <div class="muted" style="font-size:11px;">Molécula equilibrada na rede.</div>
                    `}
                  </td>
                  <td style="text-align:center;">
                    <button class="btn btn-primary btn-sm btn-open-mol-modal" data-mol-key="${esc(mol.molecule_key)}" data-pid="${target.produto_id || 0}" type="button" style="font-weight:700; padding:6px 14px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; gap:6px;">
                      🔬 Analisar Molécula
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    bindCuradoriaActions();
  } catch (err) {
    container.innerHTML = `<div class="banner error">Erro ao carregar Pré-Tela de Curadoria: ${esc(err.message)}</div>`;
  }
}

function bindCuradoriaActions() {
  // Filtro Rápido em Tempo Real
  const filterInput = document.getElementById('curadoria-filter-input');
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.toLowerCase().trim();
      const rows = document.querySelectorAll('.curadoria-product-row');
      let visible = 0;
      rows.forEach(row => {
        const text = row.dataset.search || '';
        const match = !q || text.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      const countEl = document.getElementById('curadoria-filter-count');
      if (countEl) countEl.textContent = `Mostrando ${visible} de ${rows.length} produtos`;
    });
  }

  // Clique na Linha ou no Botão "🔬 Analisar Molécula" abre a Modal com a visão matricial das lojas
  document.querySelectorAll('.curadoria-product-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const molKey = row.dataset.molKey;
      const pid = Number(row.dataset.pid || 0);
      if (molKey) {
        openMoleculeSweep(molKey, pid, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    });
  });

  document.querySelectorAll('.btn-open-mol-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const molKey = btn.dataset.molKey;
      const pid = Number(btn.dataset.pid || 0);
      if (molKey) {
        openMoleculeSweep(molKey, pid, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    });
  });

  // Homologar Todas as Trocas
  const btnAll = document.getElementById('btn-approve-all-curadoria');
  if (btnAll) {
    btnAll.addEventListener('click', async () => {
      if (!window.confirm('Deseja homologar em lote todas as moléculas pendentes? Os itens validados serão liberados imediatamente para a Sugestão de Compra.')) return;
      btnAll.disabled = true;
      btnAll.textContent = 'Homologando...';
      try {
        const res = await apiPost('/api/curadoria/decision', { action: 'APPROVE_ALL' });
        showBanner(`✓ ${res.message || 'Todas as moléculas homologadas com sucesso!'}`);
        await loadAndRenderCuradoria();
      } catch (e) {
        showBanner(`Erro na homologação em lote: ${e.message}`, true);
        btnAll.disabled = false;
        btnAll.textContent = '⚡ Homologar Todas as Trocas';
      }
    });
  }

  // Ver Itens em Desova
  const btnDesova = document.getElementById('btn-view-desova-items');
  if (btnDesova) {
    btnDesova.addEventListener('click', openDesovaItemsModal);
  }

  // Ver Log de Aprendizado da IA
  const btnLog = document.getElementById('btn-view-learning-log');
  if (btnLog) {
    btnLog.addEventListener('click', openCuradoriaLearningLogModal);
  }
}

function closeDynamicModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  syncBodyModalState();
}

async function openDesovaItemsModal() {
  try {
    const res = await apiGet('/api/curadoria/desova-items');
    const items = res.items || [];
    
    let html = `
      <div id="modal-desova-backdrop" class="modal-backdrop modal-overlay" style="z-index:9999;" onclick="if(event.target === this) closeDynamicModal('modal-desova-backdrop')">
        <div class="modal-card" style="width: min(850px, 94vw); max-height:85vh; border-radius:14px; overflow:hidden;">
          <div class="modal-head" style="padding:18px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
            <div>
              <div style="font-size:16px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>📦 Produtos em Desova no Balcão</span>
                <span class="badge" style="background:#fed7aa; color:#9a3412; font-weight:700;">${items.length} SKUs Suspensos</span>
              </div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">
                Monitorados automaticamente pela IA: quando o estoque das marcas alternativas cair para &le; 7 dias, a compra reativa sem intervenção.
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="closeDynamicModal('modal-desova-backdrop')">✕ Fechar</button>
          </div>
          <div class="modal-body" style="padding:20px 24px; overflow-y:auto; flex:1; overscroll-behavior:contain;">
            ${items.length === 0 ? '<div class="muted" style="text-align:center; padding:30px;">Nenhum produto em desova no momento.</div>' : `
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Produto &amp; Fabricante</th>
                    <th>Motivo da Suspensão</th>
                    <th class="num">Estoque Atual</th>
                    <th class="num">Giro Diário</th>
                    <th class="num">Cobertura</th>
                    <th style="text-align:center;">Ação Imediata</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td>
                        <strong>${esc(it.descricao || `SKU ${it.produto_id}`)}</strong>
                        <div class="muted" style="font-size:11px;">Cód: ${it.produto_id} &bull; ${esc(it.labora || '')}</div>
                      </td>
                      <td>
                        <span class="badge badge-neutral" style="font-size:11px;">${esc(it.motivo || 'Desova Curva D')}</span>
                        <div class="muted" style="font-size:10px; margin-top:2px;">Desde ${it.created_at || '—'}</div>
                      </td>
                      <td class="num"><strong>${num(it.estoque_atual || 0)} un</strong></td>
                      <td class="num">${num(it.ddv_projetada || 0, 2)}/d</td>
                      <td class="num"><span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">${num(it.cobertura_dias || 0, 1)}d</span></td>
                      <td style="text-align:center;">
                        <button class="btn btn-sm btn-primary btn-unsuspend-desova" data-pid="${it.produto_id}" data-filial="${it.filial_id || 0}" style="font-size:11px; font-weight:700;">
                          🚀 Liberar Compra
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;

    const oldM = document.getElementById('modal-desova-backdrop');
    if (oldM) oldM.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    syncBodyModalState();

    document.querySelectorAll('.btn-unsuspend-desova').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const fId = btn.dataset.filial;
        btn.disabled = true;
        btn.textContent = 'Liberando...';
        try {
          await apiPost('/api/curadoria/desova-unsuspend', { produto_id: pid, filial_id: fId });
          showBanner('✓ Produto liberado com sucesso para a esteira de compras!');
          btn.closest('tr').remove();
          await loadAndRenderCuradoria();
        } catch (e) {
          showBanner(`Erro ao liberar produto: ${e.message}`, true);
          btn.disabled = false;
          btn.textContent = '🚀 Liberar Compra';
        }
      });
    });

  } catch (err) {
    showBanner(`Erro ao consultar itens em desova: ${err.message}`, true);
  }
}

async function openCuradoriaLearningLogModal() {
  try {
    const res = await apiGet('/api/buyer/learning-log');
    const logs = res.logs || [];

    let html = `
      <div id="modal-cur-log-backdrop" class="modal-backdrop modal-overlay" style="z-index:9999;" onclick="if(event.target === this) closeDynamicModal('modal-cur-log-backdrop')">
        <div class="modal-card" style="width: min(850px, 94vw); max-height:85vh; border-radius:14px; overflow:hidden;">
          <div class="modal-head" style="padding:18px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
            <div>
              <div style="font-size:16px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>🧠 Log de Aprendizado da IA (Decisões do Comprador)</span>
                <span class="badge badge-accent">${logs.length} Regras Salvas</span>
              </div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">
                A IA utiliza este histórico para respeitar prescrições médicas, marcas cativas e preferências de laboratório.
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="closeDynamicModal('modal-cur-log-backdrop')">✕ Fechar</button>
          </div>
          <div class="modal-body" style="padding:20px 24px; overflow-y:auto; flex:1; overscroll-behavior:contain;">
            ${logs.length === 0 ? '<div class="muted" style="text-align:center; padding:30px;">Nenhuma regra customizada aprendida ainda.</div>' : `
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Data &amp; Hora</th>
                    <th>Evento IA</th>
                    <th>Produto / Molécula</th>
                    <th>Motivo do Comprador</th>
                    <th>Ação Futura</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(l => {
                    const isApprove = l.tipo_evento?.includes('APROVOU') || l.tipo_evento?.includes('HOMOLOGOU') || l.tipo_evento?.includes('TROCOU') || l.tipo_evento?.includes('MANTEVE');
                    const isSuspend = l.tipo_evento?.includes('SUSPENSAO');
                    const badgeClass = isApprove ? 'badge-accent' : (isSuspend ? 'badge-warn' : 'badge-danger');
                    return `
                      <tr>
                        <td class="muted" style="font-size:11px; white-space:nowrap;">${l.created_at || '—'}</td>
                        <td><span class="badge ${badgeClass}" style="font-size:10.5px;">${esc(l.tipo_evento || 'REGRA')}</span></td>
                        <td>
                          <strong>${esc(l.descricao || l.molecule_key || 'Molécula')}</strong>
                          ${l.produto_id ? `<div class="muted" style="font-size:10.5px;">SKU: ${l.produto_id}</div>` : ''}
                        </td>
                        <td><em>${esc(l.motivo || 'Sem justificativa')}</em></td>
                        <td><span class="badge badge-neutral" style="font-size:10.5px;">${esc(l.acao_futura || 'REGISTRADO')}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;

    const oldM = document.getElementById('modal-cur-log-backdrop');
    if (oldM) oldM.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    syncBodyModalState();
  } catch (err) {
    showBanner(`Erro ao carregar log de aprendizado: ${err.message}`, true);
  }
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
  document.documentElement.classList.toggle('modal-open', hasOpen);
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach((m) => {
    if (m.id === 'modal-welcome-gate' && isLicenseExpired()) {
      return; // Apenas a janela sobreposta deve permanecer até a ativação da chave!
    }
    if (m.id === 'modal-cur-log-backdrop' || m.id === 'modal-desova-backdrop') {
      m.remove();
      return;
    }
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

// ========================================================
// CONTROLE ORÇAMENTÁRIO & OPEN-TO-BUY (GOVERNANÇA DE COMPRAS)
// ========================================================

async function loadBudget(forceRefresh = false) {
  const tbody = document.getElementById('otb-dimensions-tbody');
  const tbodyStores = document.getElementById('otb-stores-tbody');
  if (tbody) tbody.style.opacity = '0.5';
  if (tbodyStores) tbodyStores.style.opacity = '0.5';

  if (tbody && forceRefresh) {
    tbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;padding:24px;">🔄 Recalculando dotação orçamentária no Linx BIG...</td></tr>';
  }

  const btnRefresh = document.getElementById('btn-refresh-budget');
  if (btnRefresh && forceRefresh) btnRefresh.disabled = true;

  try {
    const fIdParam = state.selectedFilial && state.selectedFilial !== 'all' ? `?filial_id=${state.selectedFilial}` : '';
    const endpoint = (forceRefresh ? '/api/budget/recalculate' : '/api/budget/overview') + fIdParam;
    const method = forceRefresh ? apiPost : apiGet;
    const res = await method(endpoint);
    if (!res || (res.ok === false)) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;color:#ef4444;padding:24px;">Erro ao carregar dotação: ${res?.error || 'Falha na resposta'}</td></tr>`;
      return;
    }

    const d = res.data || res;
    state.budgetSummary = d;

    // Banner de escopo de filial no OTB
    const scopeBanner = document.getElementById('otb-filial-scope-banner');
    const scopeName = document.getElementById('otb-filial-scope-name');
    if (scopeBanner && scopeName) {
      if (state.selectedFilial && state.selectedFilial !== 'all') {
        const pol = (state.overview?.filiaisPolicies || []).find(p => String(p.filial_id) === String(state.selectedFilial));
        const label = pol ? formatFilialTag(pol.filial_id, pol.nome_reduz, pol.nome_loja) : (d.nome_reduz || d.nome_loja || `Loja ${state.selectedFilial}`);
        scopeName.textContent = label;
        scopeBanner.style.display = 'flex';
      } else {
        scopeBanner.style.display = 'none';
      }
    }

    const btnResetScope = document.getElementById('btn-otb-reset-consolidated');
    if (btnResetScope && !btnResetScope._bound) {
      btnResetScope._bound = true;
      btnResetScope.addEventListener('click', () => {
        state.selectedFilial = 'all';
        renderMultilojaBar();
        renderKpiStrip('all');
        loadBudget();
      });
    }

    // Campos normalizados do resumo
    const mesRef = d.reference_month || d.mes_referencia || '—';
    const dataRef = d.reference_date || d.data_referencia || '';
    const dotacaoAjustada = Number(d.dotacao_ajustada || 0);
    const consumido = Number(d.consumido_compras_rs || d.consumido_total || 0);
    const consumidoPct = dotacaoAjustada > 0 ? (consumido / dotacaoAjustada) * 100 : 0;
    const saldoLivre = Math.max(0, dotacaoAjustada - consumido);
    const faturamentoLiquido = Number(d.faturamento_liquido_mes || d.faturamento_liquido || 0);
    const compraVendaPct = Number(d.compra_x_venda_pct || d.compra_venda_pct || 0);
    const semDemanda = Number(d.compras_sem_demanda_rs || d.sem_demanda || 0);
    const excesso = Number(d.compras_excesso_rs || d.excesso || 0);
    const naoOtimizadas = Number(d.compras_nao_otimizadas_rs || d.compras_nao_otimizadas || (semDemanda + excesso));
    const iec = Number(d.iec_eficiencia_pct !== undefined ? d.iec_eficiencia_pct : (d.iec !== undefined ? d.iec : 0));
    const comprasCertas = Math.max(0, consumido - naoOtimizadas);
    const sabPeso = Number(d.peso_sabado || d.sabado_peso || 1);
    const domPeso = Number(d.peso_domingo || d.domingo_peso || 1);
    const scoreAnt = Number(d.score_mes_anterior || d.score_mes_ant || 0);
    const scoreAtual = Number(d.score_mes_atual || 0);
    const varFat = Number(d.var_faturamento_pct !== undefined ? d.var_faturamento_pct : (d.var_fat_pct || 0));

    // Atualiza badge de mês
    const elMonth = document.getElementById('otb-month-badge');
    if (elMonth) {
      const dRef = dataRef ? dataRef.split('-').reverse().join('/') : '';
      elMonth.textContent = `Mês: ${mesRef} (Ref: ${dRef})`;
    }

    // Card 1: Dotação Orçamentária
    const elDotacao = document.getElementById('otb-kpi-dotacao');
    if (elDotacao) elDotacao.textContent = brl(dotacaoAjustada);
    const elConsumido = document.getElementById('otb-kpi-consumido');
    if (elConsumido) elConsumido.textContent = brl(consumido);
    const elConsumidoPct = document.getElementById('otb-kpi-consumido-pct');
    if (elConsumidoPct) elConsumidoPct.textContent = `${num(consumidoPct, 1)}%`;
    const elSaldoLivre = document.getElementById('otb-kpi-saldo-livre');
    if (elSaldoLivre) {
      elSaldoLivre.textContent = brl(saldoLivre);
      elSaldoLivre.style.color = saldoLivre >= 0 ? '#059669' : '#dc2626';
    }
    const elBar = document.getElementById('otb-kpi-bar');
    if (elBar) {
      const pct = Math.min(100, Math.max(0, consumidoPct || 0));
      elBar.style.width = `${pct}%`;
      elBar.style.background = consumidoPct > 100 ? '#dc2626' : (consumidoPct > 80 ? '#d97706' : '#2563eb');
    }

    // Card 2: Compra x Venda
    const elFat = document.getElementById('otb-kpi-fat');
    if (elFat) elFat.textContent = brl(faturamentoLiquido);
    const elComprado = document.getElementById('otb-kpi-comprado');
    if (elComprado) elComprado.textContent = brl(consumido);
    const elCompraVendaPct = document.getElementById('otb-kpi-compra-venda-pct');
    if (elCompraVendaPct) elCompraVendaPct.textContent = `${num(compraVendaPct, 1)}%`;

    // Card 3: Perdas & Alertas
    const elNaoOtim = document.getElementById('otb-kpi-nao-otimizadas');
    if (elNaoOtim) elNaoOtim.textContent = brl(naoOtimizadas);
    const elSemDem = document.getElementById('otb-kpi-sem-demanda');
    if (elSemDem) elSemDem.textContent = brl(semDemanda);
    const elExcesso = document.getElementById('otb-kpi-excesso');
    if (elExcesso) elExcesso.textContent = brl(excesso);

    // Card 4: IEC
    const elIec = document.getElementById('otb-kpi-iec');
    if (elIec) elIec.textContent = `${num(iec, 1)}%`;
    const elComprasCertas = document.getElementById('otb-kpi-compras-certas');
    if (elComprasCertas) elComprasCertas.textContent = brl(comprasCertas);
    const elIecBar = document.getElementById('otb-kpi-iec-bar');
    if (elIecBar) {
      elIecBar.style.width = `${Math.min(100, Math.max(0, iec || 0))}%`;
    }

    // Memória de cálculo
    const elSab = document.getElementById('otb-mem-sab');
    if (elSab) elSab.textContent = num(sabPeso, 3);
    const elDom = document.getElementById('otb-mem-dom');
    if (elDom) elDom.textContent = num(domPeso, 3);
    const elScoreAnt = document.getElementById('otb-mem-score-ant');
    if (elScoreAnt) elScoreAnt.textContent = num(scoreAnt, 3);
    const elScoreAtual = document.getElementById('otb-mem-score-atual');
    if (elScoreAtual) elScoreAtual.textContent = num(scoreAtual, 3);
    const elVarFat = document.getElementById('otb-mem-var-fat');
    if (elVarFat) {
      const sign = varFat >= 0 ? '+' : '';
      elVarFat.textContent = `${sign}${num(varFat, 2)}%`;
      elVarFat.style.background = varFat >= 0 ? '#d1fae5' : '#fee2e2';
      elVarFat.style.color = varFat >= 0 ? '#065f46' : '#991b1b';
    }

    // Tabela por dimensão
    if (tbody) {
      const dims = d.dimensions || d.dimensoes || [];
      if (dims.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;padding:16px;">Nenhuma dimensão retornada.</td></tr>';
      } else {
        tbody.innerHTML = dims.map(row => {
          const saldo = Number(row.saldo_livre_rs !== undefined ? row.saldo_livre_rs : (row.saldo_livre || 0));
          const saldoColor = saldo >= 0 ? '#059669' : '#dc2626';
          const fator = Number(row.fator_tendencia_pct !== undefined ? row.fator_tendencia_pct : (row.fator_correcao_pct || 0));
          const fatorSign = fator >= 0 ? '+' : '';
          const consPct = Number(row.consumido_pct || 0);
          const iecDim = Number(row.iec_pct !== undefined ? row.iec_pct : (row.iec || 0));
          const semDem = Number(row.compras_sem_demanda_rs !== undefined ? row.compras_sem_demanda_rs : (row.sem_demanda || 0));
          const exc = Number(row.compras_excesso_rs !== undefined ? row.compras_excesso_rs : (row.excesso || 0));

          return `
            <tr>
              <td style="font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                <span>${row.dimensao === 'Éticos' ? '💊' : (row.dimensao === 'Genéricos' ? '🟢' : (row.dimensao === 'Perfumaria' ? '🧴' : (row.dimensao === 'Similares' ? '🔵' : '📦')))}</span>
                <span>${esc(row.dimensao)}</span>
              </td>
              <td class="num">${brl(row.cmv_mes_anterior || row.cmv_mes_ant)}</td>
              <td class="num">${brl(row.dotacao_inicial)}</td>
              <td class="num"><span class="badge badge-neutral" style="font-size:11px;">${fatorSign}${num(fator, 2)}%</span></td>
              <td class="num" style="font-weight:700;color:#1e40af;">${brl(row.dotacao_ajustada)}</td>
              <td class="num">${brl(row.consumido_rs)}</td>
              <td class="num"><strong style="color:${consPct > 100 ? '#dc2626' : 'inherit'};">${num(consPct, 1)}%</strong></td>
              <td class="num" style="font-weight:800;color:${saldoColor};">${brl(saldo)}</td>
              <td class="num" style="color:#dc2626;">${brl(semDem)}</td>
              <td class="num" style="color:#c2410c;">${brl(exc)}</td>
              <td class="num" style="font-weight:700;color:#7c3aed;">${num(iecDim, 1)}%</td>
              <td style="text-align:center;">
                <button class="btn btn-secondary btn-sm btn-filter-dimension" data-dim="${esc(row.dimensao)}" style="padding:4px 8px;font-size:11px;" title="Filtrar e comprar ${esc(row.dimensao)} na Mesa">
                  🛒 Comprar
                </button>
              </td>
            </tr>
          `;
        }).join('');

        // Eventos dos botões de filtrar por dimensão na Mesa
        tbody.querySelectorAll('.btn-filter-dimension').forEach(btn => {
          btn.addEventListener('click', () => {
            const dim = btn.dataset.dim;
            goToCockpitWithDimension(dim);
          });
        });
      }
    }

    // Renderiza tabela comparativa de desempenho por loja (OTB multi-loja)
    renderBudgetFiliaisTable(d.filiais_summary);

    // Atualiza também a pílula de saldo de dotação no cockpit
    updateCockpitBudgetPill(d);

    // Sinergia Transfer-First: Economia gerada por Remanejamento Interno
    const elReman = document.getElementById('otb-remanejamento-economizado');
    if (elReman) elReman.textContent = brl(d.remanejamento_economizado_rs || 0);

    // Auditoria por Produto (Compras Não Otimizadas)
    state.unoptimizedProducts = d.unoptimized_products || [];
    renderUnoptimizedTable(state.unoptimizedProducts);

    if (forceRefresh) {
      showBanner(`✓ Dotação Orçamentária recalculada: Teto R$ ${brl(dotacaoAjustada)} • Saldo Livre R$ ${brl(saldoLivre)}.`);
    }
  } catch (err) {
    showBanner(`Erro ao carregar dotação: ${err.message}`, true);
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;color:#ef4444;padding:24px;">Erro ao carregar dotação: ${err.message}</td></tr>`;
  } finally {
    if (btnRefresh) btnRefresh.disabled = false;
    if (tbody) tbody.style.opacity = '1';
    if (tbodyStores) tbodyStores.style.opacity = '1';
  }
}

async function renderBudgetFiliaisTable(filiaisList) {
  const tbody = document.getElementById('otb-stores-tbody');
  const badge = document.getElementById('otb-stores-count-badge');
  if (!tbody) return;

  let list = filiaisList;
  if (!list || list.length === 0) {
    try {
      const res = await apiGet('/api/budget/filiais');
      if (res && res.ok && Array.isArray(res.filiais)) {
        list = res.filiais;
      }
    } catch {}
  }

  if (badge) {
    badge.textContent = list && list.length ? `${list.length} Lojas` : '0 Lojas';
  }

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:20px;">Nenhuma filial operacional com movimentação registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(f => {
    const isSelected = String(state.selectedFilial) === String(f.filial_id);
    const dotacao = Number(f.dotacao_ajustada || 0);
    const consumido = Number(f.consumido_compras_rs || 0);
    const saldo = Number(f.saldo_livre_rs || Math.max(0, dotacao - consumido));
    const pct = Number(f.consumido_pct || (dotacao > 0 ? (consumido / dotacao) * 100 : 0));
    const fat = Number(f.faturamento_liquido_mes || 0);
    const cvPct = Number(f.compra_x_venda_pct || (fat > 0 ? (consumido / fat) * 100 : 0));
    const naoOtim = Number(f.compras_nao_otimizadas_rs || 0);
    const iec = Number(f.iec_eficiencia_pct || 0);

    const barColor = pct > 100 ? '#dc2626' : (pct > 80 ? '#d97706' : '#2563eb');
    const saldoColor = saldo >= 0 ? '#059669' : '#dc2626';
    const tag = formatFilialTag(f.filial_id, f.nome_reduz, f.nome_loja);

    return `
      <tr style="${isSelected ? 'background:#f0fdf4;font-weight:600;' : ''}">
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <span>🏪</span>
            <span style="font-weight:700;color:var(--text-primary);">${esc(tag)}</span>
            ${isSelected ? '<span class="badge badge-success" style="font-size:10px;padding:1px 5px;">Visualizando</span>' : ''}
          </div>
        </td>
        <td class="num" style="font-weight:700;color:#1e40af;">${brl(dotacao)}</td>
        <td class="num">${brl(consumido)}</td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
            <div style="background:#e2e8f0;border-radius:3px;height:6px;width:50px;overflow:hidden;display:inline-block;">
              <div style="background:${barColor};height:100%;width:${Math.min(100, Math.max(0, pct))}%;"></div>
            </div>
            <strong style="color:${pct > 100 ? '#dc2626' : 'inherit'};">${num(pct, 1)}%</strong>
          </div>
        </td>
        <td class="num" style="font-weight:800;color:${saldoColor};">${brl(saldo)}</td>
        <td class="num">${brl(fat)}</td>
        <td class="num"><span class="badge badge-neutral" style="font-size:11px;">${num(cvPct, 1)}%</span></td>
        <td class="num" style="color:#dc2626;">${brl(naoOtim)}</td>
        <td class="num" style="font-weight:700;color:#7c3aed;">${num(iec, 1)}%</td>
        <td style="text-align:center;">
          <button class="btn btn-secondary btn-sm btn-select-budget-store" data-filial="${f.filial_id}" style="padding:3px 8px;font-size:11px;" title="Ver detalhes de OTB desta filial">
            ${isSelected ? '✓ Selecionada' : '🔍 Ver Loja'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-select-budget-store').forEach(btn => {
    btn.addEventListener('click', () => {
      const fId = btn.dataset.filial;
      state.selectedFilial = String(fId);
      renderMultilojaBar();
      renderKpiStrip(state.selectedFilial);
      loadBudget();
    });
  });
}

async function updateCockpitBudgetPillForFilial(filialId = 'all') {
  try {
    const fIdParam = filialId && filialId !== 'all' ? `?filial_id=${filialId}` : '';
    const res = await apiGet(`/api/budget/overview${fIdParam}`);
    const d = res.data || res.budget || res;
    updateCockpitBudgetPill(d);
  } catch (err) {
    console.warn('Erro ao atualizar pílula de saldo OTB:', err);
  }
}

function updateCockpitBudgetPill(d) {
  const pill = document.getElementById('btn-otb-cockpit-pill');
  if (!pill) return;
  if (!d) {
    pill.textContent = '📊 Dotação OTB: Carregando...';
    return;
  }
  const dotacao = Number(d.dotacao_ajustada || 0);
  const consumido = Number(d.consumido_compras_rs || d.consumido_total || 0);
  const saldo = Math.max(0, dotacao - consumido);
  const pct = dotacao > 0 ? (consumido / dotacao) * 100 : 0;
  const color = saldo >= 0 ? '#1e40af' : '#991b1b';
  const bg = saldo >= 0 ? '#eff6ff' : '#fef2f2';
  const border = saldo >= 0 ? '#bfdbfe' : '#fecaca';

  pill.style.background = bg;
  pill.style.color = color;
  pill.style.borderColor = border;
  pill.innerHTML = `📊 Saldo OTB: <strong>${brl(saldo)}</strong> (${num(pct, 1)}% consumido)`;
}

function goToCockpitWithDimension(dim) {
  switchView('cockpit');

  const selMacro = document.getElementById('filter-macro');
  const inpQ = document.getElementById('filter-q');

  if (dim === 'Éticos') {
    if (selMacro) { selMacro.value = 'MEDICAMENTO'; state.macro = 'MEDICAMENTO'; }
    if (inpQ) { inpQ.value = ''; state.q = ''; }
  } else if (dim === 'Genéricos') {
    if (selMacro) { selMacro.value = 'MEDICAMENTO'; state.macro = 'MEDICAMENTO'; }
    if (inpQ) { inpQ.value = 'GENERICO'; state.q = 'GENERICO'; }
  } else if (dim === 'Perfumaria') {
    if (selMacro) { selMacro.value = 'PERFUMARIA_HPC'; state.macro = 'PERFUMARIA_HPC'; }
    if (inpQ) { inpQ.value = ''; state.q = ''; }
  } else if (dim === 'Similares') {
    if (selMacro) { selMacro.value = 'MEDICAMENTO'; state.macro = 'MEDICAMENTO'; }
    if (inpQ) { inpQ.value = 'SIMILAR'; state.q = 'SIMILAR'; }
  } else if (dim === 'Não-Medicamentos') {
    document.querySelectorAll('#sku-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'non_med'));
    state.tab = 'non_med';
    if (selMacro) { selMacro.value = ''; state.macro = ''; }
    if (inpQ) { inpQ.value = ''; state.q = ''; }
  }

  loadSkus();
}

function renderUnoptimizedTable(products) {
  const tbody = document.getElementById('otb-unoptimized-tbody');
  const badge = document.getElementById('unoptimized-count-badge');
  if (badge) badge.textContent = `${products.length} SKUs`;
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:20px;">✓ Nenhuma compra não otimizada detectada nas entradas do mês!</td></tr>';
    return;
  }

  tbody.innerHTML = products.slice(0, 100).map(p => {
    const isExcesso = p.classificacao === 'Excesso';
    const classBadge = isExcesso 
      ? '<span class="badge" style="background:#ffedd5;color:#c2410c;font-weight:700;">⚠️ Excesso</span>'
      : '<span class="badge" style="background:#fee2e2;color:#dc2626;font-weight:700;">🛑 Sem Demanda</span>';

    return `
      <tr>
        <td style="font-weight:600;">${esc(p.loja)}</td>
        <td style="font-family:monospace;font-size:11px;">${esc(p.cod_barras)}</td>
        <td class="num" style="font-family:monospace;">${p.cod_interno}</td>
        <td style="font-weight:600;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(p.produto)}">${esc(p.produto)}</td>
        <td class="num" style="font-weight:700;">${num(p.entrada)}</td>
        <td class="num">${num(p.saida)}</td>
        <td class="num">${num(p.limite_excesso)}</td>
        <td class="num"><span class="badge badge-neutral" style="font-size:11px;">${num(p.evolucao_pct)}%</span></td>
        <td class="num" style="font-weight:800;color:#dc2626;">${brl(p.compras_nao_otimizadas_rs)}</td>
        <td style="text-align:center;">${classBadge}</td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// OPERAÇÃO LOGÍSTICA (OL) & IA CONSULTORA DE PEDIDOS MÍNIMOS
// ========================================================

async function loadOlsView() {
  const tbody = document.getElementById('ol-master-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px;">🔄 Carregando panorama de Operações Logísticas e indústrias...</td></tr>';
  }

  try {
    const fParam = state.selectedFilial && state.selectedFilial !== 'all' ? `?filial_id=${state.selectedFilial}` : '';
    const res = await apiGet(`/api/ol/dashboard${fParam}`);
    if (!res || !res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#ef4444;padding:24px;">Erro ao carregar OLs: ${res?.error || 'Falha'}</td></tr>`;
      return;
    }

    const { items, kpis } = res;
    state.olItems = items || [];

    // Preenche KPIs
    const elAtivos = document.getElementById('ol-kpi-total-ativos');
    if (elAtivos) elAtivos.textContent = `${kpis.totalAtivos || 0} Indústrias`;
    const elProntos = document.getElementById('ol-kpi-prontos');
    if (elProntos) elProntos.textContent = `${kpis.prontos || 0} Prontos`;
    const elComp = document.getElementById('ol-kpi-complementaveis');
    if (elComp) elComp.textContent = `${kpis.complementaveis || 0} Oportunidades`;
    const elEco = document.getElementById('ol-kpi-economia');
    if (elEco) elEco.textContent = brl(kpis.economiaTotalEstimada || 0);

    renderOlTable(state.olItems);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#ef4444;padding:24px;">Erro: ${err.message}</td></tr>`;
  }
}

function renderOlTable(items) {
  const tbody = document.getElementById('ol-master-tbody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px;">Nenhum fornecedor OL cadastrado. Clique em "Cadastrar Fornecedor" para começar.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(ol => {
    let statusBadge = '';
    if (ol.status === 'MINIMO_ATINGIDO') {
      statusBadge = '<span class="badge badge-success" style="font-weight:700;">🟢 Mínimo Atingido (Pronto para OL)</span>';
    } else if (ol.status === 'COMPLEMENTAVEL') {
      statusBadge = `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:700;">🟡 Faltam ${brl(ol.faltam_rs)} (IA Sugere Complementar)</span>`;
    } else {
      statusBadge = '<span class="badge badge-neutral" style="color:#64748b;">⏳ Sem Demanda no Momento</span>';
    }

    return `
      <tr>
        <td style="font-weight:700;color:var(--text-primary);font-size:13px;">${esc(ol.fabricante)}</td>
        <td><span class="badge badge-neutral" style="font-size:11px;">${esc(ol.categoria || ol.tipo_canal)}</span></td>
        <td class="num" style="font-weight:700;">${brl(ol.pedido_minimo_rs)}</td>
        <td class="num"><span class="badge badge-success" style="font-size:11px;">+${num(ol.desconto_extra_pct)}%</span></td>
        <td>${esc(ol.prazo_medio_dias ? ol.prazo_medio_dias + ' d' : '30/60/90 d')}</td>
        <td class="num">${num(ol.lead_time_dias || 7)} d</td>
        <td class="num" style="font-weight:800;font-size:13px;color:${ol.total_sugerido_rs >= ol.pedido_minimo_rs ? '#059669' : '#1e40af'};">
          ${brl(ol.total_sugerido_rs)}
        </td>
        <td class="num">${num(ol.skus_comprar)}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;white-space:nowrap;">
          <div style="display:inline-flex;gap:4px;">
            <button class="btn btn-primary btn-xs btn-buy-ol-cockpit" data-fab="${esc(ol.fabricante)}" title="Comprar este fabricante na Mesa com auxílio do Consultor IA" style="background:#0f766e;border-color:#0f766e;font-weight:600;padding:4px 8px;">
              🛒 Mesa
            </button>
            <button class="btn btn-secondary btn-xs btn-edit-ol-rule" data-id="${ol.id}" data-fab="${esc(ol.fabricante)}" data-min="${ol.pedido_minimo_rs}" data-desc="${ol.desconto_extra_pct}" data-prazo="${ol.prazo_medio_dias}" data-lead="${ol.lead_time_dias}" data-cat="${esc(ol.categoria)}" title="Editar parâmetros comerciais desta OL" style="padding:4px 6px;">
              ⚙️
            </button>
            <button class="btn btn-secondary btn-xs btn-export-ol-excel" data-fab="${esc(ol.fabricante)}" title="Baixar pedido OL formatado em Excel para o Representante Comercial" style="padding:4px 6px;">
              📊
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Eventos nos botões da tabela OL
  tbody.querySelectorAll('.btn-buy-ol-cockpit').forEach(btn => {
    btn.addEventListener('click', () => {
      const fab = btn.dataset.fab;
      goToCockpitWithManufacturer(fab);
    });
  });

  tbody.querySelectorAll('.btn-edit-ol-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      openModalOlSupplier({
        fabricante: btn.dataset.fab,
        minimo: btn.dataset.min,
        desconto: btn.dataset.desc,
        prazo: btn.dataset.prazo,
        leadTime: btn.dataset.lead,
        categoria: btn.dataset.cat
      });
    });
  });

  tbody.querySelectorAll('.btn-export-ol-excel').forEach(btn => {
    btn.addEventListener('click', () => {
      const fab = btn.dataset.fab;
      exportOlDirectFromDashboard(fab);
    });
  });
}

function goToCockpitWithManufacturer(fab) {
  // 1. Alterna para a visão Cockpit
  switchView('cockpit');

  // 2. Garante que vai para a aba de Sugestão de Compra
  switchSkuTab('buy');

  // 3. Define o laboratório no state com o nome da indústria
  const cleanFab = (fab || '').trim();
  state.labora = cleanFab;
  state.search = '';
  state.page = 1;
  state.offset = 0;

  // 4. Atualiza o dropdown filter-labora
  const selLab = document.getElementById('filter-labora');
  if (selLab) {
    let opt = Array.from(selLab.options).find(o => o.value.trim().toUpperCase() === cleanFab.toUpperCase());
    if (!opt && cleanFab) {
      opt = new Option(cleanFab, cleanFab);
      selLab.add(opt);
    }
    selLab.value = opt ? opt.value : cleanFab;
  }

  // 5. Limpa campo de busca para não restringir indevidamente
  const inpSearch = document.getElementById('filter-search');
  if (inpSearch) inpSearch.value = '';

  // 6. Sincroniza chips rápidos e carrega os SKUs do fabricante
  syncQuickLaboraChips();
  loadSkus();

  // 7. Notifica o comprador com mensagem clara
  showBanner(`Filtrando produtos sugeridos da indústria ${cleanFab} para análise de pedido direto / OL.`);
}

function openModalOlSupplier(data = null) {
  const modal = document.getElementById('modal-ol-supplier');
  if (!modal) return;
  const title = document.getElementById('modal-ol-title');
  const inpFab = document.getElementById('inp-ol-fabricante');
  const selCanal = document.getElementById('sel-ol-canal');
  const inpMin = document.getElementById('inp-ol-minimo');
  const inpDesc = document.getElementById('inp-ol-desconto');
  const inpPrazo = document.getElementById('inp-ol-prazo');
  const inpLead = document.getElementById('inp-ol-leadtime');
  const selStatus = document.getElementById('sel-ol-status');

  if (data) {
    if (title) title.textContent = `⚙️ Editar Política OL • ${data.fabricante}`;
    if (inpFab) { inpFab.value = data.fabricante; inpFab.readOnly = true; }
    if (inpMin) inpMin.value = data.minimo || 3000;
    if (inpDesc) inpDesc.value = data.desconto || 10;
    if (inpPrazo) inpPrazo.value = data.prazo || '45';
    if (inpLead) inpLead.value = data.leadTime || 7;
    if (selCanal && data.categoria) selCanal.value = data.categoria;
    if (selStatus) selStatus.value = '1';
  } else {
    if (title) title.textContent = '➕ Cadastrar Fornecedor / Fabricante OL';
    if (inpFab) { inpFab.value = ''; inpFab.readOnly = false; }
    if (inpMin) inpMin.value = '3000.00';
    if (inpDesc) inpDesc.value = '10.0';
    if (inpPrazo) inpPrazo.value = '45';
    if (inpLead) inpLead.value = '7';
    if (selStatus) selStatus.value = '1';
  }

  modal.classList.remove('hidden');
}

function closeModalOlSupplier() {
  const modal = document.getElementById('modal-ol-supplier');
  if (modal) modal.classList.add('hidden');
}

async function saveModalOlSupplier(e) {
  e.preventDefault();
  const inpFab = document.getElementById('inp-ol-fabricante');
  const selCanal = document.getElementById('sel-ol-canal');
  const inpMin = document.getElementById('inp-ol-minimo');
  const inpDesc = document.getElementById('inp-ol-desconto');
  const inpPrazo = document.getElementById('inp-ol-prazo');
  const inpLead = document.getElementById('inp-ol-leadtime');
  const selStatus = document.getElementById('sel-ol-status');

  const fab = (inpFab?.value || '').trim().toUpperCase();
  if (!fab) {
    showBanner('Informe o nome do fabricante / indústria.', true);
    return;
  }

  const payload = {
    fabricante_nome: fab,
    tipo_canal: 'OL',
    observacao: selCanal?.value || 'Medicamentos & Mix Farma',
    pedido_minimo_rs: parseFloat(inpMin?.value || '3000'),
    desconto_extra_pct: parseFloat(inpDesc?.value || '10'),
    prazo_medio_dias: parseInt(inpPrazo?.value || '45', 10),
    lead_time_dias: parseInt(inpLead?.value || '7', 10),
    ativo: selStatus?.value === '1'
  };

  try {
    const res = await apiPost('/api/ol/fabricante', payload);
    if (res && res.ok) {
      showBanner(`✓ Política comercial de OL para ${fab} salva com sucesso!`);
      closeModalOlSupplier();
      loadOlsView();
    } else {
      showBanner(`Erro ao salvar OL: ${res?.error || 'Falha'}`, true);
    }
  } catch (err) {
    showBanner(`Erro ao salvar: ${err.message}`, true);
  }
}

async function exportOlDirectFromDashboard(fab) {
  try {
    showBanner(`Gerando pedido em Excel para ${fab}...`);
    // Busca oportunidade para montar lista
    const opp = await apiGet(`/api/ol/opportunity?fabricante=${encodeURIComponent(fab)}`);
    const items = opp?.itensComplemento || [];

    const res = await fetch('/api/ol/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricante: fab,
        items,
        observacoes: 'Pedido gerado diretamente pela Central de Operações Logísticas (OL) da Mesa de Compras IA.'
      })
    });

    if (!res.ok) throw new Error('Falha ao gerar arquivo Excel de OL');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pedido_OL_${fab.replace(/[^A-Za-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showBanner(`✓ Planilha de Pedido OL (${fab}) baixada com sucesso!`);

    if (items && items.length > 0 && window.confirm(`Deseja abater os ${items.length} itens deste pedido direto de fábrica (OL ${fab}) da esteira de cotação com distribuidores para evitar duplicidade?`)) {
      try {
        await apiPost('/api/ol/mark-ordered', {
          fabricante: fab,
          items: items.map(it => ({ produto_id: it.produto_id, filial_id: it.filial_id || 0, quantidade: it.quantidade || it.sugestao_compra_un }))
        });
        showBanner(`✓ ${items.length} itens marcados como Pedido OL emitido. Demanda abatida da cotação externa!`);
        if (state.view === 'cockpit') await loadSkus();
      } catch (e) {
        console.warn('Erro ao abater itens OL:', e);
      }
    }
  } catch (err) {
    showBanner(`Erro ao exportar pedido OL: ${err.message}`, true);
  }
}

let currentOlAnalysis = null;

async function checkOlOpportunityForManufacturer(lab) {
  const card = document.getElementById('ol-consultant-card');
  if (!card) return;

  const cleanLab = String(lab || '').trim();
  if (!cleanLab) {
    card.classList.add('hidden');
    currentOlAnalysis = null;
    return;
  }

  try {
    const res = await apiGet(`/api/ol/opportunity?fabricante=${encodeURIComponent(cleanLab)}`);
    if (!res || !res.hasOl) {
      card.classList.add('hidden');
      currentOlAnalysis = null;
      return;
    }

    currentOlAnalysis = res;
    card.classList.remove('hidden');

    const titleEl = document.getElementById('ol-card-title');
    const badgeEl = document.getElementById('ol-card-badge');
    const discEl = document.getElementById('ol-card-discount-badge');
    const recEl = document.getElementById('ol-card-rec');
    const btnComp = document.getElementById('btn-ol-apply-complement');

    if (titleEl) {
      titleEl.textContent = `Operação Logística (OL): ${res.olConfig.fabricante_nome} • Pedido Mínimo ${brl(res.pedidoMinimoRs)}`;
    }
    if (badgeEl) {
      badgeEl.textContent = res.atingiuMinimo ? '✓ Mínimo Atingido' : '⚡ Oportunidade OL';
      badgeEl.style.background = res.atingiuMinimo ? '#d1fae5' : '#fef3c7';
      badgeEl.style.color = res.atingiuMinimo ? '#065f46' : '#92400e';
    }
    if (discEl) {
      discEl.textContent = `+${res.olConfig.desconto_extra_pct}% Desconto vs Distribuidora`;
    }
    if (recEl) {
      recEl.innerHTML = esc(res.recomendacaoIa);
    }

    if (btnComp) {
      if (!res.atingiuMinimo && res.itensComplemento && res.itensComplemento.length > 0) {
        btnComp.style.display = 'inline-flex';
        btnComp.textContent = `🤖 Complementar Pedido Mínimo Cirurgicamente (+${res.itensComplemento.length} SKUs Curva A/B)`;
      } else {
        btnComp.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('[OL] Erro ao consultar oportunidade:', err.message);
    card.classList.add('hidden');
  }
}

function applyOlComplement() {
  if (!currentOlAnalysis || !Array.isArray(currentOlAnalysis.itensComplemento) || currentOlAnalysis.itensComplemento.length === 0) {
    showBanner('Nenhum item de complemento disponível para esta OL.', true);
    return;
  }

  let addedCount = 0;
  for (const item of currentOlAnalysis.itensComplemento) {
    const key = `${item.filial_id}|${item.produto_id}`;
    const totalQty = Number(item.unidades_total_ol || (item.unidades_original + item.unidades_complemento));
    const totalRs = Number(item.valor_total_ol_rs || (totalQty * item.custo_unit));

    state.selectedSkus.set(key, {
      rs: totalRs,
      desc: item.descricao,
      qtd: totalQty,
      complemento: item.unidades_complemento,
      isOlComplement: true
    });
    addedCount++;
  }

  updateSelectionUi();
  renderSkuTable(state.visibleSkus);

  showBanner(`✓ Sucesso! ${addedCount} produtos de alta liquidez complementados cirurgicamente. Pedido Mínimo de ${brl(currentOlAnalysis.pedidoMinimoRs)} atingido sem gerar excesso de estoque!`);

  const btnComp = document.getElementById('btn-ol-apply-complement');
  if (btnComp) btnComp.style.display = 'none';

  const badgeEl = document.getElementById('ol-card-badge');
  if (badgeEl) {
    badgeEl.textContent = '✓ Mínimo Atingido (Completado por IA)';
    badgeEl.style.background = '#d1fae5';
    badgeEl.style.color = '#065f46';
  }
  const recEl = document.getElementById('ol-card-rec');
  if (recEl) {
    recEl.innerHTML = `✓ Pedido Mínimo da OL atingido com sucesso! Total do Pedido: <strong>${brl(currentOlAnalysis.totalFinalOlRs)}</strong> (+${currentOlAnalysis.olConfig.desconto_extra_pct}% margem adicional). Pronto para exportar e enviar ao representante!`;
  }
}

async function exportOlOrderExcel() {
  if (!currentOlAnalysis) {
    showBanner('Selecione primeiro um fabricante com Operação Logística (OL) para exportar.', true);
    return;
  }

  const fab = currentOlAnalysis.olConfig.fabricante_nome;
  showBanner(`Gerando planilha oficial de Pedido OL para o fabricante ${fab}...`);

  try {
    const itemsToExport = [];
    if (state.selectedSkus.size > 0) {
      for (const [key, val] of state.selectedSkus.entries()) {
        const [filialId, prodId] = key.split('|');
        const skuObj = state.visibleSkus.find(s => String(s.produto_id) === String(prodId) && String(s.filial_id) === String(filialId));
        itemsToExport.push({
          produto_id: prodId,
          descricao: val.desc || skuObj?.descricao || 'PRODUTO',
          barras: skuObj?.barras || '',
          quantidade: val.qtd || 1,
          custo_unit: skuObj?.custo_unit || (val.rs / (val.qtd || 1))
        });
      }
    } else {
      for (const s of state.visibleSkus) {
        if (Number(s.sugestao_compra_un) > 0) {
          itemsToExport.push({
            produto_id: s.produto_id,
            descricao: s.descricao,
            barras: s.barras,
            quantidade: s.sugestao_compra_un,
            custo_unit: s.custo_unit
          });
        }
      }
    }

    if (itemsToExport.length === 0) {
      showBanner('Nenhum item com quantidade para exportar neste pedido OL.', true);
      return;
    }

    const res = await fetch('/api/ol/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricante: fab,
        items: itemsToExport,
        observacoes: `Pedido gerado pela Mesa de Compras IA - FSConsultoria. Condição Comercial OL (+${currentOlAnalysis.olConfig.desconto_extra_pct}% desconto).`
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Falha ao gerar planilha OL.');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PEDIDO_OL_${fab}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showBanner(`✓ Planilha do Pedido OL baixada com sucesso: PEDIDO_OL_${fab}.xlsx! Envie ao representante comercial.`);

    if (itemsToExport.length > 0 && window.confirm(`Deseja abater os ${itemsToExport.length} itens deste pedido direto de fábrica (OL ${fab}) da esteira de cotação com distribuidores para evitar duplicidade?`)) {
      try {
        await apiPost('/api/ol/mark-ordered', {
          fabricante: fab,
          items: itemsToExport.map(it => ({ produto_id: it.produto_id, filial_id: it.filial_id || 0, quantidade: it.quantidade }))
        });
        showBanner(`✓ ${itemsToExport.length} itens marcados como Pedido OL emitido. Demanda abatida da cotação externa!`);
        if (state.view === 'cockpit') await loadSkus();
      } catch (e) {
        console.warn('Erro ao abater itens OL:', e);
      }
    }
  } catch (err) {
    showBanner(`Erro ao exportar pedido OL: ${err.message}`, true);
  }
}

async function refreshActiveView() {
  try {
    if (state.view === 'cockpit') await loadSkus();
    else if (state.view === 'budget') await loadBudget();
    else if (state.view === 'ols') await loadOlsView();
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
  const gateCloseBtn = document.getElementById('btn-close-welcome-gate');
  const gateWaBtn = document.getElementById('gate-btn-whatsapp');

  if (!lic) return;

  const isExpired = Boolean(lic.isExpired || !lic.isValid || (lic.daysRemaining !== undefined && lic.daysRemaining <= 0));
  const days = lic.daysRemaining !== undefined ? lic.daysRemaining : 0;
  const validUntilFmt = lic.validUntil ? lic.validUntil.split('-').reverse().join('/') : '--/--/----';
  const machId = lic.currentMachineId || lic.machineId || 'LNX-MAQUINA';
  const rawCnpj = String(lic.cnpj || '').replace(/\D/g, '');

  if (gateMach) gateMach.textContent = machId;
  if (gateClient && lic.clientName) gateClient.textContent = lic.clientName;
  if (gateCnpj && lic.cnpj) {
    gateCnpj.textContent = rawCnpj.length === 14
      ? `CNPJ: ${rawCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`
      : `CNPJ: ${rawCnpj}`;
  }

  // Link do WhatsApp com mensagem contextual para suporte ou negociação de chaves
  if (gateWaBtn) {
    const waText = isExpired
      ? `Olá FSConsultoria! Meu sistema Mesa de Compras IA está bloqueado. CNPJ: ${rawCnpj}, Máquina: ${machId}. Gostaria de negociar os valores das chaves para liberação imediata.`
      : `Olá FSConsultoria! Gostaria de tirar dúvidas ou negociar renovação da Mesa de Compras IA (CNPJ: ${rawCnpj}, Máquina: ${machId}).`;
    gateWaBtn.href = `https://wa.me/5517981205660?text=${encodeURIComponent(waText)}`;
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
      gateSub.textContent = `Venceu em ${validUntilFmt}. Insira uma chave de licença válida ou fale com a FSConsultoria no WhatsApp para desbloquear.`;
      gateSub.style.color = '#7f1d1d';
      if (gateBadge) {
        gateBadge.className = 'badge badge-danger';
        gateBadge.textContent = 'EXPIRADO';
      }
      if (gateCloseBtn) {
        gateCloseBtn.style.display = 'none'; // Não permite fechar no [X] se expirado
      }
      const btnEnter = document.getElementById('btn-enter-cockpit');
      if (btnEnter) {
        btnEnter.disabled = true;
        btnEnter.style.opacity = '0.5';
        btnEnter.style.cursor = 'not-allowed';
        btnEnter.title = 'Acesso bloqueado: Ative sua chave mensal acima para liberar o sistema';
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
      if (gateCloseBtn) {
        gateCloseBtn.style.display = '';
      }
      const btnEnter = document.getElementById('btn-enter-cockpit');
      if (btnEnter) {
        btnEnter.disabled = false;
        btnEnter.style.opacity = '1';
        btnEnter.style.cursor = 'pointer';
        btnEnter.title = '';
      }
    }
  }
}

async function openWelcomeGate(forceBlocking = false) {
  const modal = document.getElementById('modal-welcome-gate');
  const closeBtn = document.getElementById('btn-close-welcome-gate');
  if (!modal) return;

  const isExp = isLicenseExpired();
  const isStrictBlock = forceBlocking || isExp;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  if (closeBtn) {
    closeBtn.style.display = isStrictBlock ? 'none' : '';
  }

  if (state.licenseStatus) {
    updateLicenseBadge(state.licenseStatus);
  }

  try {
    const res = await apiGet('/api/license/status');
    if (res && res.ok) {
      state.licenseStatus = res;
      updateLicenseBadge(res);
      const updatedExp = isLicenseExpired();
      if (closeBtn) closeBtn.style.display = (forceBlocking || updatedExp) ? 'none' : '';
    }
  } catch {}
}

function closeWelcomeGate() {
  if (isLicenseExpired()) {
    showBanner('🚨 Acesso Bloqueado! O sistema só é liberado após a inserção e ativação de uma chave mensal válida.', true);
    return;
  }
  sessionStorage.setItem('big_welcome_seen', 'true');
  sessionStorage.removeItem('big_welcome_open_manual');
  const modal = document.getElementById('modal-welcome-gate');
  if (modal) modal.classList.add('hidden');
  syncBodyModalState();
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
      feedback.textContent = 'Por favor, digite ou cole a chave de licença fornecida.';
      feedback.style.color = '#dc2626';
      feedback.style.background = '#fee2e2';
      feedback.style.display = 'block';
    }
    return;
  }

  try {
    if (feedback) {
      feedback.textContent = 'Validando chave e blindagem de hardware...';
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

      // Atualiza o status da licença imediatamente
      const licRes = await apiGet('/api/license/status');
      if (licRes && licRes.ok) {
        state.licenseStatus = licRes;
        updateLicenseBadge(licRes);
      }

      if (input) input.value = '';

      // Fecha o modal de bloqueio imediatamente com feedback instantâneo ao usuário
      const modal = document.getElementById('modal-welcome-gate');
      if (modal) modal.classList.add('hidden');
      syncBodyModalState();

      if (state.view === 'home' || !state.view) {
        renderHomeScreen();
      }

      showBanner('✓ Licença ativada com sucesso! Acesso 100% liberado à Mesa de Compras IA.');
      // Executa o carregamento em background sem travar o fechamento do modal
      loadOverview().catch((e) => console.warn('Erro ao atualizar overview pós-ativação:', e));
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

// =========================================================================
// GESTÃO DE ATUALIZAÇÃO AUTOMÁTICA DO SISTEMA
// =========================================================================
async function checkSystemUpdates(manual = true) {
  const modal = document.getElementById('update-modal');
  const box = document.getElementById('update-modal-status-box');
  const notes = document.getElementById('update-modal-notes');
  const btnApply = document.getElementById('btn-apply-update');
  const currVerEl = document.getElementById('update-modal-curr-ver');

  if (modal) modal.classList.remove('hidden');
  if (box) {
    box.style.background = '#eff6ff';
    box.style.border = '1px solid #bfdbfe';
    box.style.color = '#1e40af';
    box.innerHTML = '🔍 Conectando à nuvem oficial no GitHub para verificar novas versões...';
  }
  if (notes) notes.style.display = 'none';
  if (btnApply) btnApply.style.display = 'none';

  try {
    const res = await fetch('/api/system/check-update');
    if (!res.ok) {
      throw new Error(`Serviço temporariamente indisponível (HTTP ${res.status}). Aguarde o servidor reiniciar.`);
    }
    const data = await res.json();
    if (currVerEl) currVerEl.textContent = `Versão atual instalada: v${data.currentVersion}`;

    if (data.hasUpdate) {
      if (box) {
        box.style.background = '#f0fdf4';
        box.style.border = '1px solid #bbf7d0';
        box.style.color = '#166534';
        box.innerHTML = `🎉 <strong>Nova versão disponível: ${data.latestVersion}</strong><br><span style="font-size:12px;">Uma versão mais recente foi publicada com melhorias no motor e na estabilidade.</span>`;
      }
      if (notes && data.notes) {
        notes.style.display = 'block';
        notes.innerHTML = `<strong>Notas da Versão:</strong><br>${data.notes.replace(/\n/g, '<br>')}`;
      }
      if (btnApply) {
        btnApply.style.display = 'inline-block';
        btnApply.onclick = applySystemUpdate;
      }
    } else {
      if (box) {
        box.style.background = '#f0fdf4';
        box.style.border = '1px solid #bbf7d0';
        box.style.color = '#166534';
        box.innerHTML = `✓ <strong>Seu sistema já está 100% atualizado!</strong><br><span style="font-size:12px;">Você está utilizando a versão oficial mais recente (${data.currentVersion}).</span>`;
      }
    }
  } catch (err) {
    if (box) {
      box.style.background = '#fef2f2';
      box.style.border = '1px solid #fecaca';
      box.style.color = '#991b1b';
      box.innerHTML = `⚠️ <strong>Falha ao verificar atualizações:</strong> ${err.message}`;
    }
  }
}

async function applySystemUpdate() {
  const btnApply = document.getElementById('btn-apply-update');
  const box = document.getElementById('update-modal-status-box');
  if (btnApply) {
    btnApply.disabled = true;
    btnApply.textContent = '⏳ Baixando e atualizando...';
  }
  if (box) {
    box.style.background = '#fffbeb';
    box.style.border = '1px solid #fef3c7';
    box.style.color = '#92400e';
    box.innerHTML = `🔄 <strong>Atualização em andamento!</strong><br>Baixando e aplicando a versão mais recente diretamente da nuvem...<br><strong>Aguarde ~10 segundos... o sistema reiniciará automaticamente.</strong>`;
  }

  try {
    const res = await fetch('/api/system/apply-update', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || 'Falha ao aplicar atualização');
    }
    if (box) {
      box.style.background = '#f0fdf4';
      box.style.border = '1px solid #86efac';
      box.style.color = '#166534';
      box.innerHTML = `✅ <strong>Arquivos atualizados com sucesso!</strong><br>Reiniciando serviço da Mesa de Compras IA...<br>Recarregando página...`;
    }
    setTimeout(() => {
      const pollTimer = setInterval(() => {
        fetch('/api/license/status').then(r => {
          if (r.ok) {
            clearInterval(pollTimer);
            window.location.reload();
          }
        }).catch(() => {});
      }, 1500);
    }, 2500);
  } catch (err) {
    if (btnApply) {
      btnApply.disabled = false;
      btnApply.textContent = '⚡ Tentar Novamente';
    }
    if (box) {
      box.style.background = '#fef2f2';
      box.style.border = '1px solid #fecaca';
      box.style.color = '#991b1b';
      box.innerHTML = `Erro ao acionar atualizador: ${err.message}`;
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

  // BIND: DOTAÇÃO ORÇAMENTÁRIA & OPEN-TO-BUY (GOVERNANÇA)
  const btnRefreshBudget = document.getElementById('btn-refresh-budget');
  if (btnRefreshBudget) {
    btnRefreshBudget.addEventListener('click', () => loadBudget(true));
  }
  const btnGotoCockpit = document.getElementById('btn-goto-cockpit-from-budget');
  if (btnGotoCockpit) {
    btnGotoCockpit.addEventListener('click', () => switchView('cockpit'));
  }
  const btnGotoTransfers = document.getElementById('btn-goto-transfers-from-budget');
  if (btnGotoTransfers) {
    btnGotoTransfers.addEventListener('click', () => switchView('transfers'));
  }
  const btnOtbPill = document.getElementById('btn-otb-cockpit-pill');
  if (btnOtbPill) {
    btnOtbPill.addEventListener('click', () => switchView('budget'));
  }
  const inpUnoptFilter = document.getElementById('otb-unoptimized-filter');
  if (inpUnoptFilter) {
    inpUnoptFilter.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      if (!state.unoptimizedProducts) return;
      if (!q) {
        renderUnoptimizedTable(state.unoptimizedProducts);
      } else {
        const filtered = state.unoptimizedProducts.filter(p => 
          (p.produto || '').toLowerCase().includes(q) ||
          (p.cod_barras || '').toLowerCase().includes(q) ||
          (p.loja || '').toLowerCase().includes(q)
        );
        renderUnoptimizedTable(filtered);
      }
    });
  }

  // BIND: CENTRAL DE OPERAÇÕES LOGÍSTICAS (OL) DEDICADA
  const btnOpenAddOl = document.getElementById('btn-open-modal-add-ol');
  if (btnOpenAddOl) {
    btnOpenAddOl.addEventListener('click', () => openModalOlSupplier());
  }
  const btnCloseModalOl = document.getElementById('btn-close-modal-ol');
  if (btnCloseModalOl) {
    btnCloseModalOl.addEventListener('click', closeModalOlSupplier);
  }
  const btnCancelModalOl = document.getElementById('btn-cancel-modal-ol');
  if (btnCancelModalOl) {
    btnCancelModalOl.addEventListener('click', closeModalOlSupplier);
  }
  const formOl = document.getElementById('form-ol-supplier');
  if (formOl) {
    formOl.addEventListener('submit', saveModalOlSupplier);
  }
  const btnRefreshOls = document.getElementById('btn-refresh-ols');
  if (btnRefreshOls) {
    btnRefreshOls.addEventListener('click', loadOlsView);
  }
  const inpOlFilter = document.getElementById('ol-table-filter');
  if (inpOlFilter) {
    inpOlFilter.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      if (!state.olItems) return;
      if (!q) {
        renderOlTable(state.olItems);
      } else {
        const filtered = state.olItems.filter(o =>
          (o.fabricante || '').toLowerCase().includes(q) ||
          (o.categoria || '').toLowerCase().includes(q)
        );
        renderOlTable(filtered);
      }
    });
  }

  // BIND: CONSULTOR IA DE OL (COMPLEMENTAÇÃO CIRÚRGICA & EXPORTAÇÃO EXCEL)
  const btnOlComp = document.getElementById('btn-ol-apply-complement');
  if (btnOlComp) {
    btnOlComp.addEventListener('click', applyOlComplement);
  }
  const btnOlExp = document.getElementById('btn-ol-export-excel');
  if (btnOlExp) {
    btnOlExp.addEventListener('click', exportOlOrderExcel);
  }

  // BIND: HORIZONTE DE COBERTURA (BOTÕES RÁPIDOS & SIMULADOR LIVRE [ X ] DIAS)
  document.querySelectorAll('.btn-horizon').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-horizon').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const customInp = document.getElementById('input-custom-horizon');
      if (customInp) customInp.value = '';
      const days = btn.dataset.days;
      state.coverageHorizonDays = days === 'padrao' ? null : Number(days);
      state.offset = 0;
      state.page = 1;
      loadSkus();
    });
  });

  const applyCustomHorizon = () => {
    const customInp = document.getElementById('input-custom-horizon');
    if (!customInp) return;
    const val = parseInt(customInp.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 180) {
      document.querySelectorAll('.btn-horizon').forEach((b) => b.classList.remove('active'));
      state.coverageHorizonDays = val;
      state.offset = 0;
      state.page = 1;
      showBanner(`Horizonte de cobertura simulado: ${val} dias.`);
      loadSkus();
    } else {
      showBanner('Por favor, informe um número de dias válido entre 1 e 180.', true);
    }
  };

  const btnApplyCustomHorizon = document.getElementById('btn-apply-custom-horizon');
  if (btnApplyCustomHorizon) {
    btnApplyCustomHorizon.addEventListener('click', applyCustomHorizon);
  }
  const inputCustomHorizon = document.getElementById('input-custom-horizon');
  if (inputCustomHorizon) {
    inputCustomHorizon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomHorizon();
      }
    });
  }

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

  // Botões de Verificação de Atualização Automática
  document.getElementById('btn-check-updates')?.addEventListener('click', () => checkSystemUpdates(true));
  document.getElementById('btn-close-update-modal')?.addEventListener('click', () => {
    document.getElementById('update-modal')?.classList.add('hidden');
    syncBodyModalState();
  });
  document.getElementById('btn-cancel-update')?.addEventListener('click', () => {
    document.getElementById('update-modal')?.classList.add('hidden');
    syncBodyModalState();
  });

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
        if (backdrop.id === 'modal-welcome-gate' && isLicenseExpired()) {
          return; // Apenas a janela sobreposta deve permanecer até a ativação da chave!
        }
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

  // 1. Tenta restaurar cache local de lojas/políticas para que a barra de filiais apareça INSTANTANEAMENTE no Frame 0
  try {
    const rawLocal = localStorage.getItem('linx_farma_multiloja_cache');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && Array.isArray(parsed.filiaisPolicies) && parsed.filiaisPolicies.length > 0) {
        state.overview = { ...state.overview, ...parsed };
        renderMultilojaBar();
      }
    }
  } catch {}

  // 2. Pré-carrega o status da licença com prioridade máxima antes de renderizar a home
  // Evita qualquer falso positivo de expirado por renderização assíncrona
  try {
    const licRes = await apiGet('/api/license/status');
    if (licRes && licRes.ok) {
      state.licenseStatus = licRes;
      updateLicenseBadge(licRes);
    }
  } catch (err) {
    console.warn('Licença status prefetch:', err);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const targetView = urlParams.get('view') || 'home';
  const targetTab = urlParams.get('tab');
  const openSweep = urlParams.get('openSweep');
  const targetFilial = urlParams.get('filial');

  if (targetFilial) {
    state.selectedFilial = targetFilial;
  }

  // Se uma sub-aba específica foi informada na URL, define no state antes da primeira renderização
  // Evita requisição duplicada pesada de carregar 'buy' e imediatamente recarregar outra aba
  if (targetTab && targetView === 'cockpit') {
    state.tab = targetTab;
    const tabs = document.querySelectorAll('#sku-tabs .tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
  }

  // 3. Carrega Glossary e Overview PRIMEIRO (ambos levam ~20ms em RAM/SQLite)
  // Isso garante que todas as 8 lojas e dados de profile estão 100% prontos no state
  await Promise.all([loadGlossary(), loadOverview()]);

  // Garante renderização das lojas com dados frescos da rede
  renderMultilojaBar();
  renderKpiStrip(state.selectedFilial);
  if (typeof updateCockpitBudgetPillForFilial === 'function') {
    updateCockpitBudgetPillForFilial(state.selectedFilial);
  }

  // 4. Agora chaveia para a view solicitada (carrega loadBudget ou loadSkus UMA ÚNICA VEZ sem duplicação)
  switchView(targetView);

  try {
    const res = await apiGet('/api/curadoria/opportunities');
    const el = document.getElementById('curadoria-tab-count');
    if (el && res && res.count !== undefined) el.textContent = res.count;
  } catch {}

  if (openSweep && targetTab === 'curadoria') {
    const delay = openSweep === 'now' ? 0 : 500;
    setTimeout(async () => {
      const res = await apiGet('/api/curadoria/opportunities');
      if (res.molecules && res.molecules.length > 0) {
        const first = res.molecules[0];
        openMoleculeSweep(first.molecule_key, first.targetSku?.produto_id || 0, state.selectedFilial !== 'all' ? state.selectedFilial : null);
      }
    }, delay);
  }
})();

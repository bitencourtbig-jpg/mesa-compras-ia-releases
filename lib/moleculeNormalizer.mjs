/**
 * Normaliza textos farmacêuticos removendo acentos, espaços extras e abreviações comuns.
 */
export function stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

const SALT_ABBREV_MAP = [
  [/\bCLOR\.?\s+DE\s+/g, 'CLORIDRATO DE '],
  [/\bCLOR\.?\s+/g, 'CLORIDRATO DE '],
  [/\bCLORID\.?\s+DE\s+/g, 'CLORIDRATO DE '],
  [/\bBROM\.?\s+DE\s+/g, 'BROMIDRATO DE '],
  [/\bHEMIFUM\.?\s+DE\s+/g, 'HEMIFUMARATO DE '],
  [/\bHEMITART\.?\s+DE\s+/g, 'HEMITARTARATO DE '],
  [/\bHIDROCLOROTIAZ\.?(?=\s|$|[^A-Z])/g, 'HIDROCLOROTIAZIDA'],
  [/\s*;\s*/g, '+'],
  [/\s*\+\s*/g, '+'],
];

/**
 * Normaliza o nome da substância para comparação e deduplicação.
 */
export function normalizeSubstance(raw) {
  let s = stripAccents(raw);
  if (!s || s === 'DIVERSOS' || s === 'NAO IDENTIFICADO' || s.startsWith('.NA')) return '';
  for (const [re, rep] of SALT_ABBREV_MAP) {
    s = s.replace(re, rep);
  }

  // Normalização de prefixos químicos e sinônimos
  s = s.replace(/^N[\s-]+ACETILCISTEINA\b/i, 'ACETILCISTEINA');
  s = s.replace(/^ACETIL[\s-]+CISTEINA\b/i, 'ACETILCISTEINA');

  // Remove sufixos de hidratação que não mudam equivalência comercial
  s = s.replace(/\b(DI-?HIDRATAD[AO]|MONOIDRATAD[AO]|ANIDR[AO]|TRIHIDRATAD[AO]|HEMI-?HIDRATAD[AO])\b/g, '');

  // Remove formas farmacêuticas que vazam para o nome da substância no cadastro do ERP BIG
  // Ex: "ACETILCISTEINA PO", "ACETILCISTEINA COMPRIMIDOS", "PREGABALINA GOTAS", "ACETILCISTEINA (ASSOC.)"
  s = s.replace(/\b(PO\s+PARA\s+SOLUCAO|PO\s+ORAL|PO|GRANULADO|GRAN|COMPRIMIDOS?|CAPSULAS?|XAROPE|XPE|GOTAS|GTS|SOLUCAO|SOL|CREME|POMADA|GEL|INJETAVEL|INJ|EFERVESCENTE|EFEV|SPRAY|AER|SUSPENSAO|SUSP|COLIRIO)\b/gi, '');
  s = s.replace(/\s*\(\s*ASSOC(?:\.|\w*)\s*\)/gi, '');
  s = s.replace(/\bASSOC(?:\.|\w*)\b/gi, '');
  s = s.replace(/[,;+-\s]+$/, '').replace(/^[,;+-\s]+/, '');
  s = s.replace(/\s+/g, ' ').trim();

  // Normaliza sinônimos diretos frequentes sem perder associação (+)
  if (s === 'LOSARTANA') s = 'LOSARTANA POTASSICA';
  if (s === 'PREGABALINA') s = 'PREGABALINA';
  if (s === 'ACETILCISTEINA') s = 'ACETILCISTEINA';
  return s;
}

/**
 * Extrai concentração normalizada de uma string de apresentação CMED ou descrição de produto.
 * Exemplos: "50 MG", "50/12,5MG", "80+11,4MG/ML", "10 MG/ML", "0,3%", "1000UI"
 */
export function extractConcentration(rawText, substanceContext = '') {
  const s = stripAccents(rawText)
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');
  const combined = `${s} ${stripAccents(substanceContext)}`.toUpperCase();

  // Equivalência clínica de Acetilcisteína expressa em mg/g para envelopes de 5g
  // 120 mg/g * 5g = 600mg | 40 mg/g * 5g = 200mg | 20 mg/g * 5g = 100mg
  if (/ACETILCIST|FLUIMUCIL|CISTEIL/i.test(combined)) {
    if (/\b120\s*MG\/G\b/i.test(s)) return '600MG';
    if (/\b40\s*MG\/G\b/i.test(s)) return '200MG';
    if (/\b20\s*MG\/G\b/i.test(s)) return '100MG';
  }

  // Concentração composta com "/" ou "+" seguido de unidade (ex.: 50/12.5 MG, 80+11.4MG/ML, 10 MG/G + 0.443 MG/G)
  const dualUnitRe = /(\d+(?:\.\d+)?)\s*(MG\/ML|MG\/G|MCG\/ML|UI\/ML|MG|MCG|G|UI|%)\s*[+/]\s*(\d+(?:\.\d+)?)\s*(MG\/ML|MG\/G|MCG\/ML|UI\/ML|MG|MCG|G|UI|%)/i;
  const dualMatch = s.match(dualUnitRe);
  if (dualMatch) {
    return `${dualMatch[1]}${dualMatch[2].toUpperCase()}+${dualMatch[3]}${dualMatch[4].toUpperCase()}`;
  }

  const slashDualRe = /(\d+(?:\.\d+)?)\s*[+/]\s*(\d+(?:\.\d+)?)\s*(MG\/ML|MG\/G|MCG\/ML|MG|MCG|G|UI|%)/i;
  const slashMatch = s.match(slashDualRe);
  if (slashMatch) {
    const unit = slashMatch[3].toUpperCase();
    return `${slashMatch[1]}+${slashMatch[2]}${unit}`;
  }

  // Concentração simples (evita capturar datas ou "(C1)" ou "C/30")
  const singleRe = /(?:^|\s)(\d+(?:\.\d+)?)\s*(MG\/ML|MG\/G|MCG\/ML|MCG\/G|UI\/ML|MG\/5ML|MG|MCG|UI|%)(?=\s|$|[^A-Z0-9])/i;
  const singleMatch = s.match(singleRe);
  if (singleMatch) {
    let conc = `${singleMatch[1]}${singleMatch[2].toUpperCase()}`;
    // Em apresentações líquidas com volume em ML ou xaropes, normaliza 20MG e 40MG para 20MG/ML e 40MG/ML
    if (/\b(XPE|XAROPE|SOL\s*ORAL|SUSP|GOTAS)\b/i.test(s) || /\b\d+\s*ML\b/i.test(s)) {
      if (conc === '20MG') conc = '20MG/ML';
      if (conc === '40MG') conc = '40MG/ML';
    }
    return conc;
  }

  // Caso especial tipo "1G" ou "2 G" (como Azitromicina 1G ou envelope 2G)
  const gramMatch = s.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*G(?=\s|$)/i);
  if (gramMatch && !/BG|TB|FR|ENV|SACH/.test(gramMatch[0])) {
    return `${gramMatch[1]}G`;
  }

  return '';
}

/**
 * Extrai a forma farmacêutica padronizada e diferencia liberações especiais (XL/LP/ODT).
 */
export function extractForm(rawText) {
  const s = stripAccents(rawText);

  const isExtended = /\b(XL|XR|LP|RETARD|PROL|PROLONGADA|CR|SR|DEPOT|LIB\s*PROL|LIB\s*RET)\b/.test(s);
  const isOdt = /\b(ODT|ORODISP|ORODISPERSIVEL|SUBLINGUAL|SUBL|SL|MAST|MASTIGAVEL|EFERV|EFERVESCENTE|EFEV)\b/.test(s);

  if (/\b(SOL\s*OFT|COLIRIO|OFTALM)\b/.test(s)) return 'SOL_OFT';
  if (/\b(SOL\s*NAS|SPR\s*NAS|SPRAY\s*NASAL|NASAL)\b/.test(s)) return 'NASAL';
  if (/\b(SOL\s*INJ|INJ|AMP|SER\s*PREENC|PO\s*LIOF|INJETAVEL)\b/.test(s)) return 'INJ';
  if (/\b(GTS|GOTAS|GOT)\b/.test(s)) return 'GOTAS';
  if (/\b(XPE|XAROPE)\b/.test(s)) return 'XAROPE';
  if (/\b(SUSP|SUSPENSAO)\b/.test(s)) return 'SUSP';
  if (/\b(CREM|CREME|CR\s*DERM|CREM\s*DERM|EMU\s*DERM|EMULSAO)\b/.test(s)) return 'CREME';
  if (/\b(POM|POMADA)\b/.test(s)) return 'POMADA';
  if (/\bGEL\b/.test(s)) return 'GEL';
  if (/\b(SPR|SPRAY|AER)\b/.test(s)) return 'SPRAY';

  // SACHÊS / ENVELOPES / PÓ ORAL (inclusive com dígitos grudados, ex.: 16ENV, 16SACHES, PO EFEV)
  if (/(?:\b|\d)(ENV|ENVELOPE|ENVELOPES|SACHE|SACHES|SACHÊ|SACHÊS|PO\s*ORAL|PO\s*SOL|PO\s*SUSP|PO\s*SOLUCAO|PO\s*EFEV|PO\s*EFERV|GRAN|GRANULADO)\b/.test(s)) {
    return 'SACHE';
  }

  // CÁPSULAS
  if (/(?:\b|\d)(CAPS|CAP|CPS|CAPSULAS?)\b/.test(s)) return isExtended ? 'CAPS_LP' : 'CAPS';

  // COMPRIMIDOS (efervescentes, revestidos, mastigáveis, sublinguais ou normais / CMED "COM CT", "COM REV", "COM EFEV", "DRG")
  if (
    /(?:\b|\d)(CPR|COMP|COMPRIMIDOS?|CP|DRAG|DRG|REV)\b/.test(s) ||
    /\bCOM\s+(?:CT|CX|BL|STRIP|FR|REV|MAST|EFEV|EFERV|DISP|ORODISP|SUBL|RET|LIB|REC|LAC)\b/.test(s) ||
    /\bCOM\s+(?:EFEV|EFERV)\b/.test(s) ||
    /\bCOM\s+\d+/.test(s) ||
    /\b(?:COM\s+REV|COM\s+MAST|COM\s+EFEV|COM\s+SUBL)\b/.test(s) ||
    (/\bCOM\b/.test(s) && /\b(?:CT|CX|BL|STRIP|X\s*\d+)\b/.test(s))
  ) {
    if (isExtended) return 'CPR_LP';
    if (isOdt) return 'CPR_ESP';
    return 'CPR';
  }

  // Se tiver ML (ex: 120ML, 100ML, 150ML) e for medicamento oral sem indicação de comprimido:
  if (/\b\d+\s*ML\b/.test(s)) {
    if (/\b(ADT|INF|PED|PEDIAT|ADULTO|PEDIATRICO)\b/.test(s) || /20MG|40MG/.test(s) || /XPE|XAROPE/.test(s)) {
      return 'XAROPE';
    }
    return 'SOL';
  }

  if (/\b(SOL|SOLUCAO)\b/.test(s)) return 'SOL';
  return 'OUTROS';
}

const SOLID_ORAL_FORMS = new Set(['CPR', 'CPR_LP', 'CPR_ESP', 'CAPS', 'CAPS_LP', 'SACHE']);

/**
 * Extrai a quantidade da embalagem (ex.: 30 comprimidos, 120 ml, 15 g).
 */
export function extractPackQty(rawText, isCmed = false) {
  const s = stripAccents(rawText).replace(/,/g, '.');

  // 1. PRIMEIRO: Verificar unidades de dose (ENV, SACHE, CPR, CAPS, AMP, FLAC) mesmo se acompanhado de peso (ex: 16 ENV 5 G, 16 SACHES 5G)
  const unitDoseMatch = s.match(/(?:^|\s|C\/|COM\s*|CX\s*|BL\s*|CT\s*)(\d+)\s*(?:ENV|ENVELOPES?|SACH|SACHES?|SACHÊS?|CP|CPR|COMP|COMPRIMIDOS?|CAP|CAPS|CAPSULAS?|DRAG|REV|AMP|FLAC|UN|UNID|UNIDADES?)\b/i);
  if (unitDoseMatch) {
    const val = Number(unitDoseMatch[1]);
    if (val > 0 && val < 1000) {
      return { value: val, unit: 'UN' };
    }
  }

  // 2. CMED padrão: "... X 30" ou "... X 120 ML" ou "... X 40 G" no final
  if (isCmed) {
    const mlMatch = s.match(/X\s*(\d+(?:\.\d+)?)\s*(ML|G)\b/i);
    if (mlMatch) return { value: Number(mlMatch[1]), unit: mlMatch[2].toUpperCase() };
    const xCountMatch = s.match(/X\s*(\d+)\s*(?:\+.*)?$/);
    if (xCountMatch) return { value: Number(xCountMatch[1]), unit: 'UN' };
  }

  // 3. Volume em ML ou L (ex: 100ML, 120ML, 150ML, 200ML)
  const mlMatch = s.match(/(?:^|\s|X|C\/)(\d+(?:\.\d+)?)\s*(ML|L)\b/i);
  if (mlMatch) {
    return { value: Number(mlMatch[1]), unit: mlMatch[2].toUpperCase() };
  }

  // 4. Peso em gramas apenas se NÃO for sachê com quantidade de envelopes já existente
  const gMatch = s.match(/(?:^|\s|X|C\/)(\d+(?:\.\d+)?)\s*G\b(?!\s*[+/])/i);
  if (gMatch && !/\b(?:ENV|SACH|CPR|COMP|CAPS)\b/i.test(s)) {
    return { value: Number(gMatch[1]), unit: 'G' };
  }

  // 5. C/ ou COM ou CX com número simples
  const cBarraMatch = s.match(/\b(?:C\/?|COM|CX\/?)\s*(\d+)\b/i);
  if (cBarraMatch) {
    const val = Number(cBarraMatch[1]);
    if (val > 0 && val < 500) {
      return { value: val, unit: 'UN' };
    }
  }

  // 6. Número isolado logo após concentração (ex.: "180MG 30 EMS" -> 30)
  const afterConcMatch = s.match(/(?:MG|MCG|G|UI|%)\s+(\d{1,3})(?=\s+[A-Z]|\s*$)/i);
  if (afterConcMatch && Number(afterConcMatch[1]) <= 200) {
    return { value: Number(afterConcMatch[1]), unit: 'UN' };
  }

  return { value: null, unit: '' };
}

/**
 * Aplica regra de tolerância para pequenas diferenças de embalagem entre laboratórios
 * (ex.: 28 CP e 30 CP tratados como mesma faixa "~30UN", 15 e 16 sachês tratados como "~16UN").
 */
export function packToBucket(pack, form, allowTolerance = true) {
  if (!pack || !pack.value) return '';
  const { value, unit } = pack;

  // Tolerância para formas líquidas orais (ex: xaropes 100ml, 120ml e 150ml tratados na mesma faixa "~120ML")
  if (unit === 'ML' && allowTolerance && (form === 'XAROPE' || form === 'SOL')) {
    if (value >= 90 && value <= 150) return '~120ML';
    return `${value}ML`;
  }

  if (unit !== 'UN' || !allowTolerance || !SOLID_ORAL_FORMS.has(form)) {
    return `${value}${unit}`;
  }

  // Faixas padrão de tratamento em sólidos orais e sachês
  const ranges = [
    [14, 16, '~16UN'],
    [28, 30, '~30UN'],
    [56, 60, '~60UN'],
    [84, 90, '~90UN'],
  ];
  for (const [min, max, label] of ranges) {
    if (value >= min && value <= max) return label;
  }
  return `${value}UN`;
}

/**
 * Monta assinatura normalizada completa a partir de texto/CMED.
 * Se concentração ou packBucket forem desconhecidos, NÃO gera chave agregadora falsa.
 */
export function buildPresentationSignature({
  substancia,
  textoFonte,
  isCmed = false,
  allowTolerance = true,
}) {
  const subst = normalizeSubstance(substancia);
  const conc = extractConcentration(textoFonte, substancia);
  const form = extractForm(textoFonte);
  const pack = extractPackQty(textoFonte, isCmed);
  const packExact = pack.value ? `${pack.value}${pack.unit}` : '';
  const packBucket = packToBucket(pack, form, allowTolerance);

  // Se substancia, concentracao ou embalagem forem incertas, nao agrupa
  const isReliable = Boolean(subst && conc && conc !== '?' && packBucket && packBucket !== '?');
  const key = isReliable
    ? [subst, conc, form, packBucket].join('|')
    : null;

  return {
    substanciaNorm: subst,
    concentracao: conc,
    forma: form,
    packExact,
    packBucket: packBucket || '?',
    key,
    isReliable,
  };
}


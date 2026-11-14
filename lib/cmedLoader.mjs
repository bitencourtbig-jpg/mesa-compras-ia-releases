import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { buildPresentationSignature } from './moleculeNormalizer.mjs';

function cleanStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.text) v = v.text;
  return String(v).trim();
}

export function normCode(v) {
  const s = cleanStr(v).replace(/[^0-9]/g, '');
  if (!s) return '';
  return s.replace(/^0+/, '') || s;
}

/**
 * Extrai um arquivo .xlsx de um .zip se o caminho informado for .zip,
 * ou lê diretamente o .xlsx.
 */
export function resolveCmedXlsxPath(inputPath, extractDir) {
  if (inputPath.toLowerCase().endsWith('.xlsx')) {
    return inputPath;
  }
  if (!inputPath.toLowerCase().endsWith('.zip')) {
    throw new Error(`Formato não suportado para CMED: ${inputPath}`);
  }
  const zip = new AdmZip(inputPath);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.xlsx'));
  if (!entries.length) {
    throw new Error(`Nenhum arquivo .xlsx encontrado dentro de ${inputPath}`);
  }
  fs.mkdirSync(extractDir, { recursive: true });
  const targetPath = path.join(extractDir, path.basename(entries[0].entryName));
  if (!fs.existsSync(targetPath)) {
    zip.extractEntryTo(entries[0], extractDir, false, true);
  }
  return targetPath;
}

/**
 * Lê a Lista PMC oficial da ANVISA/CMED via streaming e retorna índices por Registro MS e EAN.
 */
export async function loadCmedIndex(xlsxOrZipPath, { extractDir = './data/cmed', allowTolerance = true } = {}) {
  const xlsxPath = resolveCmedXlsxPath(xlsxOrZipPath, extractDir);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxPath, {
    entries: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    worksheets: 'emit',
  });

  const byRegistro = new Map();
  const byEan = new Map();
  let totalRows = 0;
  let headers = [];

  let sheetCount = 0;
  for await (const worksheet of reader) {
    sheetCount += 1;
    const isCandidate =
      /pmc|lista|preco|conformidade|medicamento/i.test(worksheet.name || '') ||
      sheetCount === 1;
    if (!isCandidate) continue;
    let rIdx = 0;
    let foundHeaders = false;
    for await (const row of worksheet) {
      rIdx += 1;
      const vals = row.values.slice(1).map(cleanStr);
      // Localiza o cabecalho (pode estar na linha 1 ou primeiras linhas)
      if (!foundHeaders) {
        if (vals.some((v) => /subst[aâ]ncia/i.test(v)) || rIdx === 1) {
          headers = vals;
          foundHeaders = true;
          continue;
        }
        continue;
      }
      if (!vals[0] && !vals[4]) continue;
      totalRows += 1;

      const tarjaIdx = headers.findIndex((h) => /tarja/i.test(h));
      const reg = normCode(vals[4]);
      const eans = [normCode(vals[5]), normCode(vals[6]), normCode(vals[7])].filter(Boolean);
      const sig = buildPresentationSignature({
        substancia: vals[0],
        textoFonte: vals[9],
        isCmed: true,
        allowTolerance,
      });

      const rec = {
        substanciaRaw: vals[0],
        laboratorio: vals[2],
        registro: reg,
        eans,
        produto: vals[8],
        apresentacao: vals[9],
        classeTerapeutica: vals[10],
        tipoProduto: vals[11],
        tarja: tarjaIdx >= 0 ? vals[tarjaIdx] : '',
        sig,
      };

      if (reg && !byRegistro.has(reg)) byRegistro.set(reg, rec);
      for (const ean of eans) {
        if (!byEan.has(ean)) byEan.set(ean, rec);
      }
    }
  }

  return {
    sourceFile: xlsxPath,
    totalRows,
    byRegistro,
    byEan,
  };
}


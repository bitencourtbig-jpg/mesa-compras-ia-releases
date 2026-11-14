import ExcelJS from 'exceljs';
import { buildBuyerDecisionAnalysis } from './buyerInterpreter.mjs';
import { buildExecutiveBi } from './biAnalyticsService.mjs';

const CURRENCY_FMT = '"R$ "#,##0.00';
const PCT_FMT = '0.0"%"';

function styleHeaderRow(row, fillColor = 'FF0F766E') {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

function autoFitColumns(ws, minWidth = 10, maxWidth = 44) {
  ws.columns.forEach((col) => {
    let maxLen = minWidth;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const val = cell.value?.formula ? '000000000' : String(cell.value ?? '');
      maxLen = Math.max(maxLen, Math.min(maxWidth, val.length + 3));
    });
    col.width = maxLen;
  });
}

/**
 * Gera workbook Excel (.xlsx) completo para decisao do comprador ou enxuto para importacao no Cotefacil.
 * @param {object} opts
 * @param {'manager'|'cotefacil'} opts.mode
 * @param {object} opts.profile
 * @param {object} opts.latestRun
 * @param {Array} opts.rows SKUs selecionados ou filtrados
 * @param {Array} opts.molecules Resumo de moleculas da rodada
 * @param {Array} opts.expiringLots Lotes curtos / vencidos
 */
export async function generateQuotationWorkbook({
  mode = 'manager',
  profile,
  latestRun,
  rows,
  molecules = [],
  expiringLots = [],
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BIG Compras AI';
  wb.created = new Date();

  const analyzed = rows.map((r) => ({
    row: r,
    buyQty: r.budget_qtd !== undefined ? Number(r.budget_qtd) : Number(r.sugestao_compra_un || 0),
    buyRs: r.budget_rs !== undefined ? Number(r.budget_rs) : Number(r.sugestao_compra_rs || 0),
    ia: buildBuyerDecisionAnalysis(r),
  }));

  if (mode === 'cotefacil') {
    // Planilha enxuta compativel com importadores de cotacao (Cotefacil / portais EAN + Qtd)
    const ws = wb.addWorksheet('Itens');
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.columns = [
      { header: 'CODIGO_BARRAS_EAN', key: 'ean', width: 18 },
      { header: 'QUANTIDADE', key: 'qtd', width: 13 },
      { header: 'CODIGO_INTERNO_SKU', key: 'sku', width: 16 },
      { header: 'DESCRICAO', key: 'descricao', width: 44 },
      { header: 'LABORATORIO', key: 'labora', width: 24 },
      { header: 'PRECO_ALVO_CUSTO', key: 'alvo', width: 18 },
      { header: 'ULTIMO_FORNECEDOR', key: 'fornecedor', width: 26 },
      { header: 'OBSERVACAO_COMPRADOR', key: 'obs', width: 42 },
    ];
    styleHeaderRow(ws.getRow(1), 'FF0F766E');

    for (const item of analyzed) {
      if (item.buyQty <= 0) continue;
      const r = item.row;
      const excelRow = ws.addRow({
        ean: String(r.barras || '').trim(),
        qtd: item.buyQty,
        sku: Number(r.produto_id),
        descricao: r.descricao,
        labora: r.labora || '',
        alvo: Number(item.ia.precoAlvoCotacao || r.custo_unit || 0),
        fornecedor: r.fornecedor_nome || item.ia.melhorFornecedorRecente || '',
        obs: `${item.ia.acaoLabel} (${item.ia.confiancaNivel} ${item.ia.confiancaScore}%) - ${item.ia.parecerCurto}`,
      });
      // Forca EAN como texto para nao virar notacao cientifica no Excel
      excelRow.getCell('ean').numFmt = '@';
      excelRow.getCell('qtd').numFmt = '#,##0';
      excelRow.getCell('alvo').numFmt = CURRENCY_FMT;
    }
    return wb.xlsx.writeBuffer();
  }

  // MODO GERENCIAL COMPLETO (multi-abas + formulas editaveis)
  const s = latestRun.summary;
  const bi = buildExecutiveBi(profile.code, latestRun.id, s);

  // Aba 1: Resumo Executivo IA
  const wsRes = wb.addWorksheet('1_Resumo_Executivo_IA');
  wsRes.columns = [
    { header: 'Indicador / Secao', key: 'k', width: 42 },
    { header: 'Valor', key: 'v', width: 22 },
    { header: 'Interpretacao Pratica', key: 'd', width: 64 },
  ];
  styleHeaderRow(wsRes.getRow(1), 'FF0F172A');

  const resumoRows = [
    ['Cliente / Filial Ref.', `${profile.name} (Filial ${profile.buyer_filial_id})`, `Data ref.: ${s.referenceDate} | Janela: ${s.weeksWindow} semanas (${s.serviceProfile})`],
    ['Itens nesta exportacao', analyzed.length, 'SKUs selecionados ou filtrados na Mesa de Compras'],
    ['Valor total sugerido (filtro atual)', analyzed.reduce((acc, x) => acc + x.buyRs, 0), 'Baseado no custo unitario de referencia de entrada/PMC', CURRENCY_FMT],
    ['Rupturas Curva A / B na loja', `${s.rupturasCurvaA} / ${s.rupturasCurvaB}`, 'Itens de alto giro zerados exigindo compra imediata'],
    ['Venda perdida estimada (91d)', Number(s.vendaPerdidaEstimadaRs91d || 0), 'Calculada automaticamente via falta diaria em estoque_posterior', CURRENCY_FMT],
    ['Capital em excesso (> Maximo)', Number(s.capitalExcessoAcimaMaxRs || 0), 'Dinheiro travado acima do teto ideal', CURRENCY_FMT],
    ['Capital parado Curva D (0 vendas)', Number(s.capitalParadoCurvaDRs || 0), 'Itens sem saida em 91d — bloquear compra e liquidar', CURRENCY_FMT],
    ['Economia evitada por Molecula', Number(s.economiaMoleculaRs || 0), `${s.economiaMoleculaUn} unidades evitadas pela equivalencia CMED`, CURRENCY_FMT],
    ['Compra evitada por PBM Auto/mes', bi.iaImpact.economiaMensalPbmRs, `${bi.iaImpact.economiaMensalPbmUn} un/mes repostas automaticamente via NSU PBM`, CURRENCY_FMT],
    ['Risco de vencimento (<= 90d)', Number(s.lotesVencendo90dRs || 0), 'Ver aba 5_Lotes_Criticos_FEFO antes de confirmar novos pedidos', CURRENCY_FMT],
  ];
  for (const [k, v, d, fmt] of resumoRows) {
    const er = wsRes.addRow({ k, v, d });
    if (fmt) er.getCell('v').numFmt = fmt;
  }

  // Aba 2: Sugestao de Compra + Parecer IA + Qtd Decisao Editavel
  const wsBuy = wb.addWorksheet('2_Decisao_Compra_IA');
  wsBuy.views = [{ state: 'frozen', ySplit: 1 }];
  wsBuy.columns = [
    { header: 'Acao Recomendada IA', key: 'acao', width: 24 },
    { header: 'Confianca IA', key: 'conf', width: 15 },
    { header: 'SKU', key: 'sku', width: 10 },
    { header: 'EAN (Barras)', key: 'ean', width: 17 },
    { header: 'Descricao', key: 'desc', width: 42 },
    { header: 'Categoria', key: 'cat', width: 18 },
    { header: 'ABC/XYZ', key: 'cls', width: 10 },
    { header: 'Laboratorio', key: 'lab', width: 22 },
    { header: 'Estoque + Tr.', key: 'est', width: 14 },
    { header: 'DDV Liq. Proj.', key: 'ddv', width: 14 },
    { header: 'Cob. (d)', key: 'cob', width: 10 },
    { header: 'Melhor Custo Recente', key: 'custoAlvo', width: 18 },
    { header: 'Sugestao IA (Un)', key: 'sugUn', width: 16 },
    { header: 'Qtd Final Comprador', key: 'qtdFinal', width: 18 },
    { header: 'Subtotal Final (R$)', key: 'subRs', width: 18 },
    { header: 'Ultimo Fornecedor', key: 'forn', width: 26 },
    { header: 'Parecer Direto para Decisao', key: 'parecer', width: 58 },
  ];
  styleHeaderRow(wsBuy.getRow(1), 'FF0F766E');
  wsBuy.autoFilter = { from: 'A1', to: 'Q1' };

  analyzed.forEach((item, idx) => {
    const r = item.row;
    const excelRowNum = idx + 2;
    const rowObj = wsBuy.addRow({
      acao: item.ia.acaoLabel,
      conf: `${item.ia.confiancaNivel} (${item.ia.confiancaScore}%)`,
      sku: Number(r.produto_id),
      ean: String(r.barras || '').trim(),
      desc: r.descricao,
      cat: r.macro_categoria,
      cls: `${r.abc_class}${r.xyz_class}`,
      lab: r.labora || '',
      est: Number(r.estoque_atual || 0) + Number(r.transito_real || 0),
      ddv: Number(r.ddv_projetada || 0),
      cob: Number(r.cobertura_dias || 0),
      custoAlvo: Number(item.ia.precoAlvoCotacao || r.custo_unit || 0),
      sugUn: item.buyQty,
      qtdFinal: item.buyQty,
      subRs: { formula: `N${excelRowNum}*L${excelRowNum}` },
      forn: r.fornecedor_nome || item.ia.melhorFornecedorRecente || '',
      parecer: `${item.ia.parecerCurto} [${item.ia.passos[3]?.texto || ''}]`,
    });
    rowObj.getCell('ean').numFmt = '@';
    rowObj.getCell('ddv').numFmt = '#,##0.00';
    rowObj.getCell('cob').numFmt = '#,##0.0';
    rowObj.getCell('custoAlvo').numFmt = CURRENCY_FMT;
    rowObj.getCell('sugUn').numFmt = '#,##0';
    rowObj.getCell('qtdFinal').numFmt = '#,##0';
    rowObj.getCell('subRs').numFmt = CURRENCY_FMT;
    rowObj.getCell('qtdFinal').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
  });

  // Aba 3: Layout direto Cotefacil
  const wsCote = wb.addWorksheet('3_Layout_Cotefacil_EAN');
  wsCote.views = [{ state: 'frozen', ySplit: 1 }];
  wsCote.columns = [
    { header: 'CODIGO_BARRAS_EAN', key: 'ean', width: 18 },
    { header: 'QUANTIDADE', key: 'qtd', width: 14 },
    { header: 'DESCRICAO', key: 'desc', width: 42 },
    { header: 'LABORATORIO', key: 'lab', width: 24 },
    { header: 'PRECO_ALVO_MAX', key: 'alvo', width: 16 },
    { header: 'SKU_BIG', key: 'sku', width: 12 },
  ];
  styleHeaderRow(wsCote.getRow(1), 'FF0369A1');
  for (const item of analyzed) {
    if (item.buyQty <= 0) continue;
    const r = item.row;
    const er = wsCote.addRow({
      ean: String(r.barras || '').trim(),
      qtd: item.buyQty,
      desc: r.descricao,
      lab: r.labora || '',
      alvo: Number(item.ia.precoAlvoCotacao || r.custo_unit || 0),
      sku: Number(r.produto_id),
    });
    er.getCell('ean').numFmt = '@';
    er.getCell('qtd').numFmt = '#,##0';
    er.getCell('alvo').numFmt = CURRENCY_FMT;
  }

  // Aba 4: Economia por Molecula
  if (molecules.length > 0) {
    const wsMol = wb.addWorksheet('4_Economia_Moleculas');
    wsMol.views = [{ state: 'frozen', ySplit: 1 }];
    wsMol.columns = [
      { header: 'Molecula / Apresentacao', key: 'mol', width: 42 },
      { header: 'SKUs / Labs', key: 'cnt', width: 14 },
      { header: 'Estoque Rede', key: 'est', width: 14 },
      { header: 'Cobertura (d)', key: 'cob', width: 14 },
      { header: 'Soma SKUs', key: 'soma', width: 14 },
      { header: 'Nec. Liquida', key: 'nec', width: 14 },
      { header: 'Economia (R$)', key: 'econ', width: 16 },
      { header: 'Melhor Opcao Atual', key: 'best', width: 38 },
    ];
    styleHeaderRow(wsMol.getRow(1), 'FF1E293B');
    for (const m of molecules) {
      const er = wsMol.addRow({
        mol: m.molecule_key,
        cnt: `${m.skus_count} / ${m.labs_count}`,
        est: Number(m.estoque_total || 0),
        cob: Number(m.cobertura_molecula_dias || 0),
        soma: Number(m.sugestao_sku_soma || 0),
        nec: Number(m.necessidade_liquida_molecula || 0),
        econ: Number(m.economia_rs_evitada || 0),
        best: `${m.melhor_sku_desc || ''} (${Number(m.melhor_custo_unit || 0).toFixed(2)})`,
      });
      er.getCell('econ').numFmt = CURRENCY_FMT;
    }
  }

  // Aba 5: Lotes Criticos (FEFO)
  if (expiringLots.length > 0) {
    const wsLot = wb.addWorksheet('5_Lotes_Criticos_FEFO');
    wsLot.views = [{ state: 'frozen', ySplit: 1 }];
    wsLot.columns = [
      { header: 'SKU', key: 'sku', width: 12 },
      { header: 'Descricao', key: 'desc', width: 42 },
      { header: 'Curva', key: 'cls', width: 10 },
      { header: 'Menor Validade', key: 'val', width: 16 },
      { header: 'Qtd Vencendo <=90d', key: 'v90', width: 18 },
      { header: 'Qtd Vencida', key: 'venc', width: 14 },
      { header: 'Risco (R$)', key: 'risco', width: 16 },
      { header: 'Margem %', key: 'mg', width: 12 },
    ];
    styleHeaderRow(wsLot.getRow(1), 'FFB45309');
    for (const l of expiringLots) {
      const er = wsLot.addRow({
        sku: Number(l.produto_id),
        desc: l.descricao,
        cls: l.abc_class,
        val: l.lote_menor_validade || '',
        v90: Number(l.lote_vencendo_90d_qtd || 0),
        venc: Number(l.lote_vencido_qtd || 0),
        risco: Number(l.lote_vencendo_90d_rs || 0),
        mg: Number(l.margem_pct || 0),
      });
      er.getCell('risco').numFmt = CURRENCY_FMT;
      er.getCell('mg').numFmt = PCT_FMT;
    }
  }

  autoFitColumns(wsRes);
  return wb.xlsx.writeBuffer();
}

/**
 * Gera guia operacional de separacao e transferencia entre filiais (Pick-List)
 * com layout visual, codigo de barras, quantidades conferidas e assinaturas.
 */
export async function buildTransferPickListExcel({ transfer, items = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BIG Compras AI - Remanejamento';
  wb.created = new Date();

  const ws = wb.addWorksheet(`TRF-${transfer.codigo_transferencia || transfer.id || 'NOVA'}`.slice(0, 30), {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const primaryFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  const headerFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const borderThin = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'GUIA OPERACIONAL DE SEPARAÇÃO E TRANSFERÊNCIA ENTRE LOJAS (LINX BIG)';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF0F766E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = `Código: ${transfer.codigo_transferencia || `TRF-${transfer.id}`} | Emissão: ${transfer.data_emissao || new Date().toLocaleString('pt-BR')} | Status: ${transfer.status || 'PENDENTE_SEPARACAO'}`;
  ws.getCell('A2').font = { name: 'Segoe UI', size: 9.5, bold: true };

  ws.mergeCells('F2:J2');
  ws.getCell('F2').value = `Origem: ${transfer.filial_origem_nome || `Filial ${transfer.filial_origem}`} ➔ Destino: ${transfer.filial_destino_nome || `Filial ${transfer.filial_destino}`}`;
  ws.getCell('F2').font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
  ws.getCell('F2').alignment = { horizontal: 'right' };
  ws.getRow(2).height = 20;

  const headers = [
    'Item #', 'Cód BIG', 'Código de Barras (EAN)', 'Descrição do Produto', 'Laboratório / Marca',
    'Qtd a Separar (un)', 'Qtd Conferida [ ___ ]', 'Custo Unit (R$)', 'Total (R$)', 'Motivo do Remanejamento'
  ];
  ws.getRow(4).values = headers;
  ws.getRow(4).height = 22;
  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getRow(4).getCell(c);
    cell.fill = primaryFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: c === 4 || c === 5 || c === 10 ? 'left' : 'center' };
  }

  let rowIdx = 5;
  let totalUnits = 0;
  let totalRs = 0;
  items.forEach((it, idx) => {
    const row = ws.getRow(rowIdx);
    const qtd = Number(it.qtd_solicitada || it.qtdSugerida || 0);
    const custo = Number(it.custo_unit || it.custoUnit || 0);
    const subtotal = Number((qtd * custo).toFixed(2));
    totalUnits += qtd;
    totalRs += subtotal;

    row.values = [
      idx + 1,
      it.produto_id || it.produtoId,
      it.barras || '',
      it.descricao || '',
      it.labora || '',
      qtd,
      '',
      custo,
      subtotal,
      it.motivo || it.motivo_decisao || 'Excesso resgatado para atender demanda'
    ];

    row.height = 20;
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.border = borderThin;
      cell.font = { name: 'Segoe UI', size: 9 };
      if (c === 6) {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F766E' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (c === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      } else if (c === 8 || c === 9) {
        cell.numFmt = CURRENCY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (c === 1 || c === 2 || c === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
    rowIdx++;
  });

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(4).value = 'TOTAL GERAL DA TRANSFERÊNCIA';
  totalRow.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true };
  totalRow.getCell(4).alignment = { horizontal: 'right' };

  totalRow.getCell(6).value = totalUnits;
  totalRow.getCell(6).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F766E' } };
  totalRow.getCell(6).alignment = { horizontal: 'center' };

  totalRow.getCell(9).value = totalRs;
  totalRow.getCell(9).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF047857' } };
  totalRow.getCell(9).numFmt = CURRENCY_FMT;
  totalRow.getCell(9).alignment = { horizontal: 'right' };
  totalRow.height = 24;

  for (let c = 1; c <= 10; c++) {
    totalRow.getCell(c).border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
  }

  rowIdx += 3;
  ws.getRow(rowIdx).values = ['_____________________________', '', '_____________________________', '', '', '_____________________________', '', '', '_____________________________'];
  rowIdx++;
  ws.getRow(rowIdx).values = ['Separação / Estoquista (Origem)', '', 'Conferência / Expedição', '', '', 'Motorista / Transporte', '', '', 'Recebimento / Conferência (Destino)'];
  for (let c = 1; c <= 10; c++) {
    ws.getRow(rowIdx - 1).getCell(c).alignment = { horizontal: 'center' };
    ws.getRow(rowIdx).getCell(c).alignment = { horizontal: 'center' };
    ws.getRow(rowIdx).getCell(c).font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF64748B' } };
  }

  ws.columns = [
    { width: 7 },
    { width: 10 },
    { width: 16 },
    { width: 38 },
    { width: 20 },
    { width: 14 },
    { width: 16 },
    { width: 13 },
    { width: 14 },
    { width: 32 },
  ];

  return wb.xlsx.writeBuffer();
}


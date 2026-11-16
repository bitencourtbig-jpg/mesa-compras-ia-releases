import ExcelJS from 'exceljs';

/**
 * Limpa strings para formato TXT delimitado por ponto e vírgula.
 */
function cleanTxtField(val, maxLen = 60) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[;\r\n\t]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Garante que o CNPJ contenha apenas dígitos (14 dígitos).
 */
export function sanitizeCnpj(cnpj) {
  if (!cnpj) return '00000000000000';
  const digits = String(cnpj).replace(/\D/g, '');
  return digits.padStart(14, '0').slice(-14);
}

/**
 * Garante código de barras no padrão EAN-13 (13 dígitos com zeros à esquerda se necessário).
 */
export function sanitizeEan13(barras, fallbackSku = '') {
  const digits = String(barras || fallbackSku || '').replace(/\D/g, '');
  if (!digits) return String(fallbackSku).padStart(13, '0').slice(-13);
  if (digits.length <= 13) return digits.padStart(13, '0');
  return digits.slice(-13);
}

/**
 * Gera arquivo TXT no formato oficial do Cotefácil (Layout 3.0):
 *
 * Registro Tipo 1 (Header):
 * 1;<CNPJ_DESTINATARIO>;3.0
 *
 * Registro Tipo 2 (Itens):
 * 2;<EAN_13_DIGITOS>;<QUANTIDADE>;<COD_SKU>;<DESCRICAO>;<FABRICANTE_OU_LAB>;<PRECO_TARGET>
 *
 * Registro Tipo 9 (Trailer):
 * 9;<TOTAL_ITENS_TIPO_2>
 *
 * Exemplo real fornecido:
 * 1;28660206000167;3.0
 * 2;0000001473438;6;147343;CHAVEIRO CH12;REVISAR;12.00
 * 2;7898744000133;1;152874;PROTETOR DE SEIO FITA UP SILICONE 8CM 1 PAR;FITA UP;38.34
 * 9;2
 *
 * @param {Object} params
 * @param {string} params.clientCnpj CNPJ da loja destinatária (filial compradora)
 * @param {Array<Object>} params.items Itens selecionados pelo comprador
 * @returns {string} Conteúdo em texto puro do arquivo Cotefácil
 */
export function generateCotefacilTxt({ clientCnpj, items }) {
  const cnpj14 = sanitizeCnpj(clientCnpj || '28660206000167');
  const lines = [];

  // Registro 1: Cabeçalho
  lines.push(`1;${cnpj14};3.0`);

  let countType2 = 0;
  for (const item of items) {
    const qty = Math.max(1, Math.round(Number(item.quantidade ?? item.sugestao_compra_un ?? 1)));
    const sku = String(item.produto_id || item.codigo || '').trim();
    const ean = sanitizeEan13(item.barras, sku);
    const desc = cleanTxtField(item.descricao || item.nome || 'PRODUTO SEM DESCRICAO', 50);
    const lab = cleanTxtField(item.labora || item.fabricante || 'DIVERSOS', 30);

    // Preço alvo com 2 casas e separador ponto (ex: 12.00)
    const rawPrice = Number(item.preco_target ?? item.custo_unit ?? item.preco_unit ?? 0);
    const targetPrice = Math.max(0.01, rawPrice).toFixed(2);

    lines.push(`2;${ean};${qty};${sku};${desc};${lab};${targetPrice}`);
    countType2 += 1;
  }

  // Registro 9: Trailer com a contagem total de itens tipo 2
  lines.push(`9;${countType2}`);

  return lines.join('\r\n') + '\r\n';
}

/**
 * Gera a planilha Excel oficial de importação do Linx Farma BIG (Módulo Compras),
 * reproduzindo fielmente o layout de 10 colunas extraído da tela do Linx BIG:
 *
 * [A] CNPJ                -> CNPJ da farmácia compradora (ex: 28660206000167)
 * [B] LOJA                -> ID da filial compradora (ex: 2)
 * [C] COD_PRODUTO         -> Código do produto no Linx BIG (ex: 147343)
 * [D] EAN                 -> Código de barras EAN-13 (Formatado como TEXTO puro para não virar notação científica)
 * [E] DESCRIÇÃO PRODUTO   -> Nome do produto
 * [F] QUANTIDADE          -> Quantidade a comprar
 * [G] PREÇO               -> Preço unitário da compra (R$)
 * [H] DESCONTO            -> Desconto percentual (ex: 0.00 ou 0.10)
 * [I] CNPJ FORNECEDOR     -> CNPJ do fornecedor cotado/mais barato dos 30d
 * [J] DESCRIÇÃO FORNECEDOR-> Razão Social ou Fantasia do Fornecedor
 *
 * @param {Object} params
 * @param {string} params.clientCnpj CNPJ da loja compradora
 * @param {number|string} params.buyerFilialId ID da loja
 * @param {Array<Object>} params.items Itens selecionados pelo comprador
 * @param {Object} [params.defaultSupplier] Fornecedor padrão se o item não tiver um específico
 * @returns {Promise<Buffer>} Buffer XLSX pronto para download
 */
export async function generateBigNativeImportXlsx({
  clientCnpj,
  buyerFilialId = 2,
  items,
  defaultSupplier = null,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity - Motor de Compras Farma BIG';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('COMPRAS', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const cnpjLoja = sanitizeCnpj(clientCnpj || '28660206000167');
  const filialIdNum = Number(buyerFilialId || 2);

  // Definição das 10 colunas oficiais do Linx Farma BIG
  ws.columns = [
    { header: 'CNPJ', key: 'cnpj', width: 20 },
    { header: 'LOJA', key: 'loja', width: 10 },
    { header: 'COD_PRODUTO', key: 'cod_produto', width: 16 },
    { header: 'EAN', key: 'ean', width: 20 },
    { header: 'DESCRIÇÃO PRODUTO', key: 'descricao_produto', width: 48 },
    { header: 'QUANTIDADE', key: 'quantidade', width: 15 },
    { header: 'PREÇO', key: 'preco', width: 15 },
    { header: 'DESCONTO', key: 'desconto', width: 14 },
    { header: 'CNPJ FORNECEDOR', key: 'cnpj_fornecedor', width: 22 },
    { header: 'DESCRIÇÃO FORNECEDOR', key: 'descricao_fornecedor', width: 36 },
  ];

  // Estilização do cabeçalho oficial Linx BIG (Azul escuro #2F5597, texto branco negrito)
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2F5597' },
    };
    cell.font = {
      name: 'Segoe UI',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F3864' } },
      left: { style: 'thin', color: { argb: 'FF1F3864' } },
      bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
      right: { style: 'thin', color: { argb: 'FF1F3864' } },
    };
  });

  // Povoamento das linhas com dados limpos e tipados
  for (const item of items) {
    const qty = Math.max(1, Math.round(Number(item.quantidade ?? item.sugestao_compra_un ?? 1)));
    const sku = Number(item.produto_id || item.codigo || 0);
    const eanText = sanitizeEan13(item.barras, sku);
    const precoUnit = Number(item.preco_target ?? item.custo_unit ?? item.preco_unit ?? 0);
    const descPct = Number(item.desconto ?? 0);

    // Identificação do fornecedor (prioriza fornecedor mais barato 30d, depois último fornecedor, depois padrão)
    const fornCnpj = sanitizeCnpj(
      item.melhor_fornecedor_30d_cnpj ||
      item.fornecedor_cnpj ||
      defaultSupplier?.cgc ||
      '00000000000000'
    );
    const fornNome = (
      item.melhor_fornecedor_30d_nome ||
      item.fornecedor_nome ||
      defaultSupplier?.nome ||
      'FORNECEDOR DIVERSOS'
    ).trim();

    const row = ws.addRow({
      cnpj: cnpjLoja,
      loja: filialIdNum,
      cod_produto: sku,
      ean: eanText,
      descricao_produto: String(item.descricao || item.nome || '').trim(),
      quantidade: qty,
      preco: precoUnit,
      desconto: descPct,
      cnpj_fornecedor: fornCnpj,
      descricao_fornecedor: fornNome,
    });

    row.height = 20;

    // Alinhamentos e formatos
    row.getCell('cnpj').numFmt = '@'; // Texto puro
    row.getCell('cnpj').alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell('loja').numFmt = '0';
    row.getCell('loja').alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell('cod_produto').numFmt = '0';
    row.getCell('cod_produto').alignment = { vertical: 'middle', horizontal: 'center' };

    // IMPORTANTE: EAN formatado explicitamente como texto '@' para evitar notação científica 1E+13
    row.getCell('ean').numFmt = '@';
    row.getCell('ean').alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell('descricao_produto').alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell('quantidade').numFmt = '#,##0';
    row.getCell('quantidade').alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell('preco').numFmt = '#,##0.00';
    row.getCell('preco').alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell('desconto').numFmt = '0.00';
    row.getCell('desconto').alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell('cnpj_fornecedor').numFmt = '@';
    row.getCell('cnpj_fornecedor').alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell('descricao_fornecedor').alignment = { vertical: 'middle', horizontal: 'left' };

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
      cell.font = { name: 'Segoe UI', size: 10 };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Gera a planilha executiva formatada de Pedido de Operação Logística (OL)
 * para envio direto ao Representante Comercial do Laboratório / Indústria Farmacêutica.
 */
export async function generateOlOrderExcel({
  clientName = 'Drogaria',
  clientCnpj = '',
  filialNome = '',
  filialId = 2,
  fabricante = 'FABRICANTE',
  olConfig = null,
  items = [],
  observacoes = '',
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FSConsultoria - Mesa de Compras IA';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('PEDIDO_OL', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  // Título e Cabeçalho do Pedido
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `📦 PEDIDO DE COMPRA • OPERAÇÃO LOGÍSTICA (OL) — ${String(fabricante).toUpperCase()}`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; // Teal escuro
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 32;

  // Linhas de dados da farmácia e da OL
  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `Farmácia: ${clientName} | Filial: ${filialNome || filialId} | CNPJ: ${sanitizeCnpj(clientCnpj)}`;
  ws.getCell('A2').font = { name: 'Segoe UI', size: 10, bold: true };

  ws.mergeCells('E2:G2');
  const minVal = olConfig?.pedido_minimo_rs ? Number(olConfig.pedido_minimo_rs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 3.000,00';
  ws.getCell('E2').value = `Canal: Operação Logística (OL) | Pedido Mínimo: ${minVal}`;
  ws.getCell('E2').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F766E' } };
  ws.getCell('E2').alignment = { horizontal: 'right' };

  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
  ws.getCell('A3').font = { name: 'Segoe UI', size: 9, italic: true };

  ws.mergeCells('E3:G3');
  const cond = `Condição: Prazo ${olConfig?.prazo_medio_dias || 45}d • Desc. Extra: ${olConfig?.desconto_extra_pct || 10}%`;
  ws.getCell('E3').value = cond;
  ws.getCell('E3').font = { name: 'Segoe UI', size: 9, italic: true };
  ws.getCell('E3').alignment = { horizontal: 'right' };

  if (observacoes) {
    ws.mergeCells('A4:G4');
    ws.getCell('A4').value = `Obs: ${observacoes}`;
    ws.getCell('A4').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
  }

  // Linha 6: Cabeçalhos das Colunas
  const headerRowIdx = 6;
  const colHeaders = [
    { key: 'item', title: 'Item', width: 8, align: 'center' },
    { key: 'codigo', title: 'Cód. BIG', width: 12, align: 'center' },
    { key: 'ean', title: 'EAN-13 (Barras)', width: 20, align: 'center' },
    { key: 'descricao', title: 'Descrição do Produto / Apresentação', width: 48, align: 'left' },
    { key: 'qtd', title: 'Qtd Pedida', width: 14, align: 'right' },
    { key: 'preco', title: 'Preço Custo (R$)', width: 16, align: 'right' },
    { key: 'total', title: 'Total Líquido (R$)', width: 18, align: 'right' },
  ];

  ws.columns = colHeaders.map(c => ({ header: c.title, key: c.key, width: c.width }));
  ws.getRow(headerRowIdx).height = 24;

  const headerRow = ws.getRow(headerRowIdx);
  colHeaders.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.title;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: col.align };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    };
  });

  // Linhas de Dados
  let curRowIdx = headerRowIdx + 1;
  let totalUnits = 0;
  let totalRs = 0;

  items.forEach((item, idx) => {
    const qty = Math.max(1, Math.round(Number(item.quantidade ?? item.sugestao_compra_un ?? item.qtd ?? 1)));
    const preco = Number(item.custo_unit ?? item.preco ?? 0);
    const lineTotal = Math.round((qty * preco) * 100) / 100;
    totalUnits += qty;
    totalRs += lineTotal;

    const row = ws.getRow(curRowIdx);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).value = Number(item.produto_id || item.codigo || 0);
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(3).value = sanitizeEan13(item.barras, item.produto_id);
    row.getCell(3).numFmt = '@';
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(4).value = String(item.descricao || item.nome || '').trim();
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(5).value = qty;
    row.getCell(5).numFmt = '#,##0';
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(6).value = preco;
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(7).value = lineTotal;
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.font = { name: 'Segoe UI', size: 9.5 };
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    curRowIdx += 1;
  });

  // Linha de Totais
  const totalRow = ws.getRow(curRowIdx);
  totalRow.height = 26;
  ws.mergeCells(`A${curRowIdx}:D${curRowIdx}`);
  const lblTot = totalRow.getCell(1);
  lblTot.value = `TOTAL DO PEDIDO OL (${items.length} ITENS):`;
  lblTot.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  lblTot.alignment = { vertical: 'middle', horizontal: 'right' };

  const cellTotQtd = totalRow.getCell(5);
  cellTotQtd.value = totalUnits;
  cellTotQtd.numFmt = '#,##0';
  cellTotQtd.font = { name: 'Segoe UI', size: 11, bold: true };
  cellTotQtd.alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.getCell(6).value = '';

  const cellTotRs = totalRow.getCell(7);
  cellTotRs.value = totalRs;
  cellTotRs.numFmt = '#,##0.00';
  cellTotRs.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F766E' } };
  cellTotRs.alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    };
  });

  return await workbook.xlsx.writeBuffer();
}


import ExcelJS from 'exceljs';

const XLSX_PATH = 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/cmed/Lista_PMC_20261109_111901661.xlsx';

async function main() {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(XLSX_PATH, {
    entries: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    worksheets: 'emit',
  });

  let sheetIndex = 0;
  for await (const worksheet of reader) {
    sheetIndex += 1;
    console.log(`\n=== SHEET ${sheetIndex}: ${worksheet.name} ===`);
    let rowCount = 0;
    for await (const row of worksheet) {
      rowCount += 1;
      if (rowCount <= 65) {
        const vals = row.values.slice(1).map((v) =>
          v && typeof v === 'object' && v.text ? v.text : v
        );
        const nonEmpty = vals.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
        if (nonEmpty.length > 0) {
          console.log(`Row ${rowCount} (${vals.length} cols):`, JSON.stringify(vals.slice(0, 18)));
        }
      } else {
        // continuar apenas para contar rapido? Nao precisa varrer todas as 30k linhas agora
        break;
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


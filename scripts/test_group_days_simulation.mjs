import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/analytics.db');
const latestRun = db.prepare('SELECT id FROM engine_runs ORDER BY id DESC LIMIT 1').get();
const runId = latestRun.id;

const allSkus = db.prepare(`
  SELECT 
    produto_id, descricao, labora, macro_categoria, abc_class, xyz_class,
    estoque_atual, estoque_reserva, transito_real, ddv_projetada, custo_unit, preco_venda,
    estoque_min, estoque_max, sugestao_compra_un, sugestao_compra_rs
  FROM engine_sku_results
  WHERE run_id = ?
`).all(runId);

console.log('Total SKUs in run:', allSkus.length);

// Simulação de Parâmetros de Dias por Curva (Sinergia Linx BIG):
// Curva A: min 3 dias, max 12 dias
// Curva B: min 7 dias, max 15 dias
// Curva C: min 10 dias, max 20 dias
// Curva D: 0 dias

const daysByCurvaMed = {
  A: { min: 3, max: 12 },
  B: { min: 7, max: 15 },
  C: { min: 10, max: 20 },
  D: { min: 0, max: 0 },
};

const daysByCurvaNonMed = {
  A: { min: 5, max: 15 },
  B: { min: 10, max: 20 },
  C: { min: 15, max: 25 },
  D: { min: 0, max: 0 },
};

let simBuyCount = 0;
let simTotalRs = 0;
let simBuyCurvaA = 0;
let simBuyCurvaB = 0;
let simBuyCurvaC = 0;

for (const s of allSkus) {
  if (s.ddv_projetada <= 0 || s.abc_class === 'D') continue;

  const isNonMed = ['PERFUMARIA_HPC', 'DERMOCOSMETICO', 'SUPLEMENTO_VITAMINA'].includes(s.macro_categoria);
  const cfg = isNonMed ? daysByCurvaNonMed[s.abc_class] : daysByCurvaMed[s.abc_class];

  const estMin = Math.max(1, Math.ceil(s.ddv_projetada * cfg.min));
  const estMax = Math.max(estMin, Math.ceil(s.ddv_projetada * cfg.max));

  const disp = s.estoque_atual - s.estoque_reserva + s.transito_real;

  // Trigger estrito de ponto de pedido: só compra se o estoque disponível atingiu ou caiu abaixo do mínimo!
  if (disp <= estMin) {
    const nec = Math.max(0, estMax - disp);
    if (nec > 0) {
      simBuyCount++;
      const val = nec * s.custo_unit;
      simTotalRs += val;
      if (s.abc_class === 'A') simBuyCurvaA += val;
      else if (s.abc_class === 'B') simBuyCurvaB += val;
      else if (s.abc_class === 'C') simBuyCurvaC += val;
    }
  }
}

console.log(`\n=== RESULTADO DA SIMULAÇÃO COM SINERGIA BIG (DIAS DE GRUPO + PONTO DE PEDIDO) ===`);
console.log(`SKUs com sugestão assertiva: ${simBuyCount}`);
console.log(`Valor total sugerido: R$ ${simTotalRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`  • Curva A: R$ ${simBuyCurvaA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`  • Curva B: R$ ${simBuyCurvaB.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`  • Curva C: R$ ${simBuyCurvaC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);


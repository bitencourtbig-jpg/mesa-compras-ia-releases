import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';
import { buildBuyerDecisionAnalysis } from '../src/services/buyerInterpreter.mjs';

const db = getAnalyticsDb();
const latestRun = db.prepare('SELECT id, client_code FROM engine_runs ORDER BY id DESC LIMIT 1').get();

console.log(`=== TESTE DE INTEGRIDADE MATEMÁTICA E REGRAS DE COMPRA (Run ID: ${latestRun.id}) ===\n`);

// Teste 1: BUSONID 50MCG (produto_id = 79641)
const busonidRow = db.prepare('SELECT * FROM engine_sku_results WHERE run_id = ? AND produto_id = 79641').get(latestRun.id);

if (!busonidRow) {
  console.error('ERRO: Busonid não encontrado no Run atual.');
  process.exit(1);
}

console.log('--- TESTE 1: BUSONID NO MODO PADRÃO LINX BIG ---');
const busonidPadrao = {
  ...busonidRow,
  is_custom_horizon: false,
};
const iaBusonidPadrao = buildBuyerDecisionAnalysis(busonidPadrao);
console.log('Saldo Físico:', busonidPadrao.estoque_atual);
console.log('Mínimo:', busonidPadrao.estoque_min);
console.log('Máximo:', busonidPadrao.estoque_max);
console.log('Sugestão Compra Un:', busonidPadrao.sugestao_compra_un);
console.log('Parecer Curto:', iaBusonidPadrao.parecerCurto);
console.log('Fórmula Texto:', iaBusonidPadrao.memoriaCalculo.formulaTexto);

console.log('\n--- TESTE 2: BUSONID NO MODO HORIZONTE 7 DIAS ---');
// Simula a lógica de server.mjs com customHorizon = 7
const ddv = Number(busonidRow.ddv_projetada || 0);
const lt = Number(busonidRow.lead_time_dias || 1);
const disp = Number(busonidRow.estoque_atual || 0) - Number(busonidRow.estoque_reserva || 0) + Number(busonidRow.transito_real || 0);
const diasSegHorizonte = Math.min(2, Math.max(1, Math.round(lt)));
const segHorizonte = Math.ceil(ddv * diasSegHorizonte);
const consumoCiclo = Math.ceil(ddv * 7);
const alvo = Math.max(1, consumoCiclo + segHorizonte);
const novaSugUn = Math.max(0, alvo - disp);

const busonidHorizon = {
  ...busonidRow,
  is_custom_horizon: true,
  dias_estoque_max: 7,
  estoque_seg: segHorizonte,
  estoque_max: alvo,
  sugestao_compra_un: novaSugUn,
  sugestao_compra_rs: Math.round(novaSugUn * Number(busonidRow.custo_unit || 0) * 100) / 100
};
const iaBusonidHorizon = buildBuyerDecisionAnalysis(busonidHorizon);
console.log('DDV:', ddv);
console.log('Dias Horizonte: 7');
console.log('Consumo no Horizonte:', consumoCiclo);
console.log('Segurança (Lead Time):', segHorizonte);
console.log('Alvo:', alvo);
console.log('Disponível:', disp);
console.log('Sugestão Compra Un:', novaSugUn);
console.log('Parecer Curto:', iaBusonidHorizon.parecerCurto);
console.log('Fórmula Texto:', iaBusonidHorizon.memoriaCalculo.formulaTexto);

// Teste 3: MOTILEX HA 60 CÁPSULAS (produto_id = 123949)
const motilexRow = db.prepare('SELECT * FROM engine_sku_results WHERE run_id = ? AND produto_id = 123949').get(latestRun.id);

if (motilexRow) {
  console.log('\n--- TESTE 3: MOTILEX COM RESERVA (19 est - 5 res = 14 disp) ---');
  const dispMot = Number(motilexRow.estoque_atual) - Number(motilexRow.estoque_reserva) + Number(motilexRow.transito_real);
  const motilexPadrao = {
    ...motilexRow,
    is_custom_horizon: false
  };
  const iaMotilexPadrao = buildBuyerDecisionAnalysis(motilexPadrao);
  console.log('Parecer Curto Motilex:', iaMotilexPadrao.parecerCurto);
  console.log('Fórmula Texto Motilex:', iaMotilexPadrao.memoriaCalculo.formulaTexto);
  
  // Valida que não existe "19 vs 17"
  if (iaMotilexPadrao.parecerCurto.includes('19 vs 17')) {
    console.error('FALHA: O texto ainda contém a incongruência 19 vs 17!');
  } else {
    console.log('SUCESSO: Paradoxo "19 vs 17" eliminado com sucesso.');
  }
}

console.log('\n=== TESTES CONCLUÍDOS COM SUCESSO ===');

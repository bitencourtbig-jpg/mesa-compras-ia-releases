// scripts/audit_status.mjs
import fs from 'fs';
import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

console.log('====================================================');
console.log('🔍 AUDITORIA GERAL DE PRONTIDÃO DO COCKPIT LINX BIG');
console.log('====================================================\n');

// 1. Backlog JSON
const backlogRaw = fs.readFileSync('./dev_reviews/backlog_melhorias.json', 'utf8');
const backlogData = JSON.parse(backlogRaw);
console.log(`[1] BACKLOG OFICIAL (dev_reviews/backlog_melhorias.json):`);
console.log(`    Total de Itens Cadastrados: ${backlogData.reviews.length}`);
const pendingJson = backlogData.reviews.filter(r => r.status !== 'concluido');
console.log(`    Itens Concluídos: ${backlogData.reviews.length - pendingJson.length}`);
console.log(`    Itens Pendentes: ${pendingJson.length}`);
if (pendingJson.length > 0) {
  pendingJson.forEach(p => console.log(`    ⚠️ Pendente: [${p.id}] ${p.titulo}`));
} else {
  console.log(`    ✅ 100% dos 19 itens de melhoria estão marcados como CONCLUÍDOS!`);
}

// 2. Reviews salvas no banco SQLite (Gravador de Críticas & Melhorias)
console.log(`\n[2] BANCO DE DADOS ANALYTICS (data/analytics.db):`);
const db = getAnalyticsDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(`    Tabelas no SQLite (${tables.length}): ${tables.map(t => t.name).join(', ')}`);

// Verificar se existe tabela de reviews ou gravações do modo dev
const devTable = tables.find(t => t.name.includes('review') || t.name.includes('critica') || t.name.includes('dev'));
if (devTable) {
  const reviewsDb = db.prepare(`SELECT * FROM ${devTable.name}`).all();
  console.log(`    Registros na tabela ${devTable.name}: ${reviewsDb.length}`);
  const pendentesDb = reviewsDb.filter(r => r.status !== 'concluido' && r.status !== 'resolvido');
  console.log(`    Pendentes na tabela: ${pendentesDb.length}`);
  pendentesDb.forEach(r => console.log(`      • [${r.id}] ${r.titulo || r.description || r.mensagem}`));
} else {
  console.log(`    ℹ️ Não há tabela dedicada 'dev_reviews' no SQLite; as melhorias são mantidas no arquivo versionado.`);
}

// 3. Status das Runs do Motor
const runs = db.prepare("SELECT * FROM engine_runs ORDER BY id DESC LIMIT 5").all();
console.log(`\n[3] ÚLTIMAS EXECUÇÕES DO MOTOR DE COMPRAS:`);
runs.forEach(r => {
  const s = JSON.parse(r.summary_json || '{}');
  console.log(`    Run #${r.id} (${r.created_at}) - Filial ${r.filial_id}:`);
  console.log(`      SKUs: ${r.total_skus} | Sugestão Líquida: ${r.sugestao_total_un} un (R$ ${Number(r.sugestao_total_rs).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
  console.log(`      Rupturas Curva A/B: ${s.rupturas_a_b || 0} | Excesso: R$ ${Number(s.excesso_max_rs || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
});

// 4. Módulos & Endpoints do Servidor
console.log(`\n[4] AUDITORIA DE ROTAS DA API:`);
const endpointsToTest = [
  { name: 'Overview & KPIs', url: 'http://127.0.0.1:3456/api/overview' },
  { name: 'Mesa de SKUs (Buy)', url: 'http://127.0.0.1:3456/api/skus?tab=buy&limit=5' },
  { name: 'Mesa de SKUs (Exceptions)', url: 'http://127.0.0.1:3456/api/skus?tab=exceptions&limit=5' },
  { name: 'Mesa de SKUs (PBM Replenish)', url: 'http://127.0.0.1:3456/api/skus?tab=pbm_replenish&limit=5' },
  { name: 'Árvore de Grupos (Cache/Fast)', url: 'http://127.0.0.1:3456/api/groups/tree' },
  { name: 'Glossário Técnico', url: 'http://127.0.0.1:3456/api/glossary' },
  { name: 'BI Executivo', url: 'http://127.0.0.1:3456/api/bi' },
  { name: 'Moléculas Intercambiáveis', url: 'http://127.0.0.1:3456/api/molecules?limit=5' },
  { name: 'Varredura da Molécula (Sweep)', url: 'http://127.0.0.1:3456/api/molecules/sweep?skuId=119732' },
  { name: 'Configurações de Grupos', url: 'http://127.0.0.1:3456/api/config/groups' },
];

let allOk = true;
for (const ep of endpointsToTest) {
  try {
    const t0 = Date.now();
    const res = await fetch(ep.url);
    const ms = Date.now() - t0;
    if (res.ok) {
      console.log(`    ✅ ${ep.name.padEnd(30)} -> HTTP ${res.status} (${ms}ms)`);
    } else {
      console.log(`    ❌ ${ep.name.padEnd(30)} -> HTTP ${res.status} (${ms}ms)`);
      allOk = false;
    }
  } catch (err) {
    console.log(`    ❌ ${ep.name.padEnd(30)} -> FALHA: ${err.message}`);
    allOk = false;
  }
}

console.log('\n====================================================');
if (allOk && pendingJson.length === 0) {
  console.log('🎉 STATUS GLOBAL: TUDO DESENVOLVIDO ESTÁ PRONTO E VALIDADO!');
} else {
  console.log('⚠️ STATUS GLOBAL: EXISTEM PENDÊNCIAS A REVISAR.');
}
console.log('====================================================\n');


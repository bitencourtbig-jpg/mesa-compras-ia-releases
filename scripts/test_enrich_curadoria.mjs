import { getAnalyticsDb, getMotorTransfers, getFilialPolicies } from '../src/store/analyticsDb.mjs';
const db = getAnalyticsDb();

const latestRun = db.prepare('SELECT id FROM engine_runs WHERE client_code = ? ORDER BY id DESC LIMIT 1').get('bandeirante');
const clientCode = 'bandeirante';

// Get filiais policies
const filiais = getFilialPolicies(clientCode);
const filMap = new Map(filiais.map(f => [Number(f.filial_id), f]));

// Transfers from motor
const transfers = getMotorTransfers(clientCode);

// Buyer learning log
const logs = db.prepare(`
  SELECT id, filial_id, produto_id, molecule_key, descricao, tipo_evento, motivo, acao_futura, created_at
  FROM buyer_learning_log
  WHERE client_code = ? AND tipo_evento IN ('DEDUZIU_ESTOQUE_MOLECULA', 'REMANEJOU_E_CANCELOU_COMPRA_EXTERNA', 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL')
  ORDER BY id DESC
`).all(clientCode);

console.log(`Found ${logs.length} curadoria logs.`);

// Group by produto_id
const grouped = new Map();
for (const l of logs) {
  if (!grouped.has(l.produto_id)) {
    grouped.set(l.produto_id, {
      produto_id: l.produto_id,
      descricao: l.descricao,
      molecule_key: l.molecule_key,
      actions: [],
      total_un_abatidas: 0,
      lojas_canceladas: new Set(),
      created_at: l.created_at,
    });
  }
  const g = grouped.get(l.produto_id);
  g.actions.push(l);
  if (l.filial_id > 0) g.lojas_canceladas.add(l.filial_id);
  
  // Parse un from motivo if possible
  const match = l.motivo.match(/(\d+)\s*un/i);
  if (match) {
    const un = Number(match[1]);
    if (l.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA') {
      g.total_un_abatidas = Math.max(g.total_un_abatidas, un);
    } else if (l.tipo_evento === 'CANCELOU_COMPRA_FILIAL_INDIVIDUAL') {
      // If no bulk deduct, accumulate
      if (!g.actions.some(a => a.tipo_evento === 'DEDUZIU_ESTOQUE_MOLECULA')) {
        g.total_un_abatidas += un;
      }
    }
  }
}

// Enrich with SKU and alternative stock across the network
const result = [];
for (const [pId, g] of grouped.entries()) {
  const skuInfo = db.prepare(`
    SELECT produto_id, barras, descricao, labora, custo_unit, preco_venda, abc_class
    FROM engine_sku_results
    WHERE run_id = ? AND produto_id = ?
    LIMIT 1
  `).get(latestRun.id, pId);

  // Find stores that have alternative stock of this molecule
  let altStockStores = [];
  if (g.molecule_key) {
    altStockStores = db.prepare(`
      SELECT filial_id, produto_id, descricao, labora, estoque_atual, abc_class
      FROM engine_sku_results
      WHERE run_id = ? AND molecule_key = ? AND produto_id <> ? AND estoque_atual > 0
      ORDER BY estoque_atual DESC
    `).all(latestRun.id, g.molecule_key, pId);
  }

  // Check if a transfer already exists for this product
  const existingTransfer = transfers.find(t => 
    t.itens && t.itens.some(it => it.produto_id === pId) || 
    (t.observacao && t.observacao.includes(g.molecule_key))
  );

  const custo = skuInfo?.custo_unit || 0;
  const economiaRs = Math.round(g.total_un_abatidas * custo * 100) / 100;

  result.push({
    produto_id: pId,
    descricao: skuInfo?.descricao || g.descricao,
    barras: skuInfo?.barras || '',
    labora: skuInfo?.labora || '',
    molecule_key: g.molecule_key,
    total_un_abatidas: g.total_un_abatidas,
    custo_unit: custo,
    economia_rs: economiaRs,
    lojas_canceladas: Array.from(g.lojas_canceladas).map(fId => ({
      filial_id: fId,
      nome: filMap.get(fId)?.nome_reduz || `Loja ${fId}`
    })),
    lojas_doadoras: altStockStores.map(s => ({
      filial_id: s.filial_id,
      nome: filMap.get(s.filial_id)?.nome_reduz || `Loja ${s.filial_id}`,
      estoque_atual: s.estoque_atual,
      labora: s.labora,
      descricao: s.descricao
    })),
    transfer_emitted: existingTransfer ? {
      codigo: existingTransfer.codigo_transferencia,
      id: existingTransfer.id,
      status: existingTransfer.status,
      filial_origem: existingTransfer.filial_origem_nome,
      filial_destino: existingTransfer.filial_destino_nome
    } : null,
    created_at: g.created_at
  });
}

console.log('Result enriched decisions:', JSON.stringify(result, null, 2));

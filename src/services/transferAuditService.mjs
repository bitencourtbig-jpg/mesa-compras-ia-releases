import { createReadOnlyConnection, runReadOnlyQuery } from '../../db/client.mjs';
import { getAnalyticsDb, getClientProfile } from '../store/analyticsDb.mjs';

const cacheMap = new Map();
const CACHE_TTL_MS = 30_000; // 30 segundos de cache para ultra performance

/**
 * Coleta todas as pendências operacionais em aberto:
 * 1. Guias emitidas pelo Motor de Remanejamento (SQLite)
 * 2. Transferências pendentes no Linx BIG (MySQL)
 * 3. Notas Fiscais de Distribuidoras faturadas sem entrada dada (NFe em trânsito no Linx BIG)
 * 4. Pedidos de compra em aberto com distribuidoras nos últimos 30 dias (Linx BIG)
 */
export async function getOpenTransitsAndOrdersAudit(clientCode) {
  const cached = cacheMap.get(clientCode);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.auditIndex;
  }

  const profile = getClientProfile(clientCode) || {};
  const db = getAnalyticsDb();

  // 1. Guias emitidas no Motor de Remanejamento (SQLite)
  const motorRows = db.prepare(`
    SELECT t.id, t.codigo_transferencia, t.status, t.filial_origem, t.filial_destino, t.data_emissao,
           ti.produto_id, ti.qtd_solicitada, ti.descricao
    FROM motor_transferencia_itens ti
    JOIN motor_transferencias t ON t.id = ti.transferencia_id
    WHERE t.client_code = ? AND t.status IN ('PENDENTE_SEPARACAO', 'EM_TRANSITO')
  `).all(clientCode);

  const motorTransfersByDest = new Map(); // key: `${filial_destino}|${produto_id}`
  const motorTransfersByRoute = new Map(); // key: `${filial_origem}->${filial_destino}|${produto_id}`

  for (const r of motorRows) {
    const destKey = `${r.filial_destino}|${r.produto_id}`;
    const routeKey = `${r.filial_origem}->${r.filial_destino}|${r.produto_id}`;
    
    if (!motorTransfersByDest.has(destKey)) {
      motorTransfersByDest.set(destKey, []);
    }
    motorTransfersByDest.get(destKey).push(r);

    if (!motorTransfersByRoute.has(routeKey)) {
      motorTransfersByRoute.set(routeKey, []);
    }
    motorTransfersByRoute.get(routeKey).push(r);
  }

  // Mapas para dados do MySQL BIG
  const bigTransfersByDest = new Map(); // key: `${filial_destino}|${produto_id}`
  const bigNfeByDest = new Map();       // key: `${filial_destino}|${produto_id}`
  const bigOrdersByDest = new Map();    // key: `${filial_destino}|${produto_id}`

  let conn = null;
  try {
    conn = await createReadOnlyConnection(profile);

    // 2. Transferências pendentes no Linx BIG (recebido = 'N' AND apagado = 'N')
    try {
      const transfRows = await runReadOnlyQuery(conn, `
        SELECT defilial_id, parafilial_id, produto_id, SUM(qtde) AS qtd, MAX(data_hora) AS data_hora
        FROM transferencia
        WHERE apagado = 'N' AND recebido = 'N'
        GROUP BY defilial_id, parafilial_id, produto_id
      `);
      for (const t of transfRows) {
        const destKey = `${t.parafilial_id}|${t.produto_id}`;
        if (!bigTransfersByDest.has(destKey)) bigTransfersByDest.set(destKey, []);
        bigTransfersByDest.get(destKey).push(t);
      }
    } catch (err) {
      console.warn('[transferAuditService] Aviso ao consultar transferencia do Linx BIG:', err.message);
    }

    // 3. Notas de Distribuidora Faturadas Pendentes de Entrada (nfe_cab.importada = 'N')
    try {
      const nfeRows = await runReadOnlyQuery(conn, `
        SELECT nc.fillogica_id AS filial_id, nd.produto_id, SUM(nd.qtde) AS qtd,
               MAX(nc.emit_fantasia) AS fornecedor_nome, MAX(nc.dtemissao) AS dt_emissao
        FROM nfe_cab nc
        JOIN nfe_det nd ON nd.filfisica_id = nc.filfisica_id AND nd.nfe_cab_id = nc.nfe_cab_id AND nd.apagado = 'N'
        WHERE nc.apagado = 'N' AND nc.importada = 'N'
        GROUP BY nc.fillogica_id, nd.produto_id
      `);
      for (const n of nfeRows) {
        const destKey = `${n.filial_id}|${n.produto_id}`;
        if (!bigNfeByDest.has(destKey)) bigNfeByDest.set(destKey, []);
        bigNfeByDest.get(destKey).push(n);
      }
    } catch (err) {
      console.warn('[transferAuditService] Aviso ao consultar nfe_cab do Linx BIG:', err.message);
    }

    // 4. Pedidos de Compra de Distribuidora em Aberto (pedidos pendentes nos últimos 30 dias)
    try {
      const orderRows = await runReadOnlyQuery(conn, `
        SELECT p.filial_id, p.produto_id, SUM(p.pedir) AS qtd,
               MAX(f.nome) AS fornecedor_nome, MAX(p.datahora) AS dt_pedido
        FROM pedidos p
        LEFT JOIN fornece f ON f.fornece_id = p.fornece_id
        WHERE p.apagado = 'N' AND COALESCE(p.falta, 'N') <> 'S'
          AND p.datahora >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY p.filial_id, p.produto_id
      `);
      for (const o of orderRows) {
        const destKey = `${o.filial_id}|${o.produto_id}`;
        if (!bigOrdersByDest.has(destKey)) bigOrdersByDest.set(destKey, []);
        bigOrdersByDest.get(destKey).push(o);
      }
    } catch (err) {
      console.warn('[transferAuditService] Aviso ao consultar pedidos em aberto do Linx BIG:', err.message);
    }

  } catch (err) {
    console.warn('[transferAuditService] MySQL BIG indisponível para auditoria ao vivo, usando histórico SQLite:', err.message);
  } finally {
    if (conn) {
      try { await conn.end(); } catch {}
    }
  }

  /**
   * Helper para auditoria rápida por item e filial
   */
  const auditIndex = {
    getAudit(filialOrigem, filialDestino, produtoId, faltaDestino = 0) {
      const destKey = `${filialDestino}|${produtoId}`;
      const routeKey = `${filialOrigem}->${filialDestino}|${produtoId}`;

      const motorItems = motorTransfersByDest.get(destKey) || [];
      const bigTransfItems = bigTransfersByDest.get(destKey) || [];
      const nfeItems = bigNfeByDest.get(destKey) || [];
      const orderItems = bigOrdersByDest.get(destKey) || [];

      // Qtds
      const transfMotorQtd = motorItems.reduce((acc, m) => acc + Number(m.qtd_solicitada || 0), 0);
      const transfBigQtd = bigTransfItems.reduce((acc, b) => acc + Number(b.qtd || 0), 0);
      const transfTotalQtd = transfMotorQtd + transfBigQtd;

      const nfeQtd = nfeItems.reduce((acc, n) => acc + Number(n.qtd || 0), 0);
      const orderQtd = orderItems.reduce((acc, o) => acc + Number(o.qtd || 0), 0);

      const totalChegando = transfTotalQtd + nfeQtd + orderQtd;
      const temPendencias = totalChegando > 0;

      // Guias e fornecedores
      const guias = [
        ...motorItems.map((m) => m.codigo_transferencia),
        ...bigTransfItems.map((b) => `Linx F${b.defilial_id}➔F${b.parafilial_id}`),
      ].filter(Boolean);

      const nfeFornecedores = [...new Set(nfeItems.map((n) => n.fornecedor_nome).filter(Boolean))];
      const pedidoFornecedores = [...new Set(orderItems.map((o) => o.fornecedor_nome).filter(Boolean))];

      const dtNfe = nfeItems[0]?.dt_emissao ? String(nfeItems[0].dt_emissao).slice(0, 10) : '';
      const dtPedido = orderItems[0]?.dt_pedido ? String(orderItems[0].dt_pedido).slice(0, 10) : '';

      // Mensagens de alerta amigáveis
      const alertMsgs = [];
      if (nfeQtd > 0) {
        const fornStr = nfeFornecedores.length ? ` (${nfeFornecedores.join(', ')})` : '';
        alertMsgs.push(`🚚 NFe faturada pendente: +${nfeQtd} un${fornStr}`);
      }
      if (transfTotalQtd > 0) {
        const guiasStr = guias.length ? ` [${guias.join(', ')}]` : '';
        alertMsgs.push(`🔄 Já em transferência interna: +${transfTotalQtd} un${guiasStr}`);
      }
      if (orderQtd > 0) {
        const fornStr = pedidoFornecedores.length ? ` (${pedidoFornecedores.join(', ')})` : '';
        alertMsgs.push(`📦 Pedido em aberto distribuidora: +${orderQtd} un${fornStr}`);
      }

      // Risco de duplicidade: se a soma de NFe + Transferências já atende a falta da loja receptora
      const riscoDuplicidade = faltaDestino > 0 && (nfeQtd + transfTotalQtd) >= faltaDestino;

      return {
        temPendencias,
        totalChegando,
        transfTotalQtd,
        transfMotorQtd,
        transfBigQtd,
        guias,
        nfeQtd,
        nfeFornecedores,
        dtNfe,
        orderQtd,
        pedidoFornecedores,
        dtPedido,
        alertMsgs,
        riscoDuplicidade,
      };
    }
  };

  cacheMap.set(clientCode, { timestamp: now, auditIndex });
  return auditIndex;
}

export function clearTransitAuditCache(clientCode) {
  if (clientCode) cacheMap.delete(clientCode);
  else cacheMap.clear();
}

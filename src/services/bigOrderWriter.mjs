import { createWriteConnection } from '../../db/client.mjs';
import { getAnalyticsDb } from '../store/analyticsDb.mjs';

/**
 * Insere um lote de cotação/pedido diretamente na tabela nativa `pedidos` do Linx Farma BIG,
 * seguindo com rigor absoluto a engenharia e as regras de sequência do próprio ERP:
 *
 * 1. O `numlanc` é gerado através da tabela oficial central `nlanc` (auto_increment do BIG),
 *    garantindo que a numeração avance na sequência global do ERP e nunca colida com
 *    vendas de balcão (movment), orçamentos ou outras filiais;
 * 2. Todos os 35+ campos nativos são povoados com os mesmos valores e flags padrão
 *    que a tela de compras do BIG gera (lojas_leram='0', dafilial_id, nfilial, gp, ep,
 *    fabricantes_id, estoque, demanda, valid_pro='2099-12-31');
 * 3. Toda a operação é executada sob transação ACID (commit ou rollback total);
 * 4. Auditoria salva no SQLite local (`big_orders_log`).
 *
 * @param {Object} profile Perfil da farmácia compradora
 * @param {Object} payload
 * @param {Array<Object>} payload.items Lista de produtos a pedir
 * @param {number|string} [payload.supplierId] ID do fornecedor alvo
 * @param {string} [payload.supplierName] Razão social do fornecedor alvo
 * @param {string} [payload.notes] Observação opcional
 * @returns {Promise<Object>} Resultado da gravação com numlanc oficial gerado
 */
export async function insertBigPedidos(profile, { items, supplierId = null, supplierName = null, notes = '', targetFilialId = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Nenhum item selecionado para gravar pedido no BIG.');
  }

  const conn = await createWriteConnection(profile);
  const targetSupplierId = Number(supplierId ?? profile.default_supplier_id ?? 0);
  const targetSupplierName = String(supplierName || profile.default_supplier_name || 'COTAÇÃO MOTOR INTELIGENTE').slice(0, 50);
  const buyerFilialId = Number(profile.buyer_filial_id || 1);
  const effectiveTargetFilialId = Number(targetFilialId || items[0]?.filial_id || (buyerFilialId === 1 ? 2 : buyerFilialId));

  try {
    // 1. Obter dados das filiais (escritório comprador vs filial física de entrega)
    const [filialRows] = await conn.query(
      "SELECT filial_id, nome FROM filial WHERE filial_id IN (?, ?) AND apagado = 'N'",
      [buyerFilialId, effectiveTargetFilialId]
    );
    const filialMap = new Map(filialRows.map((f) => [f.filial_id, f.nome]));
    const buyerFilialNome = String(filialMap.get(buyerFilialId) || `LOJA ${buyerFilialId}`).slice(0, 35);
    const targetFilialNome = String(filialMap.get(effectiveTargetFilialId) || `LOJA ${effectiveTargetFilialId}`).slice(0, 35);

    // 2. Iniciar transação ACID no MariaDB
    await conn.beginTransaction();

    // 3. Obter o numlanc OFICIAL através da tabela geradora central do Linx BIG (nlanc)
    let numlanc = null;
    try {
      const [nlancRes] = await conn.query('INSERT INTO nlanc () VALUES ()');
      numlanc = Number(nlancRes.insertId);
    } catch {
      // Fallback defensivo com bloqueio de leitura FOR UPDATE para evitar colisão com vendas simultâneas
      const [maxRows] = await conn.query(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(nlanc_id) FROM nlanc), 0),
          COALESCE((SELECT MAX(numlanc) FROM pedidos), 0),
          COALESCE((SELECT MAX(numlanc) FROM movment), 0)
        ) AS max_num
        FOR UPDATE
      `);
      numlanc = Number(maxRows[0]?.max_num || 50580000) + 1;
    }

    const insertSql = `
      INSERT INTO pedidos (
        filial_id,
        dafilial_id,
        nfilial,
        produto_id,
        pedir,
        pedir_sugerido,
        datahora,
        numlanc,
        marcado,
        barras,
        lojas_leram,
        apagado,
        descricao,
        preco_cmp_un,
        preco_vnd,
        preco_pro,
        labora,
        estoque,
        mediavenda,
        dgrupo,
        gp,
        ep,
        comprar,
        fornece_id,
        comprarfornece_id,
        cotacao_fornece_id,
        cotacao_fornece_nome,
        desconto,
        recebido,
        falta,
        fabricantes_id,
        minimo,
        cotacao_online,
        unid_caixa,
        preco_manual,
        desconto_manual,
        demanda,
        demandames,
        valid_pro,
        obs
      ) VALUES (
        ?, ?, ?, ?, ?, ?, NOW(), ?, 'N', ?, '0', 'N', ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 'N', 'N', ?, 0, 'N', 0, 'N', 'N', ?, ?, '2099-12-31', ?
      )
    `;

    let totalUnits = 0;
    let totalRs = 0;
    const insertedItems = [];

    for (const it of items) {
      const pId = Number(it.produto_id || it.codigo);
      const qty = Math.max(1, Math.round(Number(it.quantidade ?? it.sugestao_compra_un ?? 1)));
      const origSug = Math.max(0, Math.round(Number(it.sugestao_compra_un ?? qty)));
      const barras = String(it.barras || '').slice(0, 13);
      const desc = String(it.descricao || 'PRODUTO').slice(0, 60);
      const custo = Math.max(0, Number(it.preco_target ?? it.custo_unit ?? 0));
      const precoVnd = Math.max(0, Number(it.preco_venda ?? 0));
      const precoPro = Math.max(0, Number(it.preco_pro ?? it.preco_venda ?? 0));
      const labora = String(it.labora || '').slice(0, 40);
      const estoqueAtual = Math.max(0, Math.round(Number(it.estoque_atual || 0)));
      const dgrupo = String(it.macro_categoria || it.grupo_nome || 'DIVERSOS').slice(0, 40);
      const gp = Number(it.grupo_id || 0);
      const ep = Number(it.espec_id || 0);
      const fabricantesId = Number(it.fabricantes_id || 0);

      const rowSupplierId = Number(it.melhor_fornecedor_30d_id || targetSupplierId);
      const rowSupplierName = String(it.melhor_fornecedor_30d_nome || targetSupplierName).slice(0, 50);
      const comprarDesc = rowSupplierName || 'NAO IDENTIFICADO';

      const ddv = Math.max(0, Number(it.ddv_projetada || it.ddv || 0));
      const ddvMes = Math.round(ddv * 30 * 100) / 100;
      const rowObs = notes || `Lote #${numlanc} - Motor Inteligente de Compras`;

      const itemDaFilialId = it.filial_id ? Number(it.filial_id) : effectiveTargetFilialId;
      const itemDaFilialNome = String(filialMap.get(itemDaFilialId) || targetFilialNome).slice(0, 35);

      await conn.query(insertSql, [
        buyerFilialId,
        itemDaFilialId,
        itemDaFilialNome,
        pId,
        qty,
        origSug,
        numlanc,
        barras,
        desc,
        custo.toFixed(2),
        precoVnd.toFixed(2),
        precoPro.toFixed(2),
        labora,
        estoqueAtual,
        dgrupo,
        gp,
        ep,
        comprarDesc,
        rowSupplierId,
        rowSupplierId,
        rowSupplierId,
        rowSupplierName,
        fabricantesId,
        ddv.toFixed(3),
        ddvMes.toFixed(2),
        rowObs,
      ]);

      totalUnits += qty;
      totalRs += qty * custo;
      insertedItems.push({
        produto_id: pId,
        descricao: desc,
        quantidade: qty,
        custo_unit: custo,
        subtotal: Math.round(qty * custo * 100) / 100,
      });
    }

    // 4. Confirmar gravação no Linx BIG
    await conn.commit();

    // 5. Registrar auditoria local no SQLite
    try {
      const db = getAnalyticsDb();
      db.prepare(`
        INSERT INTO big_orders_log (
          client_code, numlanc, filial_id, supplier_id, supplier_name,
          total_items, total_units, total_rs, export_channel, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BIG_DIRECT', ?)
      `).run(
        profile.code,
        numlanc,
        effectiveTargetFilialId,
        targetSupplierId,
        targetSupplierName,
        items.length,
        totalUnits,
        Math.round(totalRs * 100) / 100,
        JSON.stringify(insertedItems)
      );
    } catch (auditErr) {
      console.warn('Erro ao salvar auditoria de pedido no SQLite:', auditErr.message);
    }

    return {
      ok: true,
      numlanc,
      filialId: buyerFilialId,
      filialNome: buyerFilialNome,
      targetFilialId: effectiveTargetFilialId,
      targetFilialNome,
      supplierId: targetSupplierId,
      supplierName: targetSupplierName,
      totalItems: items.length,
      totalUnits,
      totalRs: Math.round(totalRs * 100) / 100,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    throw new Error(`Falha ao gravar pedido no banco BIG (pedidos): ${err.message}`);
  } finally {
    try {
      await conn.end();
    } catch {}
  }
}

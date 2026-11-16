import { createReadOnlyConnection, runReadOnlyQuery } from '../../db/client.mjs';
import { getFilialPolicies, upsertFilialPolicy, getPendingTransfersItemsMap } from '../store/analyticsDb.mjs';

function addDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Conecta em modo SOMENTE LEITURA no MariaDB/MySQL do BIG e extrai todos
 * os blocos necessarios para o motor de compras, moleculas, PBM, lotes e entradas.
 */
export async function syncBigClientData(profile, { referenceDate = null } = {}) {
  const t0 = Date.now();
  const conn = await createReadOnlyConnection(profile);

  try {
    // 1. Filiais e topologia
    const filiais = await runReadOnlyQuery(
      conn,
      `SELECT filial_id, nome, reduz, cgc, escritorio, apagado, calcdemanda, filialestoque_id
       FROM filial
       WHERE apagado = 'N'
       ORDER BY filial_id`
    );

    const filiaisIdsValidas = new Set(filiais.map((f) => Number(f.filial_id)));

    // Suporte a modo Loja Local (ponta) vs Modo Central (escritorio consolidador)
    let rawSales = [];
    if (profile.operation_mode === 'local' && profile.target_filial_id) {
      rawSales = [Number(profile.target_filial_id)];
    } else if (profile.active_sales_filials?.length) {
      rawSales = profile.active_sales_filials.map(Number);
    } else {
      rawSales = filiais
        .filter((f) => f.escritorio !== 'S' && !profile.ignored_filials?.includes(f.filial_id))
        .map((f) => Number(f.filial_id));
    }

    // Sanitização estrita: apenas números inteiros válidos e existentes no ERP
    const salesFilials = rawSales.filter((id) => Number.isFinite(id) && id > 0 && filiaisIdsValidas.has(id));
    const buyerFilialId = Number(profile.buyer_filial_id || (salesFilials[0] || 1));
    const allScopeFilials = [...new Set([buyerFilialId, ...salesFilials])].filter((id) => Number.isFinite(id) && id > 0);

    const scopeIn = allScopeFilials.length ? allScopeFilials.join(',') : '1';
    const salesIn = salesFilials.length ? salesFilials.join(',') : '1';

    // 2. Data de referencia ("ontem" em relacao a ultima venda ativa no banco)
    let refDate = referenceDate;
    if (!refDate) {
      const ultRows = await runReadOnlyQuery(
        conn,
        `SELECT DATE(MAX(ultvenda)) AS max_ult
         FROM estoque_minimo
         WHERE filial_id IN (${salesIn}) AND apagado = 'N' AND ultvenda IS NOT NULL`
      );
      const maxUlt = ultRows[0]?.max_ult || new Date().toISOString().slice(0, 10);
      refDate = addDaysIso(maxUlt, -1);
    }

    const start91 = addDaysIso(refDate, -90); // 91 dias fechados: [start91 .. refDate]
    const endExcl = addDaysIso(refDate, 1);

    // 2.1 Maturidade de cada loja & Politicas de Carencia Multi-Loja (Ultra-Rápido via Políticas e Índice Direto)
    const existingPolicies = getFilialPolicies(profile.code);
    const policiesMap = new Map(existingPolicies.map((p) => [Number(p.filial_id), p]));
    const filiaisMetadata = [];

    for (const f of filiais) {
      const fId = Number(f.filial_id);
      let policy = policiesMap.get(fId);

      let inauDate = policy?.data_inauguracao;
      if (!inauDate && f.escritorio !== 'S') {
        try {
          const minRows = await runReadOnlyQuery(
            conn,
            `SELECT DATE(data_hora) AS primeira_venda
             FROM movment
             WHERE filial_id = ? AND oper IN (2, 3) AND apagado = 'N'
             ORDER BY data_hora ASC LIMIT 1`,
            [fId],
            { timeout: 3000 }
          );
          if (minRows?.[0]?.primeira_venda) {
            inauDate = String(minRows[0].primeira_venda).slice(0, 10);
          }
        } catch (_errMin) {
          // Fallback seguro caso banco do cliente demore
        }
      }

      // Se filial 4 e a data gravada for anterior a outubro/2026 devido a transacao isolada de teste de PDV,
      // utiliza a data real de inicio das operacoes continuas (02/10/2026)
      if (fId === 4 && (!inauDate || inauDate < '2026-10-01')) {
        inauDate = '2026-10-02';
      }

      let diasOperacao = 999;
      if (inauDate) {
        diasOperacao = Math.max(1, Math.floor((new Date(refDate) - new Date(inauDate)) / (1000 * 86400)));
      } else if (f.escritorio === 'S') {
        diasOperacao = 9999;
      }

      if (!policy) {
        // Sugestao inteligente do motor: 90 dias de carencia para lojas com menos de 120 dias de operacao
        const isRecemInaugurada = (diasOperacao <= 120 || fId === 4) && f.escritorio !== 'S';
        const nomeReduzPadrao = (fId === 4 && f.reduz === 'DROG. DR.VI') ? 'H. GABRIEL' : (f.reduz || f.nome.slice(0, 15));
        policy = {
          client_code: profile.code,
          filial_id: fId,
          nome_loja: f.nome,
          nome_reduz: nomeReduzPadrao,
          data_inauguracao: inauDate,
          dias_carencia: 90,
          bloquear_doacao_remanejamento: isRecemInaugurada ? 1 : 0,
          tipo_reposicao: isRecemInaugurada ? 'sellout_1to1' : 'curva_motor'
        };
        upsertFilialPolicy(policy);
      }

      const diasCarencia = Number(policy.dias_carencia) || 90;
      const bloquearDoacao = Number(policy.bloquear_doacao_remanejamento) === 1;
      const emCarencia = (diasOperacao <= diasCarencia) && f.escritorio !== 'S';
      const tipoReposicao = policy.tipo_reposicao || (emCarencia ? 'sellout_1to1' : 'curva_motor');
      const nomeReduzFinal = (fId === 4 && (!policy.nome_reduz || policy.nome_reduz === 'DROG. DR.VI'))
        ? 'H. GABRIEL'
        : (policy.nome_reduz || f.reduz || f.nome.slice(0, 15));

      filiaisMetadata.push({
        filial_id: fId,
        nome: f.nome,
        reduz: nomeReduzFinal,
        cgc: f.cgc,
        escritorio: f.escritorio === 'S',
        diasOperacao,
        primeiraVenda: inauDate,
        emCarencia,
        diasCarencia,
        bloquearDoacao,
        tipoReposicao
      });
    }

    const pendingTransfers = getPendingTransfersItemsMap(profile.code);

    // Complementa com transferências em trânsito nativas do Linx BIG (transferencia WHERE recebido = 'N' AND apagado = 'N')
    try {
      const bigPendingTransfers = await runReadOnlyQuery(
        conn,
        `SELECT defilial_id, parafilial_id, produto_id, SUM(COALESCE(qtde, 0)) AS qty_transf
         FROM transferencia
         WHERE recebido = 'N' AND apagado = 'N'
           AND (defilial_id IN (${scopeIn}) OR parafilial_id IN (${scopeIn}))
         GROUP BY defilial_id, parafilial_id, produto_id`
      );
      for (const bt of bigPendingTransfers) {
        const destKey = `${bt.parafilial_id}|${bt.produto_id}`;
        const origKey = `${bt.defilial_id}|${bt.produto_id}`;
        const q = Number(bt.qty_transf || 0);
        pendingTransfers.incomingMap.set(destKey, (pendingTransfers.incomingMap.get(destKey) || 0) + q);
        pendingTransfers.outgoingMap.set(origKey, (pendingTransfers.outgoingMap.get(origKey) || 0) + q);
      }
    } catch (errBigTransf) {
      console.warn('[SYNC] Aviso ao consultar transferencia do Linx BIG:', errBigTransf.message);
    }

    // Janelas YoY para sazonalidade historica (ano anterior)
    const lyNextStart = addDaysIso(refDate, -364);
    const lyNextEndExcl = addDaysIso(refDate, -334); // proximos 30d do ano passado
    const lyPrevStart = addDaysIso(refDate, -424); // 60d base antes daquela data

    // 3. Produtos, grupos, barras adicionais, estoque, custo, precos e bloqueios
    const products = await runReadOnlyQuery(
      conn,
      `SELECT p.Produto_id AS produto_id,
              p.descricao,
              COALESCE(NULLIF(TRIM(p.labora), ''), fab.descricao, '') AS labora,
              COALESCE(p.fabricantes_id, 0) AS fabricantes_id,
              COALESCE(fab.descricao, '') AS fabricante_nome,
              COALESCE(p.barras, '') AS prod_barras,
              COALESCE(p.gtin14, '') AS gtin14,
              COALESCE(p.registro_ms, '') AS registro_ms,
              COALESCE(p.medicamento, 'N') AS medicamento,
              COALESCE(p.taxa_entrega, 'N') AS taxa_entrega,
              GREATEST(COALESCE(p.qt_fr, 1), 1) AS qt_fr,
              GREATEST(COALESCE(p.qtde_apres, 1), 1) AS qtde_apres,
              COALESCE(p.grupo_id, 0) AS grupo_id,
              COALESCE(g.descricao, 'SEM GRUPO') AS grupo_nome,
              COALESCE(g.codigo, '') AS grupo_codigo,
              COALESCE(g.desc_arvore, '') AS grupo_desc_arvore,
              CASE 
                WHEN LOCATE('.', g.codigo) > 0 THEN SUBSTRING_INDEX(g.codigo, '.', 1)
                ELSE COALESCE(g.codigo, '') 
              END AS grupo_codigo_pai,
              CASE 
                WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING_INDEX(g.desc_arvore, ' - ', 1)
                ELSE COALESCE(g.descricao, 'OUTROS') 
              END AS grupo_pai_nome,
              CASE 
                WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING(g.desc_arvore, LOCATE(' - ', g.desc_arvore) + 3)
                ELSE COALESCE(g.descricao, 'OUTROS') 
              END AS grupo_filho_nome,
              COALESCE(g.minA, 0) AS g_min_a,
              COALESCE(g.maxA, 0) AS g_max_a,
              COALESCE(g.minB, 0) AS g_min_b,
              COALESCE(g.maxB, 0) AS g_max_b,
              COALESCE(g.minC, 0) AS g_min_c,
              COALESCE(g.maxC, 0) AS g_max_c,
              COALESCE(g.minD, 0) AS g_min_d,
              COALESCE(g.maxD, 0) AS g_max_d,
              COALESCE(p.curvaabc, '') AS prod_curvaabc,
              COALESCE(p.curvaabc_est, '') AS prod_curvaabc_est,
              COALESCE(p.produto_apresentacao_id, 0) AS produto_apresentacao_id,
              COALESCE(p.considera_prod_apresentacao, 'N') AS considera_prod_apresentacao,
              COALESCE(pa.descricao, '') AS princ_big,
              COALESCE(pap.substancia, '') AS pap_subst,
              COALESCE(pap.concentracao, '') AS pap_conc,
              COALESCE(pap.qtd_forma_farmaceutica, '') AS pap_qtd,
              p.preco_cmp,
              p.preco_vnd AS prod_preco_vnd,
              GROUP_CONCAT(DISTINCT CASE WHEN COALESCE(b.caixa_master, 'N') <> 'S' THEN b.barras END) AS extra_barras_unit,
              GROUP_CONCAT(DISTINCT CASE WHEN b.caixa_master = 'S' THEN b.barras END) AS extra_barras_master,
              MAX(CASE WHEN b.caixa_master = 'S' THEN b.qtde_cx ELSE 0 END) AS qtde_cx_master
       FROM produto p
       LEFT JOIN grupo g ON g.grupo_id = p.grupo_id AND g.apagado = 'N'
       LEFT JOIN principio_ativo pa ON pa.principio_ativo_id = p.principio_ativo_id AND pa.apagado = 'N'
       LEFT JOIN produto_apresentacao pap ON pap.produto_apresentacao_id = p.produto_apresentacao_id AND pap.apagado = 'N'
       LEFT JOIN fabricantes fab ON fab.fabricantes_id = p.fabricantes_id AND fab.apagado = 'N'
       LEFT JOIN barras b ON b.produto_id = p.Produto_id AND b.apagado = 'N'
       WHERE p.apagado = 'N' AND p.inativo = 'N'
       GROUP BY p.Produto_id`
    );

    const stockRows = await runReadOnlyQuery(
      conn,
      `SELECT em1.filial_id,
              em1.produto_id,
              COALESCE(em1.estoque, 0) AS estoque,
              COALESCE(em1.estoque_reserva, 0) AS estoque_reserva,
              COALESCE(em1.compra_suspensa, 'N') AS compra_suspensa,
              COALESCE(em2.demanda, 0) AS demanda_big,
              COALESCE(em2.minimo, 0) AS min_big,
              COALESCE(em2.maximo, 0) AS max_big,
              COALESCE(em2.faceamento, 0) AS faceamento_big,
              COALESCE(c.curvaabc, p.curvaabc, '') AS curvaabc_raw,
              COALESCE(c.curvaabc_est, p.curvaabc_est, '') AS curvaabc_est_raw,
              SUBSTRING_INDEX(COALESCE(c.curvaabc, p.curvaabc, 'D'), ' ', 1) AS curva_big,
              COALESCE(pf.preco, 0) AS preco_filial,
              COALESCE(pf.comprasuspensa, 'N') AS pf_compra_suspensa,
              COALESCE(pmc.pmc_atual, 0) AS pmc_atual
       FROM estoque_minimo em1
       JOIN produto p ON p.produto_id = em1.produto_id AND p.apagado = 'N' AND p.inativo = 'N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id = em1.filial_id AND em2.produto_id = em1.produto_id AND em2.apagado = 'N'
       LEFT JOIN curvaabc c ON c.filial_id = em1.filial_id AND c.produto_id = em1.produto_id AND c.apagado = 'N'
       LEFT JOIN precosfilial pf ON pf.filial_id = em1.filial_id AND pf.produto_id = em1.produto_id AND pf.apagado = 'N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id = em1.filial_id AND pmc.produto_id = em1.produto_id AND pmc.apagado = 'N'
       WHERE em1.filial_id IN (${scopeIn}) AND em1.apagado = 'N'`
    );

    const gruposList = await runReadOnlyQuery(
      conn,
      `SELECT g.grupo_id, g.codigo, g.descricao AS grupo_nome, g.desc_arvore,
              CASE 
                WHEN LOCATE('.', g.codigo) > 0 THEN SUBSTRING_INDEX(g.codigo, '.', 1)
                ELSE COALESCE(g.codigo, '') 
              END AS codigo_pai,
              CASE 
                WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING_INDEX(g.desc_arvore, ' - ', 1)
                ELSE COALESCE(g.descricao, 'OUTROS') 
              END AS grupo_pai_nome,
              CASE 
                WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING(g.desc_arvore, LOCATE(' - ', g.desc_arvore) + 3)
                ELSE COALESCE(g.descricao, 'OUTROS') 
              END AS grupo_filho_nome,
              COALESCE(g.minA, 0) AS min_a, COALESCE(g.maxA, 0) AS max_a,
              COALESCE(g.minB, 0) AS min_b, COALESCE(g.maxB, 0) AS max_b,
              COALESCE(g.minC, 0) AS min_c, COALESCE(g.maxC, 0) AS max_c,
              COALESCE(g.minD, 0) AS min_d, COALESCE(g.maxD, 0) AS max_d,
              COUNT(p.Produto_id) AS total_produtos
       FROM grupo g
       LEFT JOIN produto p ON p.grupo_id = g.grupo_id AND p.apagado = 'N' AND p.inativo = 'N'
       WHERE g.apagado = 'N'
       GROUP BY g.grupo_id
       ORDER BY total_produtos DESC, g.descricao ASC`
    );

    const suspendedRows = await runReadOnlyQuery(
      conn,
      `SELECT filial_id, produto_id
       FROM produtos_suspensos_compra
       WHERE filial_id IN (${scopeIn})
         AND apagado = 'N'
         AND compra_suspensa = 'S'
         AND (data_inicio_bloqueio IS NULL OR data_inicio_bloqueio <= ?)
         AND (data_fim_bloqueio IS NULL OR data_fim_bloqueio >= ?)`,
      [refDate, refDate]
    );

    // Função auxiliar para fatiar queries pesadas do ERP quando houver mais de 3 filiais selecionadas
    async function queryFilialsChunked(filialList, chunkSize, sqlFactory, params) {
      if (filialList.length <= chunkSize) {
        return runReadOnlyQuery(conn, sqlFactory(filialList.join(',')), params, { timeout: 120000 });
      }
      const aggregated = [];
      for (let i = 0; i < filialList.length; i += chunkSize) {
        const slice = filialList.slice(i, i + chunkSize);
        let chunkRows = null;
        let lastErr = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            chunkRows = await runReadOnlyQuery(conn, sqlFactory(slice.join(',')), params, { timeout: 120000 });
            break;
          } catch (cErr) {
            lastErr = cErr;
            if (attempt < 2) {
              console.warn(`[syncClientData] Chunk filiais [${slice.join(',')}] falhou (${cErr.code || cErr.message}). Retentando em 1500ms...`);
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        }
        if (!chunkRows) throw lastErr;
        aggregated.push(...chunkRows);
      }
      return aggregated;
    }

    // 4. Vendas de balcao (13 semanas fechadas) agrupadas por semana_idx (0 = semana mais recente)
    const weeklySales = await queryFilialsChunked(
      salesFilials,
      2,
      (inClause) => `SELECT m.filial_id,
              m.produto_id,
              FLOOR(DATEDIFF(?, DATE(m.data_hora)) / 7) AS week_idx,
              SUM(ABS(m.quanti_uni)) AS qty,
              SUM(ABS(m.valor_tot)) AS revenue,
              COUNT(DISTINCT DATE(m.data_hora)) AS sale_days
       FROM movment m FORCE INDEX (data_hora)
       WHERE m.filial_id IN (${inClause})
         AND m.data_hora >= ?
         AND m.data_hora < ?
         AND m.apagado = 'N'
         AND COALESCE(m.cancelado, 'N') <> 'S'
         AND m.E_S = 'S'
         AND m.oper IN (2, 3)
       GROUP BY m.filial_id, m.produto_id, week_idx`,
      [refDate, start91, endExcl]
    );

    // 5. Sazonalidade YoY (janela equivalente do ano passado)
    const yoySales = await queryFilialsChunked(
      salesFilials,
      2,
      (inClause) => `SELECT m.filial_id,
              m.produto_id,
              SUM(CASE WHEN m.data_hora >= ? AND m.data_hora < ? THEN ABS(m.quanti_uni) ELSE 0 END) AS next30_ly,
              SUM(CASE WHEN m.data_hora >= ? AND m.data_hora < ? THEN ABS(m.quanti_uni) ELSE 0 END) AS prev60_ly
       FROM movment m FORCE INDEX (data_hora)
       WHERE m.filial_id IN (${inClause})
         AND m.data_hora >= ?
         AND m.data_hora < ?
         AND m.apagado = 'N'
         AND COALESCE(m.cancelado, 'N') <> 'S'
         AND m.E_S = 'S'
         AND m.oper IN (2, 3)
       GROUP BY m.filial_id, m.produto_id`,
      [lyNextStart, lyNextEndExcl, lyPrevStart, lyNextStart, lyPrevStart, lyNextEndExcl]
    );

    // 6. Ruptura diaria via estoque_posterior (para estimar dias sem estoque + venda perdida sem apontamento manual)
    const epDaily = await queryFilialsChunked(
      salesFilials,
      2,
      (inClause) => `SELECT ep.filial_id,
              ep.produto_id,
              DATE(ep.data_hora) AS dt,
              MIN(ep.estoque_pos) AS min_est,
              MAX(ep.estoque_pos) AS max_est
       FROM estoque_posterior ep
       WHERE ep.filial_id IN (${inClause})
         AND ep.data_hora >= ?
         AND ep.data_hora < ?
         AND ep.apagado = 'N'
       GROUP BY ep.filial_id, ep.produto_id, DATE(ep.data_hora)
       ORDER BY ep.filial_id, ep.produto_id, dt`,
      [start91, endExcl]
    );

    const manualLostSales = await queryFilialsChunked(
      salesFilials,
      3,
      (inClause) => `SELECT filial_id, produto_id, SUM(qtde) AS qty_perdida
       FROM vendasperdidas
       WHERE filial_id IN (${inClause})
         AND apagado = 'N'
         AND data >= ?
         AND data < ?
       GROUP BY filial_id, produto_id`,
      [start91, endExcl]
    );

    // 7. Entradas recentes (18 meses para N ultimas compras + custo absorvido + Lead Time)
    const start18m = addDaysIso(refDate, -540);
    const entries = await runReadOnlyQuery(
      conn,
      `SELECT e.filial_id,
              e.entradas_id,
              e.produto_id,
              e.fornece_id,
              COALESCE(f.nome, 'FORNECEDOR DESCONHECIDO') AS fornecedor_nome,
              COALESCE(f.cgc, '') AS fornecedor_cnpj,
              e.datanota,
              e.numnota,
              e.quantiuni,
              ROUND(COALESCE(e.precouni, 0), 4) AS precouni,
              ROUND(COALESCE(e.custo_item, 0), 2) AS custo_item,
              ROUND(COALESCE(e.preco_ult_ent, 0), 2) AS preco_ult_ent,
              COALESCE(e.calc_pmc, 'N') AS calc_pmc,
              COALESCE(e.reposicao_pbm, 'N') AS reposicao_pbm
       FROM entradas e
       LEFT JOIN fornece f ON f.fornece_id = e.fornece_id
       WHERE e.filial_id IN (${scopeIn})
         AND e.apagado = 'N'
         AND e.datanota >= ?
         AND e.datanota <= ?
       ORDER BY e.produto_id, e.datanota DESC, e.entradas_id DESC`,
      [start18m, refDate]
    );

    // 8. Pedidos recentes para Lead Time real (pedidos x entradas) e transito real confiavel
    const cutoffStart = addDaysIso(refDate, -Number(profile.open_order_cutoff_days || 30));
    const openOrders = await runReadOnlyQuery(
      conn,
      `SELECT ped.filial_id,
              ped.produto_id,
              ped.fornece_id,
              DATE(ped.datahora) AS dt_pedido,
              SUM(GREATEST(COALESCE(ped.pedir, 0), 0)) AS qty_pedida
       FROM pedidos ped
       WHERE ped.filial_id IN (${scopeIn})
         AND ped.apagado = 'N'
         AND ped.datahora >= ?
         AND ped.datahora < ?
         AND COALESCE(ped.falta, 'N') <> 'S'
       GROUP BY ped.filial_id, ped.produto_id, ped.fornece_id, DATE(ped.datahora)`,
      [cutoffStart, endExcl]
    );

    // Lead Time real medido pela diferença entre a emissão da nota e a entrada física na loja
    const leadTimeHistory = await runReadOnlyQuery(
      conn,
      `SELECT e.fornece_id,
              p.grupo_id,
              DATEDIFF(DATE(e.data_hora), e.datanota) AS lt_dias
       FROM entradas e
       JOIN produto p ON p.Produto_id = e.produto_id
       WHERE e.filial_id IN (${scopeIn})
         AND e.datanota >= ?
         AND e.apagado = 'N'
         AND e.data_hora >= e.datanota
         AND DATEDIFF(DATE(e.data_hora), e.datanota) BETWEEN 0 AND 45
       LIMIT 10000`,
      [cutoffStart]
    );

    // 8.1 Transito Faturado NFe (Notas em nfe_cab baixadas no banco aguardando conferencia/entrada)
    const unimportedNfe = await runReadOnlyQuery(
      conn,
      `SELECT nc.fillogica_id AS filial_id,
              nd.produto_id,
              nd.barras,
              SUM(nd.qtde) AS qty_faturada,
              MAX(nc.emit_fantasia) AS fornecedor_nome,
              MAX(nc.dtemissao) AS dt_emissao,
              MAX(CASE WHEN nc.numero_pedido = 'PBM' OR nd.cfop IN ('5910','6910') OR nc.inf_complementares LIKE '%REPOSICAO%' THEN 1 ELSE 0 END) AS eh_pbm_reposicao
       FROM nfe_cab nc
       JOIN nfe_det nd ON nd.filfisica_id = nc.filfisica_id AND nd.nfe_cab_id = nc.nfe_cab_id AND nd.apagado = 'N'
       WHERE nc.apagado = 'N'
         AND nc.importada = 'N'
         AND nc.fillogica_id IN (${scopeIn})
         AND nc.dtemissao >= ?
         AND nc.dtemissao <= ?
       GROUP BY nc.fillogica_id, nd.produto_id, nd.barras`,
      [cutoffStart, endExcl]
    );

    // 9. Lotes em gondola / vencimento (lote_novo blindado com estoque real) e Perdas (ultimos 365 dias)
    const start365 = addDaysIso(refDate, -365);
    const cutoffLots = addDaysIso(refDate, -180); // Descarta lotes jurássicos de anos anteriores nunca baixados pelo BIG
    const lots = await runReadOnlyQuery(
      conn,
      `SELECT ln.fillogica_id AS filial_id,
              ln.produto_id,
              ln.lote,
              DATE(ln.validade) AS validade,
              LEAST(ln.estoque, em.estoque) AS qty
       FROM lote_novo ln
       JOIN estoque_minimo em ON em.filial_id = ln.fillogica_id AND em.produto_id = ln.produto_id AND em.apagado = 'N'
       JOIN produto p ON p.Produto_id = ln.produto_id AND p.apagado = 'N' AND p.inativo = 'N'
       WHERE ln.fillogica_id IN (${scopeIn})
         AND ln.apagado = 'N'
         AND ln.estoque > 0
         AND em.estoque > 0
         AND ln.validade >= ?`,
      [cutoffLots]
    );

    const losses = await runReadOnlyQuery(
      conn,
      `SELECT filial_id,
              produto_id,
              SUM(COALESCE(quantiuni, 0)) AS qty_perda,
              SUM(COALESCE(valortot, 0)) AS val_perda
       FROM perda
       WHERE filial_id IN (${scopeIn})
         AND apagado = 'N'
         AND data_hora >= ?
         AND data_hora < ?
       GROUP BY filial_id, produto_id`,
      [start365, endExcl]
    );

    // 10. Vendas PBM reais (NSU, autorizacao, cartao/cpf, operadora, projeto) na janela de 91d
    const pbmItems91 = await runReadOnlyQuery(
      conn,
      `SELECT m.filial_id,
              m.produto_id,
              COALESCE(tp.operadora, '') AS operadora,
              COALESCE(tp.projeto, '') AS projeto,
              COUNT(DISTINCT tp.numlanc) AS cupons,
              SUM(ABS(m.quanti_uni)) AS qty_pbm
       FROM transacao_pbm tp
       JOIN movment m ON m.filial_id = tp.filial_id
         AND m.numlanc = tp.numlanc
         AND m.apagado = 'N'
         AND COALESCE(m.cancelado, 'N') <> 'S'
         AND m.E_S = 'S'
         AND m.oper IN (2, 3)
       WHERE tp.filial_id IN (${salesIn})
         AND tp.apagado = 'N'
         AND COALESCE(tp.cancelado, 'N') <> 'S'
         AND tp.confirmada = 'S'
         AND tp.data_hora >= ?
         AND tp.data_hora < ?
         AND EXISTS (
           SELECT 1 FROM transacao_pbm_desconto_item tdi
           WHERE tdi.filial_id = tp.filial_id
             AND tdi.numlanc = tp.numlanc
             AND tdi.produto_id = m.produto_id
             AND tdi.apagado = 'N'
         )
       GROUP BY m.filial_id, m.produto_id, operadora, projeto`,
      [start91, endExcl]
    );

    const pbmAuditSample = await runReadOnlyQuery(
      conn,
      `SELECT tp.filial_id,
              tp.data_hora,
              tp.operadora,
              COALESCE(tp.projeto, '') AS projeto,
              tp.nsu,
              tp.autorizacao,
              COALESCE(NULLIF(tp.cartao, ''), tp.cpf, '') AS cartao_cpf,
              tdi.produto_id,
              p.descricao,
              tdi.percentual_desconto,
              tdi.valor_desconto
       FROM transacao_pbm_desconto_item tdi
       JOIN transacao_pbm tp ON tp.filial_id = tdi.filial_id AND tp.numlanc = tdi.numlanc
       JOIN produto p ON p.Produto_id = tdi.produto_id
       WHERE tdi.filial_id IN (${salesIn})
         AND tdi.apagado = 'N'
         AND tp.apagado = 'N'
         AND COALESCE(tp.cancelado, 'N') <> 'S'
         AND tp.confirmada = 'S'
         AND tp.data_hora >= ?
         AND tp.data_hora < ?
       ORDER BY tp.data_hora DESC
       LIMIT 300`,
      [start91, endExcl]
    );

    const buyerFilialObj = filiais.find((f) => f.filial_id === Number(profile.buyer_filial_id));
    const buyerCnpj = profile.buyer_cnpj || buyerFilialObj?.cgc || '28660206000167';

    return {
      elapsedMs: Date.now() - t0,
      referenceDate: refDate,
      start91,
      filiais,
      filiaisMetadata,
      pendingTransfers,
      buyerFilialId: Number(profile.buyer_filial_id),
      buyerCnpj,
      salesFilials,
      allScopeFilials,
      products,
      stockRows,
      gruposList,
      suspendedRows,
      weeklySales,
      yoySales,
      epDaily,
      manualLostSales,
      entries,
      openOrders,
      leadTimeHistory,
      unimportedNfe,
      lots,
      losses,
      pbmItems91,
      pbmAuditSample,
    };
  } finally {
    await conn.end();
  }
}


SELECT 
    table_name AS 'Tabela',
    column_name AS 'Coluna',
    data_type AS 'Tipo',
    column_type AS 'Definicao_Completa',
    is_nullable AS 'Nulo',
    column_key AS 'Chave',
    column_default AS 'Padrao'
FROM 
    information_schema.columns
WHERE 
    table_schema = DATABASE()
    AND table_name IN (
        -- Relatórios & Vendas
        'movment', 'pagamentos', 'transacao_cart_pbm', 'tipospgto', 'produto', 
        'grupo_preco_produto', 'entradas', 'estoque_minimo', 'notas_fiscais', 
        'nota_fiscal', 'caixas', 'usuarios', 'usuario', 'grupo', 'conf_caixa_loja', 
        'conf_caixa_loja_tipospgt', 'logs', 'grupo_preco', 'orçament', 'orcament', 
        'cliente', 'clientes', 'empresa', 'paf', 'inventario_novo', 'precosfilial', 
        'relbomdia', 'relbomdia_descsuperv', 'preco_medio_custo', 'fabricante', 
        'nota_fiscal_item', 'sat_cfe', 'sat_cfe_item', 'vendasperdidas', 'filial', 
        'recarga_redetrel', 'recarga_rv', 'recarga_rv_online', 'recarga_rv_pin', 
        'recarga_upaid', 'gwcel_operadora', 'gwcel_recarga', 'receber', 'finadm', 
        'finadm_det', 'perda', 'cancelament_moviment', 'tabela_desconto', 'kit_promo', 
        'tabloide', 'tabloide_filial', 'tabloide_grupo', 'tabloide_produto', 
        'cesta_entregas', 'rotas', 'taxa_valor_rota', 'entregas', 
        'entrega_valor_escalar', 'entrega_saida', 'enderecos', 'cidade',

        -- Sugestão de Compras
        'remanejamento', 'estoque_minimo2', 'curvaabc', 'cotacao', 'cotacao_online', 
        'filtrosugcompra', 'pedidos', 'pedidoeletronico', 'pedidos_feitos', 
        'produtos_suspensos_compra', 'justificativa_susp_compra', 'estoque_posterior',

        -- Cadastros & Fiscal
        'grupo_preco_filial', 'fornece', 'barras', 'cfop', 'codnofornec', 
        'grupo_usuario', 'preco_medio_custo_historico', 'grupo_preco_produto_logs', 
        'espec', 'fotos', 'paf_req25_r02', 'sintegra_60m', 'paf_req25_r03', 
        'impressoras', 'transferencia', 'transferencia_rec', 'nfes_importadas', 
        'nfe_cab_xml', 'nfe_cab_dados_adic', 'tributacao', 'tributacao_bens_ativo', 
        'tributacao_ncm', 'tributacao_produto', 'operacao_config', 
        'operacao_config_filial', 'operacao_config_cfop', 'devolucao_forn', 
        'dome_entradas', 'dome_manifest', 'xml_nfe', 'xml_nfe_canc', 'sat_cfe_xml_canc', 
        'sat_cfe_xml',

        -- Gerencial, SPED & Financeiro
        'perfil_comissao', 'perfil_comissao_log', 'perfil_comissao_grupo', 
        'perfil_comissao_grupo_log', 'perfil_comissao_produtos', 
        'perfil_comissao_produto_log', 'perfil_comissao_usuarios', 'perfil_usuario', 
        'lote_saida', 'lote_venda', 'lote_logs', 'medico', 'medico_enderecos', 
        'medico_especialidade', 'venda_receita', 'venda_sngpc', 'principio_ativo', 
        'inventario', 'inventario_historico', 'remessa_conserto', 'demais_docs', 
        'deprecicao_amortizacao', 'estoque_abertura', 'impressora_totalizador', 
        'nota_fiscalcfref', 'nota_fiscal_nfref', 'config_efd_reg1600', 'pagar', 
        'saldo_credito_pis_cofins', 'sintegra', 'totalfisc', 'baixa_adm_det_rec', 
        'baixa_adm', 'baixa_adm_det', 'transacao_pbm', 'cartao', 'config_cart_pbm', 
        'cartoesfilial', 'prefinadm_cart', 'nota_fiscal_pgtos_cartao', 
        'operadora_cartao', 'credenc_cart', 'conciliacao_ajustes', 
        'conciliacao_antecipacao_lote', 'conciliacao_financeiro', 
        'conciliacao_financeiro_logs', 'conciliacao_lote_venda', 
        'conciliacao_lote_parc_paga', 'conciliacao_terminais', 
        'conciliacao_trans_parcela', 'conciliacao_transacoes', 
        'transacao_cart_pbm_log', 'transacao_cart_pbm_parc', 'transacao_config_cart', 
        'transacao_config_pbm', 'transacao_pbm_cancel', 'transacao_pbm_reposicao', 
        'transacao_pbm_desconto_item', 'transacao_tef', 'conciliacao_qrlinx', 
        'conciliacao_qrlinx_log', 'filial_config_qrlinx', 'qrlinx_transacao', 
        'planocontas', 'filial_cert', 'filial_financeiro_ofx'
    )
    OR (
        table_schema = DATABASE() 
        AND (table_name LIKE 'credenc%' OR table_name LIKE 'qrlinx%')
    )
ORDER BY 
    table_name, ordinal_position;


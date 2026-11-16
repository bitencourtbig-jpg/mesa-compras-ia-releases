# Linx Farma BIG — Estrutura das Tabelas (SQL)

> **Status:** Armazenado (**178** tabelas / **4210** colunas, de `baixa_adm` até `xml_nfe_canc`). *(Obs.: `perfil_comissao_produto_log` foi omitida conforme indicado pelo usuário.)*

Consulta SQL original salva em: [consulta_estrutura_tabelas.sql](file:///C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/consulta_estrutura_tabelas.sql)
Dados brutos em TSV salvos em: [estrutura_tabelas.tsv](file:///C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/estrutura_tabelas.tsv)

## Índice de Tabelas

- [`baixa_adm`](#baixa_adm) (21 colunas)
- [`baixa_adm_det`](#baixa_adm_det) (6 colunas)
- [`baixa_adm_det_rec`](#baixa_adm_det_rec) (11 colunas)
- [`barras`](#barras) (14 colunas)
- [`caixas`](#caixas) (10 colunas)
- [`cartoesfilial`](#cartoesfilial) (9 colunas)
- [`cfop`](#cfop) (16 colunas)
- [`cidade`](#cidade) (11 colunas)
- [`clientes`](#clientes) (139 colunas)
- [`codnofornec`](#codnofornec) (10 colunas)
- [`conciliacao_ajustes`](#conciliacao_ajustes) (28 colunas)
- [`conciliacao_antecipacao_lote`](#conciliacao_antecipacao_lote) (12 colunas)
- [`conciliacao_financeiro`](#conciliacao_financeiro) (7 colunas)
- [`conciliacao_lote_parc_paga`](#conciliacao_lote_parc_paga) (14 colunas)
- [`conciliacao_lote_venda`](#conciliacao_lote_venda) (24 colunas)
- [`conciliacao_qrlinx`](#conciliacao_qrlinx) (12 colunas)
- [`conciliacao_qrlinx_log`](#conciliacao_qrlinx_log) (14 colunas)
- [`conciliacao_terminais`](#conciliacao_terminais) (11 colunas)
- [`conciliacao_transacoes`](#conciliacao_transacoes) (37 colunas)
- [`conciliacao_trans_parcela`](#conciliacao_trans_parcela) (17 colunas)
- [`config_cart_pbm`](#config_cart_pbm) (20 colunas)
- [`config_efd_reg1600`](#config_efd_reg1600) (10 colunas)
- [`conf_caixa_loja`](#conf_caixa_loja) (16 colunas)
- [`cotacao`](#cotacao) (15 colunas)
- [`cotacao_online`](#cotacao_online) (9 colunas)
- [`credenc_cart`](#credenc_cart) (36 colunas)
- [`credenc_cart_config`](#credenc_cart_config) (13 colunas)
- [`credenc_cart_config_banco`](#credenc_cart_config_banco) (13 colunas)
- [`credenc_cart_config_bandeira`](#credenc_cart_config_bandeira) (12 colunas)
- [`credenc_cart_config_dia`](#credenc_cart_config_dia) (17 colunas)
- [`credenc_cart_config_per`](#credenc_cart_config_per) (16 colunas)
- [`credenc_cart_credenc_filial`](#credenc_cart_credenc_filial) (16 colunas)
- [`credenc_cart_credenc_filiallog`](#credenc_cart_credenc_filiallog) (5 colunas)
- [`credenc_cart_sat`](#credenc_cart_sat) (3 colunas)
- [`credenc_maquineta_terminal`](#credenc_maquineta_terminal) (16 colunas)
- [`credenc_pbm`](#credenc_pbm) (13 colunas)
- [`credenc_pbm_config`](#credenc_pbm_config) (16 colunas)
- [`credenc_pbm_prod`](#credenc_pbm_prod) (12 colunas)
- [`credenc_pbm_prod_log`](#credenc_pbm_prod_log) (6 colunas)
- [`credenc_pbm_prod_tab_desc`](#credenc_pbm_prod_tab_desc) (6 colunas)
- [`credenc_pbm_prod_tab_desc_log`](#credenc_pbm_prod_tab_desc_log) (7 colunas)
- [`credenc_tef`](#credenc_tef) (3 colunas)
- [`credenc_tef_inconsistente`](#credenc_tef_inconsistente) (12 colunas)
- [`curvaabc`](#curvaabc) (9 colunas)
- [`demais_docs`](#demais_docs) (25 colunas)
- [`devolucao_forn`](#devolucao_forn) (17 colunas)
- [`empresa`](#empresa) (109 colunas)
- [`enderecos`](#enderecos) (18 colunas)
- [`entradas`](#entradas) (136 colunas)
- [`entregas`](#entregas) (13 colunas)
- [`entrega_saida`](#entrega_saida) (7 colunas)
- [`entrega_valor_escalar`](#entrega_valor_escalar) (5 colunas)
- [`espec`](#espec) (15 colunas)
- [`estoque_abertura`](#estoque_abertura) (21 colunas)
- [`estoque_minimo`](#estoque_minimo) (27 colunas)
- [`estoque_minimo2`](#estoque_minimo2) (17 colunas)
- [`estoque_posterior`](#estoque_posterior) (15 colunas)
- [`filial`](#filial) (448 colunas)
- [`filial_cert`](#filial_cert) (8 colunas)
- [`filial_config_qrlinx`](#filial_config_qrlinx) (6 colunas)
- [`filial_financeiro_ofx`](#filial_financeiro_ofx) (5 colunas)
- [`filtrosugcompra`](#filtrosugcompra) (44 colunas)
- [`finadm`](#finadm) (11 colunas)
- [`finadm_det`](#finadm_det) (19 colunas)
- [`fornece`](#fornece) (60 colunas)
- [`grupo`](#grupo) (32 colunas)
- [`grupo_preco`](#grupo_preco) (12 colunas)
- [`grupo_preco_filial`](#grupo_preco_filial) (6 colunas)
- [`grupo_preco_produto`](#grupo_preco_produto) (31 colunas)
- [`grupo_preco_produto_logs`](#grupo_preco_produto_logs) (12 colunas)
- [`grupo_usuario`](#grupo_usuario) (75 colunas)
- [`gwcel_operadora`](#gwcel_operadora) (5 colunas)
- [`gwcel_recarga`](#gwcel_recarga) (12 colunas)
- [`impressoras`](#impressoras) (21 colunas)
- [`impressora_totalizador`](#impressora_totalizador) (6 colunas)
- [`inventario`](#inventario) (10 colunas)
- [`inventario_historico`](#inventario_historico) (10 colunas)
- [`inventario_novo`](#inventario_novo) (15 colunas)
- [`justificativa_susp_compra`](#justificativa_susp_compra) (10 colunas)
- [`kit_promo`](#kit_promo) (26 colunas)
- [`logs`](#logs) (12 colunas)
- [`lote_logs`](#lote_logs) (10 colunas)
- [`lote_saida`](#lote_saida) (11 colunas)
- [`lote_venda`](#lote_venda) (7 colunas)
- [`medico`](#medico) (30 colunas)
- [`medico_enderecos`](#medico_enderecos) (17 colunas)
- [`medico_especialidade`](#medico_especialidade) (9 colunas)
- [`movment`](#movment) (81 colunas)
- [`nfe_cab_dados_adic`](#nfe_cab_dados_adic) (7 colunas)
- [`nfe_cab_xml`](#nfe_cab_xml) (6 colunas)
- [`nota_fiscal`](#nota_fiscal) (136 colunas)
- [`nota_fiscal_item`](#nota_fiscal_item) (110 colunas)
- [`nota_fiscal_nfref`](#nota_fiscal_nfref) (6 colunas)
- [`nota_fiscal_pgtos_cartao`](#nota_fiscal_pgtos_cartao) (16 colunas)
- [`operacao_config`](#operacao_config) (48 colunas)
- [`operacao_config_cfop`](#operacao_config_cfop) (11 colunas)
- [`operacao_config_filial`](#operacao_config_filial) (6 colunas)
- [`operadora_cartao`](#operadora_cartao) (6 colunas)
- [`orcament`](#orcament) (97 colunas)
- [`paf_req25_r02`](#paf_req25_r02) (24 colunas)
- [`paf_req25_r03`](#paf_req25_r03) (5 colunas)
- [`pagamentos`](#pagamentos) (27 colunas)
- [`pagar`](#pagar) (50 colunas)
- [`pedidoeletronico`](#pedidoeletronico) (39 colunas)
- [`pedidos`](#pedidos) (49 colunas)
- [`pedidos_feitos`](#pedidos_feitos) (12 colunas)
- [`perda`](#perda) (19 colunas)
- [`perfil_comissao`](#perfil_comissao) (9 colunas)
- [`perfil_comissao_grupo_log`](#perfil_comissao_grupo_log) (6 colunas)
- [`perfil_comissao_produtos`](#perfil_comissao_produtos) (6 colunas)
- [`perfil_comissao_usuarios`](#perfil_comissao_usuarios) (7 colunas)
- [`perfil_usuario`](#perfil_usuario) (4 colunas)
- [`planocontas`](#planocontas) (13 colunas)
- [`precosfilial`](#precosfilial) (37 colunas)
- [`preco_medio_custo`](#preco_medio_custo) (7 colunas)
- [`preco_medio_custo_historico`](#preco_medio_custo_historico) (28 colunas)
- [`prefinadm_cart`](#prefinadm_cart) (23 colunas)
- [`principio_ativo`](#principio_ativo) (12 colunas)
- [`produto`](#produto) (155 colunas)
- [`produtos_suspensos_compra`](#produtos_suspensos_compra) (15 colunas)
- [`qrlinx_ambiente`](#qrlinx_ambiente) (3 colunas)
- [`qrlinx_caixa`](#qrlinx_caixa) (16 colunas)
- [`qrlinx_comprovante`](#qrlinx_comprovante) (5 colunas)
- [`qrlinx_config`](#qrlinx_config) (15 colunas)
- [`qrlinx_config_filial`](#qrlinx_config_filial) (5 colunas)
- [`qrlinx_controle`](#qrlinx_controle) (3 colunas)
- [`qrlinx_log`](#qrlinx_log) (6 colunas)
- [`qrlinx_qrcode`](#qrlinx_qrcode) (5 colunas)
- [`qrlinx_transacao`](#qrlinx_transacao) (34 colunas)
- [`qrlinx_transacao_venda`](#qrlinx_transacao_venda) (5 colunas)
- [`qrlinx_wallet`](#qrlinx_wallet) (5 colunas)
- [`recarga_redetrel`](#recarga_redetrel) (16 colunas)
- [`recarga_rv`](#recarga_rv) (18 colunas)
- [`recarga_rv_online`](#recarga_rv_online) (8 colunas)
- [`recarga_rv_pin`](#recarga_rv_pin) (7 colunas)
- [`recarga_upaid`](#recarga_upaid) (16 colunas)
- [`receber`](#receber) (45 colunas)
- [`relbomdia`](#relbomdia) (9 colunas)
- [`relbomdia_descsuperv`](#relbomdia_descsuperv) (21 colunas)
- [`remanejamento`](#remanejamento) (28 colunas)
- [`remessa_conserto`](#remessa_conserto) (26 colunas)
- [`rotas`](#rotas) (17 colunas)
- [`saldo_credito_pis_cofins`](#saldo_credito_pis_cofins) (5 colunas)
- [`sat_cfe`](#sat_cfe) (32 colunas)
- [`sat_cfe_item`](#sat_cfe_item) (45 colunas)
- [`sat_cfe_xml`](#sat_cfe_xml) (4 colunas)
- [`sintegra`](#sintegra) (8 colunas)
- [`sintegra_60m`](#sintegra_60m) (30 colunas)
- [`tabela_desconto`](#tabela_desconto) (10 colunas)
- [`tabloide`](#tabloide) (15 colunas)
- [`tabloide_filial`](#tabloide_filial) (6 colunas)
- [`tabloide_grupo`](#tabloide_grupo) (20 colunas)
- [`tabloide_produto`](#tabloide_produto) (22 colunas)
- [`taxa_valor_rota`](#taxa_valor_rota) (9 colunas)
- [`tipospgto`](#tipospgto) (40 colunas)
- [`totalfisc`](#totalfisc) (13 colunas)
- [`transacao_cart_pbm`](#transacao_cart_pbm) (29 colunas)
- [`transacao_cart_pbm_log`](#transacao_cart_pbm_log) (9 colunas)
- [`transacao_cart_pbm_parc`](#transacao_cart_pbm_parc) (24 colunas)
- [`transacao_config_cart`](#transacao_config_cart) (8 colunas)
- [`transacao_config_pbm`](#transacao_config_pbm) (6 colunas)
- [`transacao_pbm`](#transacao_pbm) (53 colunas)
- [`transacao_pbm_cancel`](#transacao_pbm_cancel) (12 colunas)
- [`transacao_pbm_desconto_item`](#transacao_pbm_desconto_item) (12 colunas)
- [`transacao_pbm_reposicao`](#transacao_pbm_reposicao) (13 colunas)
- [`transacao_tef`](#transacao_tef) (23 colunas)
- [`transferencia`](#transferencia) (28 colunas)
- [`transferencia_rec`](#transferencia_rec) (14 colunas)
- [`tributacao`](#tributacao) (36 colunas)
- [`tributacao_bens_ativo`](#tributacao_bens_ativo) (6 colunas)
- [`tributacao_ncm`](#tributacao_ncm) (7 colunas)
- [`tributacao_produto`](#tributacao_produto) (7 colunas)
- [`usuario`](#usuario) (82 colunas)
- [`vendasperdidas`](#vendasperdidas) (11 colunas)
- [`venda_receita`](#venda_receita) (16 colunas)
- [`venda_sngpc`](#venda_sngpc) (26 colunas)
- [`xml_nfe`](#xml_nfe) (5 colunas)
- [`xml_nfe_canc`](#xml_nfe_canc) (5 colunas)

---

## baixa_adm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `baixa_adm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `operadoras_id` | `int` | `int(11)` | NO | MUL | `0` |
| `empresa_id` | `int` | `int(11)` | NO | - | `0` |
| `clientes_id` | `int` | `int(11)` | NO | - | `0` |
| `datahora` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `pagamento_id_adm` | `int` | `int(11)` | NO | - | `0` |
| `valortotal` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `desconto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valorliquido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `numlanc` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `caixas_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `cancelado` | `char` | `char(1)` | NO | - | `'N'` |
| `usuario_id_canc` | `int` | `int(11)` | YES | - | `NULL` |
| `datahora_canc` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_baixa` | `mediumint` | `mediumint(11)` | NO | - | `0` |
| `multa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `juros` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## baixa_adm_det

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `baixa_adm_id` | `int` | `int(11)` | NO | MUL | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `valor` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## baixa_adm_det_rec

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `baixa_adm_det_rec_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `baixa_adm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `receber_id` | `int` | `int(11)` | NO | - | `0` |
| `dtvenc` | `date` | `date` | NO | - | `'0000-00-00'` |
| `valor` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `desconto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `multa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `juros` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## barras

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `barras_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `0` |
| `barras` | `varchar` | `varchar(14)` | YES | MUL | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `barras14` | `char` | `char(1)` | YES | - | `NULL` |
| `qtde_cx` | `int` | `int(11)` | YES | - | `0` |
| `caixa_master` | `char` | `char(1)` | NO | - | `'N'` |

---

## caixas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `caixas_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `dtinicial` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `dtfinal` | `datetime` | `datetime` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `caixa` | `int` | `int(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `caixa_dia` | `int` | `int(11)` | YES | - | `0` |
| `finprocescritorio` | `char` | `char(1)` | NO | - | `'N'` |

---

## cartoesfilial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `tipospgto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dias_recebe` | `int` | `int(11)` | YES | - | `0` |
| `taxa_mensal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `conta_credito` | `int` | `int(11)` | YES | - | `NULL` |

---

## cfop

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `cfop_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `codigo` | `varchar` | `varchar(10)` | NO | MUL | `''` |
| `descricao` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `aplicacao` | `text` | `text` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `operacao_nota` | `char` | `char(1)` | NO | - | `''` |
| `codigo_devol` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `cst_escrituracao_entrada` | `char` | `char(2)` | NO | - | `''` |
| `codigo_estorno` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `conta_contabil_id` | `int` | `int(11)` | NO | - | `0` |

---

## cidade

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `cidade_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nome_cidade` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `cod_cidade_ibge` | `varchar` | `varchar(15)` | YES | MUL | `NULL` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## clientes

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `clientes_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nome` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `fis_jur` | `char` | `char(1)` | YES | - | `'F'` |
| `status` | `char` | `char(1)` | YES | - | `'S'` |
| `empresa_id` | `int` | `int(6)` | NO | MUL | `0` |
| `chapa` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `filial_id` | `int` | `int(11)` | YES | - | `NULL` |
| `sexo` | `char` | `char(1)` | YES | - | `'M'` |
| `data_nasc` | `date` | `date` | YES | - | `NULL` |
| `telefone1` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `telefone2` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `fax` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `cpf` | `varchar` | `varchar(14)` | YES | MUL | `NULL` |
| `rg` | `varchar` | `varchar(30)` | YES | MUL | `NULL` |
| `cgc` | `varchar` | `varchar(20)` | YES | MUL | `NULL` |
| `inscr` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `obs` | `varchar` | `varchar(150)` | YES | - | `NULL` |
| `obs2` | `text` | `text` | YES | - | `NULL` |
| `desconto` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `centcust` | `smallint` | `smallint(6)` | YES | - | `NULL` |
| `prxfechamento` | `char` | `char(1)` | YES | - | `'N'` |
| `descmaxgr` | `char` | `char(1)` | YES | - | `'S'` |
| `endereco` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `email` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `pgvista` | `char` | `char(1)` | YES | - | `'S'` |
| `pgprazo` | `char` | `char(1)` | YES | - | `'S'` |
| `pgcheque` | `char` | `char(1)` | YES | - | `'N'` |
| `pgcartao` | `char` | `char(1)` | YES | - | `'N'` |
| `saldototal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `saldomes` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lim_cre_total` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lim_mes` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `banco` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `agencia` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `ender2` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `bairro2` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `cidade2` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf2` | `char` | `char(2)` | YES | - | `NULL` |
| `cep2` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `marcado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtligacao` | `date` | `date` | YES | - | `NULL` |
| `horaligacao` | `time` | `time` | YES | - | `NULL` |
| `referencia` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `referencia2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `dias_limite` | `int` | `int(11)` | YES | - | `0` |
| `dependente` | `varchar` | `varchar(45)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `senha` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `cobra_juros` | `char` | `char(1)` | YES | - | `'S'` |
| `juros` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `multa` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `fidelidade` | `varchar` | `varchar(20)` | YES | MUL | `NULL` |
| `dtfidelidade` | `datetime` | `datetime` | YES | - | `NULL` |
| `pontos` | `int` | `int(11)` | YES | - | `0` |
| `libera_grupo` | `char` | `char(1)` | YES | - | `'N'` |
| `diavenc` | `int` | `int(11)` | YES | - | `0` |
| `receb` | `int` | `int(11)` | YES | - | `0` |
| `rota_id` | `int` | `int(11)` | YES | - | `NULL` |
| `celular` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `primeira_vnd` | `char` | `char(1)` | YES | - | `'N'` |
| `prxligacao` | `datetime` | `datetime` | YES | - | `NULL` |
| `ultligacao` | `datetime` | `datetime` | YES | - | `NULL` |
| `obstelemarketing` | `text` | `text` | YES | - | `NULL` |
| `usuario_ultligacao` | `int` | `int(11)` | YES | - | `0` |
| `curva_abc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `participa_abc` | `char` | `char(1)` | YES | - | `NULL` |
| `numero1` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `numero2` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `lim_chq_total` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lim_qtde` | `int` | `int(11)` | YES | - | `0` |
| `saldochqtotal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `saldochqqtde` | `int` | `int(11)` | YES | - | `0` |
| `localtrab` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `dtadmissao` | `datetime` | `datetime` | YES | - | `NULL` |
| `renda` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cargo` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `temposerv` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `anotacoes` | `text` | `text` | YES | - | `NULL` |
| `diautil` | `char` | `char(1)` | YES | - | `'N'` |
| `emp_system` | `int` | `int(11)` | YES | - | `0` |
| `bloqueio_parc` | `char` | `char(1)` | YES | - | `'N'` |
| `complemento` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `complemento2` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `dt_ult_venda` | `datetime` | `datetime` | YES | - | `NULL` |
| `vl_ult_venda` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `cli_atualiza` | `int` | `int(11)` | YES | MUL | `0` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `orgao_exped_rg` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `uf_emiss_rg` | `char` | `char(2)` | YES | - | `NULL` |
| `fidelidade2` | `char` | `char(1)` | YES | - | `'S'` |
| `telefone_trabalho` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `tx_desc_dupl` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `Impressao_Digital` | `longblob` | `longblob` | YES | - | `NULL` |
| `Atrib_Impressao_Digital` | `longblob` | `longblob` | YES | - | `NULL` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cidade_id_corresp` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_contribuinte_icms` | `int` | `int(11)` | NO | - | `0` |
| `tipo_cliente` | `char` | `char(2)` | YES | - | `NULL` |
| `email_nfe` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `perc_red_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_red_icms_st` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `aliq_icms_reduzida` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `obs_fiscal` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `titularadm_id` | `int` | `int(11)` | NO | MUL | `0` |
| `nome_mae` | `varchar` | `varchar(40)` | NO | - | `''` |
| `nome_pai` | `varchar` | `varchar(40)` | NO | - | `''` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_id_corresp` | `int` | `int(11)` | YES | - | `NULL` |
| `produtor_rural` | `char` | `char(1)` | NO | - | `'N'` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `id_estrangeiro` | `varchar` | `varchar(20)` | NO | - | `''` |
| `cliente_id_prever` | `varchar` | `varchar(15)` | NO | - | `''` |
| `prever_origem` | `char` | `char(1)` | NO | - | `'B'` |
| `banco_id` | `varchar` | `varchar(4)` | NO | - | `'0'` |
| `diafecha_fim_periodo` | `char` | `char(1)` | NO | - | `'N'` |
| `cpf_cnpj_entrega` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `unymos_beneficiario_id` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `unymos_numero_contrato` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `unymos_status` | `char` | `char(1)` | YES | - | `NULL` |
| `unymos_condicao_beneficiario` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `marka_cartao` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `qtd_caracter_senha` | `int` | `int(11)` | YES | - | `NULL` |
| `tributacao_regular` | `char` | `char(1)` | YES | - | `'N'` |
| `perc_red_tributacao_regular` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cst_tributacao_regular` | `char` | `char(3)` | YES | - | `'N'` |
| `classif_tributacao_regular` | `varchar` | `varchar(6)` | YES | - | `'N'` |
| `perfil_credito_presumido` | `char` | `char(1)` | YES | - | `'N'` |
| `ente_governamental` | `char` | `char(1)` | YES | - | `'N'` |

---

## codnofornec

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `fornece_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `codnofornec` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `data_comunic` | `date` | `date` | YES | - | `NULL` |

---

## conciliacao_ajustes

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `ajuste_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `codigo_grupo` | `int` | `int(11)` | YES | - | `NULL` |
| `codigo_terminal` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `codigo_rede` | `int` | `int(11)` | YES | MUL | `NULL` |
| `cnpj` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `data_ajuste` | `date` | `date` | YES | - | `NULL` |
| `sequencia1` | `int` | `int(11)` | YES | - | `NULL` |
| `sequencia2` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_ajuste` | `int` | `int(11)` | YES | MUL | `NULL` |
| `valor_bruto` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `valor_liquido` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `data_prev_pagto` | `date` | `date` | YES | - | `NULL` |
| `data_pagamento` | `date` | `date` | YES | MUL | `NULL` |
| `observacao` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `status` | `int` | `int(11)` | YES | - | `NULL` |
| `lote_ajuste` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `lote_id` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `parcela_lote` | `int` | `int(11)` | YES | - | `NULL` |
| `data_venda` | `date` | `date` | YES | - | `NULL` |
| `ajuste_id_substituto` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lote_pagamento` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `codigo_banco` | `int` | `int(4)` | YES | MUL | `NULL` |
| `agencia` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `conta_corrente` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `chave_ur` | `varchar` | `varchar(200)` | YES | MUL | `NULL` |

---

## conciliacao_antecipacao_lote

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lote_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `parcela_lote` | `int` | `int(11)` | NO | PRI | `0` |
| `valor_liquido_parcela` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `valor_liquido_antecipacao` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `data_antecipacao` | `date` | `date` | YES | - | `NULL` |
| `data_prev_pagto` | `date` | `date` | YES | - | `NULL` |
| `status` | `int` | `int(11)` | YES | - | `NULL` |
| `numero_documento` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `valor_desconto` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## conciliacao_financeiro

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lote_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `parcela_lote` | `int` | `int(11)` | NO | PRI | `0` |
| `data_pagamento` | `date` | `date` | YES | - | `NULL` |
| `bancos_contas_movto_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## conciliacao_lote_parc_paga

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lote_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `parcela_lote` | `int` | `int(11)` | NO | PRI | `1` |
| `valor_bruto` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `valor_liquido` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `data_pagamento` | `date` | `date` | YES | MUL | `NULL` |
| `status` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lote_pagamento` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `codigo_banco` | `int` | `int(11)` | YES | - | `0` |
| `agencia` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `conta_corrente` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `chave_ur` | `varchar` | `varchar(200)` | YES | - | `NULL` |

---

## conciliacao_lote_venda

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lote_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `codigo_grupo` | `int` | `int(11)` | NO | MUL | `0` |
| `codigo_terminal` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `codigo_rede` | `int` | `int(11)` | NO | MUL | `0` |
| `cnpj` | `varchar` | `varchar(20)` | NO | - | `''` |
| `lote` | `varchar` | `varchar(20)` | NO | - | `''` |
| `data_lote` | `date` | `date` | NO | - | `'0000-00-00'` |
| `codigo_bandeira` | `int` | `int(11)` | NO | - | `0` |
| `codigo_transacao` | `int` | `int(11)` | NO | - | `0` |
| `tipo_parcelamento` | `int` | `int(11)` | NO | - | `0` |
| `quantidade_reg_vendas` | `int` | `int(11)` | NO | - | `0` |
| `valor_bruto` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `valor_liquido` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `numero_parcelas` | `int` | `int(11)` | NO | - | `0` |
| `status` | `int` | `int(11)` | NO | - | `0` |
| `taxa_administradora` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `lote_id_substituto` | `bigint` | `bigint(20)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `codigo_banco` | `int` | `int(11)` | YES | - | `0` |
| `agencia` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `conta_corrente` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `chave_ur` | `varchar` | `varchar(200)` | YES | - | `NULL` |

---

## conciliacao_qrlinx

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `status` | `char` | `char(2)` | YES | - | `NULL` |
| `valor_liquido` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `data_pagamento` | `date` | `date` | YES | - | `NULL` |
| `transacao_id_conciliacao` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `lote_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `movimento_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `baixa_automatica` | `char` | `char(1)` | YES | - | `'N'` |
| `divergencia` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## conciliacao_qrlinx_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `data_cadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `status` | `char` | `char(2)` | YES | - | `NULL` |
| `valor_liquido` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `data_pagamento` | `date` | `date` | YES | - | `NULL` |
| `transacao_id_conciliacao` | `bigint` | `bigint(20)` | YES | - | `0` |
| `lote_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `movimento_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `baixa_automatica` | `char` | `char(1)` | YES | - | `'N'` |
| `divergencia` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## conciliacao_terminais

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `codigo_grupo` | `int` | `int(11)` | NO | PRI | `0` |
| `codigo_terminal` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `codigo_rede` | `int` | `int(11)` | NO | MUL | `0` |
| `identificador1` | `varchar` | `varchar(50)` | NO | - | `''` |
| `identificador2` | `varchar` | `varchar(50)` | NO | - | `''` |
| `cnpj` | `varchar` | `varchar(20)` | NO | - | `''` |
| `descricao` | `varchar` | `varchar(50)` | NO | - | `''` |
| `tipo_terminal` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## conciliacao_transacoes

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `varchar` | `varchar(32)` | NO | PRI | `'0'` |
| `codigo_grupo` | `int` | `int(11)` | NO | MUL | `0` |
| `codigo_terminal` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `codigo_rede` | `int` | `int(11)` | NO | MUL | `0` |
| `cnpj` | `varchar` | `varchar(20)` | NO | - | `''` |
| `data_venda` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `nsu_loja` | `bigint` | `bigint(20)` | NO | - | `0` |
| `nsu_rede` | `varchar` | `varchar(100)` | NO | - | `''` |
| `codigo_autorizacao` | `varchar` | `varchar(100)` | NO | - | `''` |
| `codigo_bandeira_loja` | `int` | `int(11)` | NO | - | `0` |
| `codigo_transacao_loja` | `int` | `int(11)` | NO | - | `0` |
| `tipo_parcelamento_loja` | `int` | `int(11)` | NO | - | `0` |
| `numero_parcelas_loja` | `int` | `int(11)` | NO | - | `0` |
| `valor_bruto_loja` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `valor_liquido_loja` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `numero_cartao_loja` | `varchar` | `varchar(20)` | NO | - | `''` |
| `status_loja` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_captura_loja` | `int` | `int(11)` | YES | - | `NULL` |
| `codigo_bandeira_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `codigo_transacao_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_parcelamento_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `numero_parcelas_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `valor_bruto_rede` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `valor_liquido_rede` | `decimal` | `decimal(15,2)` | YES | - | `NULL` |
| `numero_cartao_rede` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `status_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_captura_rede` | `int` | `int(11)` | YES | - | `NULL` |
| `status_conciliacao` | `int` | `int(11)` | YES | - | `NULL` |
| `lote_venda_rede` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `lote_rede_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `transacao_substituta_id` | `bigint` | `bigint(20)` | YES | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `id_unico_erp` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `id_pagamento_erp` | `bigint` | `bigint(20)` | NO | - | `0` |
| `sigla_arranjo_ur` | `varchar` | `varchar(100)` | YES | - | `NULL` |

---

## conciliacao_trans_parcela

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `varchar` | `varchar(32)` | NO | PRI | `'0'` |
| `numero_parcela` | `int` | `int(11)` | NO | PRI | `0` |
| `valor_bruto_loja` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `valor_liquido_loja` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `data_previsao_pgto_loja` | `date` | `date` | NO | - | `'0000-00-00'` |
| `status_loja` | `int` | `int(11)` | NO | - | `0` |
| `valor_bruto_rede` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `valor_liquido_rede` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `data_previsao_pgto_rede` | `date` | `date` | NO | - | `'0000-00-00'` |
| `status_rede` | `int` | `int(11)` | NO | - | `0` |
| `status_conciliacao` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `NULL (sem default)` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `id_unico_erp` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `id_pagamento_erp` | `bigint` | `bigint(20)` | NO | - | `0` |
| `chave_ur` | `varchar` | `varchar(200)` | YES | - | `NULL` |

---

## config_cart_pbm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `usar_config_avanc` | `char` | `char(1)` | NO | - | `'N'` |
| `conf_cart_fecham_cx` | `char` | `char(1)` | NO | - | `'N'` |
| `conf_cart_conf_cx_loja` | `char` | `char(1)` | NO | - | `'N'` |
| `conf_cart_conf_cx_escr` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `usar_credenc_cart` | `char` | `char(1)` | YES | - | `'N'` |
| `credenc_cart_maq` | `char` | `char(1)` | YES | - | `'E'` |
| `usar_credenc_pbm` | `char` | `char(1)` | NO | - | `'N'` |
| `solucao_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `usar_credenc_cart_maq` | `char` | `char(1)` | NO | - | `'N'` |
| `obrigar_informar_credenc` | `char` | `char(1)` | NO | - | `'N'` |
| `dtef_por_dll` | `char` | `char(1)` | NO | - | `'N'` |
| `usa_parcela_conferencia` | `char` | `char(1)` | NO | - | `'N'` |
| `perm_pgto_rec_cel_com_cartao` | `char` | `char(1)` | NO | - | `'N'` |
| `perm_somente_debito_avista` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_parcelamento_credito` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `forma_parcelamento_credito` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `novo_fluxo_tef` | `char` | `char(1)` | NO | - | `'S'` |

---

## config_efd_reg1600

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tipospgto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `tipo_cartao` | `char` | `char(1)` | NO | - | `''` |
| `fornece_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## conf_caixa_loja

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `conf_caixa_loja_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `caixas_id` | `int` | `int(11)` | NO | - | `0` |
| `status` | `char` | `char(1)` | NO | - | `'P'` |
| `usuario_inicio_id` | `int` | `int(11)` | NO | - | `0` |
| `usuario_fim_id` | `int` | `int(11)` | NO | - | `0` |
| `dt_inicio_conf` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dt_fim_conf` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `justificativa_apag` | `varchar` | `varchar(60)` | NO | - | `''` |
| `comparado` | `char` | `char(1)` | NO | - | `'N'` |
| `duplicado` | `char` | `char(1)` | NO | - | `'N'` |

---

## cotacao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `fornece_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `validade` | `date` | `date` | NO | PRI | `'0000-00-00'` |
| `qtde` | `int` | `int(11)` | YES | - | `0` |
| `desconto2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `cotacao_online_id` | `int` | `int(11)` | NO | MUL | `0` |
| `qtde_caixa` | `int` | `int(11)` | NO | - | `0` |
| `obs` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `principal` | `char` | `char(1)` | YES | - | `'N'` |
| `apagado_manualmente` | `char` | `char(1)` | YES | MUL | `'N'` |

---

## cotacao_online

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `cotacao_online_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `validade` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `descricao` | `varchar` | `varchar(100)` | NO | - | `''` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `encerrada` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `leilao` | `char` | `char(1)` | NO | - | `'N'` |

---

## credenc_cart

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(50)` | NO | - | `''` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_taxas` | `int` | `int(11)` | YES | - | `NULL` |
| `razao_social` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `cgc` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `inscr_estadual` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `endereco` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `numero` | `int` | `int(11)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `estado` | `char` | `char(2)` | YES | - | `NULL` |
| `endereco_compl` | `varchar` | `varchar(120)` | YES | - | `NULL` |
| `credenc_tef_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `lanc_financeiro` | `int` | `int(11)` | YES | - | `0` |
| `credenciadora_link_pgto` | `char` | `char(1)` | NO | - | `'N'` |
| `credenc_cart_sat_codigo` | `char` | `char(3)` | YES | - | `NULL` |
| `planocontascredito_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontascredito_id_taxas` | `int` | `int(11)` | YES | - | `0` |
| `agrupar_pre_pago` | `char` | `char(1)` | YES | - | `'N'` |
| `planocontaspix_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontaspix_id_taxas` | `int` | `int(11)` | YES | - | `0` |
| `lanc_financeiropix` | `int` | `int(11)` | YES | - | `0` |
| `planocontasrecebiveis_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontasrecebiveis_id_taxas` | `int` | `int(11)` | YES | - | `0` |

---

## credenc_cart_config

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | - | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | - | `0` |
| `tipo_fechamento` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_cart_config_banco

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_config_banco_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_config_bandid` | `int` | `int(11)` | NO | MUL | `0` |
| `bandeira_tef_id` | `int` | `int(11)` | NO | MUL | `0` |
| `bancos_contas_id` | `int` | `int(11)` | NO | MUL | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `apag_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtapagado` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## credenc_cart_config_bandeira

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_config_bandid` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | MUL | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | MUL | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtapagado` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `apag_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `'0'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_cart_config_dia

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_config_dia_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_config_id` | `int` | `int(11)` | NO | - | `0` |
| `tipospgto_id` | `int` | `int(11)` | NO | - | `0` |
| `formapgto_id` | `int` | `int(11)` | NO | - | `0` |
| `taxa_tef` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `taxa_maquineta` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `dias_parcela` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `bandeira_tef_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_cart_config_per

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_cart_config_per_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_config_id` | `int` | `int(11)` | NO | - | `0` |
| `tipospgto_id` | `int` | `int(11)` | NO | - | `0` |
| `dia_final` | `int` | `int(11)` | NO | - | `0` |
| `dia_receb` | `int` | `int(11)` | NO | - | `0` |
| `taxa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `bandeira_tef_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_cart_credenc_filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | MUL | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | MUL | `0` |
| `codigo_credenc` | `varchar` | `varchar(25)` | NO | - | `'0'` |
| `chave_requisicao` | `varchar` | `varchar(36)` | NO | - | `''` |
| `cnpj_filial` | `varchar` | `varchar(14)` | YES | MUL | `NULL` |
| `cnpj_credenc` | `varchar` | `varchar(14)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtapagado` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `apag_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_cart_credenc_filiallog

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `logs_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## credenc_cart_sat

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `codigo` | `char` | `char(3)` | NO | PRI | `''` |
| `nome` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cnpj` | `varchar` | `varchar(20)` | YES | - | `NULL` |

---

## credenc_maquineta_terminal

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_maquineta_terminal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | - | `0` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | - | `0` |
| `identificador_terminal` | `varchar` | `varchar(25)` | NO | - | `'0'` |
| `tipo` | `tinyint` | `tinyint(5)` | NO | - | `0` |
| `dia_venc` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `valor_mensalidade` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## credenc_pbm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_pbm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(50)` | NO | - | `''` |
| `tipo_pbm` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## credenc_pbm_config

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_pbm_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_pbm_id` | `int` | `int(11)` | NO | - | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | - | `0` |
| `tipo_fechamento` | `int` | `int(11)` | NO | - | `0` |
| `dias_parcela` | `int` | `int(11)` | NO | - | `0` |
| `dia_final` | `int` | `int(11)` | NO | - | `0` |
| `dia_receb` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filfisica_id` | `int` | `int(11)` | NO | - | `0` |

---

## credenc_pbm_prod

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_pbm_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `reposicao_automatica` | `char` | `char(1)` | NO | - | `'N'` |
| `perc_desc_rep_autom` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |

---

## credenc_pbm_prod_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_pbm_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `logs_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## credenc_pbm_prod_tab_desc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabela_desconto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_pbm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `desconto_adicional` | `decimal` | `decimal(6,2)` | NO | - | `0.00` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## credenc_pbm_prod_tab_desc_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabela_desconto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_pbm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `logs_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(100)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## credenc_tef

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_tef_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nome` | `varchar` | `varchar(50)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## credenc_tef_inconsistente

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `credenc_tef_inconsistente_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `credenc_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `caixa_id` | `int` | `int(11)` | NO | - | `0` |
| `nsu` | `bigint` | `bigint(20)` | NO | - | `0` |
| `status` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `status_descr` | `varchar` | `varchar(20)` | NO | - | `''` |
| `cod_rede` | `varchar` | `varchar(20)` | NO | - | `''` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## curvaabc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `totalcusto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `totalqtde` | `int` | `int(11)` | YES | - | `NULL` |
| `curvaabc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `curvaabc_est` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `data` | `datetime` | `datetime` | YES | - | `NULL` |

---

## demais_docs

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `demais_docs_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `ind_oper` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `fornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dt_oper` | `date` | `date` | NO | - | `'0000-00-00'` |
| `vl_oper` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cst_pis` | `char` | `char(2)` | NO | - | `''` |
| `vl_bc_pis` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `aliq_pis` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_pis` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cst_cofins` | `char` | `char(2)` | NO | - | `''` |
| `vl_bc_cofins` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `aliq_cofins` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_cofins` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `nat_bc_cred` | `char` | `char(2)` | YES | - | `NULL` |
| `ind_orig_cred` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `desc_doc_oper` | `varchar` | `varchar(60)` | NO | - | `''` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `conta_contabil_id` | `int` | `int(11)` | NO | - | `0` |
| `tipo_oper` | `char` | `char(1)` | NO | - | `'C'` |

---

## devolucao_forn

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `devolucao_forn_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `fornece_id` | `int` | `int(11)` | NO | - | `0` |
| `entradas_id` | `int` | `int(11)` | NO | - | `0` |
| `descricao` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | NO | - | `0` |
| `qtde_dev` | `int` | `int(11)` | NO | - | `0` |
| `preco_unit` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `preco_cad` | `decimal` | `decimal(11,0)` | YES | - | `NULL` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `''` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `data_hora` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `consumo_interno` | `char` | `char(1)` | YES | - | `'N'` |
| `nota_fiscal_item_id` | `int` | `int(11)` | YES | - | `0` |

---

## empresa

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `EMPRESA_ID` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `STATUS` | `char` | `char(1)` | YES | - | `'S'` |
| `NOME` | `varchar` | `varchar(100)` | NO | - | `''` |
| `ENDERECO` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `CIDADE` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `BAIRRO` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `CEP` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `ESTADO` | `char` | `char(2)` | YES | - | `NULL` |
| `INSCR` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `CGC` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `TELEF` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `CONTATO` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `FLAG_NOTA` | `char` | `char(1)` | YES | - | `'S'` |
| `DESC_FUNC` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `DESC_EMPR` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `VIAS` | `int` | `int(1)` | YES | - | `1` |
| `TIPOPRECO` | `int` | `int(1)` | YES | - | `1` |
| `CTRVENCTO` | `char` | `char(1)` | YES | - | `'S'` |
| `DIASJUR` | `int` | `int(3)` | YES | - | `0` |
| `MULTA` | `decimal` | `decimal(6,3)` | NO | - | `0.000` |
| `JUROSDIA` | `decimal` | `decimal(7,4)` | YES | - | `0.0000` |
| `VENDA_VISTA` | `char` | `char(1)` | YES | - | `'P'` |
| `FECHAMENTO` | `int` | `int(2)` | YES | - | `30` |
| `RECEB` | `int` | `int(2)` | YES | - | `1` |
| `PERPRPROMO` | `char` | `char(1)` | YES | - | `'S'` |
| `CUPOMFISC` | `char` | `char(1)` | YES | - | `'N'` |
| `DESCMAXGR` | `char` | `char(1)` | YES | - | `'N'` |
| `PDESCVVIST` | `char` | `char(1)` | YES | - | `'S'` |
| `INSTR01` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `INSTR02` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `LOJAS_LERAM` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `LOJAS_LERAM2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `APAGADO` | `char` | `char(1)` | YES | - | `'N'` |
| `CARTAO` | `char` | `char(1)` | YES | - | `'P'` |
| `codempadm` | `int` | `int(11)` | YES | - | `NULL` |
| `pmpreco` | `char` | `char(1)` | YES | - | `'N'` |
| `impdadoscliente` | `char` | `char(1)` | YES | - | `'S'` |
| `DESC_AUT` | `char` | `char(1)` | YES | - | `'N'` |
| `UTILIZA_COD_IMP` | `char` | `char(1)` | YES | - | `'N'` |
| `altera_desconto` | `char` | `char(1)` | YES | - | `'N'` |
| `PROIBIRDESC` | `char` | `char(1)` | YES | - | `'N'` |
| `marcado` | `char` | `char(1)` | YES | - | `'N'` |
| `fidelidade` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_Id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `pagar_vista` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `fidelidade2` | `char` | `char(1)` | YES | - | `'S'` |
| `FAX` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `novartis` | `char` | `char(1)` | YES | - | `'N'` |
| `senha` | `varchar` | `varchar(20)` | YES | - | `'1111'` |
| `pedesenha` | `char` | `char(1)` | YES | - | `'N'` |
| `operadoras_id` | `int` | `int(11)` | YES | - | `0` |
| `parcelamento` | `char` | `char(1)` | YES | - | `'N'` |
| `baixa_fechamento` | `char` | `char(1)` | YES | - | `'N'` |
| `dias_limite` | `int` | `int(11)` | YES | - | `0` |
| `BUSCA_TEL` | `char` | `char(1)` | YES | - | `'N'` |
| `vidalink` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `envia_prod` | `char` | `char(1)` | YES | - | `'N'` |
| `vale_dinheiro` | `char` | `char(1)` | YES | - | `'S'` |
| `descqtde` | `char` | `char(1)` | YES | - | `'N'` |
| `email` | `varchar` | `varchar(80)` | YES | - | `NULL` |
| `diautil` | `char` | `char(1)` | YES | - | `'N'` |
| `pagar_vistasemrec` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cupom_receita` | `varchar` | `varchar(80)` | YES | - | `NULL` |
| `cupom_semrec` | `varchar` | `varchar(80)` | YES | - | `NULL` |
| `ean8` | `char` | `char(1)` | YES | - | `'N'` |
| `seq_ean8` | `int` | `int(11)` | YES | - | `0` |
| `cadclivenda` | `char` | `char(1)` | YES | - | `'S'` |
| `DESCVISTA` | `char` | `char(1)` | YES | - | `'N'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `empresanet_lib` | `char` | `char(1)` | NO | - | `'S'` |
| `msg_cupom` | `text` | `text` | YES | - | `NULL` |
| `rodape_fiscal` | `int` | `int(11)` | NO | - | `0` |
| `percpgtomin` | `decimal` | `decimal(6,2)` | NO | - | `0.00` |
| `numero` | `int` | `int(11)` | YES | - | `0` |
| `alt_end_fun` | `char` | `char(1)` | NO | - | `'S'` |
| `receita` | `char` | `char(1)` | YES | - | `'N'` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dias_venc` | `int` | `int(11)` | NO | - | `0` |
| `email_nfe` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cupom_parcela` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `RAZAO` | `varchar` | `varchar(100)` | NO | - | `''` |
| `baixar_apenas_ult_periodo` | `char` | `char(1)` | NO | - | `'N'` |
| `crediario` | `char` | `char(1)` | NO | - | `'N'` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `impdadoscliente_ger` | `char` | `char(1)` | YES | - | `'N'` |
| `so_formas_da_empresa` | `char` | `char(1)` | YES | - | `'N'` |
| `tipo_limite_mes` | `char` | `char(1)` | NO | - | `'T'` |
| `fis_jur` | `char` | `char(1)` | NO | - | `'J'` |
| `cpf` | `varchar` | `varchar(14)` | NO | - | `''` |
| `rg` | `varchar` | `varchar(30)` | NO | - | `''` |
| `obs` | `varchar` | `varchar(150)` | NO | - | `''` |
| `produtor_rural` | `char` | `char(1)` | NO | - | `'N'` |
| `empresa_id_prever` | `varchar` | `varchar(15)` | NO | - | `''` |
| `prever_origem` | `char` | `char(1)` | NO | - | `'B'` |
| `diafecha_fim_periodo` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_contribuinte` | `int` | `int(1)` | YES | - | `1` |
| `exigir_cartao_fidelidade` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_leitura_cartao_fidelidade` | `char` | `char(1)` | YES | - | `NULL` |
| `bloquear_troca_cliente` | `char` | `char(1)` | NO | - | `'N'` |
| `exibir_dt_fechamento` | `char` | `char(1)` | YES | - | `'S'` |
| `codigo_lgpd` | `int` | `int(11)` | YES | - | `1` |
| `acao_lgpd` | `int` | `int(11)` | YES | - | `1` |
| `permite_tabela_desc_entrega` | `char` | `char(1)` | NO | - | `'N'` |
| `lim_cre_total` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lim_mes` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `tipo_emissao` | `char` | `char(2)` | YES | - | `NULL` |

---

## enderecos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `clientes_id` | `int` | `int(11)` | NO | PRI | `0` |
| `enderecos_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `endereco` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `referencia` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `rota_id` | `int` | `int(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `numero` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `complemento` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cpf_cnpj_entrega` | `varchar` | `varchar(18)` | YES | - | `NULL` |

---

## entradas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `entradas_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `fornece_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `barras` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `fabric` | `varchar` | `varchar(12)` | YES | - | `NULL` |
| `quanticx` | `int` | `int(11)` | YES | - | `NULL` |
| `precocx` | `decimal` | `decimal(11,4)` | NO | - | `0.0000` |
| `quantiuni` | `int` | `int(11)` | YES | - | `NULL` |
| `unidades` | `int` | `int(11)` | YES | - | `NULL` |
| `precouni` | `decimal` | `decimal(11,4)` | NO | - | `0.0000` |
| `descit1` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `descit2` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `valorit` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `numnota` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `datanota` | `date` | `date` | YES | MUL | `NULL` |
| `fechada` | `char` | `char(1)` | YES | - | `'N'` |
| `marcada` | `char` | `char(1)` | YES | - | `'N'` |
| `conferida` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(60)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `preco_vnd` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `codnofornec` | `varchar` | `varchar(25)` | NO | - | `''` |
| `prc_cmp_cad` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `veiofilial` | `char` | `char(1)` | YES | - | `'N'` |
| `data_hora` | `date` | `date` | YES | MUL | `NULL` |
| `validade` | `date` | `date` | YES | - | `NULL` |
| `controla_validade` | `char` | `char(1)` | YES | - | `'N'` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `ipi` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `redutor_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `numlanc` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `cfop` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `importada` | `char` | `char(3)` | NO | - | `'N'` |
| `lote` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `repasse` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `estoque_atual` | `int` | `int(11)` | YES | - | `0` |
| `curvaabc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `import_pedido` | `char` | `char(1)` | NO | - | `'N'` |
| `dafilial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `substituicao_tributaria` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `qtdeoriginal` | `int` | `int(11)` | YES | - | `0` |
| `perc_repasse` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_ipi` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_substituicao_tributaria` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `conferiupreco` | `char` | `char(1)` | YES | - | `'N'` |
| `numlancconfent` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `lista` | `char` | `char(1)` | YES | - | `NULL` |
| `iva` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `val_descit1` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `val_descit2` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `operacao` | `int` | `int(11)` | NO | MUL | `0` |
| `comparada` | `char` | `char(1)` | NO | - | `'N'` |
| `validado` | `int` | `int(11)` | NO | - | `0` |
| `controlado` | `char` | `char(1)` | NO | - | `'N'` |
| `calc_pmc` | `char` | `char(1)` | NO | - | `'N'` |
| `st` | `char` | `char(3)` | YES | - | `NULL` |
| `unidade` | `varchar` | `varchar(6)` | YES | - | `NULL` |
| `hr_fecha_entrada` | `datetime` | `datetime` | YES | - | `NULL` |
| `hr_fecha_conferencia` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `perc_reducao_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `alterar` | `char` | `char(1)` | NO | - | `'N'` |
| `val_frete` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `val_seguro` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `val_despesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cst_ipi` | `char` | `char(2)` | NO | - | `''` |
| `tipo_pagto` | `char` | `char(1)` | NO | - | `''` |
| `consumo_interno` | `char` | `char(1)` | YES | - | `'N'` |
| `chave_nfe` | `varchar` | `varchar(44)` | YES | - | `NULL` |
| `base_calc_icms_sub_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_icms_sub_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `icms_ret_somado_produto` | `char` | `char(1)` | YES | - | `'N'` |
| `importada_site` | `char` | `char(1)` | YES | - | `'N'` |
| `cst_pis` | `char` | `char(2)` | NO | - | `''` |
| `base_pis` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `aliq_pis` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cst_cofins` | `char` | `char(2)` | NO | - | `''` |
| `base_cofins` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `aliq_cofins` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cst_pis_ent` | `char` | `char(2)` | YES | - | `NULL` |
| `valor_pis_ent` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cst_cofins_ent` | `char` | `char(2)` | YES | - | `NULL` |
| `valor_cofins_ent` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `ncm` | `int` | `int(11)` | YES | - | `NULL` |
| `num_item` | `int` | `int(11)` | NO | - | `0` |
| `conferida_xml` | `char` | `char(1)` | NO | - | `'N'` |
| `preco_ult_ent` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `custo_item` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `csosn_icms` | `char` | `char(3)` | YES | - | `NULL` |
| `perc_aplic_calc_credito` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_cred_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `frete_conta` | `char` | `char(1)` | YES | - | `NULL` |
| `percent_acres_custo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `emit_crt` | `int` | `int(11)` | YES | - | `NULL` |
| `serie` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `base_calc_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_fcp_st` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_fcp_st_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_ipi_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `versao_xml` | `decimal` | `decimal(8,3)` | NO | - | `0.000` |
| `valor_icms_deson` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `motivo_desoneracao` | `int` | `int(11)` | NO | - | `0` |
| `descontar_desonerado` | `char` | `char(1)` | NO | - | `'N'` |
| `cest` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `valor_icms_operacao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_diferido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_diferido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `emit_ie_st` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `vl_icms_substituto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `quantidade_devolucao` | `int` | `int(11)` | YES | - | `NULL` |
| `reposicao_pbm` | `char` | `char(1)` | NO | - | `'N'` |

---

## entregas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `usuario_id_saida` | `int` | `int(11)` | NO | - | `0` |
| `usuario_id_chegada` | `int` | `int(11)` | YES | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `usuario_id_cancela` | `int` | `int(11)` | YES | - | `NULL` |
| `data_hora_cancelado` | `datetime` | `datetime` | YES | - | `NULL` |
| `usuario_id_conf` | `int` | `int(11)` | NO | - | `0` |
| `data_hora_conf` | `datetime` | `datetime` | YES | - | `NULL` |
| `data_hora_pedido` | `datetime` | `datetime` | YES | - | `NULL` |
| `data_hora_saida` | `datetime` | `datetime` | YES | - | `NULL` |
| `data_hora_chegada` | `datetime` | `datetime` | YES | - | `NULL` |

---

## entrega_saida

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `saida_id` | `int` | `int(11)` | NO | PRI | `0` |
| `saida_filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `entrega_numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `entrega_filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `tipo_saida` | `char` | `char(1)` | NO | PRI | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `char` | `char(50)` | NO | MUL | `''` |

---

## entrega_valor_escalar

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `valor_ate` | `decimal` | `decimal(11,2)` | NO | PRI | `0.00` |
| `preco` | `decimal` | `decimal(12,2)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `filial_id` | `int` | `int(10) unsigned` | NO | PRI | `0` |

---

## espec

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `espec_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `validade` | `date` | `date` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `Cod_Grupo_Espec` | `int` | `int(11)` | YES | - | `NULL` |
| `peso` | `int` | `int(7)` | YES | - | `0` |
| `oculta_item` | `char` | `char(1)` | YES | - | `'N'` |
| `oculta_foto` | `char` | `char(1)` | YES | - | `'N'` |

---

## estoque_abertura

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `data_estoque` | `date` | `date` | NO | - | `'0000-00-00'` |
| `nat_bc_cred` | `char` | `char(2)` | NO | - | `''` |
| `vl_tot_est` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `est_imp` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_bc_est` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_bc_men_est` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cst_pis` | `char` | `char(2)` | NO | - | `''` |
| `aliq_pis` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cst_cofins` | `char` | `char(2)` | NO | - | `''` |
| `aliq_cofins` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_cred_pis` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `vl_cred_cofins` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `desc_est` | `varchar` | `varchar(60)` | NO | - | `''` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `conta_contabil_id` | `int` | `int(11)` | NO | - | `0` |

---

## estoque_minimo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `estoque` | `int` | `int(11)` | YES | - | `0` |
| `minimo` | `int` | `int(11)` | YES | - | `0` |
| `compra_suspensa` | `char` | `char(1)` | YES | - | `'N'` |
| `margem_preco_pro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_pro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valid_pro` | `date` | `date` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `ultvenda` | `datetime` | `datetime` | YES | - | `NULL` |
| `ultentrada` | `datetime` | `datetime` | YES | - | `NULL` |
| `ultqtdeent` | `int` | `int(11)` | YES | - | `0` |
| `ultqtdevenda` | `int` | `int(11)` | YES | - | `0` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `ultimaentrada` | `char` | `char(1)` | YES | - | `'N'` |
| `pmc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `ultconferencia` | `datetime` | `datetime` | YES | - | `NULL` |
| `ultqtdeconferencia` | `int` | `int(11)` | NO | - | `0` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `estoque_reserva` | `int` | `int(11)` | YES | - | `0` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |

---

## estoque_minimo2

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `minimo` | `int` | `int(11)` | YES | - | `0` |
| `maximo` | `int` | `int(11)` | YES | - | `0` |
| `faceamento` | `int` | `int(11)` | YES | - | `0` |
| `demanda` | `float` | `float(9,3)` | YES | - | `0.000` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `desviopadrao` | `decimal` | `decimal(11,9)` | YES | - | `0.000000000` |
| `maximo_abs` | `int` | `int(11)` | YES | - | `0` |
| `max_unid_vend` | `decimal` | `decimal(11,9)` | YES | - | `0.000000000` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `faceamento_vencimento` | `date` | `date` | NO | - | `'0000-00-00'` |

---

## estoque_posterior

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `movment_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | MUL | `0` |
| `estoque_pos` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `quanti_uni` | `int` | `int(11)` | NO | - | `0` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `preco_medio_custo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `estoque_posterior_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dt_cadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `md5sign` | `varchar` | `varchar(32)` | YES | - | `NULL` |
| `filial_movment_id` | `int` | `int(11)` | NO | - | `0` |

---

## filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(10)` | NO | PRI | `NULL (sem default)` |
| `nome` | `varchar` | `varchar(35)` | NO | - | `''` |
| `reduz` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `ender` | `varchar` | `varchar(35)` | NO | - | `''` |
| `cgc` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `menstit` | `varchar` | `varchar(49)` | YES | - | `NULL` |
| `mensrod1` | `varchar` | `varchar(49)` | YES | - | `NULL` |
| `mensrod2` | `varchar` | `varchar(49)` | YES | - | `NULL` |
| `mensorc` | `varchar` | `varchar(49)` | YES | - | `NULL` |
| `mens2via` | `varchar` | `varchar(49)` | YES | - | `NULL` |
| `menstotal` | `varchar` | `varchar(28)` | YES | - | `NULL` |
| `menscima` | `varchar` | `varchar(28)` | YES | - | `NULL` |
| `mensbaixo` | `varchar` | `varchar(28)` | YES | - | `NULL` |
| `mensapagar` | `varchar` | `varchar(28)` | YES | - | `NULL` |
| `data` | `char` | `char(1)` | YES | - | `'S'` |
| `hora` | `char` | `char(1)` | YES | - | `'S'` |
| `viasvista` | `int` | `int(1)` | YES | - | `1` |
| `viasprazo` | `int` | `int(1)` | YES | - | `1` |
| `colunas` | `int` | `int(2)` | YES | - | `1` |
| `salto` | `int` | `int(2)` | YES | - | `1` |
| `mostratotd` | `char` | `char(1)` | YES | - | `'I'` |
| `menstotdes` | `varchar` | `varchar(28)` | YES | - | `NULL` |
| `impcupom` | `char` | `char(1)` | YES | - | `'S'` |
| `menstitfi` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `mensrodfi1` | `varchar` | `varchar(48)` | YES | - | `NULL` |
| `mensrodfi2` | `varchar` | `varchar(48)` | YES | - | `NULL` |
| `desconto` | `char` | `char(1)` | YES | - | `'S'` |
| `altpreco` | `char` | `char(1)` | YES | - | `'S'` |
| `orcamento` | `char` | `char(1)` | YES | - | `'S'` |
| `estoque` | `char` | `char(1)` | YES | - | `'S'` |
| `cadastra` | `char` | `char(1)` | YES | - | `'S'` |
| `paracima` | `char` | `char(1)` | YES | - | `'S'` |
| `parabaixo` | `char` | `char(1)` | YES | - | `'S'` |
| `troco` | `decimal` | `decimal(10,2)` | YES | - | `0.00` |
| `tmaximo` | `decimal` | `decimal(7,2)` | YES | - | `0.00` |
| `pernome` | `char` | `char(1)` | YES | - | `'S'` |
| `desmarg1` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `desmarg2` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `desmarg3` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `mostraf` | `char` | `char(1)` | YES | - | `'S'` |
| `descreal` | `char` | `char(1)` | YES | - | `'N'` |
| `p_empresa` | `char` | `char(1)` | YES | - | `'S'` |
| `sem_estoque` | `char` | `char(1)` | NO | - | `'N'` |
| `cnc_data_o` | `char` | `char(1)` | YES | - | `'S'` |
| `mencabcnv` | `varchar` | `varchar(48)` | YES | - | `NULL` |
| `menrd1cnv` | `varchar` | `varchar(48)` | YES | - | `NULL` |
| `menrd2cnv` | `varchar` | `varchar(48)` | YES | - | `NULL` |
| `recalc` | `char` | `char(1)` | YES | - | `'S'` |
| `arredconv` | `char` | `char(1)` | YES | - | `'S'` |
| `cod_panare` | `int` | `int(11)` | YES | - | `NULL` |
| `cgc_panare` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `ped_panare` | `int` | `int(6)` | YES | - | `0` |
| `cod_panafa` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cod_reydr` | `int` | `int(11)` | YES | - | `NULL` |
| `ped_reydr` | `int` | `int(11)` | YES | - | `0` |
| `cod_rey_ve` | `varchar` | `varchar(4)` | YES | - | `NULL` |
| `cod_rey_fa` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cod_cruz` | `int` | `int(11)` | YES | - | `NULL` |
| `cod_sagra` | `int` | `int(11)` | YES | - | `NULL` |
| `ped_sagra` | `int` | `int(3)` | YES | - | `0` |
| `codproffa` | `int` | `int(11)` | YES | - | `0` |
| `entr_pagar` | `char` | `char(1)` | YES | - | `'S'` |
| `entr_preco` | `char` | `char(1)` | YES | - | `'S'` |
| `possuigaveta` | `char` | `char(1)` | YES | - | `'N'` |
| `concaix_entr` | `char` | `char(1)` | YES | - | `'S'` |
| `psi_nomest` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `psi_ender` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `psi_cgc` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `psi_inscr` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `psi_telef` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `psi_fax` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `psi_farma` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `psicrf` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `repassadesc_ent` | `char` | `char(1)` | YES | - | `'N'` |
| `codmulta` | `int` | `int(11)` | YES | - | `NULL` |
| `codsupr` | `int` | `int(11)` | YES | - | `NULL` |
| `codsangria` | `int` | `int(11)` | YES | - | `NULL` |
| `viasrecibo` | `tinyint` | `tinyint(4)` | YES | - | `1` |
| `tirabotoes` | `char` | `char(1)` | YES | - | `'S'` |
| `versao` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `dtarqprc` | `date` | `date` | YES | - | `NULL` |
| `tipoadmcartao` | `varchar` | `varchar(15)` | YES | - | `'CartÃ¯Â¿Â½o BIG'` |
| `ped_cruz` | `int` | `int(11)` | YES | - | `0` |
| `ped_profarma` | `int` | `int(11)` | YES | - | `0` |
| `cod_ita` | `int` | `int(11)` | YES | - | `NULL` |
| `ped_ita` | `int` | `int(11)` | YES | - | `NULL` |
| `DATA_ATUALIZA_SALDO` | `date` | `date` | YES | - | `NULL` |
| `CODFORNECEDORADM` | `int` | `int(11)` | YES | - | `NULL` |
| `SENHAFORNECEDORADM` | `int` | `int(11)` | YES | - | `NULL` |
| `PATHWEBSERVICE` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `arred_orc` | `char` | `char(1)` | YES | - | `'N'` |
| `FORCA_AUTORIZACAO` | `char` | `char(1)` | YES | - | `'N'` |
| `relreceberunificado` | `char` | `char(1)` | YES | - | `'N'` |
| `envia_baixa` | `char` | `char(1)` | YES | - | `'N'` |
| `NaoFechaCaixa` | `char` | `char(1)` | YES | - | `'N'` |
| `permite_devolucao` | `char` | `char(1)` | YES | - | `'N'` |
| `ped_servimed` | `int` | `int(11)` | YES | - | `0` |
| `datax` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `dataultsenha` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `impfechacesta` | `char` | `char(1)` | YES | - | `'S'` |
| `escritorio` | `char` | `char(1)` | YES | - | `'N'` |
| `prog_gaveta` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `grupodespesas_id` | `int` | `int(11)` | YES | - | `0` |
| `produto_id` | `int` | `int(11)` | YES | - | `0` |
| `chqempresa_id` | `int` | `int(11)` | YES | - | `0` |
| `meses_cheque` | `int` | `int(11)` | YES | - | `0` |
| `pedesupervisor` | `char` | `char(1)` | YES | - | `'S'` |
| `icms` | `decimal` | `decimal(11,2)` | YES | - | `18.00` |
| `descr_campo1` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `descr_campo2` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `descr_campo3` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `descr_campo4` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `descr_campo5` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `bloquear_usuario_caixa` | `char` | `char(1)` | YES | - | `'N'` |
| `bloquear_usuario_cai` | `char` | `char(1)` | YES | - | `'N'` |
| `msg_feccaixa` | `char` | `char(1)` | YES | - | `'S'` |
| `email` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `altdesc` | `char` | `char(1)` | YES | - | `'N'` |
| `imp_entrega` | `char` | `char(1)` | YES | - | `'O'` |
| `sup_orcamento` | `char` | `char(1)` | YES | - | `'N'` |
| `mesvotou` | `char` | `char(2)` | YES | - | `NULL` |
| `telefone` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `controle_validade` | `char` | `char(1)` | YES | - | `'N'` |
| `validade_A` | `int` | `int(11)` | YES | - | `0` |
| `validade_B` | `int` | `int(11)` | YES | - | `0` |
| `validade_C` | `int` | `int(11)` | YES | - | `0` |
| `validade_D` | `int` | `int(11)` | YES | - | `0` |
| `imp_transf` | `char` | `char(2)` | YES | - | `'S'` |
| `parc_entrada` | `int` | `int(11)` | YES | - | `0` |
| `uti_foto` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `imp_despesas` | `char` | `char(1)` | YES | - | `'S'` |
| `atu_foto` | `datetime` | `datetime` | YES | - | `NULL` |
| `pontos` | `int` | `int(11)` | YES | - | `0` |
| `avisopontos` | `int` | `int(11)` | YES | - | `0` |
| `ini_fidelidade` | `datetime` | `datetime` | YES | - | `NULL` |
| `fin_fidelidade` | `datetime` | `datetime` | YES | - | `NULL` |
| `atualizacao` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `filialestoque_id` | `int` | `int(11)` | YES | - | `0` |
| `filialcompartilha_id` | `int` | `int(11)` | YES | - | `0` |
| `ncontrole_novartis` | `int` | `int(11)` | YES | - | `NULL` |
| `perg_prodbloq` | `char` | `char(1)` | YES | - | `'N'` |
| `fontesaude` | `char` | `char(1)` | YES | - | `'N'` |
| `vis_descmax` | `char` | `char(1)` | YES | - | `'S'` |
| `ext_juros` | `char` | `char(1)` | YES | - | `'N'` |
| `seq_epharma` | `int` | `int(11)` | YES | - | `0` |
| `sel_caixa_canc` | `char` | `char(1)` | YES | - | `'N'` |
| `max_parcelas` | `int` | `int(11)` | YES | - | `1` |
| `cod_sagrfa` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cod_cruzfa` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `codnaprof` | `int` | `int(6)` | YES | - | `0` |
| `cod_servimed` | `int` | `int(11)` | YES | - | `0` |
| `saldowpdv` | `char` | `char(1)` | YES | - | `'T'` |
| `bairro` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `UF` | `char` | `char(2)` | YES | - | `NULL` |
| `inscr` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `prc_transfer` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `tipo_coletor_inv` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `dataat_reimprime` | `char` | `char(1)` | YES | - | `'S'` |
| `dinheiro_pontos` | `decimal` | `decimal(11,2)` | YES | - | `1.00` |
| `prxfechamento` | `char` | `char(1)` | YES | - | `'S'` |
| `acestrutura` | `char` | `char(1)` | YES | - | `'S'` |
| `cancela_chq` | `char` | `char(1)` | YES | - | `'P'` |
| `vis_pedpendente` | `char` | `char(1)` | YES | - | `'N'` |
| `confere_cx` | `char` | `char(1)` | YES | - | `'N'` |
| `planocontas` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `impfeccaixa` | `char` | `char(1)` | YES | - | `'S'` |
| `usuario_fp` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `senha_fp` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `solic_fp` | `int` | `int(11)` | YES | - | `1` |
| `est_contagem` | `char` | `char(1)` | YES | - | `'S'` |
| `pontos_cad` | `int` | `int(11)` | YES | - | `0` |
| `pontos_pri` | `int` | `int(11)` | YES | - | `0` |
| `prc_sugcompra` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `imp_recibo` | `char` | `char(2)` | YES | - | `'N'` |
| `tipov` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `ver_chq` | `char` | `char(1)` | YES | - | `'N'` |
| `inestra` | `char` | `char(1)` | YES | - | `'N'` |
| `desc_promo` | `char` | `char(1)` | YES | - | `'N'` |
| `minA` | `int` | `int(11)` | YES | - | `7` |
| `maxA` | `int` | `int(11)` | YES | - | `7` |
| `minB` | `int` | `int(11)` | YES | - | `7` |
| `maxB` | `int` | `int(11)` | YES | - | `7` |
| `minC` | `int` | `int(11)` | YES | - | `7` |
| `maxC` | `int` | `int(11)` | YES | - | `7` |
| `minD` | `int` | `int(11)` | YES | - | `0` |
| `maxD` | `int` | `int(11)` | YES | - | `0` |
| `conferecx_ent` | `char` | `char(1)` | YES | - | `'N'` |
| `calcabcprod` | `datetime` | `datetime` | YES | - | `NULL` |
| `calcabcest` | `datetime` | `datetime` | YES | - | `NULL` |
| `calcabcclientes` | `datetime` | `datetime` | YES | - | `NULL` |
| `calcdemanda` | `datetime` | `datetime` | YES | - | `NULL` |
| `pontosreais` | `char` | `char(1)` | YES | - | `'N'` |
| `seqsystemfarma` | `int` | `int(11)` | YES | - | `0` |
| `vis_local` | `char` | `char(1)` | YES | - | `'N'` |
| `bancoca` | `char` | `char(1)` | YES | - | `'N'` |
| `dtarqcrm` | `date` | `date` | YES | - | `NULL` |
| `obrigarkm` | `char` | `char(1)` | YES | - | `'N'` |
| `romaneio` | `int` | `int(11)` | YES | - | `0` |
| `menrd3cnv` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `horafunc_ini` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `horafunc_fin` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `rel_abreviado` | `char` | `char(1)` | YES | - | `'N'` |
| `troco_max` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `marka` | `char` | `char(1)` | YES | - | `'N'` |
| `comunicando` | `char` | `char(1)` | YES | - | `'N'` |
| `inicio_comunic` | `datetime` | `datetime` | YES | - | `NULL` |
| `fim_comunic` | `datetime` | `datetime` | YES | - | `NULL` |
| `fila` | `int` | `int(11)` | YES | - | `0` |
| `fila_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `max_comunic` | `int` | `int(11)` | YES | - | `0` |
| `obriga_cesta` | `char` | `char(1)` | YES | - | `'N'` |
| `vias_supsang` | `int` | `int(11)` | YES | - | `1` |
| `taxa_parc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `data_parc` | `char` | `char(1)` | YES | - | `'S'` |
| `senhavenda` | `char` | `char(1)` | YES | - | `'N'` |
| `vias_sangria` | `int` | `int(11)` | YES | - | `NULL` |
| `procura_prod_nome` | `char` | `char(1)` | YES | - | `'S'` |
| `imprime_recibo_premios` | `char` | `char(1)` | YES | - | `'S'` |
| `calcipi` | `char` | `char(1)` | YES | - | `'S'` |
| `limpa_psico` | `char` | `char(1)` | YES | - | `'N'` |
| `valid_pontos` | `int` | `int(11)` | YES | - | `0` |
| `arred_ent` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dias_sug_contagem` | `int` | `int(11)` | NO | - | `0` |
| `bloq_prods_em_contagem` | `char` | `char(1)` | NO | - | `'N'` |
| `icms_subst` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cfop_transf` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `solic_prevsaude` | `int` | `int(11)` | YES | - | `0` |
| `toler_entr_acima` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `toler_entr_abaixo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `controlar_continuo` | `char` | `char(1)` | NO | - | `'S'` |
| `est_neg_ent` | `char` | `char(1)` | YES | - | `'S'` |
| `dias_cancelamento` | `smallint` | `smallint(6)` | NO | - | `0` |
| `exigir_senha_cliente` | `char` | `char(1)` | NO | - | `'S'` |
| `conta_caixa` | `int` | `int(11)` | YES | - | `NULL` |
| `impressao_romaneio` | `char` | `char(1)` | NO | - | `'F'` |
| `selfilial_ent` | `char` | `char(1)` | YES | - | `'N'` |
| `selfilial_ent_vnd` | `char` | `char(1)` | YES | - | `'N'` |
| `planocontas_id_sangria` | `int` | `int(11)` | YES | - | `NULL` |
| `avisosangria` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `agrega_positivo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `agrega_negativo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `agrega_neutro` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `incide_ipi_subst` | `char` | `char(1)` | NO | - | `'N'` |
| `cobrasubisidio_fp` | `char` | `char(1)` | YES | - | `'S'` |
| `pagamentoid_fp` | `int` | `int(11)` | YES | - | `0` |
| `retiradesc_fp` | `char` | `char(1)` | YES | - | `'N'` |
| `financeiro` | `char` | `char(1)` | NO | - | `'N'` |
| `comunic_fp` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `cadresumido` | `char` | `char(1)` | YES | - | `'S'` |
| `confcaixa_tolerancia_diferenca` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `sangria_conv` | `char` | `char(1)` | YES | - | `'N'` |
| `dados_sngpc` | `char` | `char(1)` | NO | - | `'S'` |
| `listar_faltas` | `char` | `char(1)` | NO | - | `'F'` |
| `condicao_pagamento_id` | `int` | `int(11)` | NO | - | `0` |
| `pede_senharec` | `char` | `char(1)` | YES | - | `'S'` |
| `tipo_receber` | `varchar` | `varchar(20)` | YES | - | `'Por Produto'` |
| `medico_so_crm` | `char` | `char(1)` | NO | - | `'N'` |
| `calc_ultentrada` | `date` | `date` | YES | - | `NULL` |
| `autenticacao` | `char` | `char(1)` | YES | - | `'N'` |
| `calc_pmc` | `date` | `date` | YES | - | `NULL` |
| `edit_pedeletronico_entrada` | `char` | `char(1)` | NO | - | `'N'` |
| `planocontas_id_vista` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_receber` | `int` | `int(11)` | YES | - | `NULL` |
| `est_inventario` | `char` | `char(1)` | YES | - | `'S'` |
| `est_entrada` | `char` | `char(1)` | YES | - | `'S'` |
| `planocontas_id_cheques` | `int` | `int(11)` | YES | - | `NULL` |
| `transprodcodbarra` | `char` | `char(1)` | NO | - | `'N'` |
| `recbtransmarcaescane` | `char` | `char(1)` | NO | - | `'N'` |
| `separar_filial_numped` | `char` | `char(1)` | NO | - | `'N'` |
| `vias_cupom_transf` | `int` | `int(11)` | NO | - | `1` |
| `cnpj_entrada` | `char` | `char(1)` | YES | - | `'N'` |
| `mostra_lote_venda` | `char` | `char(1)` | NO | - | `'S'` |
| `nfpaulista` | `char` | `char(1)` | YES | - | `'N'` |
| `forca_ncupom` | `char` | `char(1)` | YES | - | `'N'` |
| `planocontas_id_rcbmts` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_rcdesc` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_rcjuro` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_rcmulta` | `int` | `int(11)` | YES | - | `NULL` |
| `desviopadrao` | `char` | `char(1)` | YES | - | `'N'` |
| `arred_desvio` | `char` | `char(1)` | YES | - | `'S'` |
| `rec_endereco` | `char` | `char(1)` | YES | - | `'N'` |
| `rec_consulta` | `char` | `char(1)` | YES | - | `'N'` |
| `planocontas_id_pgdesc` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_pgacres` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_desrec` | `int` | `int(11)` | YES | - | `NULL` |
| `canc_numlanc` | `char` | `char(1)` | YES | - | `'N'` |
| `parcomentrada` | `char` | `char(1)` | NO | - | `'N'` |
| `validade_entrada` | `char` | `char(1)` | YES | - | `'N'` |
| `usa_conferencia` | `char` | `char(1)` | NO | - | `'S'` |
| `drogaria_id` | `int` | `int(11)` | NO | - | `0` |
| `usuario_tedf` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `senha_tedf` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `enviar_vendas_rede` | `char` | `char(1)` | YES | - | `'N'` |
| `pathws_tedf` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `vis_lista` | `char` | `char(1)` | YES | - | `'N'` |
| `cgc_rede` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `nome_rede` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `imp_rectransf` | `char` | `char(1)` | YES | - | `'N'` |
| `vias_cupom_rectransf` | `int` | `int(11)` | YES | - | `0` |
| `geraradmautomatic` | `char` | `char(1)` | NO | - | `'S'` |
| `planocontas_id_sobcxas` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_difcxas` | `int` | `int(11)` | YES | - | `NULL` |
| `dtarqprcguia` | `date` | `date` | YES | - | `NULL` |
| `planocontas_id_cancdev` | `int` | `int(11)` | YES | - | `NULL` |
| `numero` | `int` | `int(11)` | YES | - | `NULL` |
| `nfe_tp_amb` | `int` | `int(1)` | YES | - | `NULL` |
| `nfe_serie` | `char` | `char(3)` | YES | - | `NULL` |
| `nfe_Stat` | `int` | `int(10) unsigned` | YES | - | `NULL` |
| `nfe_modalidade` | `int` | `int(10) unsigned` | YES | - | `NULL` |
| `licenca_nfe` | `varchar` | `varchar(150)` | NO | - | `''` |
| `frase_nfe` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `modif_seq_forn_entr` | `char` | `char(1)` | YES | - | `'N'` |
| `rec_transf_numlanc` | `char` | `char(1)` | YES | - | `'N'` |
| `est_perdas` | `char` | `char(1)` | YES | - | `'S'` |
| `atualiza_est_contagem` | `char` | `char(1)` | YES | - | `'N'` |
| `minutos_parado` | `int` | `int(11)` | YES | - | `0` |
| `planocontas_id_lanentr` | `int` | `int(11)` | YES | - | `0` |
| `sem_estoque_devol` | `char` | `char(1)` | NO | - | `'S'` |
| `inscr_municipal` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `modo_fp` | `char` | `char(1)` | YES | - | `'P'` |
| `cor_perc_lucr` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `campo_preco_custo` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `perc1` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc3` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc4` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc5` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `usa_sintegra` | `char` | `char(1)` | NO | - | `'N'` |
| `altera_preco_transf` | `char` | `char(1)` | YES | - | `NULL` |
| `permit_selentregador` | `char` | `char(1)` | YES | - | `'N'` |
| `imp_tot_danfe` | `char` | `char(1)` | YES | - | `NULL` |
| `produto_arredond` | `int` | `int(11)` | NO | - | `0` |
| `enviar_dados_acode` | `char` | `char(1)` | YES | - | `'N'` |
| `enviando_acode_temp` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |
| `exibe_estoque_sugestaocompra` | `char` | `char(1)` | NO | - | `'S'` |
| `arvore_aberta` | `char` | `char(1)` | YES | - | `'S'` |
| `atualiza_preco_promo` | `char` | `char(1)` | YES | - | `'S'` |
| `promocao_atu_auto` | `char` | `char(1)` | YES | - | `'N'` |
| `promocao_percentual` | `int` | `int(11)` | YES | - | `0` |
| `promocao_local_atu` | `int` | `int(11)` | YES | - | `0` |
| `promocao_data_ult_atu` | `date` | `date` | YES | - | `NULL` |
| `promocao_data_ult_prom` | `date` | `date` | YES | - | `NULL` |
| `promocao_tab_desc_id` | `int` | `int(11)` | YES | - | `0` |
| `usando_rec_transf` | `char` | `char(1)` | YES | - | `'N'` |
| `busca_receita` | `char` | `char(1)` | NO | - | `'N'` |
| `somar_impostos_pmc` | `char` | `char(1)` | NO | - | `'S'` |
| `icms_generico` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `diaslimitealtmov` | `int` | `int(11)` | NO | - | `0` |
| `contato` | `varchar` | `varchar(45)` | YES | - | `NULL` |
| `fax` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `nome_cont` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `cpf_cont` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `crc_cont` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `cnpj_cont` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `cep_cont` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `ender_cont` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `numero_cont` | `int` | `int(11)` | YES | - | `NULL` |
| `telefone_cont` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `fax_cont` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `email_cont` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `cidade_cont` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf_cont` | `char` | `char(2)` | YES | - | `NULL` |
| `bairro_cont` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `vender_lotes_recentes` | `char` | `char(1)` | NO | - | `'S'` |
| `vender_lotes_recentes_cont` | `char` | `char(1)` | NO | - | `'S'` |
| `lote_manualmente` | `char` | `char(1)` | NO | - | `'S'` |
| `lote_manualmente_cont` | `char` | `char(1)` | NO | - | `'S'` |
| `visualizar_estoque_lote` | `char` | `char(1)` | NO | - | `'S'` |
| `vinculado_entrega_avista` | `char` | `char(1)` | NO | - | `'S'` |
| `gera_ctas_pagar_entrada` | `char` | `char(1)` | NO | - | `'N'` |
| `lote_entrega` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `receita_entrega` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `medico_endereco_id` | `int` | `int(11)` | NO | - | `0` |
| `calc_so_usuario_filial` | `char` | `char(1)` | YES | - | `'N'` |
| `pag_comis_ating_meta` | `char` | `char(1)` | YES | - | `'N'` |
| `minimo_perc_meta` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `psi_aut_especial` | `int` | `int(11)` | YES | - | `NULL` |
| `psi_licen_func` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `psi_aut_func` | `int` | `int(11)` | YES | - | `NULL` |
| `ind_perfil` | `char` | `char(1)` | NO | - | `'B'` |
| `exibe_cartao_entrega` | `char` | `char(1)` | YES | - | `'S'` |
| `nfe_amb_conting` | `char` | `char(1)` | YES | - | `'N'` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `versao_nfe` | `char` | `char(1)` | YES | - | `'1'` |
| `cod_regime_tribut` | `char` | `char(2)` | YES | - | `''` |
| `imp_prod_taxa_entrega` | `int` | `int(11)` | NO | - | `0` |
| `imprimir_pmc_danfe` | `char` | `char(1)` | YES | - | `'S'` |
| `perm_sair_prod_reserv` | `char` | `char(1)` | NO | - | `'S'` |
| `fechacx_ent_nao_ini` | `char` | `char(1)` | NO | - | `'N'` |
| `fechacx_ent_nao_fin` | `char` | `char(1)` | NO | - | `'N'` |
| `limite_mes_sug_compra` | `int` | `int(11)` | NO | - | `0` |
| `aguardar_ret_nfe` | `char` | `char(1)` | NO | - | `'S'` |
| `aliq_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `tempo_aguardar_ret_nfe` | `int` | `int(11)` | NO | - | `7` |
| `exibir_pmc_danfe` | `char` | `char(1)` | NO | - | `'S'` |
| `tipo_danfe` | `int` | `int(11)` | YES | - | `1` |
| `cidade_cont_id` | `int` | `int(11)` | NO | - | `0` |
| `codigo_ims` | `int` | `int(11)` | NO | - | `0` |
| `loja_padrao_ims` | `char` | `char(1)` | NO | - | `'N'` |
| `imp_danfe_alfabetica` | `char` | `char(1)` | YES | - | `'N'` |
| `tipo_filial` | `char` | `char(2)` | YES | - | `NULL` |
| `servicos_big` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `codigo_closeup` | `varchar` | `varchar(6)` | YES | - | `NULL` |
| `md5sign_out` | `varchar` | `varchar(32)` | NO | - | `''` |
| `email_nfe` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `host_email_nfe` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `senha_email_nfe` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `qtde_terminais` | `varchar` | `varchar(12)` | YES | - | `NULL` |
| `porta_email_nfe` | `int` | `int(11)` | YES | - | `NULL` |
| `utiliza_ssl_tls` | `char` | `char(1)` | NO | - | `'N'` |
| `importar_lotes_nfe_ent` | `char` | `char(1)` | NO | - | `'N'` |
| `senha_supervisor_ent` | `char` | `char(1)` | NO | - | `'N'` |
| `incluir_itens_conf` | `char` | `char(1)` | NO | - | `'S'` |
| `alterar_qtde_conf` | `char` | `char(1)` | NO | - | `'S'` |
| `associar_pedido_ent` | `char` | `char(1)` | NO | - | `'N'` |
| `farmaceutico_id` | `int` | `int(11)` | NO | - | `0` |
| `solic_qtde_venda` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `cod_inc_trib` | `int` | `int(11)` | NO | - | `1` |
| `ind_apro_cred` | `int` | `int(11)` | NO | - | `1` |
| `ind_reg_cum` | `int` | `int(11)` | NO | - | `1` |
| `conta_analitica_inv` | `varchar` | `varchar(25)` | NO | - | `''` |
| `md5sign_out2` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_out3` | `varchar` | `varchar(32)` | NO | - | `''` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_cont_id` | `int` | `int(11)` | YES | - | `NULL` |
| `layout_sngpc` | `varchar` | `varchar(10)` | YES | - | `'1.0'` |
| `data_ult_exe_integracoes` | `datetime` | `datetime` | YES | - | `NULL` |
| `permite_excluir_cliente` | `char` | `char(1)` | NO | - | `'N'` |
| `notificar_tot_fiscal` | `char` | `char(1)` | YES | - | `'N'` |
| `preco_perda` | `char` | `char(1)` | NO | - | `'C'` |
| `tipo_crypt_email_nfe` | `char` | `char(1)` | NO | - | `'A'` |
| `logo_filial` | `longblob` | `longblob` | NO | - | `''` |
| `sup_atualizar_rota` | `char` | `char(1)` | NO | - | `'N'` |
| `dev_forn_cta_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontas_id_taxa_boleto` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_demais_desc` | `int` | `int(11)` | YES | - | `NULL` |
| `faturar_entrega` | `char` | `char(1)` | YES | - | `'N'` |

---

## filial_cert

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `cert_base64` | `mediumtext` | `mediumtext` | NO | - | `''` |
| `cert_pw` | `varchar` | `varchar(255)` | NO | - | `''` |
| `cert_validade` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |
| `cert_nome_arquivo` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cert_cadastro` | `date` | `date` | YES | - | `'0000-00-00'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## filial_config_qrlinx

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `imprimir_comprovante` | `char` | `char(1)` | NO | - | `'S'` |
| `validar_caixa` | `char` | `char(1)` | NO | - | `'S'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `exibir_qrcode_pinpad` | `char` | `char(1)` | NO | - | `'N'` |

---

## filial_financeiro_ofx

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `considerar_registros_ofx` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `considerar_registros_periodo` | `char` | `char(1)` | YES | - | `'N'` |

---

## filtrosugcompra

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filtrosugcompra_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nome` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `tipofiltro` | `int` | `int(11)` | YES | - | `NULL` |
| `condicaominimo` | `char` | `char(2)` | YES | - | `NULL` |
| `min_ou_max` | `char` | `char(3)` | YES | - | `NULL` |
| `diasperiodo` | `int` | `int(11)` | YES | - | `0` |
| `diasatras` | `int` | `int(11)` | YES | - | `0` |
| `horainicial` | `varchar` | `varchar(8)` | YES | - | `NULL` |
| `horafinal` | `varchar` | `varchar(8)` | YES | - | `NULL` |
| `pedirsempre1` | `char` | `char(1)` | YES | - | `'N'` |
| `est_maior_qtde` | `char` | `char(1)` | YES | - | `'N'` |
| `incluir_transf` | `char` | `char(1)` | YES | - | `'N'` |
| `grupos` | `text` | `text` | YES | - | `NULL` |
| `espec` | `text` | `text` | YES | - | `NULL` |
| `fabric` | `text` | `text` | YES | - | `NULL` |
| `cadoferta` | `text` | `text` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `estoq_zero` | `char` | `char(1)` | YES | - | `'N'` |
| `marcapendente` | `char` | `char(1)` | YES | - | `'N'` |
| `diasa` | `int` | `int(11)` | YES | - | `0` |
| `diasb` | `int` | `int(11)` | YES | - | `0` |
| `diasc` | `int` | `int(11)` | YES | - | `0` |
| `diasd` | `int` | `int(11)` | YES | - | `0` |
| `condicaominimo2` | `char` | `char(2)` | YES | - | `NULL` |
| `pbm` | `char` | `char(1)` | YES | - | `'N'` |
| `filialis` | `text` | `text` | YES | - | `NULL` |
| `representante_id` | `int` | `int(11)` | YES | - | `NULL` |
| `usa_representante` | `char` | `char(1)` | NO | - | `'N'` |
| `incluir_transferencia` | `char` | `char(1)` | NO | - | `'N'` |
| `utilizar_demanda_filial` | `char` | `char(1)` | NO | - | `'N'` |
| `utilizar_demanda_filial_id` | `int` | `int(11)` | NO | - | `0` |
| `meses_analise` | `int` | `int(11)` | NO | - | `4` |
| `dthr_criacao` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |
| `ordem` | `int` | `int(11)` | YES | - | `0` |
| `apresentacao` | `text` | `text` | YES | - | `NULL` |
| `tabloide` | `text` | `text` | YES | - | `NULL` |
| `consultar_melhor_forn_compra` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_filtro_prod_parado` | `int` | `int(11)` | NO | - | `0` |
| `qtde_dias_prod_parado` | `int` | `int(11)` | NO | - | `0` |
| `filtrar_ult_entr` | `char` | `char(1)` | NO | - | `'N'` |
| `qtde_dias_ult_entr` | `int` | `int(11)` | NO | - | `0` |
| `pbm_venda` | `char` | `char(1)` | YES | - | `'N'` |

---

## finadm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `finadm_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `tipo` | `char` | `char(1)` | NO | - | `'C'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |

---

## finadm_det

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `finadm_det_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `finadm_id` | `int` | `int(11)` | NO | - | `0` |
| `data` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `valor` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `planocontas_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `numlanc` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `num_caixa` | `int` | `int(11)` | NO | - | `0` |
| `finadm_det_grp_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `descricao` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `quanti_uni` | `int` | `int(11)` | NO | - | `0` |
| `preco_unit` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `fil_finadm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `fornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | MUL | `'N'` |
| `subtipo` | `int` | `int(11)` | NO | - | `0` |

---

## fornece

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `fornece_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nome` | `varchar` | `varchar(100)` | YES | MUL | `NULL` |
| `fantasia` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cgc` | `varchar` | `varchar(20)` | YES | MUL | `NULL` |
| `ie` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `endereco` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `estado` | `char` | `char(2)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `telefone` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `fax` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `contato` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `codinterf` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `codinterf_inter` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `senha` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `obs` | `varchar` | `varchar(54)` | YES | - | `NULL` |
| `email` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `converte_caixa` | `char` | `char(1)` | YES | - | `'S'` |
| `obs2` | `text` | `text` | YES | - | `NULL` |
| `status` | `char` | `char(1)` | YES | - | `'S'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `NULL` |
| `numero` | `int` | `int(11)` | YES | - | `NULL` |
| `codbanco` | `char` | `char(3)` | YES | - | `NULL` |
| `agencia` | `varchar` | `varchar(6)` | YES | - | `NULL` |
| `contacorrente` | `varchar` | `varchar(13)` | YES | - | `NULL` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `fis_jur` | `char` | `char(1)` | YES | - | `'J'` |
| `cpf` | `varchar` | `varchar(15)` | YES | MUL | `NULL` |
| `rg` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `industria` | `char` | `char(1)` | YES | - | `NULL` |
| `cod_regime_tribut` | `char` | `char(2)` | YES | - | `NULL` |
| `email_nfe` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `tipo_fornece` | `char` | `char(1)` | YES | - | `'D'` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `complemento` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `fornece_id_prever` | `varchar` | `varchar(15)` | NO | - | `''` |
| `ddd` | `char` | `char(3)` | NO | - | `''` |
| `tipo_contribuinte` | `int` | `int(1)` | NO | - | `1` |
| `fornece_participa_sncm` | `char` | `char(1)` | NO | - | `'N'` |
| `nao_validar_icms_proprio` | `char` | `char(1)` | NO | - | `'N'` |
| `taxa_boleto` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cpf_cnpj_cedente` | `varchar` | `varchar(14)` | NO | MUL | `''` |
| `nome_razao_cedente` | `varchar` | `varchar(40)` | NO | - | `''` |
| `cpf_cnpj_sacador` | `varchar` | `varchar(14)` | NO | MUL | `''` |
| `nome_razao_sacador` | `varchar` | `varchar(50)` | NO | - | `''` |
| `tributacao_regular` | `char` | `char(1)` | YES | - | `'N'` |
| `perc_red_tributacao_regular` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cst_tributacao_regular` | `char` | `char(3)` | YES | - | `'N'` |
| `classif_tributacao_regular` | `varchar` | `varchar(6)` | YES | - | `'N'` |
| `perfil_credito_presumido` | `char` | `char(1)` | YES | - | `'N'` |
| `ente_governamental` | `char` | `char(1)` | YES | - | `'N'` |

---

## grupo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `MostraDesc` | `char` | `char(1)` | YES | - | `'S'` |
| `Controlado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `margem_automatica` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `bloquearvenda` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `pontos_fidelidade` | `char` | `char(1)` | YES | - | `'S'` |
| `codepharma` | `int` | `int(11)` | YES | - | `NULL` |
| `codigo` | `varchar` | `varchar(150)` | YES | MUL | `NULL` |
| `desc_arvore` | `varchar` | `varchar(150)` | YES | - | `NULL` |
| `minA` | `int` | `int(11)` | YES | - | `0` |
| `maxA` | `int` | `int(11)` | YES | - | `0` |
| `minB` | `int` | `int(11)` | YES | - | `0` |
| `maxB` | `int` | `int(11)` | YES | - | `0` |
| `minC` | `int` | `int(11)` | YES | - | `0` |
| `maxC` | `int` | `int(11)` | YES | - | `0` |
| `minD` | `int` | `int(11)` | YES | - | `0` |
| `maxD` | `int` | `int(11)` | YES | - | `0` |
| `codgrupoadm` | `int` | `int(11)` | YES | - | `0` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `qtde_sug_contagem` | `int` | `int(11)` | YES | - | `0` |
| `rep_subst` | `char` | `char(1)` | YES | - | `'N'` |
| `desc_ordem` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `desvio_padrao` | `char` | `char(1)` | YES | - | `'S'` |
| `reshop_limite_desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |

---

## grupo_preco

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_preco_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `perc_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_icms_generico` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `habilitar_livre_comercio` | `char` | `char(1)` | YES | - | `'N'` |

---

## grupo_preco_filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_preco_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## grupo_preco_produto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_preco_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `alt_m_pc` | `char` | `char(1)` | YES | - | `'M'` |
| `preco_cmp` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `qt_fr` | `int` | `int(11)` | YES | - | `0` |
| `preco_cmp_un` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco_vnd` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem2` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem3` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco3` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `desc_promo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem_preco_pro` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco_pro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dtiniciopromocao` | `date` | `date` | YES | - | `'2004-01-01'` |
| `valid_pro` | `date` | `date` | YES | - | `NULL` |
| `desconto` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `descmax` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_fp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `datapre` | `datetime` | `datetime` | YES | - | `NULL` |
| `md5sign_preco_vnd` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco2` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco3` | `varchar` | `varchar(32)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `id_alt` | `int` | `int(11)` | YES | - | `0` |
| `preco_fp_bolsa_familia` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## grupo_preco_produto_logs

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_preco_produto_logs_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `grupo_preco_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `campo` | `varchar` | `varchar(100)` | NO | - | `''` |
| `valor_ant` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `valor_pos` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_logica_id` | `int` | `int(11)` | NO | - | `0` |

---

## grupo_usuario

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_usuario_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `permit_baixareceb` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_fechacx` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_altcadapro` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_altcadcli` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_inclctapagar` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_inclcadcli` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_altprecoentr` | `char` | `char(1)` | YES | - | `'S'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `permit_altcomissao` | `char` | `char(1)` | YES | - | `'S'` |
| `modulos` | `text` | `text` | YES | - | `NULL` |
| `permit_altreceb` | `char` | `char(1)` | YES | - | `'N'` |
| `pesqprodnome` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_abrircaixa` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_apagareceber` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `permit_apagarorc` | `char` | `char(1)` | YES | - | `'N'` |
| `permi_estminimo` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_validade` | `char` | `char(1)` | YES | - | `'N'` |
| `permit_atcurva` | `char` | `char(1)` | YES | - | `'N'` |
| `hab_novidades_sist` | `char` | `char(1)` | YES | - | `'S'` |
| `msg_big` | `char` | `char(1)` | YES | - | `'S'` |
| `motivo_canc` | `char` | `char(1)` | YES | - | `'N'` |
| `inifin_entrega` | `char` | `char(1)` | YES | - | `'S'` |
| `inclui_pontos` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_altabsoluto` | `char` | `char(1)` | YES | - | `'N'` |
| `permit_sangria` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_perdas` | `char` | `char(1)` | YES | - | `'S'` |
| `pedir_mot_alt_est` | `char` | `char(1)` | YES | - | `'N'` |
| `visualizar_estoque` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_imp` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_email` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_exp` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_altrota` | `char` | `char(1)` | YES | - | `'S'` |
| `permit_cadsemcep` | `char` | `char(1)` | YES | - | `'S'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `permit_substpagto` | `char` | `char(1)` | YES | - | `'N'` |
| `permit_qtde_conf` | `char` | `char(1)` | YES | - | `'N'` |
| `visualizar_comissao_prod` | `char` | `char(1)` | NO | - | `'S'` |
| `permit_acomp` | `char` | `char(1)` | YES | - | `'N'` |
| `permite_cancelamento` | `char` | `char(1)` | YES | - | `'S'` |
| `permite_reducao_z` | `char` | `char(1)` | YES | - | `'S'` |
| `permitir_alterar_estoque_lote` | `char` | `char(1)` | NO | - | `'N'` |
| `permitir_controle_validade` | `char` | `char(1)` | NO | - | `'N'` |
| `controla_perm_financ` | `char` | `char(1)` | NO | - | `'N'` |
| `alterar_estoque_lote` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_atualizador` | `char` | `char(1)` | YES | - | `'S'` |
| `permitir_manter_enderecos` | `char` | `char(1)` | NO | - | `'N'` |
| `permitir_alterar_telefones` | `char` | `char(1)` | NO | - | `'N'` |
| `permitir_efetuar_prebaixa` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_cancelar_entrega` | `char` | `char(1)` | YES | - | `'S'` |
| `permite_alt_preco_filiais` | `char` | `char(1)` | YES | - | `'S'` |
| `permite_rel_vendaspdv` | `varchar` | `varchar(20)` | NO | - | `'N'` |
| `permite_repositorio_relatorios` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_excluir_cliente` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_visualizar_licenca` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_licenca_extra_boleto` | `char` | `char(1)` | NO | - | `'N'` |
| `permit_agenda_pgto` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_visualizar_dashboard` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_visualizar_raiox` | `char` | `char(1)` | NO | - | `'N'` |
| `raiox_credenciamento` | `char` | `char(1)` | NO | - | `'N'` |
| `raiox_dashboard` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_cancelamento_cupom` | `char` | `char(1)` | YES | - | `'S'` |
| `consulta_cancelamento` | `text` | `text` | YES | - | `NULL` |
| `permite_suspensao_compra` | `char` | `char(1)` | YES | - | `'N'` |
| `perm_alt_val_itens_prox_venc` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_pinmaster_crmbonus` | `char` | `char(1)` | NO | - | `'N'` |
| `background` | `char` | `char(1)` | NO | - | `'N'` |
| `permite_visualizar_linxbi` | `char` | `char(1)` | NO | - | `'N'` |

---

## gwcel_operadora

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `operadora_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## gwcel_recarga

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `operadora_id` | `int` | `int(11)` | NO | - | `0` |
| `autorizacao` | `varchar` | `varchar(20)` | NO | - | `''` |
| `valor` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_hora` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cupom_fiscal` | `int` | `int(11)` | NO | - | `0` |
| `numero_telefone` | `varchar` | `varchar(11)` | NO | - | `''` |
| `mensagem` | `text` | `text` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `origem` | `tinyint` | `tinyint(4)` | NO | - | `0` |

---

## impressoras

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `impressoras_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numserie` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `mf_adicional` | `char` | `char(1)` | YES | - | `NULL` |
| `tipo_ecf` | `varchar` | `varchar(7)` | YES | - | `NULL` |
| `marca_ecf` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `modelo` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `versao_sb` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `data_inst_sb` | `date` | `date` | YES | - | `NULL` |
| `hora_inst_sb` | `varchar` | `varchar(8)` | YES | - | `NULL` |
| `num_seq_ecf` | `int` | `int(11)` | YES | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `num_ord_usu_ecf` | `int` | `int(11)` | NO | - | `0` |
| `gt` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cod_ident_ecf` | `varchar` | `varchar(6)` | NO | - | `''` |
| `num_fab_ecf` | `varchar` | `varchar(20)` | NO | - | `''` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `totalizadores_adicionais` | `char` | `char(1)` | YES | - | `NULL` |
| `indtotreceb` | `int` | `int(11)` | NO | - | `0` |
| `md5sign_out` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_out2` | `varchar` | `varchar(32)` | NO | - | `''` |

---

## impressora_totalizador

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `impressoras_id` | `int` | `int(11)` | NO | PRI | `0` |
| `totalizador` | `char` | `char(2)` | NO | PRI | `''` |
| `indice_impressora` | `char` | `char(2)` | YES | - | `NULL` |
| `codigo_impressora` | `varchar` | `varchar(5)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## inventario

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `inventario_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | MUL | `0` |
| `estoque` | `int` | `int(11)` | YES | - | `NULL` |
| `contado` | `int` | `int(11)` | YES | - | `NULL` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |

---

## inventario_historico

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `fillogica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `inventario_historico_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `dtinicio` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `dtfim` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `inventario_novo_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `contado_inicial` | `int` | `int(11)` | NO | - | `0` |
| `contado_final` | `int` | `int(11)` | NO | - | `0` |

---

## inventario_novo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `inventario_novo_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `quantiuni` | `int` | `int(11)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dt_cadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `valor_uni` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `movment_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `estoque_ant` | `int` | `int(11)` | NO | - | `0` |
| `obs` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `acerto_manual` | `char` | `char(1)` | NO | - | `'N'` |

---

## justificativa_susp_compra

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `justificativa_susp_compra_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(50)` | NO | - | `''` |
| `ativa` | `char` | `char(1)` | NO | - | `'S'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `NULL (sem default)` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## kit_promo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `kit_promo_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `barras` | `varchar` | `varchar(13)` | YES | MUL | `NULL` |
| `vigencia_de` | `datetime` | `datetime` | YES | - | `NULL` |
| `vigencia_ate` | `datetime` | `datetime` | YES | - | `NULL` |
| `dia_segunda` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_terca` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_quarta` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_quinta` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_sexta` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_sabado` | `char` | `char(1)` | YES | - | `NULL` |
| `dia_domingo` | `char` | `char(1)` | YES | - | `NULL` |
| `ativo` | `char` | `char(1)` | YES | MUL | `'N'` |
| `alter_desc_na_venda` | `char` | `char(1)` | YES | - | `'N'` |
| `senha_alter_desc_na_venda` | `char` | `char(1)` | YES | - | `'N'` |
| `venda_apenas_cod_kitpromo` | `char` | `char(1)` | YES | - | `'N'` |
| `venda_itens_separados` | `char` | `char(1)` | YES | - | `'N'` |
| `cancelar_item_separado` | `char` | `char(1)` | YES | - | `'N'` |
| `qtd_maxima_uso_clie` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |

---

## logs

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `logs_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `tabela` | `varchar` | `varchar(40)` | NO | - | `''` |
| `campo` | `varchar` | `varchar(100)` | NO | - | `''` |
| `valor_ant` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `valor_pos` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `filial_id` | `int` | `int(11)` | YES | - | `NULL` |
| `chavepri` | `int` | `int(11)` | YES | MUL | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |

---

## lote_logs

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `fillogica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lote_logs_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `lote_novo_id` | `int` | `int(11)` | YES | - | `NULL` |
| `campo` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `valor_ant` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `valor_atu` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `motivo` | `varchar` | `varchar(100)` | NO | - | `''` |

---

## lote_saida

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `lote_saida_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `produto_id` | `int` | `int(11)` | NO | - | `0` |
| `qtde` | `int` | `int(11)` | NO | - | `0` |
| `lote` | `varchar` | `varchar(50)` | NO | - | `''` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `motivo_perda` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `transferencia_id` | `int` | `int(11)` | NO | - | `0` |
| `movment_id` | `bigint` | `bigint(20)` | NO | - | `0` |

---

## lote_venda

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `movment_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `lote_novo_id` | `int` | `int(11)` | NO | PRI | `0` |
| `qtdelote` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `fillogica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |

---

## medico

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `MEDICO_ID` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `NOME` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `ENDERECO` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `BAIRRO` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `CIDADE` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `UF` | `char` | `char(2)` | YES | - | `NULL` |
| `CEP` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `TELEFONE` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `LOJAS_LERAM` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `LOJAS_LERAM2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `DTCADASTRO` | `datetime` | `datetime` | YES | - | `NULL` |
| `DTALTERACAO` | `datetime` | `datetime` | YES | - | `NULL` |
| `ALT_USUARIO_ID` | `int` | `int(11)` | YES | - | `NULL` |
| `CPF` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `CRM` | `int` | `int(11)` | YES | MUL | `NULL` |
| `RG` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `DTNASCIMENTO` | `date` | `date` | YES | - | `NULL` |
| `APAGADO` | `char` | `char(1)` | YES | - | `'N'` |
| `OBS` | `text` | `text` | YES | - | `NULL` |
| `tipo` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `uf_conselho` | `char` | `char(2)` | YES | - | `NULL` |
| `numero` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `email` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `medico_especialidade_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `representante` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `representante_id` | `int` | `int(11)` | NO | - | `0` |

---

## medico_enderecos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `medico_id` | `int` | `int(11)` | NO | - | `0` |
| `enderecos_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `endereco` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `referencia` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `rota_id` | `int` | `int(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `numero` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `complemento` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## medico_especialidade

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `medico_especialidade_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## movment

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `movment_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `data_hora` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `produto_id` | `int` | `int(11)` | NO | MUL | `0` |
| `E_S` | `char` | `char(1)` | NO | - | `''` |
| `quanti_uni` | `int` | `int(11)` | NO | - | `0` |
| `estoque` | `int` | `int(11)` | NO | - | `0` |
| `fornece_id` | `int` | `int(11)` | NO | MUL | `0` |
| `usuario_id` | `int` | `int(11)` | NO | MUL | `0` |
| `preco_unit` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_tot` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `numlanc` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `oper` | `tinyint` | `tinyint(4)` | NO | MUL | `0` |
| `preco_cad` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `tipo_pgto` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `num_caixa` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `clientes_id` | `int` | `int(11)` | YES | MUL | `0` |
| `numnota` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `docto_rg` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `nome_cliente_receita` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `crm` | `int` | `int(11)` | YES | - | `0` |
| `nome_medico` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `num_receita` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `entradas_id` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `cancelado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `precofis` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `usuario_id_canc` | `int` | `int(11)` | YES | - | `0` |
| `apagado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `grupodespesas_id` | `int` | `int(11)` | YES | - | `0` |
| `parafilial_id` | `int` | `int(11)` | YES | - | `0` |
| `lib_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `descr` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `fidelidade` | `char` | `char(1)` | YES | - | `'N'` |
| `dependentes_id` | `int` | `int(11)` | YES | - | `NULL` |
| `datanota` | `date` | `date` | YES | - | `NULL` |
| `entrega` | `char` | `char(1)` | YES | MUL | `'N'` |
| `dtsaida_entrega` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `dtchegada_entrega` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `entregador_id` | `int` | `int(11)` | YES | - | `NULL` |
| `valor_vista` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_prazo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `numadmin` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `numcontrole` | `varchar` | `varchar(6)` | YES | - | `NULL` |
| `operadora` | `varchar` | `varchar(20)` | YES | MUL | `NULL` |
| `obs` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `natureza` | `char` | `char(1)` | YES | - | `'E'` |
| `programa` | `int` | `int(11)` | YES | - | `0` |
| `dafilial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `series_id` | `int` | `int(11)` | YES | - | `0` |
| `num_ecf` | `int` | `int(11)` | YES | MUL | `0` |
| `imp` | `int` | `int(11)` | YES | - | `NULL` |
| `turnos_id` | `int` | `int(11)` | YES | - | `0` |
| `gerente_id` | `int` | `int(11)` | YES | - | `0` |
| `tipo_desc` | `char` | `char(1)` | YES | - | `'M'` |
| `planocontas_id` | `int` | `int(11)` | NO | - | `0` |
| `pmc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `uf_med` | `char` | `char(2)` | YES | - | `NULL` |
| `enderecos_id` | `int` | `int(11)` | YES | - | `0` |
| `medico_id` | `int` | `int(11)` | YES | - | `0` |
| `km_inicial` | `int` | `int(11)` | YES | - | `0` |
| `km_final` | `int` | `int(11)` | YES | - | `0` |
| `romaneio` | `int` | `int(11)` | YES | - | `0` |
| `dtreceita` | `date` | `date` | YES | - | `NULL` |
| `caixa_dia` | `int` | `int(11)` | YES | - | `0` |
| `vencimento` | `date` | `date` | YES | - | `NULL` |
| `receber_id` | `int` | `int(11)` | YES | MUL | `0` |
| `tel_paciente` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `tiporeceita` | `int` | `int(11)` | YES | - | `0` |
| `tipouso` | `int` | `int(11)` | YES | - | `0` |
| `orgao_rg_cliente` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `uf_rg_cliente` | `char` | `char(2)` | YES | - | `NULL` |
| `formapgto_tipospgto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `comreceita` | `char` | `char(1)` | YES | - | `'N'` |
| `numlancconfent` | `bigint` | `bigint(20)` | YES | - | `0` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `Enviado_Con_Rede` | `char` | `char(1)` | YES | - | `'N'` |
| `qtd_prod_receita` | `int` | `int(11)` | YES | - | `NULL` |
| `impressoras_id` | `int` | `int(11)` | YES | - | `0` |
| `cancel_acerto_ent` | `char` | `char(1)` | NO | - | `'N'` |

---

## nfe_cab_dados_adic

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nfe_cab_id` | `int` | `int(11)` | NO | PRI | `0` |
| `conferida` | `char` | `char(1)` | NO | - | `'N'` |
| `conf_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtconferida` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `NULL (sem default)` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## nfe_cab_xml

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nfe_cab_id` | `int` | `int(11)` | NO | PRI | `0` |
| `imagem_nfe` | `longtext` | `longtext` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `dtalteracao` | `date` | `date` | NO | - | `'0000-00-00'` |

---

## nota_fiscal

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `data_emissao` | `date` | `date` | NO | MUL | `'0000-00-00'` |
| `data_saida_entrada` | `date` | `date` | NO | - | `'0000-00-00'` |
| `hora_saida` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `entrada_saida` | `char` | `char(1)` | NO | - | `''` |
| `cfop` | `varchar` | `varchar(5)` | NO | - | `''` |
| `serie` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `num_nota` | `int` | `int(11)` | NO | MUL | `0` |
| `modelo` | `char` | `char(3)` | YES | - | `NULL` |
| `cnpj_emit` | `varchar` | `varchar(20)` | NO | - | `''` |
| `inscr_emit` | `varchar` | `varchar(20)` | NO | - | `''` |
| `inscr_est_subst_tribut` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `razao_emit` | `varchar` | `varchar(100)` | NO | - | `''` |
| `cnpj_dest` | `varchar` | `varchar(20)` | NO | - | `''` |
| `inscr_dest` | `varchar` | `varchar(20)` | NO | - | `''` |
| `razao_dest` | `varchar` | `varchar(100)` | NO | - | `''` |
| `base_calc_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms_subst` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_subst` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_produtos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_frete` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_seguro` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `outras_depesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_ipi` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_nota` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_desconto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `razao_transp` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `frete_conta` | `char` | `char(1)` | YES | - | `NULL` |
| `placa_veiculo` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `uf_transp` | `char` | `char(2)` | YES | - | `NULL` |
| `cnpj_transp` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `ender_transp` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `cidade_transp` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `uf_veiculo` | `char` | `char(2)` | YES | - | `NULL` |
| `inscr_trans` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `quant` | `int` | `int(11)` | YES | - | `NULL` |
| `especie` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `marca` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `numero` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `peso_bruto` | `decimal` | `decimal(18,3)` | YES | - | `0.000` |
| `peso_liqui` | `decimal` | `decimal(18,3)` | YES | - | `0.000` |
| `dados_adicionais` | `text` | `text` | YES | - | `NULL` |
| `fornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `clientes_id` | `int` | `int(11)` | YES | - | `NULL` |
| `empresa_id` | `int` | `int(11)` | YES | - | `NULL` |
| `conferida` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `filial_id_trans` | `int` | `int(11)` | YES | - | `0` |
| `uf_cidade_transp` | `char` | `char(2)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `chave` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `num_recibonfe` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `proto_nfe` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `proto_canc_nfe` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `tipo_nota` | `char` | `char(1)` | YES | - | `NULL` |
| `subserie` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `qualidade` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `cadastrada_manualmente` | `char` | `char(1)` | YES | - | `'N'` |
| `mod_frete` | `char` | `char(2)` | YES | - | `NULL` |
| `exportada_contabil` | `char` | `char(1)` | YES | - | `'N'` |
| `cancelada` | `char` | `char(1)` | NO | MUL | `'N'` |
| `data_cancelamento` | `date` | `date` | YES | - | `'0000-00-00'` |
| `total_produtos_bruto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cance_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `somar_frete` | `char` | `char(1)` | NO | - | `'S'` |
| `status_nfe` | `char` | `char(1)` | NO | MUL | `'F'` |
| `danfe_emitido` | `char` | `char(1)` | NO | - | `'N'` |
| `tipo_danfe` | `int` | `int(11)` | YES | - | `1` |
| `total_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `calc_icms_frete` | `char` | `char(1)` | YES | - | `'N'` |
| `calc_icms_seguro` | `char` | `char(1)` | YES | - | `'N'` |
| `calc_icms_outras` | `char` | `char(1)` | YES | - | `'N'` |
| `perc_icms_frete` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_icms_seguro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_icms_outras` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `tipo_pagto` | `char` | `char(1)` | NO | - | `''` |
| `valor_forn_serv` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_nt` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_terc` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `imp_princ_ativo` | `char` | `char(1)` | YES | - | `'N'` |
| `icms_ret_somado_produto` | `char` | `char(1)` | YES | - | `'N'` |
| `ambiente_nfe` | `int` | `int(11)` | NO | - | `0` |
| `tipo_dacte` | `int` | `int(11)` | YES | - | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `tot_trib` | `decimal` | `decimal(10,2)` | NO | - | `0.00` |
| `valor_ipi_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_st_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `ind_presenca` | `int` | `int(11)` | NO | - | `999` |
| `data_hora_contingencia` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `motivo_contingencia` | `varchar` | `varchar(255)` | NO | - | `''` |
| `base_calc_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_protocolo` | `datetime` | `datetime` | YES | - | `NULL` |
| `tipo_emissao` | `int` | `int(11)` | NO | - | `0` |
| `tempo_envio` | `bigint` | `bigint(18)` | YES | - | `NULL` |
| `digest_value` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `motivo_rejeicao` | `varchar` | `varchar(200)` | NO | - | `''` |
| `total_taxa_entrega` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `deducao_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `emit_crt` | `int` | `int(11)` | YES | - | `NULL` |
| `natureza_operacao` | `varchar` | `varchar(60)` | NO | - | `''` |
| `difal` | `char` | `char(1)` | NO | - | `'N'` |
| `uf_dest` | `char` | `char(2)` | YES | - | `NULL` |
| `valor_fcp_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_uf_remet` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `nota_fiscal_id_estorno` | `int` | `int(11)` | YES | - | `NULL` |
| `data_hora_estorno` | `datetime` | `datetime` | YES | - | `NULL` |
| `inf_adicional_fisco` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `total_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_fcp_st` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_fcp_st_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_ipi_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `modalidade_frete` | `char` | `char(2)` | NO | - | `''` |
| `leilao_licitacao` | `char` | `char(1)` | NO | - | `'N'` |
| `data_recolhimento_fcp` | `date` | `date` | YES | - | `NULL` |
| `cidade_id_emit` | `int` | `int(11)` | NO | - | `0` |
| `cidade_id_dest` | `int` | `int(11)` | NO | - | `0` |
| `versao_xml` | `decimal` | `decimal(8,3)` | NO | - | `0.000` |
| `total_icms_deson` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `descontar_desonerado` | `char` | `char(1)` | NO | - | `'N'` |
| `total_base_calc_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `total_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `total_icms_diferido` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `serie_contingencia` | `char` | `char(1)` | NO | - | `'N'` |
| `total_icms_st_deson` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `operacao_ciap` | `char` | `char(1)` | NO | - | `'N'` |

---

## nota_fiscal_item

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `nota_fiscal_item_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | MUL | `0` |
| `cod_produto` | `varchar` | `varchar(20)` | NO | - | `''` |
| `descricao` | `varchar` | `varchar(100)` | NO | - | `''` |
| `st` | `char` | `char(3)` | YES | - | `NULL` |
| `unid` | `varchar` | `varchar(4)` | YES | - | `NULL` |
| `quant` | `int` | `int(11)` | NO | - | `1` |
| `valor_unit` | `decimal` | `decimal(11,4)` | NO | - | `0.0000` |
| `valor_total` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `desc_val` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `desc_per1` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `desc_per2` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `alt_usuario_id` | `int` | `int(4)` | NO | - | `0` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `repasse` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `substituicao_tributaria` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lista` | `char` | `char(1)` | NO | - | `'U'` |
| `iva` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cfop` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `aliq_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_ipi` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_reducao_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_desc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `aliq_ipi` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_reducao_icms_st` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cstcofins` | `char` | `char(2)` | NO | - | `''` |
| `cstpis` | `char` | `char(2)` | NO | - | `''` |
| `ncm` | `int` | `int(11)` | NO | - | `0` |
| `base_calc_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_icms_sub_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_icms_sub_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `csosn` | `char` | `char(3)` | YES | - | `NULL` |
| `origem` | `char` | `char(1)` | YES | - | `NULL` |
| `gtin14` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `valor_frete` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_seguro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_outras` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `item_operacao_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `num_item` | `int` | `int(11)` | NO | - | `0` |
| `fat_conv` | `int` | `int(11)` | NO | - | `0` |
| `tot_trib` | `decimal` | `decimal(10,2)` | NO | - | `0.00` |
| `valor_ipi_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_st_devol` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `perc_aplic_calc_credito` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_cred_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_devolucao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cest` | `varchar` | `varchar(9)` | NO | - | `''` |
| `cod_lista_servicos_issqn` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cod_trib_municipio_issqn` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `ind_exigibilidade_issqn` | `smallint` | `smallint(6)` | YES | - | `NULL` |
| `ind_inc_fiscal_issqn` | `char` | `char(1)` | YES | - | `'N'` |
| `deducao_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `servico` | `char` | `char(1)` | NO | - | `'N'` |
| `ajuste_debito_substituicao` | `char` | `char(1)` | NO | - | `'N'` |
| `base_calc_fcp_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_inter` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_fcp_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_icms_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_icms_inter` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_icms_inter_part` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_uf_dest` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_uf_remet` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `destacar_difal` | `char` | `char(1)` | NO | - | `'N'` |
| `dados_adicionais` | `text` | `text` | YES | - | `NULL` |
| `base_calc_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp_sub` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calc_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms_sub_ret` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_deson` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `motivo_desoneracao` | `int` | `int(11)` | NO | - | `0` |
| `perc_red_bc_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `base_calc_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `aliq_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `valor_icms_efetivo` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `valor_icms_operacao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `perc_diferido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms_diferido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `utilizado_saldo_transferencia` | `char` | `char(1)` | NO | - | `'N'` |
| `vl_icms_substituto` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `vl_icms_st_restituicao` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `aliq_icms_deson` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `codigo_beneficio` | `varchar` | `varchar(20)` | NO | - | `''` |
| `valor_icms_st_deson` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms_st_deson` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |

---

## nota_fiscal_nfref

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_ref_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nota_fiscal_ref_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |

---

## nota_fiscal_pgtos_cartao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nota_fiscal_pgtos_id` | `smallint` | `smallint(6)` | NO | PRI | `0` |
| `tipospgto_nfe_id` | `int` | `int(11)` | NO | - | `0` |
| `tipo_integracao` | `tinyint` | `tinyint(4)` | NO | - | `2` |
| `nsu` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `cnpj_credenciadora` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `bandeira` | `int` | `int(2)` | NO | - | `99` |
| `solucao_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `status_credenc_tef` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `numero_autorizacao` | `varchar` | `varchar(20)` | NO | - | `''` |
| `cnpj_receb` | `varchar` | `varchar(14)` | NO | - | `''` |
| `id_term_pag` | `varchar` | `varchar(40)` | NO | - | `''` |

---

## operacao_config

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `operacao_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `natureza_operacao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `operacao_tipo_nota` | `char` | `char(1)` | YES | - | `NULL` |
| `tipo_preco` | `char` | `char(1)` | YES | - | `'1'` |
| `tipo_operacao` | `char` | `char(1)` | YES | - | `NULL` |
| `tipo_destinatario` | `char` | `char(1)` | YES | - | `NULL` |
| `emissao_propria` | `char` | `char(1)` | YES | - | `'N'` |
| `realiza_operacao_fora_estado` | `char` | `char(1)` | NO | - | `'S'` |
| `cst_icms` | `char` | `char(2)` | YES | - | `NULL` |
| `csosn` | `char` | `char(3)` | YES | - | `NULL` |
| `cst_pis` | `char` | `char(2)` | YES | - | `NULL` |
| `cst_cofins` | `char` | `char(2)` | YES | - | `NULL` |
| `cfop_id_dentro` | `int` | `int(11)` | YES | - | `NULL` |
| `cfop_id_fora` | `int` | `int(11)` | YES | - | `NULL` |
| `informacao_complementar` | `text` | `text` | YES | - | `NULL` |
| `desfazer_cfe_duplicado` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `operacao_ciap` | `char` | `char(1)` | NO | - | `'N'` |
| `cst_ibs_cbs` | `char` | `char(3)` | NO | MUL | `''` |
| `class_trib_ibs_cbs` | `varchar` | `varchar(6)` | NO | - | `''` |
| `perc_ibs_mun` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_ibs_uf` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_ibs_dif` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_ibs_red` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_cbs` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_cbs_dif` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_cbs_red` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cst_is` | `char` | `char(3)` | NO | MUL | `''` |
| `class_trib_is` | `varchar` | `varchar(6)` | YES | - | `NULL` |
| `perc_is` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `obs_fiscal_sped` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `finalidade_nota` | `char` | `char(1)` | YES | - | `'P'` |
| `tipo_nota_debito` | `int` | `int(11)` | YES | - | `0` |
| `incluir_mes_competencia` | `char` | `char(1)` | NO | - | `'N'` |
| `usar_presumido` | `char` | `char(1)` | NO | - | `'N'` |
| `cod_presumido` | `char` | `char(2)` | NO | - | `''` |
| `usar_presumido_ibs` | `char` | `char(1)` | NO | - | `'N'` |
| `perc_presumido_ibs` | `decimal` | `decimal(11,4)` | YES | - | `0.0000` |
| `usar_presumido_cbs` | `char` | `char(1)` | NO | - | `'N'` |
| `perc_presumido_cbs` | `decimal` | `decimal(11,4)` | YES | - | `0.0000` |
| `deduz_presumido` | `char` | `char(1)` | NO | - | `'N'` |

---

## operacao_config_cfop

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `operacao_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `operacao_config_cfop_id` | `int` | `int(11)` | NO | PRI | `0` |
| `cst_icms` | `char` | `char(2)` | NO | - | `''` |
| `csosn` | `char` | `char(3)` | NO | - | `''` |
| `cfop_id_dentro` | `int` | `int(11)` | NO | - | `0` |
| `cfop_id_fora` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `''''` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cod_beneficio_rbc` | `varchar` | `varchar(10)` | YES | - | `NULL` |

---

## operacao_config_filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `operacao_config_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## operadora_cartao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `operadora_cartao_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |

---

## orcament

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `orcament_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `preco` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_cad` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `qtde` | `int` | `int(11)` | YES | - | `0` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `usuario_id` | `bigint` | `bigint(11)` | YES | - | `NULL` |
| `data` | `date` | `date` | YES | MUL | `NULL` |
| `hora` | `time` | `time` | YES | - | `NULL` |
| `status` | `char` | `char(1)` | YES | MUL | `'N'` |
| `terminal` | `int` | `int(11)` | YES | - | `NULL` |
| `empresa_id` | `int` | `int(11)` | YES | - | `NULL` |
| `clientes_id` | `int` | `int(11)` | YES | - | `NULL` |
| `descontoperc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `ncartao` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `devolucao` | `char` | `char(1)` | YES | - | `'N'` |
| `promocao` | `char` | `char(1)` | YES | - | `'N'` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apagou_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `preco_sem_desc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `psi_nome` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `psi_rg` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `psi_med` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `psi_crm` | `decimal` | `decimal(20,2)` | YES | - | `0.00` |
| `psi_rec` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `aberto` | `char` | `char(1)` | YES | - | `'N'` |
| `altera_desc` | `char` | `char(1)` | YES | - | `'S'` |
| `prxfechamento` | `char` | `char(1)` | YES | - | `'N'` |
| `liberadopor` | `int` | `int(11)` | YES | - | `0` |
| `motivo_canc` | `varchar` | `varchar(150)` | YES | - | `NULL` |
| `tipo_desc` | `char` | `char(1)` | YES | - | `'M'` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `supervisor_id` | `int` | `int(11)` | YES | - | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `cartaomarka` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `vale_dinheiro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `liberacoes` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `nempresa` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `pagaravista` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `formula` | `char` | `char(1)` | YES | - | `'N'` |
| `psi_dtrec` | `date` | `date` | YES | - | `NULL` |
| `medico_id` | `int` | `int(11)` | YES | - | `0` |
| `msg_desconto` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `tel_paciente` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `orgao_rg_cliente` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `uf_rg_cliente` | `char` | `char(2)` | YES | - | `NULL` |
| `psi_tipo_uso` | `int` | `int(11)` | YES | - | `NULL` |
| `psi_tipo_receita` | `int` | `int(11)` | YES | - | `NULL` |
| `formapgto_tipospgto_id` | `int` | `int(11)` | NO | - | `0` |
| `qtde_continuo` | `int` | `int(11)` | YES | - | `0` |
| `origemcond` | `char` | `char(1)` | NO | - | `'E'` |
| `pmc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `supervisor_desc` | `int` | `int(11)` | YES | - | `0` |
| `desc_supervisordesc` | `varchar` | `varchar(65)` | YES | - | `NULL` |
| `msgcaixa` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `senha_comunix` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `tipovenda_comunix` | `char` | `char(3)` | YES | - | `NULL` |
| `parcelas_comunix` | `int` | `int(11)` | YES | - | `1` |
| `subsidio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `pbm` | `char` | `char(1)` | YES | - | `'N'` |
| `qtde_apres` | `int` | `int(11)` | YES | - | `0` |
| `dependentes_id` | `int` | `int(11)` | NO | - | `0` |
| `etiq_poso` | `text` | `text` | YES | - | `NULL` |
| `medico_endereco_id` | `int` | `int(11)` | NO | - | `0` |
| `psi_receita_qtde` | `int` | `int(11)` | NO | - | `0` |
| `psi_tipo_doc` | `int` | `int(11)` | NO | - | `0` |
| `usuario_id_desc` | `int` | `int(11)` | NO | - | `0` |
| `desc_sup` | `char` | `char(1)` | NO | - | `'N'` |
| `paciente_nome` | `varchar` | `varchar(100)` | NO | - | `''` |
| `paciente_endereco` | `varchar` | `varchar(100)` | NO | - | `''` |
| `paciente_numero` | `varchar` | `varchar(10)` | NO | - | `''` |
| `paciente_bairro` | `varchar` | `varchar(60)` | NO | - | `''` |
| `paciente_cidade_id` | `int` | `int(11)` | NO | - | `0` |
| `paciente_cep` | `varchar` | `varchar(9)` | NO | - | `''` |
| `valor_pgto_convenio` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `EmPreVenda` | `char` | `char(1)` | YES | - | `'N'` |
| `paciente_idade` | `int` | `int(11)` | NO | - | `0` |
| `paciente_sexo` | `char` | `char(1)` | NO | - | `'M'` |
| `uso_prolongado` | `char` | `char(1)` | NO | - | `''` |
| `cartao_multifidelidade` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `valor_resgate_integracao` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `comprador_endereco` | `varchar` | `varchar(50)` | NO | - | `''` |
| `comprador_numero` | `varchar` | `varchar(6)` | NO | - | `''` |
| `valor_resgate_marka` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `email_danfe` | `varchar` | `varchar(255)` | NO | - | `''` |
| `data_hora_inicio` | `datetime` | `datetime` | YES | - | `NULL` |
| `usuario_id_inicio` | `int` | `int(11)` | YES | - | `NULL` |
| `paciente_unidade_idade` | `int` | `int(11)` | NO | - | `1` |
| `transacao_id_quest` | `bigint` | `bigint(20)` | NO | - | `0` |
| `reshop` | `char` | `char(1)` | NO | - | `'N'` |
| `reshop_brinde` | `char` | `char(1)` | NO | - | `'N'` |
| `napse_promo` | `char` | `char(1)` | YES | - | `'N'` |
| `desc_lote_venc` | `char` | `char(1)` | NO | - | `'N'` |

---

## paf_req25_r02

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `paf_req25_r02_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `impressoras_id` | `int` | `int(11)` | NO | MUL | `0` |
| `num_con_crz` | `int` | `int(11)` | NO | - | `0` |
| `num_con_coo` | `int` | `int(11)` | NO | - | `0` |
| `num_con_cro` | `int` | `int(11)` | NO | - | `0` |
| `data_mov` | `date` | `date` | NO | MUL | `'0000-00-00'` |
| `datahora_emis` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `venda_bruta` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `grande_total` | `decimal` | `decimal(14,2)` | NO | - | `0.00` |
| `inc_desc_issqn` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `num_coo_inicial` | `int` | `int(11)` | NO | - | `0` |
| `num_coo_final` | `int` | `int(11)` | NO | - | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_manual` | `char` | `char(1)` | NO | - | `'N'` |
| `num_ord_usu_ecf` | `int` | `int(11)` | NO | - | `0` |
| `data` | `date` | `date` | NO | MUL | `'0000-00-00'` |

---

## paf_req25_r03

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `paf_req25_r02_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `totalizador_parcial` | `varchar` | `varchar(7)` | NO | PRI | `''` |
| `valor_acumulado` | `decimal` | `decimal(13,2)` | NO | - | `0.00` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## pagamentos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `pagamentos_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `0` |
| `datahora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `tipospgto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `valor` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `numcaixa` | `int` | `int(11)` | YES | - | `NULL` |
| `supsang` | `char` | `char(1)` | YES | - | `NULL` |
| `descr` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `oper` | `int` | `int(11)` | YES | MUL | `0` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `altera` | `char` | `char(1)` | YES | - | `'S'` |
| `cartaopreais` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `baixa` | `char` | `char(1)` | YES | - | `'N'` |
| `troco_entrega` | `char` | `char(1)` | YES | - | `'N'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dias_recebimento` | `int` | `int(11)` | YES | - | `NULL` |
| `sangria_desp` | `char` | `char(1)` | YES | - | `'N'` |
| `bancos_contas_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cancelado` | `char` | `char(1)` | NO | - | `'N'` |
| `cancelamento` | `char` | `char(1)` | NO | - | `'N'` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |

---

## pagar

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `pagar_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `dt_emissao` | `date` | `date` | YES | MUL | `NULL` |
| `dtvenc` | `date` | `date` | YES | MUL | `NULL` |
| `NF` | `bigint` | `bigint(20)` | YES | MUL | `NULL` |
| `fornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `historico` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `valor` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_pago` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dt_pgto` | `date` | `date` | YES | MUL | `NULL` |
| `parcela` | `tinyint` | `tinyint(4)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `despesas` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `numcaixa` | `int` | `int(11)` | YES | - | `0` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `0` |
| `duplicata` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dafilial_id` | `int` | `int(11)` | YES | MUL | `0` |
| `movnumlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `cfop` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `numlancconfent` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `movnumlancdesp` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `fil_baixa_id` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo_titulo` | `varchar` | `varchar(20)` | NO | - | `''` |
| `acrescimos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `descontos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_doc` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `barras_boleto` | `varchar` | `varchar(100)` | NO | - | `''` |
| `bancos_id` | `char` | `char(3)` | NO | - | `''` |
| `borde_ro` | `varchar` | `varchar(10)` | YES | MUL | `NULL` |
| `linha_digitavel` | `varchar` | `varchar(100)` | NO | - | `''` |
| `data_previsao_pgto` | `date` | `date` | NO | - | `'0000-00-00'` |
| `taxa_boleto` | `decimal` | `decimal(9,2)` | NO | - | `0.00` |
| `cpf_cnpj_cedente` | `varchar` | `varchar(14)` | NO | - | `''` |
| `nome_razao_cedente` | `varchar` | `varchar(40)` | NO | - | `''` |
| `dt_competencia` | `date` | `date` | YES | MUL | `NULL` |
| `identf_unico` | `varchar` | `varchar(32)` | YES | - | `NULL` |
| `lancamento_manual` | `char` | `char(1)` | YES | - | `'N'` |
| `utiliza_outros_descontos` | `char` | `char(1)` | NO | - | `'N'` |
| `cpf_cnpj_sacador` | `varchar` | `varchar(14)` | NO | - | `''` |
| `nome_razao_sacador` | `varchar` | `varchar(50)` | NO | - | `''` |
| `categoria_lancamento_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `dtvenc_original` | `date` | `date` | YES | - | `NULL` |
| `dtvenc_original_openbanking` | `date` | `date` | YES | - | `NULL` |

---

## pedidoeletronico

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `fornece_id` | `int` | `int(11)` | NO | PRI | `0` |
| `npedido` | `int` | `int(11)` | YES | - | `0` |
| `codfarmacia` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `codfarmacia_inter` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `layout` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `codvendedor` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `codfisica` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `ftp` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `cod_layout` | `int` | `int(11)` | NO | - | `0` |
| `email` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `senha` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPEndereco` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPUsuario` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPSenha` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPEnvio` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPRetorno` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPExtensaoEnvio` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPExtensaoRetorno` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `FTPPorta` | `int` | `int(11)` | YES | - | `NULL` |
| `FTPConexao` | `char` | `char(1)` | NO | - | `'N'` |
| `spe` | `char` | `char(1)` | NO | - | `'N'` |
| `spe_auto_config` | `char` | `char(1)` | NO | - | `'S'` |
| `spe_layout_id` | `int` | `int(11)` | YES | - | `NULL` |
| `ftp_usar_sftp` | `char` | `char(1)` | YES | - | `'N'` |
| `ftp_passivo` | `char` | `char(1)` | YES | - | `'N'` |
| `ftp_aguardar` | `int` | `int(11)` | YES | - | `NULL` |
| `ftp_repetir` | `int` | `int(11)` | YES | - | `NULL` |
| `proxy_usar` | `char` | `char(1)` | YES | - | `'N'` |
| `proxy_endereco` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `proxy_porta` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `proxy_usuario` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `proxy_senha` | `varchar` | `varchar(100)` | YES | - | `NULL` |

---

## pedidos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `pedidos_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `pedir` | `int` | `int(11)` | YES | - | `NULL` |
| `datahora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `marcado` | `char` | `char(1)` | YES | - | `'N'` |
| `barras` | `varchar` | `varchar(13)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `preco_cmp_un` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_vnd` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `labora` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `preco_pro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `estoque` | `int` | `int(11)` | YES | - | `0` |
| `mediavenda` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dgrupo` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `despec` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `dprincipio` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `dtultvenda` | `varchar` | `varchar(19)` | YES | - | `NULL` |
| `fornece_id` | `int` | `int(11)` | YES | - | `0` |
| `comprar_no_fornecedo` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `gp` | `int` | `int(11)` | YES | - | `NULL` |
| `ep` | `int` | `int(11)` | YES | - | `NULL` |
| `nome` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `comprar` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nfilial` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `dafilial_id` | `int` | `int(11)` | YES | - | `NULL` |
| `comprarfornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `obs` | `text` | `text` | YES | - | `NULL` |
| `recebido` | `char` | `char(1)` | YES | - | `'N'` |
| `falta` | `char` | `char(1)` | YES | - | `'N'` |
| `fabricantes_id` | `int` | `int(11)` | YES | - | `0` |
| `forsug_id` | `int` | `int(11)` | YES | - | `0` |
| `forsugnome` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `msg` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `minimo` | `int` | `int(11)` | YES | - | `0` |
| `cotacao_online` | `char` | `char(1)` | YES | - | `'N'` |
| `pedir_sugerido` | `int` | `int(11)` | YES | - | `0` |
| `unid_caixa` | `int` | `int(11)` | YES | - | `0` |
| `cotacao_fornece_id` | `int` | `int(11)` | YES | - | `0` |
| `cotacao_fornece_nome` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `preco_manual` | `char` | `char(1)` | YES | - | `'N'` |
| `desconto_manual` | `char` | `char(1)` | YES | - | `'N'` |
| `demanda` | `float` | `float(9,3)` | YES | - | `0.000` |
| `demandames` | `float` | `float(9,3)` | YES | - | `0.000` |
| `valid_pro` | `date` | `date` | YES | - | `NULL` |

---

## pedidos_feitos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `pedidos_feitos_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `codnofornec` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `fornece_id` | `int` | `int(11)` | YES | - | `NULL` |
| `qtde` | `int` | `int(11)` | YES | - | `0` |
| `npedido` | `int` | `int(11)` | YES | - | `NULL` |
| `entregue` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `dafilial_id` | `int` | `int(11)` | YES | - | `0` |

---

## perda

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `perda_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `quantiuni` | `int` | `int(11)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `precouni` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `valortot` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `obs` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `movment_id` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `motivo_perda` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `nota_fiscal_id` | `int` | `int(11)` | YES | - | `0` |
| `fornece_id` | `int` | `int(11)` | YES | - | `0` |
| `preco_custo_cadastro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_medio_custo` | `decimal` | `decimal(11,3)` | YES | - | `0.000` |
| `preco_ultima_entrada` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |

---

## perfil_comissao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `perfil_comissao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(50)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## perfil_comissao_grupo_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grupo_id` | `int` | `int(11)` | NO | PRI | `0` |
| `perfil_comissao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `logs_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_fisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `lojas_leram` | `varchar` | `varchar(100)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## perfil_comissao_produtos

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `perfil_comissao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `val_comissao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `per_comissao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## perfil_comissao_usuarios

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `usuario_id` | `int` | `int(11)` | NO | PRI | `0` |
| `perfil_comissao_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |

---

## perfil_usuario

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `usuario_id` | `int` | `int(11)` | NO | PRI | `0` |
| `propriedades` | `longtext` | `longtext` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## planocontas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `planocontas_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `codigo` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `totalizador` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `fornece_id` | `int` | `int(11)` | YES | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `operacao` | `char` | `char(1)` | NO | - | `'D'` |
| `opdesp` | `char` | `char(1)` | YES | - | `'S'` |
| `titulos_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## precosfilial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `preco` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `comprasuspensa` | `char` | `char(1)` | YES | - | `'N'` |
| `preco_promo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `inicio_promocao` | `date` | `date` | YES | - | `NULL` |
| `final_promocao` | `date` | `date` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `margem` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_custo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco_cmp_caixa` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `qt_fr` | `int` | `int(11)` | YES | - | `1` |
| `margem2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem3` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `preco3` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `desc_vista` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem_promo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `datapre` | `date` | `date` | YES | - | `NULL` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `comissao` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `comisunit` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `desc_promo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `usu_comprasuspensa` | `int` | `int(11)` | YES | - | `0` |
| `data_comprasuspensa` | `datetime` | `datetime` | YES | - | `NULL` |
| `md5sign_preco` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco2` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco3` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco_promo` | `varchar` | `varchar(32)` | NO | - | `''` |
| `preco_franquia` | `char` | `char(1)` | NO | - | `'N'` |
| `promocao_franquia` | `char` | `char(1)` | NO | - | `'N'` |

---

## preco_medio_custo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `fillogica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `pmc_atual` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `dtalteracao` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `char` | `char(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## preco_medio_custo_historico

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `historico_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `datahora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `estoque_anterior` | `int` | `int(11)` | NO | - | `0` |
| `pmc_anterior` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `qtde_entrada` | `int` | `int(11)` | NO | - | `0` |
| `valor_entrada` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `valor_ipi` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `valor_st` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `novo_pmc` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `lojas_leram` | `char` | `char(50)` | YES | MUL | `NULL` |
| `oper` | `int` | `int(11)` | NO | MUL | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `operacao_id` | `int` | `int(11)` | NO | - | `0` |
| `fillogica_id` | `int` | `int(11)` | NO | MUL | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `valor_frete` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_seguro` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_despesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `editado_manualmente` | `char` | `char(1)` | NO | - | `'N'` |
| `inserido_manualmente` | `char` | `char(1)` | NO | - | `'N'` |
| `percent_acres_custo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_acres_custo` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `bonificado` | `char` | `char(1)` | NO | - | `'N'` |
| `data_comunic` | `date` | `date` | YES | - | `NULL` |
| `valor_desonerado` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## prefinadm_cart

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `prefinadm_cart_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `movimento_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `totalbruto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `taxas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `fincaixastipos_id` | `int` | `int(11)` | YES | - | `NULL` |
| `fincaixas_id` | `int` | `int(11)` | NO | - | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `tipospgto_id` | `int` | `int(11)` | NO | - | `0` |
| `totalbruto_cop` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `taxas_cop` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `finadm_det_id` | `int` | `int(11)` | YES | - | `NULL` |
| `fil_finadm_id` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_taxas` | `int` | `int(11)` | YES | - | `NULL` |
| `taxa_antecipacao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `planocontas_adm_id_taxas` | `int` | `int(11)` | YES | - | `NULL` |

---

## principio_ativo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `principio_ativo_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(120)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `controle` | `char` | `char(1)` | NO | - | `'S'` |
| `coddcb_id` | `int` | `int(11)` | NO | - | `0` |

---

## produto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `Produto_id` | `int` | `int(10)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(60)` | YES | MUL | `NULL` |
| `labora` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `barras` | `varchar` | `varchar(13)` | YES | MUL | `NULL` |
| `principio_ativo_id` | `int` | `int(11)` | YES | - | `NULL` |
| `tipo` | `char` | `char(1)` | YES | - | `'P'` |
| `grupo_id` | `int` | `int(10)` | YES | - | `NULL` |
| `espec_id` | `int` | `int(10)` | YES | - | `NULL` |
| `portaria` | `char` | `char(2)` | YES | - | `NULL` |
| `cod_dcb` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `unidade` | `varchar` | `varchar(4)` | YES | - | `'UN'` |
| `sittr` | `char` | `char(3)` | YES | - | `NULL` |
| `lista` | `char` | `char(1)` | YES | - | `'N'` |
| `totfisc` | `char` | `char(2)` | YES | - | `'N'` |
| `comisunit` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `comissao` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `cod_abc` | `int` | `int(11)` | YES | MUL | `NULL` |
| `codtotal` | `varchar` | `varchar(10)` | YES | - | `NULL` |
| `descemp` | `char` | `char(1)` | YES | - | `'S'` |
| `descconv` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `alt_m_pc` | `char` | `char(1)` | YES | - | `'M'` |
| `preco_cmp` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `qt_fr` | `int` | `int(11)` | YES | - | `0` |
| `preco_cmp_un` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `barras14` | `char` | `char(1)` | YES | - | `NULL` |
| `margem2` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco2` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem3` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco3` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `margem_preco_pro` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `preco_pro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valid_pro` | `date` | `date` | YES | MUL | `NULL` |
| `desconto` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `datapre` | `datetime` | `datetime` | YES | - | `NULL` |
| `grupo` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `codigo` | `mediumint` | `mediumint(9)` | NO | - | `0` |
| `coinbs` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `contando` | `char` | `char(1)` | YES | - | `'N'` |
| `contado` | `int` | `int(11)` | YES | - | `0` |
| `ENTRADAS` | `int` | `int(11)` | YES | - | `0` |
| `precofis` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `local` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `estoque` | `int` | `int(11)` | YES | - | `0` |
| `minimo` | `int` | `int(11)` | YES | - | `0` |
| `dtiniciopromocao` | `date` | `date` | YES | MUL | `'2004-01-01'` |
| `curvaabc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `foi_contado` | `char` | `char(1)` | YES | - | `'N'` |
| `precoee` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `descmax` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `melhor_compra` | `int` | `int(11)` | YES | - | `NULL` |
| `grupo_precos_id` | `int` | `int(11)` | YES | MUL | `0` |
| `participa_abc` | `char` | `char(1)` | YES | - | `'N'` |
| `prc_ult_compra` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `ipi` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `codnofornec` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `pmc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `curvaabc_est` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `controla_validade` | `char` | `char(1)` | YES | MUL | `'N'` |
| `cod_foto` | `int` | `int(11)` | YES | MUL | `NULL` |
| `classe_t` | `varchar` | `varchar(40)` | YES | - | `NULL` |
| `continuo` | `char` | `char(1)` | YES | - | `'N'` |
| `qtde_continuo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valedinheiro` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valdin_perc` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `desc_promo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `formula` | `char` | `char(1)` | YES | - | `'N'` |
| `fabricantes_id` | `int` | `int(11)` | YES | - | `0` |
| `faceamento` | `int` | `int(11)` | YES | - | `0` |
| `qtde_apres` | `int` | `int(11)` | YES | - | `0` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtultcompra` | `datetime` | `datetime` | YES | - | `NULL` |
| `registro_ms` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `marcado` | `char` | `char(1)` | YES | - | `'N'` |
| `receita` | `char` | `char(1)` | YES | - | `'N'` |
| `nbm` | `int` | `int(11)` | YES | - | `NULL` |
| `ncm` | `int` | `int(11)` | YES | - | `NULL` |
| `msgvenda` | `text` | `text` | YES | - | `NULL` |
| `pesq_nome` | `char` | `char(1)` | YES | - | `'S'` |
| `desc_etiq` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `tipo_preco` | `char` | `char(1)` | YES | - | `NULL` |
| `classe_produto` | `char` | `char(1)` | YES | - | `NULL` |
| `classe_terapeutica_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cod_guiafar` | `int` | `int(11)` | YES | MUL | `NULL` |
| `cad_filial_id` | `int` | `int(11)` | YES | - | `0` |
| `cstpis` | `char` | `char(2)` | YES | - | `NULL` |
| `cstcofins` | `char` | `char(2)` | YES | - | `NULL` |
| `preco_vnd` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `gera_etiq_gondola` | `char` | `char(1)` | YES | - | `'S'` |
| `filtro_cadastro` | `tinyint` | `tinyint(4)` | NO | MUL | `0` |
| `contando_coletor` | `char` | `char(1)` | NO | - | `'N'` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `gtin14` | `varchar` | `varchar(14)` | NO | - | `''` |
| `genero` | `int` | `int(11)` | YES | - | `NULL` |
| `clasfis` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `inativo` | `char` | `char(1)` | NO | - | `'N'` |
| `csosn` | `char` | `char(3)` | YES | - | `NULL` |
| `md5sign_sittr` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco_vnd` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco2` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco3` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_preco_pro` | `varchar` | `varchar(32)` | NO | - | `''` |
| `indicado_fp` | `char` | `char(1)` | NO | - | `'N'` |
| `preco_fp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `md5sign_preco_fp` | `varchar` | `varchar(32)` | NO | - | `''` |
| `origem` | `char` | `char(1)` | YES | - | `NULL` |
| `dosagem_minima` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dosagem_maxima` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cstpis_ent` | `char` | `char(2)` | YES | - | `NULL` |
| `cstcofins_ent` | `char` | `char(2)` | YES | - | `NULL` |
| `liberado` | `char` | `char(1)` | NO | - | `'S'` |
| `medicamento` | `char` | `char(1)` | NO | - | `'S'` |
| `apresentacao_id` | `int` | `int(11)` | YES | - | `0` |
| `Cod_Tipo_Cat44` | `int` | `int(11)` | YES | - | `0` |
| `nat_rec` | `char` | `char(3)` | NO | - | `''` |
| `nbs` | `varchar` | `varchar(9)` | NO | - | `''` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `dt_ult_agendamento_preco` | `datetime` | `datetime` | YES | - | `NULL` |
| `descricao_ifarma` | `varchar` | `varchar(200)` | NO | - | `''` |
| `produto_id_protheus` | `varchar` | `varchar(20)` | NO | - | `''` |
| `grupo_id_prever` | `varchar` | `varchar(4)` | NO | - | `''` |
| `produto_id_ifarma` | `int` | `int(11)` | NO | - | `0` |
| `desconsidera_conferencia` | `char` | `char(1)` | YES | - | `'N'` |
| `cest_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `taxa_entrega` | `char` | `char(1)` | NO | - | `'N'` |
| `classific_fiscal_servicos_id` | `int` | `int(11)` | YES | - | `NULL` |
| `sem_codigo_barras` | `char` | `char(1)` | YES | - | `'N'` |
| `controlar_sncm` | `char` | `char(1)` | NO | - | `'N'` |
| `md5sign_ncm` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_cest_id` | `varchar` | `varchar(32)` | NO | - | `''` |
| `md5sign_classifc_servico_id` | `varchar` | `varchar(32)` | NO | - | `''` |
| `barras_valido` | `char` | `char(1)` | NO | - | `'N'` |
| `motivo_desoneracao` | `smallint` | `smallint(6)` | YES | - | `9` |
| `aliquota_desoneracao` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cesta_basica` | `char` | `char(1)` | NO | - | `'N'` |
| `comprimento` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `comprimento_unid` | `varchar` | `varchar(6)` | NO | - | `'cm'` |
| `largura` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `largura_unid` | `varchar` | `varchar(6)` | NO | - | `'cm'` |
| `altura` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `altura_unid` | `varchar` | `varchar(6)` | NO | - | `'cm'` |
| `peso` | `decimal` | `decimal(11,3)` | NO | - | `0.000` |
| `peso_unid` | `varchar` | `varchar(6)` | NO | - | `'kg'` |
| `url_bula` | `varchar` | `varchar(100)` | NO | - | `''` |
| `tarja` | `char` | `char(1)` | NO | - | `''` |
| `retem_receita` | `char` | `char(1)` | NO | - | `''` |
| `produto_apresentacao_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `considera_prod_apresentacao` | `char` | `char(1)` | NO | - | `'N'` |

---

## produtos_suspensos_compra

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `compra_suspensa` | `char` | `char(1)` | NO | MUL | `'S'` |
| `desabilita_qtde_estoque` | `int` | `int(11)` | NO | - | `0` |
| `data_inicio_bloqueio` | `date` | `date` | YES | - | `NULL` |
| `data_fim_bloqueio` | `date` | `date` | YES | - | `NULL` |
| `justificativa_susp_compra_id` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | MUL | `'N'` |

---

## qrlinx_ambiente

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `ambiente` | `char` | `char(1)` | NO | PRI | `'P'` |
| `referencia` | `text` | `text` | YES | - | `NULL` |
| `ativo` | `char` | `char(1)` | NO | - | `'S'` |

---

## qrlinx_caixa

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `qrlinx_caixa_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(200)` | NO | - | `''` |
| `caixa_id` | `int` | `int(11)` | NO | MUL | `0` |
| `status` | `int` | `int(11)` | NO | MUL | `0` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `pos_id` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `qrcode` | `varchar` | `varchar(255)` | NO | - | `''` |
| `qrcode_image` | `blob` | `blob` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `timeout` | `int` | `int(2)` | NO | - | `2` |

---

## qrlinx_comprovante

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `comprovante` | `text` | `text` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## qrlinx_config

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `tipo` | `varchar` | `varchar(20)` | YES | MUL | `NULL` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `0` |
| `planocontas_id_taxas` | `int` | `int(11)` | YES | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `conciliar_por` | `char` | `char(2)` | NO | - | `'VL'` |
| `taxa_padrao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## qrlinx_config_filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `bancos_contas_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `NULL (sem default)` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## qrlinx_controle

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `order_number` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `numlanc` | `bigint` | `bigint(20)` | YES | MUL | `0` |

---

## qrlinx_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `qrlinx_log_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `int` | `int(11)` | YES | MUL | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `method_name` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `text` | `text` | `text` | YES | - | `NULL` |

---

## qrlinx_qrcode

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `cnpj` | `varchar` | `varchar(14)` | NO | PRI | `''` |
| `name` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `logo_link` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `logo_link_download` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## qrlinx_transacao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `transaction_id` | `varchar` | `varchar(50)` | NO | - | `''` |
| `payment_id` | `varchar` | `varchar(50)` | NO | - | `''` |
| `order_id` | `varchar` | `varchar(50)` | NO | - | `''` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `0` |
| `caixa_id` | `int` | `int(11)` | NO | - | `0` |
| `clientes_id` | `int` | `int(11)` | NO | - | `0` |
| `status_id` | `int` | `int(11)` | NO | - | `0` |
| `status_name` | `varchar` | `varchar(50)` | NO | - | `''` |
| `amount` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `subtotal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `discount_value` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `add_value` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `total_pago` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `mensagem` | `varchar` | `varchar(100)` | NO | - | `''` |
| `data_hora_cadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `usuario_id_cadastro` | `int` | `int(11)` | NO | - | `0` |
| `data_hora_processamento` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `data_hora_confirmacao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `status_transacao` | `int` | `int(11)` | NO | - | `0` |
| `usuario_id_cancelamento` | `int` | `int(11)` | NO | - | `0` |
| `data_hora_cancelamento` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `motivo_cancelamento` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `wallet_cnpj` | `varchar` | `varchar(14)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `qrcode` | `text` | `text` | YES | - | `NULL` |
| `payment_method` | `varchar` | `varchar(50)` | NO | - | `''` |
| `id_end_to_end` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `qrlink` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `expire_date` | `datetime` | `datetime` | YES | - | `NULL` |
| `entrega` | `char` | `char(1)` | YES | - | `'N'` |
| `qrcode_signature` | `text` | `text` | YES | - | `NULL` |

---

## qrlinx_transacao_venda

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `transacao_id` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## qrlinx_wallet

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `cnpj` | `varchar` | `varchar(14)` | NO | PRI | `''` |
| `trading_name` | `varchar` | `varchar(50)` | NO | - | `''` |
| `mdr` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## recarga_redetrel

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `status` | `varchar` | `varchar(10)` | NO | - | `''` |
| `nsu_operadora` | `varchar` | `varchar(9)` | NO | - | `''` |
| `nsu_host` | `varchar` | `varchar(9)` | NO | MUL | `''` |
| `numero_telefone` | `varchar` | `varchar(11)` | NO | - | `''` |
| `codigo_regional` | `varchar` | `varchar(10)` | NO | - | `''` |
| `valor_face` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_autorizacao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `mensagem` | `text` | `text` | NO | - | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `nsu_centralizador` | `varchar` | `varchar(9)` | NO | - | `''` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `operadora` | `varchar` | `varchar(10)` | NO | - | `''` |
| `cupom_fiscal` | `int` | `int(11)` | NO | - | `0` |

---

## recarga_rv

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `codigocompra` | `int` | `int(11)` | NO | MUL | `0` |
| `codigoonline` | `bigint` | `bigint(20)` | NO | - | `0` |
| `produto` | `varchar` | `varchar(9)` | NO | - | `''` |
| `valor_preco` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_face` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `vencimento` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `status` | `varchar` | `varchar(10)` | NO | - | `''` |
| `pago` | `char` | `char(1)` | NO | - | `'N'` |
| `cupom_fiscal` | `int` | `int(11)` | NO | - | `0` |
| `mensagem` | `varchar` | `varchar(255)` | NO | - | `''` |
| `dataRV` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `operadora` | `varchar` | `varchar(20)` | NO | - | `''` |
| `operadora_tipo` | `tinyint` | `tinyint(4)` | NO | - | `0` |

---

## recarga_rv_online

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `nsu` | `varchar` | `varchar(9)` | NO | - | `''` |
| `ddd` | `char` | `char(2)` | NO | - | `''` |
| `fone` | `varchar` | `varchar(9)` | NO | - | `''` |
| `codigo_assinante` | `varchar` | `varchar(50)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## recarga_rv_pin

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `pin` | `varchar` | `varchar(20)` | NO | - | `''` |
| `lote` | `varchar` | `varchar(50)` | NO | - | `'0'` |
| `serie` | `varchar` | `varchar(50)` | NO | - | `'0'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## recarga_upaid

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `status` | `varchar` | `varchar(10)` | NO | - | `''` |
| `nsu_operadora` | `varchar` | `varchar(9)` | NO | - | `''` |
| `nsu_upaid` | `varchar` | `varchar(9)` | NO | MUL | `''` |
| `numero_telefone` | `varchar` | `varchar(11)` | NO | - | `''` |
| `codigo_regional` | `varchar` | `varchar(10)` | NO | - | `''` |
| `valor_face` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data_autorizacao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `mensagem` | `text` | `text` | NO | - | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `nsu_centralizador` | `varchar` | `varchar(9)` | NO | - | `''` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `operadora` | `varchar` | `varchar(10)` | NO | - | `''` |
| `cupom_fiscal` | `int` | `int(11)` | NO | - | `0` |

---

## receber

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `receber_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `empresa_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `clientes_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `datahora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `tipo` | `tinyint` | `tinyint(4)` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `barras` | `varchar` | `varchar(13)` | YES | - | `NULL` |
| `quantidade` | `int` | `int(11)` | YES | - | `0` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `valor` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valortotal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `numnota` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `vencimento` | `date` | `date` | YES | MUL | `NULL` |
| `obs` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `amort` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `crm` | `varchar` | `varchar(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `autorizacao` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `COMRECEITA` | `char` | `char(1)` | YES | - | `'N'` |
| `data_baixa` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `num_ecf` | `int` | `int(11)` | YES | - | `0` |
| `dependentes_id` | `int` | `int(11)` | YES | - | `0` |
| `parcelado` | `char` | `char(1)` | YES | - | `'N'` |
| `num_caixa` | `int` | `int(11)` | YES | - | `0` |
| `caixa_dia` | `int` | `int(11)` | YES | - | `0` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `formula` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `baixa` | `char` | `char(1)` | YES | - | `'S'` |
| `per_desc_baixa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lanc_manual` | `char` | `char(1)` | NO | - | `'N'` |
| `baixa_filial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `baixa_numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `movment_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `data_venda` | `datetime` | `datetime` | YES | - | `NULL` |
| `data_alteracao` | `date` | `date` | YES | MUL | `NULL` |
| `numero_documento` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `total_original` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## relbomdia

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `relbomdia_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `usuario_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | MUL | `NULL` |
| `descricao` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `permissoessup_id` | `int` | `int(11)` | YES | - | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `clientes_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## relbomdia_descsuperv

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `relbomdiadesc_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `preco_vnd_desc` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `preco_vnd` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `desc_ant` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `desc_post` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `desc_max` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `quantidade` | `int` | `int(11)` | YES | - | `NULL` |
| `supervisor_id` | `int` | `int(11)` | YES | - | `NULL` |
| `desc_max_sup` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `finalizado` | `char` | `char(1)` | YES | - | `'N'` |
| `orcament_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `movment_id` | `bigint` | `bigint(20)` | YES | MUL | `0` |
| `data_hora_finalizacao` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `justificativa_desc_sup_id` | `int` | `int(11)` | NO | - | `0` |
| `observacao` | `varchar` | `varchar(200)` | YES | - | `NULL` |

---

## remanejamento

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `remanejamento_id` | `bigint` | `bigint(20)` | NO | PRI | `NULL (sem default)` |
| `defilial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `parafilial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `qtde` | `int` | `int(11)` | YES | - | `0` |
| `preco` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `recebido` | `char` | `char(1)` | YES | - | `'N'` |
| `obs` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `remanejar` | `int` | `int(11)` | YES | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `recusado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `usuario_id_aviso` | `int` | `int(11)` | YES | - | `0` |
| `data_hora_envio` | `datetime` | `datetime` | YES | - | `NULL` |
| `data_hora_recusa` | `datetime` | `datetime` | YES | - | `NULL` |
| `enviado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |
| `contando_coletor` | `char` | `char(1)` | YES | - | `'N'` |
| `transferindo` | `char` | `char(1)` | YES | - | `'N'` |
| `recusar` | `char` | `char(1)` | YES | - | `'N'` |
| `reabastecimento_config_id` | `int` | `int(11)` | YES | - | `NULL` |
| `automatico` | `char` | `char(1)` | NO | - | `'N'` |
| `qtde_demanda` | `int` | `int(11)` | NO | - | `0` |
| `qtde_original` | `int` | `int(11)` | NO | - | `0` |

---

## remessa_conserto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `remessa_conserto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `nome_razaosocial` | `varchar` | `varchar(40)` | NO | - | `''` |
| `cnpj_cpf` | `varchar` | `varchar(14)` | NO | MUL | `''` |
| `ie_rg` | `varchar` | `varchar(20)` | NO | - | `''` |
| `endereco` | `varchar` | `varchar(40)` | NO | - | `''` |
| `bairro_distrito` | `varchar` | `varchar(25)` | NO | - | `''` |
| `cep` | `varchar` | `varchar(8)` | NO | - | `''` |
| `municipio` | `varchar` | `varchar(30)` | NO | - | `''` |
| `fone_fax` | `varchar` | `varchar(25)` | NO | - | `''` |
| `uf` | `char` | `char(2)` | NO | - | `''` |
| `base_calc_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_prod` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_frete` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_ipi` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `frete_por_conta` | `char` | `char(1)` | NO | - | `'1'` |
| `dados_adicionais` | `text` | `text` | YES | - | `NULL` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | - | `0` |
| `fornece_id` | `int` | `int(11)` | NO | - | `0` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |

---

## rotas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `rota_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `text` | `text` | YES | - | `NULL` |
| `tempo_max` | `int` | `int(11)` | YES | - | `NULL` |
| `tempo_min` | `int` | `int(11)` | YES | - | `NULL` |
| `tempo_medio` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `nome_rota` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `cep_inicial` | `int` | `int(11)` | YES | - | `NULL` |
| `cep_final` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `entrega_por` | `char` | `char(1)` | NO | - | `'M'` |
| `valor_entrega` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## saldo_credito_pis_cofins

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `saldo_credito_pis_cofins_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `valor_cred_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_cred_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `data` | `date` | `date` | NO | MUL | `'0000-00-00'` |
| `cod_cred` | `char` | `char(3)` | YES | - | `NULL` |

---

## sat_cfe

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `sat_cfe_id` | `bigint` | `bigint(18)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `sat_id` | `int` | `int(11)` | NO | MUL | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `num_cfe` | `int` | `int(11)` | NO | - | `0` |
| `chave_cfe` | `varchar` | `varchar(44)` | NO | - | `''` |
| `dt_emissao` | `date` | `date` | NO | MUL | `'0000-00-00'` |
| `hr_emissao` | `time` | `time` | NO | - | `'00:00:00'` |
| `total_produtos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_descontos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_despesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `total_cfe` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cpf_cnpj_dest` | `varchar` | `varchar(14)` | NO | - | `''` |
| `nome_dest` | `varchar` | `varchar(60)` | NO | - | `''` |
| `reg_trib` | `int` | `int(11)` | NO | - | `3` |
| `ind_rat_issqn` | `char` | `char(1)` | NO | - | `'N'` |
| `dados_adicionais` | `text` | `text` | NO | - | `NULL (sem default)` |
| `assinatura_qrcode` | `text` | `text` | NO | - | `NULL (sem default)` |
| `tipo_ambiente` | `int` | `int(11)` | NO | - | `1` |
| `cancelado` | `char` | `char(1)` | NO | - | `'N'` |
| `num_caixa` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dt_cadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dt_alteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `total_taxa_entrega` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lei_12741` | `varchar` | `varchar(200)` | YES | - | `NULL` |
| `uf_dest` | `char` | `char(2)` | YES | - | `NULL` |
| `total_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `num_serie_equipamento` | `varchar` | `varchar(9)` | NO | - | `''` |

---

## sat_cfe_item

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `sat_cfe_id` | `bigint` | `bigint(18)` | NO | PRI | `0` |
| `num_item` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | MUL | `0` |
| `descricao` | `varchar` | `varchar(60)` | NO | - | `''` |
| `barras` | `varchar` | `varchar(14)` | NO | - | `''` |
| `cfop` | `varchar` | `varchar(10)` | NO | - | `''` |
| `unidade` | `varchar` | `varchar(6)` | NO | - | `''` |
| `quantidade` | `int` | `int(11)` | NO | - | `0` |
| `valor_unitario` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_total_bruto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `ind_regra` | `char` | `char(1)` | NO | - | `'A'` |
| `valor_descontos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_despesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_total_liquido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_rateio_descontos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_rateio_despesas` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_aprox_tributos` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `origem_mercadoria` | `char` | `char(1)` | NO | - | `''` |
| `cst_icms` | `char` | `char(2)` | NO | - | `''` |
| `csosn` | `char` | `char(3)` | NO | - | `''` |
| `base_calculo_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_icms` | `decimal` | `decimal(5,2)` | NO | - | `0.00` |
| `valor_icms` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cst_pis` | `char` | `char(2)` | NO | - | `''` |
| `base_calculo_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_pis` | `decimal` | `decimal(7,4)` | NO | - | `0.0000` |
| `valor_pis` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `cst_cofins` | `char` | `char(2)` | NO | - | `''` |
| `base_calculo_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_cofins` | `decimal` | `decimal(7,4)` | NO | - | `0.0000` |
| `cod_lista_servicos_issqn` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `valor_cofins` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_deducoes_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `base_calculo_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_issqn` | `decimal` | `decimal(5,2)` | NO | - | `0.00` |
| `valor_issqn` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `nat_oper_issqn` | `int` | `int(11)` | YES | - | `NULL` |
| `ind_inc_fiscal` | `char` | `char(1)` | NO | - | `'N'` |
| `cest` | `varchar` | `varchar(9)` | NO | - | `''` |
| `cod_municipio_issqn` | `int` | `int(11)` | YES | - | `NULL` |
| `cod_trib_municipio_issqn` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `servico` | `char` | `char(1)` | NO | - | `'N'` |
| `base_calc_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aliq_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_fcp` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |

---

## sat_cfe_xml

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `sat_cfe_id` | `bigint` | `bigint(18)` | NO | PRI | `0` |
| `arquivo_cfe` | `mediumtext` | `mediumtext` | NO | - | `NULL (sem default)` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |

---

## sintegra

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `mes_ano` | `varchar` | `varchar(6)` | NO | PRI | `''` |
| `serie_impfiscal` | `varchar` | `varchar(100)` | NO | PRI | `''` |
| `arquivo` | `longtext` | `longtext` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `data_hora` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `arquivo2` | `longblob` | `longblob` | YES | - | `NULL` |

---

## sintegra_60m

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `impressora_id` | `int` | `int(11)` | NO | PRI | `0` |
| `data` | `date` | `date` | NO | PRI | `'0000-00-00'` |
| `numero_seq_ecf` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `contador_red_z` | `int` | `int(11)` | NO | - | `0` |
| `contador_reinic_oper` | `int` | `int(11)` | NO | PRI | `0` |
| `coo_inicial` | `int` | `int(11)` | NO | - | `0` |
| `coo_final` | `int` | `int(11)` | NO | - | `0` |
| `venda_bruta` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `grande_total` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `cancelamentos` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `subst_trib` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `isencao` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `nao_incidencia` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `iss` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `datahora_emissao` | `datetime` | `datetime` | YES | - | `NULL` |
| `acrescimo` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `opnf` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `coo_red_z` | `int` | `int(11)` | NO | - | `0` |
| `desc_issqn` | `char` | `char(1)` | NO | - | `'N'` |
| `apag_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_manual` | `char` | `char(1)` | NO | - | `'N'` |
| `bkp_data` | `datetime` | `datetime` | YES | - | `NULL` |

---

## tabela_desconto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabela_desconto_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(60)` | NO | - | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `tabela_para_entrega` | `char` | `char(1)` | NO | - | `'N'` |

---

## tabloide

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabloide_id` | `int` | `int(11)` | NO | PRI | `0` |
| `descricao` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `vigencia_de` | `datetime` | `datetime` | YES | - | `NULL` |
| `vigencia_ate` | `datetime` | `datetime` | YES | - | `NULL` |
| `ativo` | `char` | `char(1)` | YES | MUL | `'N'` |
| `permite_alterar_desc` | `char` | `char(1)` | YES | - | `'N'` |
| `permite_tabela_desc_entrega` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `permite_sup_alt_desc` | `char` | `char(1)` | NO | - | `'S'` |

---

## tabloide_filial

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabloide_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## tabloide_grupo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabloide_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `grupo_id` | `int` | `int(11)` | NO | PRI | `0` |
| `aplicar_perc_desconto` | `char` | `char(1)` | YES | - | `'N'` |
| `perc_desconto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aplicar_margem_markup` | `char` | `char(1)` | YES | - | `'N'` |
| `margem_markup` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aplicar_marg_custo_medio` | `char` | `char(1)` | YES | - | `'N'` |
| `marg_custo_medio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dia_segunda` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_terca` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_quarta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_quinta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_sexta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_sabado` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_domingo` | `char` | `char(1)` | YES | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## tabloide_produto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tabloide_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `aplicar_perc_desconto` | `char` | `char(1)` | YES | - | `'N'` |
| `perc_desconto` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aplicar_margem_markup` | `char` | `char(1)` | YES | - | `'N'` |
| `margem_markup` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aplicar_preco_venda` | `char` | `char(1)` | YES | - | `'N'` |
| `preco_venda` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `aplicar_marg_custo_medio` | `char` | `char(1)` | YES | - | `'N'` |
| `marg_custo_medio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dia_segunda` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_terca` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_quarta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_quinta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_sexta` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_sabado` | `char` | `char(1)` | YES | - | `'N'` |
| `dia_domingo` | `char` | `char(1)` | YES | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |

---

## taxa_valor_rota

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `taxa_valor_rota_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `valor_venda` | `decimal` | `decimal(11,2)` | NO | MUL | `0.00` |
| `taxa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dt_cadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `rota_id` | `int` | `int(11)` | NO | - | `0` |

---

## tipospgto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tipospgto_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `descricao` | `varchar` | `varchar(35)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `cadastrar` | `char` | `char(1)` | YES | - | `'N'` |
| `tipo` | `varchar` | `varchar(15)` | YES | - | `'Dinheiro'` |
| `dias_recebe` | `int` | `int(11)` | YES | - | `0` |
| `desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `trncentre` | `char` | `char(1)` | YES | - | `'N'` |
| `taxa_mensal` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valedinheiro` | `char` | `char(1)` | YES | - | `'N'` |
| `retira_desc` | `char` | `char(1)` | YES | - | `'N'` |
| `sorocred` | `char` | `char(1)` | YES | - | `'N'` |
| `leader` | `char` | `char(1)` | YES | - | `'N'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `max_vezes` | `int` | `int(11)` | YES | - | `0` |
| `avisosangria` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `conta_credito` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id` | `int` | `int(11)` | YES | - | `NULL` |
| `planocontas_id_taxas` | `int` | `int(11)` | YES | - | `NULL` |
| `gerarfinautomatic` | `char` | `char(1)` | NO | - | `'N'` |
| `operadora` | `varchar` | `varchar(50)` | NO | - | `''` |
| `tipo_cartao` | `char` | `char(1)` | NO | - | `'N'` |
| `exibir_fluxo_caixa` | `char` | `char(1)` | NO | - | `'N'` |
| `ocultar_em_sangria` | `char` | `char(1)` | YES | - | `'N'` |
| `ocultar_em_suprimento` | `char` | `char(1)` | YES | - | `'N'` |
| `tipospgto_nfe_id` | `int` | `int(11)` | YES | - | `NULL` |
| `inativo` | `char` | `char(1)` | YES | - | `'N'` |
| `tipo_pgto_reshop` | `tinyint` | `tinyint(4)` | YES | - | `NULL` |
| `desc_pagto_outros` | `varchar` | `varchar(60)` | NO | - | `''` |
| `ct_presente_napsepromo` | `char` | `char(1)` | YES | - | `'N'` |
| `credenc_id` | `int` | `int(11)` | YES | - | `0` |
| `informar_tags_xml` | `char` | `char(1)` | YES | - | `'N'` |
| `tef_transacao_completa` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `tipo_pix` | `char` | `char(1)` | YES | - | `NULL` |
| `tipo_integracao` | `char` | `char(3)` | YES | - | `NULL` |

---

## totalfisc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `totalizador` | `char` | `char(2)` | NO | PRI | `''` |
| `icms` | `double` | `double(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `totalfisc_id` | `int` | `int(11)` | NO | UNI | `NULL (sem default)` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `padrao` | `char` | `char(1)` | NO | - | `'N'` |
| `md5sign` | `varchar` | `varchar(32)` | NO | - | `''` |
| `tipo` | `varchar` | `varchar(5)` | YES | - | `NULL` |

---

## transacao_cart_pbm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_cart_pbm_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `valor_total_original` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `nsu` | `varchar` | `varchar(50)` | NO | MUL | `'0'` |
| `data_hora` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `numlanc` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `pagamentos_id` | `int` | `int(11)` | NO | MUL | `0` |
| `tef` | `char` | `char(1)` | NO | MUL | `'S'` |
| `cartao_pbm` | `char` | `char(1)` | NO | - | `'C'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `possui_parc_baixada` | `char` | `char(1)` | NO | - | `'N'` |
| `usando_config_avanc` | `char` | `char(1)` | NO | - | `'N'` |
| `codigo_rede` | `varchar` | `varchar(20)` | NO | - | `''` |
| `solucao_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `status_credenc_tef` | `int` | `int(11)` | NO | - | `0` |
| `numero_autorizacao` | `varchar` | `varchar(20)` | NO | - | `''` |
| `qtde_parcelas_tef` | `int` | `int(11)` | NO | - | `1` |
| `codigo_bandeira` | `varchar` | `varchar(30)` | NO | - | `''` |
| `credito_debito` | `char` | `char(1)` | NO | - | `''` |
| `bandeira_tef_id` | `int` | `int(11)` | NO | - | `0` |
| `tipo_parcelamento` | `tinyint` | `tinyint(2)` | NO | - | `0` |

---

## transacao_cart_pbm_log

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_cart_pbm_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | - | `0` |
| `cgc` | `varchar` | `varchar(14)` | NO | - | `''` |
| `tipospgto_id` | `int` | `int(11)` | NO | - | `0` |
| `tipospgto_nfe_id` | `int` | `int(11)` | NO | - | `0` |
| `nsu` | `bigint` | `bigint(20)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |

---

## transacao_cart_pbm_parc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_cart_pbm_parc_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `transacao_cart_pbm_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `valor` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `taxa` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_liquido` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_lanc` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `vencimento` | `date` | `date` | NO | MUL | `'0000-00-00'` |
| `alterado` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtapagado` | `datetime` | `datetime` | YES | - | `NULL` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `transacao_id` | `varchar` | `varchar(32)` | NO | MUL | `'0'` |
| `lote_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `bancos_contas_movto_id` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `dtconciliacao_automatica` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `status_conciliacao` | `char` | `char(2)` | NO | - | `'NC'` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `num_parcela` | `int` | `int(11)` | NO | - | `1` |
| `num_parcela_conciliadora` | `int` | `int(11)` | NO | - | `0` |

---

## transacao_config_cart

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_cart_pbm_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `credenc_cart_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_cart_config_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_cart_config_dia_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_cart_config_per_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |

---

## transacao_config_pbm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_cart_pbm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `credenc_pbm_id` | `int` | `int(11)` | NO | - | `0` |
| `credenc_pbm_config_id` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |

---

## transacao_pbm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `confirmada` | `char` | `char(1)` | NO | - | `'N'` |
| `operadora` | `int` | `int(11)` | NO | PRI | `0` |
| `autorizacao` | `varchar` | `varchar(30)` | NO | - | `''` |
| `cartao` | `varchar` | `varchar(30)` | NO | - | `''` |
| `nsu` | `varchar` | `varchar(30)` | NO | - | `''` |
| `projeto` | `varchar` | `varchar(30)` | NO | - | `''` |
| `cupom_vinculado` | `text` | `text` | YES | - | `NULL` |
| `cpf` | `varchar` | `varchar(20)` | NO | - | `''` |
| `data_hora` | `datetime` | `datetime` | NO | MUL | `'0000-00-00 00:00:00'` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `sequencia` | `int` | `int(11)` | NO | - | `0` |
| `epharma_tipo` | `int` | `int(11)` | NO | - | `0` |
| `trnc_campo1` | `varchar` | `varchar(100)` | NO | - | `''` |
| `trnc_campo2` | `varchar` | `varchar(100)` | NO | - | `''` |
| `paciente` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `cancelado` | `char` | `char(1)` | NO | - | `'N'` |
| `autor_cancel` | `varchar` | `varchar(30)` | NO | - | `''` |
| `dados_comple` | `text` | `text` | YES | - | `NULL` |
| `valor_avista` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `valor_convenio` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `operadora_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `crm` | `varchar` | `varchar(10)` | NO | - | `''` |
| `id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `fechada` | `char` | `char(1)` | YES | - | `'N'` |
| `cupom_fiscal` | `int` | `int(11)` | YES | - | `0` |
| `pedir_senhaadm` | `char` | `char(1)` | NO | - | `'N'` |
| `iniciada_balcao` | `char` | `char(1)` | YES | - | `'N'` |
| `tipo_documento_fiscal` | `tinyint` | `tinyint(4)` | YES | - | `0` |
| `chave_documento` | `varchar` | `varchar(44)` | YES | - | `NULL` |
| `serie_documento` | `char` | `char(3)` | YES | - | `NULL` |
| `numero_ecf_documento` | `int` | `int(11)` | YES | - | `0` |
| `numero_caixa_documento` | `int` | `int(11)` | YES | - | `0` |
| `motivo_cancelado` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `endereco_farmacia_pop` | `varchar` | `varchar(60)` | NO | - | `''` |
| `numero_farmacia_pop` | `varchar` | `varchar(20)` | NO | - | `''` |
| `codigo_conveniado` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `num_parc_convenio` | `int` | `int(11)` | YES | - | `NULL` |
| `bairro_farmacia_pop` | `varchar` | `varchar(25)` | NO | - | `''` |
| `operadora_tipo` | `char` | `char(2)` | NO | - | `''` |
| `senha_conveniado` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `entrega` | `char` | `char(1)` | NO | - | `'N'` |
| `qtd_digitos_senha` | `int` | `int(11)` | NO | - | `0` |
| `senha_padrao` | `char` | `char(1)` | NO | - | `'N'` |
| `obriga_receita` | `char` | `char(1)` | NO | - | `'N'` |
| `obriga_receita_sgpharma` | `char` | `char(1)` | NO | - | `'N'` |
| `usa_pre_conferencia` | `char` | `char(1)` | NO | - | `'N'` |
| `cpf_usuario` | `varchar` | `varchar(14)` | YES | - | `NULL` |
| `forma_pgto_id` | `int` | `int(11)` | YES | - | `0` |
| `senha_cartao` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `cidade_farmacia_pop` | `varchar` | `varchar(20)` | NO | - | `''` |

---

## transacao_pbm_cancel

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transacao_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `operadora` | `int` | `int(11)` | NO | - | `0` |
| `transacao_pbm_id` | `int` | `int(11)` | NO | - | `0` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `autorizacao` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `valor_avista` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_convenio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `cupom_vinculado` | `text` | `text` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |

---

## transacao_pbm_desconto_item

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `movment_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `operadora` | `int` | `int(11)` | NO | - | `0` |
| `produto_id` | `int` | `int(11)` | NO | - | `0` |
| `percentual_desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `valor_desconto` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `percentual_desconto_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `permite_desconto_item_pbm` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `preco_uni_com_desconto_ret` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |

---

## transacao_pbm_reposicao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_pbm_reposicao_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | MUL | `0` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `produto_id` | `int` | `int(11)` | NO | - | `0` |
| `percent_reposicao` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `tipo_pbm` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | MUL | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `qtde_venda` | `int` | `int(11)` | NO | - | `0` |
| `qtde_reposta` | `int` | `int(11)` | NO | - | `0` |
| `qtde_cancelada` | `int` | `int(11)` | NO | - | `0` |
| `status` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `conciliacao_automatica` | `char` | `char(1)` | NO | - | `'N'` |

---

## transacao_tef

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transacao_tef_id` | `int` | `int(11)` | NO | PRI | `0` |
| `valor_total` | `decimal` | `decimal(15,2)` | NO | - | `0.00` |
| `status_transacao` | `char` | `char(3)` | NO | - | `''` |
| `nome_rede` | `varchar` | `varchar(16)` | NO | - | `''` |
| `tipo_transacao` | `smallint` | `smallint(6)` | NO | - | `0` |
| `nsu` | `bigint` | `bigint(20)` | NO | - | `0` |
| `cod_autorizacao` | `varchar` | `varchar(20)` | NO | - | `''` |
| `tipo_parcelamento` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `qtde_parcelas` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `data_transacao` | `date` | `date` | NO | - | `'0000-00-00'` |
| `hora_transacao` | `time` | `time` | NO | - | `'00:00:00'` |
| `numlanc` | `bigint` | `bigint(20)` | NO | MUL | `0` |
| `filial_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `dtcancelado` | `datetime` | `datetime` | YES | - | `NULL` |
| `canc_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cancelado` | `char` | `char(1)` | NO | MUL | `'N'` |
| `bancos_contas_movto_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `operadora_cartao_id` | `int` | `int(11)` | NO | - | `0` |

---

## transferencia

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `transferencia_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `numlanc` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `defilial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `parafilial_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `qtde` | `int` | `int(11)` | YES | - | `NULL` |
| `preco` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `recebido` | `char` | `char(1)` | YES | - | `'N'` |
| `obs` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `ok` | `char` | `char(1)` | YES | - | `'N'` |
| `recusado` | `char` | `char(1)` | YES | MUL | `'N'` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `datahora_recusado` | `datetime` | `datetime` | YES | - | `NULL` |
| `filialremanejamento_id` | `int` | `int(11)` | YES | - | `NULL` |
| `remanejamento_id` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `numnota` | `bigint` | `bigint(20)` | YES | - | `NULL` |
| `lote` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `movment_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `transferencia_rec_id` | `int` | `int(11)` | NO | - | `0` |
| `qtdelida` | `int` | `int(11)` | NO | - | `0` |
| `nota_manual` | `char` | `char(1)` | YES | - | `NULL` |
| `marcado` | `char` | `char(1)` | NO | - | `'N'` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | - | `0` |
| `data_comunic` | `date` | `date` | YES | MUL | `NULL` |

---

## transferencia_rec

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filfisica_id` | `int` | `int(11)` | NO | PRI | `0` |
| `transferencia_rec_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `defilial_id` | `int` | `int(11)` | YES | - | `NULL` |
| `transferencia_id` | `int` | `int(11)` | YES | MUL | `NULL` |
| `data_hora` | `datetime` | `datetime` | YES | - | `NULL` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `qtde` | `int` | `int(11)` | NO | - | `0` |
| `preco` | `decimal` | `decimal(11,2)` | NO | - | `0.00` |
| `usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `numnota` | `int` | `int(11)` | YES | - | `NULL` |
| `numlanc` | `bigint` | `bigint(20)` | NO | - | `0` |
| `lojas_leram` | `char` | `char(50)` | YES | MUL | `NULL` |
| `movment_id` | `bigint` | `bigint(20)` | NO | - | `0` |
| `nota_fiscal_id` | `int` | `int(11)` | NO | MUL | `0` |

---

## tributacao

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tributacao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `uf_origem` | `char` | `char(2)` | NO | MUL | `''` |
| `uf_destino` | `char` | `char(2)` | NO | - | `''` |
| `tipo_medicamento` | `char` | `char(1)` | YES | - | `'1'` |
| `cst` | `char` | `char(2)` | NO | - | `''` |
| `csosn` | `char` | `char(3)` | NO | - | `''` |
| `perc_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_reducao_icms` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_fcp` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_diferimento` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_icms_st` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_mva` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_reducao_icms_st` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_reducao_efetiva` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_isencao_parcial` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_reducao_isencao_parcial` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `perc_desoneracao` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `motivo_desoneracao` | `varchar` | `varchar(120)` | NO | - | `''` |
| `isencao_parcial` | `char` | `char(1)` | NO | - | `'N'` |
| `difal_ec_87_2015` | `char` | `char(1)` | YES | - | `'N'` |
| `beneficio_fiscal` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `difal_calculo_aliquota` | `tinyint` | `tinyint(4)` | NO | - | `-1` |
| `difal_icms_sem_anuencia` | `char` | `char(1)` | NO | - | `'N'` |
| `difal_beneficio_fiscal_anuenc` | `char` | `char(1)` | NO | - | `'N'` |
| `difal_beneficio_fiscal` | `tinyint` | `tinyint(4)` | NO | - | `0` |
| `difal_perc_reducao_icms` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `difal_perc_icms` | `decimal` | `decimal(11,2)` | YES | - | `NULL` |
| `centro_distribuicao` | `char` | `char(1)` | NO | - | `'N'` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `cad_im` | `char` | `char(1)` | YES | - | `'N'` |
| `id_imendes` | `varchar` | `varchar(50)` | YES | - | `NULL` |

---

## tributacao_bens_ativo

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tributacao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `bens_ativo_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## tributacao_ncm

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tributacao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `ncm_id` | `int` | `int(11)` | NO | PRI | `0` |
| `ncm_codigo` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |

---

## tributacao_produto

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `tributacao_id` | `int` | `int(11)` | NO | PRI | `0` |
| `produto_id` | `int` | `int(11)` | NO | PRI | `0` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `id_imendes` | `varchar` | `varchar(50)` | YES | - | `NULL` |

---

## usuario

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `usuario_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `nome` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `endereco` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `bairro` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `cidade` | `varchar` | `varchar(30)` | YES | - | `NULL` |
| `uf` | `char` | `char(2)` | YES | - | `NULL` |
| `cep` | `varchar` | `varchar(9)` | YES | - | `NULL` |
| `telefone` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `desc_max` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `perc_comissao` | `decimal` | `decimal(6,2)` | YES | - | `0.00` |
| `vendedor` | `char` | `char(1)` | YES | - | `'S'` |
| `grupo_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `senha` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `senhasupervisor` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `lojas_leram2` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `desc_supervisor` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `dtcadastro` | `datetime` | `datetime` | YES | - | `NULL` |
| `dtalteracao` | `datetime` | `datetime` | YES | - | `NULL` |
| `cad_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `alt_usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `entregador` | `char` | `char(1)` | YES | - | `'N'` |
| `desc_receber` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `CPF` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `rg` | `varchar` | `varchar(18)` | YES | - | `NULL` |
| `obs` | `varchar` | `varchar(54)` | YES | - | `NULL` |
| `supervisor` | `varchar` | `varchar(255)` | YES | - | `NULL` |
| `dtnascimento` | `date` | `date` | YES | - | `NULL` |
| `dtrelbomdia` | `date` | `date` | YES | - | `NULL` |
| `mesvotou` | `char` | `char(2)` | YES | - | `NULL` |
| `dt_aviso_promo` | `date` | `date` | YES | - | `NULL` |
| `aviso_comunic` | `datetime` | `datetime` | YES | - | `NULL` |
| `aviso_atualiza` | `datetime` | `datetime` | YES | - | `NULL` |
| `filial_id` | `int` | `int(11)` | YES | - | `NULL` |
| `celular` | `varchar` | `varchar(16)` | YES | - | `NULL` |
| `dt_admissao` | `datetime` | `datetime` | YES | - | `NULL` |
| `dt_demissao` | `datetime` | `datetime` | YES | - | `NULL` |
| `num_carteira` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `pis_pasep` | `varchar` | `varchar(25)` | YES | - | `NULL` |
| `banco_id` | `char` | `char(3)` | YES | - | `NULL` |
| `agencia` | `varchar` | `varchar(5)` | YES | - | `NULL` |
| `cc` | `varchar` | `varchar(15)` | YES | - | `NULL` |
| `troca_senha` | `char` | `char(1)` | YES | - | `'N'` |
| `status` | `char` | `char(1)` | YES | - | `'S'` |
| `apag_usuario_id` | `int` | `int(11)` | YES | - | `0` |
| `participa_sug_cont` | `char` | `char(1)` | NO | - | `'N'` |
| `Impressao_Digital` | `longblob` | `longblob` | YES | - | `NULL` |
| `Atrib_impressao_digtal` | `longblob` | `longblob` | YES | - | `NULL` |
| `ticket_medio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `unid_vendidas` | `int` | `int(11)` | YES | - | `0` |
| `cli_atendidos` | `int` | `int(11)` | YES | - | `0` |
| `desc_concedido` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `pr_ticket_medio` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `pr_unid_vendidas` | `int` | `int(11)` | YES | - | `0` |
| `pr_cli_atendidos` | `int` | `int(11)` | YES | - | `0` |
| `pr_desc_concedido` | `decimal` | `decimal(11,2)` | YES | - | `0.00` |
| `cidade_id` | `int` | `int(11)` | YES | - | `NULL` |
| `usuario_fp` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `senha_fp` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `email` | `varchar` | `varchar(100)` | YES | - | `NULL` |
| `dtalteracao_senha` | `date` | `date` | YES | - | `NULL` |
| `distrito_id` | `int` | `int(11)` | YES | - | `NULL` |
| `token_multifidelidade` | `varchar` | `varchar(50)` | YES | - | `NULL` |
| `email_compra` | `varchar` | `varchar(100)` | NO | - | `''` |
| `senha_email_compra` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `host_email_compra` | `varchar` | `varchar(100)` | NO | - | `''` |
| `porta_email_compra` | `int` | `int(11)` | YES | - | `NULL` |
| `utiliza_ssl_email_compra` | `char` | `char(1)` | NO | - | `'N'` |
| `anotacoes` | `text` | `text` | YES | - | `NULL` |
| `tipo_crypt_email_compras` | `char` | `char(1)` | NO | - | `'A'` |
| `mostrar_info_tabela_entrega` | `char` | `char(1)` | NO | - | `'S'` |
| `ultima_info_tabela_entrega` | `datetime` | `datetime` | YES | - | `NULL` |
| `matricula_rh` | `varchar` | `varchar(20)` | YES | - | `NULL` |
| `DtUltimaAutenticacao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dt_aviso_senha` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dt_acesso_sem_2fa` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `qtd_caracter_senha` | `int` | `int(11)` | YES | - | `NULL` |
| `qtd_caracter_senhasuper` | `int` | `int(11)` | YES | - | `NULL` |
| `background` | `char` | `char(1)` | NO | - | `'N'` |
| `background_type` | `tinyint` | `tinyint(1)` | NO | - | `0` |
| `numero` | `varchar` | `varchar(20)` | YES | - | `NULL` |

---

## vendasperdidas

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `vendasperdidas_id` | `int` | `int(11)` | NO | PRI | `NULL (sem default)` |
| `produto_id` | `int` | `int(11)` | YES | - | `NULL` |
| `descproduto` | `varchar` | `varchar(60)` | YES | - | `NULL` |
| `data` | `datetime` | `datetime` | YES | - | `NULL` |
| `qtde` | `int` | `int(11)` | YES | - | `0` |
| `clientes_id` | `int` | `int(11)` | YES | - | `NULL` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | YES | - | `'N'` |
| `usuario_id` | `int` | `int(11)` | YES | - | `NULL` |
| `obs` | `varchar` | `varchar(250)` | YES | - | `NULL` |

---

## venda_receita

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `movment_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `medico_id` | `int` | `int(11)` | NO | - | `0` |
| `medico_endereco_id` | `int` | `int(11)` | NO | - | `0` |
| `numero` | `varchar` | `varchar(20)` | NO | - | `''` |
| `tipo` | `int` | `int(11)` | NO | - | `0` |
| `uso` | `int` | `int(11)` | NO | - | `0` |
| `data` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `qtde` | `int` | `int(11)` | NO | - | `0` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `dtalteracao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `uso_prolongado` | `char` | `char(1)` | NO | - | `''` |

---

## venda_sngpc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `movment_id` | `bigint` | `bigint(20)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `comprador_nome` | `varchar` | `varchar(100)` | NO | - | `''` |
| `comprador_doc_num` | `varchar` | `varchar(20)` | NO | - | `''` |
| `comprador_doc_orgao` | `varchar` | `varchar(20)` | NO | - | `''` |
| `comprador_doc_uf` | `char` | `char(2)` | NO | - | `''` |
| `comprador_doc_tipo` | `int` | `int(11)` | NO | - | `0` |
| `comprador_fone` | `varchar` | `varchar(20)` | NO | - | `''` |
| `dtalteracao` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `dtcadastro` | `datetime` | `datetime` | NO | - | `'0000-00-00 00:00:00'` |
| `alt_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `cad_usuario_id` | `int` | `int(11)` | NO | - | `0` |
| `lojas_leram` | `varchar` | `varchar(50)` | NO | MUL | `''` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |
| `paciente_nome` | `varchar` | `varchar(100)` | NO | - | `''` |
| `paciente_endereco` | `varchar` | `varchar(100)` | NO | - | `''` |
| `paciente_numero` | `varchar` | `varchar(10)` | NO | - | `''` |
| `paciente_bairro` | `varchar` | `varchar(60)` | NO | - | `''` |
| `paciente_cidade_id` | `int` | `int(11)` | NO | - | `0` |
| `paciente_cep` | `varchar` | `varchar(9)` | NO | - | `''` |
| `paciente_distrito_id` | `int` | `int(11)` | NO | - | `0` |
| `paciente_sexo` | `char` | `char(1)` | YES | - | `'M'` |
| `paciente_idade` | `int` | `int(11)` | YES | - | `0` |
| `comprador_endereco` | `varchar` | `varchar(53)` | NO | - | `''` |
| `comprador_numero` | `varchar` | `varchar(6)` | NO | - | `''` |
| `paciente_unidade_idade` | `int` | `int(11)` | NO | - | `1` |

---

## xml_nfe

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `xml` | `mediumtext` | `mediumtext` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |

---

## xml_nfe_canc

| Coluna | Tipo | Definição Completa | Nulo | Chave | Padrão |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `nota_fiscal_id` | `int` | `int(11)` | NO | PRI | `0` |
| `filial_id` | `int` | `int(11)` | NO | PRI | `0` |
| `xml_canc` | `mediumtext` | `mediumtext` | NO | - | `NULL (sem default)` |
| `lojas_leram` | `varchar` | `varchar(50)` | YES | MUL | `NULL` |
| `apagado` | `char` | `char(1)` | NO | - | `'N'` |


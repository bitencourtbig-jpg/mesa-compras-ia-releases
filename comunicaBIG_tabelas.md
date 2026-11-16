# Linx Farma BIG — Documentação de Tabelas por Rotina (`comunicaBIG`)

Documentação de tabelas do **Linx Farma BIG** organizadas por rotinas comuns presenciadas no RC.

Para localizar as tabelas desejadas utilize o atalho de pesquisa (`CTRL + F`) ou navegue pelos setores:
- [Passo a passo para os principais ajustes no comunicaBIG](#passo-a-passo-para-os-principais-ajustes-no-comunicabig)
- [Relatórios](#relatórios)
- [Sugestão de compras](#sugestão-de-compras)
- [Cadastros](#cadastros)
- [Notas fiscais (Operações)](#notas-fiscais-operações)
- [Gerencial / Financeiro](#gerencial--financeiro)
- [Configurações](#configurações)
- [Vendas](#vendas)

---

## Passo a passo para os principais ajustes no comunicaBIG

1. Para abrir as configurações do comunicador, aperte com o botão direito do mouse sobre o executável `comunicaBIG.exe` já aberto e, na opção **Configurações**, digite a senha.
2. Clique no meio da coluna `'Tabela'` e digite o nome da coluna que deseja identificar ou ajustar.
3. Altere para `'S'` ou para `'N'` as colunas `'Env. Matriz'` e `'Rec. Matriz'` (`"Matriz"` é simbolizada como servidor central).
4. Poderá ser definido limite de registro e prioridade nas colunas `'Limite de registros'` e `'Prioridade'`.
5. Nas colunas `'Filtros para enviar'` e `'Filtros para receber'` são utilizadas situações personalizadas ou em tabelas específicas; em casos de dúvida, acione o suporte N2.
6. **Aba Geral:** Pode ser definido o período e a quantidade de registros por ciclo de comunicação.
7. **Configurações Padrão:** Pode ser selecionado entre `Loja`, `Notebook` e `Escritório adicional`.

> **Atenção!**
> Ao alterar a configuração padrão, as configurações personalizadas anteriormente serão desfeitas; em caso de dúvidas, acionar o suporte N2.

---

## Relatórios

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Relatório Vendas em geral | `movment`, `pagamentos`, `transacao_cart_pbm`, `tipospgto`, `produto`, `grupo_preco_produto` |
| Relatório Entradas -> Entradas/Compra | `Movment`, `Entradas`, `Estoque_minimo`, `notas_fiscais`, `nota_fiscal` |
| Relatório fechamento de caixa/Conferência | `caixas`, `usuarios`, `grupo`, `pagamentos`, `movment`, `conf_caixa_loja`, `conf_caixa_loja_tipospgt` |
| Relatorios -> Alteração Preço de Venda | `usuario`, `logs`, `produto`, `grupo_preco_produto`, `grupo_preco` |
| Relatorio cestas canceladas | `orçament`, `cliente`, `empresa`, `movment` |
| Relatório de vendas entradas por cst pis/cofins | `Paf` |
| Relatórios inventario em geral | `movment`, `produto`, `inventario_novo`, `estoque_minimo`, `precosfilial` |
| Relatórios Bom dia, Supervidor | `Relbomdia`, `Relbomdia_descsuperv` |
| Relatório Lucratividade por Filial | `Movment`, `transacao_cart_pbm`, `produto`, `preco_medio_custo`, `estoque_minimo`, `precosfilial`, `fabricante`, `nota fiscal`, `nota_fiscal_item`, `sat_cfe`, `sat_cfe_item` |
| Relatorio de Vendas Perdidas | `vendasperdidas`, `clientes`, `filial` |
| Relatório recargas de celular | `recarga_redetrel`, `recarga_rv`, `recarga_rv_online`, `recarga_rv_pin`, `recarga_upaid`, `gwcel_operadora`, `gwcel_recarga` |
| Histórico recebimento Contas receber | `tipospgto`, `movment`, `receber`, `finadm`, `finadm_det` |
| Relatorio Analico de Perdas | `perda` |
| Relatorio cestas canceladas | `orçament`, `cliente`, `empresa`, `movment` |

---

## Sugestão de compras

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Remanejamento de Estoque | `remanejamento` |
| CurvaABC/Demanda | `estoque_minimo2`, `curvaabc` |
| Cotação Online | `cotacao`, `cotacao_online` |
| Filtros salvos sugestão de compra | `filtrosugcompra` |
| Restaurar Sugestão / sugestão de compra e pedidos em geral | `pedidos` |
| Pedidos Feitos | `pedidoeletronico`, `pedidos_feitos` |
| Suspensão de compra | `produtos_suspensos_compra`, `justificativa_susp_compra` |
| Ficha de estoque | `movment`, `estoque_minimo`, `estoque_posterior` |

---

## Cadastros

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Produtos e alterações de preços | `produto`, `grupo_preco`, `grupo_preco_produto`, `grupo_preco_filial` |
| Cadastro de empresa | `empresa` |
| Grupos de produtos | `grupo` |
| Cadastro de Fornecedor | `fornece` |
| Cadastro de Cliente | `clientes` |
| Barras adicionais | `barras` |
| Cadastro de CFOP | `cfop` |
| Adm de convenio | `Operadoras` |
| Unidades por caixa (Cadastro do produto) | `produto` |
| Codigo do fornecedor (Cadastro do produto) | `codnofornec` |
| Alterações de preço Venda no cadastro de produto | `produto`, `grupo_preco_produto`, `grupo_preco` |
| Alterações cadastro de usuário e grupo de usuário | `usuario`, `grupo_usuario` |
| Custo médio | `preco_medio_custo_historico` |
| Preços Filiais | `precosfilial`, `grupo_preco_produto`, `grupo_preco`, `produto` |
| Multiplas UF - Preços | `grupo_preco`, `grupo_preco_filial`, `grupo_preco_produto`, `grupo_preco_produto_logs` |
| Especificações - Cadastro Produto | `espec`, `produto` |
| Fotos do cadastro de Produto | `fotos` |
| Cadastro de Redução Z | `paf_req25_r02`, `sintegra_60m`, `paf_req25_r03`, `impressoras` |

---

## Notas fiscais (Operações)

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Transferencia | `transferencia`, `transferencia_rec` |
| Importação de xml | `nfes_importadas`, `nfe_cab_xml`, `nfe_cab_dados_adic` |
| Entrada de mercadoria / Conferência | `entradas`, `movment` |
| Configurações tributárias | `tributacao`, `tributacao_bens_ativo`, `tributacao_ncm`, `tributacao_produto` |
| Operações fiscais | `operacao_config`, `operacao_config_filial`, `operacao_config_cfop` |
| Perdas | `perda`, `movment` |
| Devolução | `notas_fiscal`, `movment`, `devolucao_forn` |
| Dome - Importação Loja - Escritório | `dome_entradas`, `dome_manifest`, `nfes_importadas`, `xml_nfe`, `xml_nfe_canc`, `nfe_cab_xml`, `nfe_cab_dados_adic` |
| ExportaXmls | **NFC-e:** `nfes_importadas`, `xml_nfe`, `xml_nfe_canc`<br>**Sat:** `sat_cfe_xml_canc`, `sat_cfe`, `sat_cfe_item`, `sat_cfe_xml`, `nfes_importadas`, `xml_nfe`, `xml_nfe_canc` |

---

## Gerencial / Financeiro

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Comissões do funcionarios / Tabela de comissões | `perfil_comissao`, `perfil_comissao_log`, `perfil_comissao_grupo`, `perfil_comissao_grupo_log`, `perfil_comissao_produtos`, `perfil_comissao_produto_log`, `perfil_comissao_usuarios`, `perfil_usuario` |
| Premiação por Produtividade | `movment`, `produto`, `grupo`, `grupo_usuario` |
| Administração de produtos controlados | `filial`, `logs`, `perda`, `produto`, `grupo`, `nota_fiscal`, `nota_fiscal_item`, `lote_saida`, `usuario`, `lote_venda`, `lote_logs`, `medico`, `medico_enderecos`, `medico_especialidade` *(Somente Env. Matriz)*, `venda_receita`, `venda_sngpc`, `principio_ativo`, `fornece`, `transferencia`, `transferencia_rec`, `inventario`, `inventario_historico`, `inventario_novo` *(Somente Env. Matriz)*, `entradas` |
| Sped | `Remessa_conserto`, `demais_docs`, `deprecicao_amortizacao`, `empresa`, `estoque_abertura`, `estoque_minimo`, `filial`, `fornece`, `impressoras` e `impressora_totalizador` *(Somente Env. Matriz)*, `movment`, `nota_fiscal`, `nota_fiscalcfref`, `nota_fiscal_item`, `nota_fiscal_nfref`, `config_efd_reg1600`, `paf` *(Somente Env. Matriz)*, `pagar`, `preco_medio_custo_historico`, `produto`, `saldo_credito_pis_cofins`, `sintegra`, `totalfisc` |
| Baixas receber no financeiro | `receber`, `movment`, `baixa_adm_det_rec`, `baixa_adm` |
| Contas a pagar | `pagar` |
| Conferencia/fechamento de caixa | `conf_caixa_loja`, `conf_caixa_loja_tipospgto`, `baixa_adm`, `baixa_adm_det`, `pagamentos`, `caixas` |
| Conferencia de Credenciadora de cartões | `transacao pbm`, `transação cart pbm` |
| Movimentações de cartão | `cartao`, `config_cart_pbm`, `cartoesfilial`, `transacao_cart_pbm`, `prefinadm_cart`, `nota_fiscal_pgtos_cartao`, `operadora_cartao`, `credenc_cart` |
| Credenciadora de cartão | Todas as tabelas que começam com `"Credenc"` |
| Conciliação de cartão | `conciliacao_ajustes`, `conciliacao_antecipacao_lote`, `conciliacao_financeiro`, `conciliacao_financeiro_logs`, `conciliacao_lote_venda`, `conciliacao_lote_parc_paga`, `conciliacao_terminais`, `conciliacao_trans_parcela`, `conciliacao_transacoes`, `transacao_cart_pbm`, `transacao_cart_pbm_log`, `transacao_cart_pbm_parc`, `transacao_config_cart`, `transacao_config_pbm`, `transacao_pbm_cancel`, `transacao_pbm`, `transacao_pbm_reposicao`, `transacao_pbm_desconto_item`, `transacao_tef` |
| Conciliação QR Linx | `conciliacao_qrlinx`, `conciliacao_qrlinx_log`, `filial_config_qrlinx`, `qrlinx_transacao` *(Conforme necessidade, habilitar todas que iniciam com `'qrlinx_'`)* |
| Plano de Contas | `movment`, `planocontas`, `filial`, `logs` |

---

## Configurações

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Configurações em geral | `filial`, `logs` |
| Certificado digital | `filial_cert` |
| Financeiro | `finadm`, `finadm_det`, `filial_financeiro_ofx` |
| Notebook | `entradas`, `movment`, `pagamentos`, `pagar` *(usar filtro `filial_id <> :codfilial` para receber)* \| `estoque_minimo` *(usar filtro `filial_id = :codfilial` para enviar)* |

---

## Vendas

| Funções | Tabelas para comunicação |
| :--- | :--- |
| Entregas | `orcament`, `pagamentos`, `movment`, `cesta_entregas`, `rotas`, `taxa_valor_rota`, `rotas`, `tipospgto`, `entregas`, `entrega_valor_escalar`, `entrega_saida`, `enderecos`, `cidade` |
| cestas > canceladas/ cancelamentos | `cancelament_moviment` |
| Tabela de descontos | `tabela_desconto` |
| Kit Combo promocional | `kit_promo` |
| Tabloide | `tabloide`, `tabloide_filial`, `tabloide_grupo`, `tabloide_produto` |

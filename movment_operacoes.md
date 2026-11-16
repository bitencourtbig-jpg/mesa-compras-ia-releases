# Linx Farma BIG — Dicionário do Campo `movment.oper` e `movment.E_S`

Mapeamento oficial das operações registradas na tabela `movment` (obtido junto à base real de cliente).

## Dicionário de Operações (`oper`)

| `oper` | Descrição | `E_S` | Relevância para Compras / Estoque / Demanda |
| :---: | :--- | :---: | :--- |
| `1` | Entrada | `E` | Entrada de mercadoria / compra (compõe histórico de compras e lead time) |
| `2` | Venda a Vista | `S` | **Venda efetiva** (compõe demanda de venda) |
| `3` | Venda a Prazo | `S` | **Venda efetiva** (compõe demanda de venda) |
| `4` | Despesas | `S` | Financeiro (ignorar em cálculo de giro de produto) |
| `5` | Perdas | `S` | Quebra/perda de estoque (monitorar à parte; não é demanda comercial) |
| `6` | Inventário | `E` / `S` | Ajuste de contagem de estoque (não é venda nem compra) |
| `7` | Devolução de Mercadorias | `E` | Devolução de cliente (reduz venda líquida se aplicável) |
| `8` | Sangria / Suprimentos | `E` / `S` | Movimentação de caixa (ignorar em estoque/demanda) |
| `9` | Baixa de Contas a Receber | `S` / `""` | Financeiro (ignorar em estoque/demanda) |
| `10` | Transferências / Recebimento de Transferências | `S` / `E` | Saída/entrada entre filiais (importante filtrar quando analisar demanda da loja vs. transferência entre lojas!) |
| `11` | Recebimento de Transferências Recusadas | `E` | Retorno de transferência recusada |
| `12` | Entrega Pendente | `S` | Movimentação vinculada a entrega pendente |
| `13` | Devolução de Fornecedor | `S` | Devolução ao fornecedor |
| `14` | Sangria Convênio | `S` | Financeiro/convênio (ignorar em estoque/demanda) |
| `15` | Acerto de Estoque pela Entrada | `E` / `S` | Ajuste na entrada |
| `16` | Venda Temporária Loja Virtual | `S` | Venda temporária e-commerce |
| `17` | Troca / Devolução de Pontos por Prêmios | `S` / `E` | Programa de fidelidade |
| `18` | Outras Operações Produto | `E` / `S` | Outras movimentações manuais/específicas |

---

## Amostra Observada na Base Analisada (`apagado = 'N' AND cancelado = 'N'`)

Período observado: `2022-06-20 15:18:07` até `2026-10-29 23:04:12`

| `E_S` | `oper` | Quantidade de Registros | Início | Fim |
| :---: | :---: | :---: | :--- | :--- |
| `""` | `9` | 397.126 | `2022-06-23 12:27:49` | `2026-10-29 16:51:23` |
| `E` | `0` | 1 | `2023-01-10 05:00:00` | `2023-01-10 05:00:00` |
| `E` | `1` | 582.844 | `2022-06-20 15:18:07` | `2026-10-29 18:04:15` |
| `E` | `2` | 1 | `2024-01-09 17:00:42` | `2024-01-09 17:00:42` |
| `E` | `6` | 38.211 | `2022-06-24 15:49:38` | `2026-10-29 17:22:33` |
| `E` | `8` | 26.580 | `2022-06-21 13:08:30` | `2026-10-29 22:05:51` |
| `E` | `10` | 46.688 | `2022-06-24 11:39:21` | `2026-10-29 19:51:39` |
| `E` | `15` | 4.421 | `2022-06-25 16:05:51` | `2026-10-23 07:51:37` |
| `S` | `2` | 6.784.132 | `2022-06-21 13:38:11` | `2026-10-29 22:33:43` |
| `S` | `3` | 387.442 | `2022-06-22 08:53:14` | `2026-10-29 21:48:27` |
| `S` | `4` | 2 | `2024-10-07 14:30:00` | `2024-10-07 14:36:05` |
| `S` | `5` | 15.261 | `2022-06-23 15:17:41` | `2026-10-29 14:53:21` |
| `S` | `6` | 9.241 | `2022-06-22 16:57:10` | `2026-10-29 12:10:51` |
| `S` | `8` | 86.893 | `2022-06-21 13:15:52` | `2026-10-29 23:04:12` |
| `S` | `10` | 46.813 | `2022-06-22 17:49:08` | `2026-10-29 20:27:19` |
| `S` | `13` | 2.419 | `2022-06-30 13:25:26` | `2026-10-29 13:47:21` |
| `S` | `15` | 2.089 | `2022-06-28 17:34:41` | `2026-10-23 07:51:37` |
| `S` | `18` | 16 | `2022-07-22 15:53:04` | `2025-02-26 13:59:23` |

### Pontos de Atenção na Análise de Dados
1. **Vendas puras:** filtrar sempre `E_S = 'S' AND oper IN (2, 3) AND apagado = 'N' AND cancelado = 'N'`. (Há 1 registro anômalo com `E_S = 'E' AND oper = 2`, por isso exigir `E_S = 'S'` evita ruído).
2. **Transferências (`oper = 10`):** quase **46.813 saídas** e **46.688 entradas**! Em redes multi-loja, nunca misturar `oper = 10` como venda ao calcular demanda de loja — mas vale analisar separadamente para identificar lojas distribuidoras/CD ou padrão de remanejamento.
3. **Volume da tabela `movment`:** são ~7,8 milhões de linhas ativas em ~4 anos. Para consultas analíticas rápidas, usar sempre índices em `data_hora`, `produto_id` e `filial_id`, evitando *full table scan*.


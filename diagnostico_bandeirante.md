# Diagnóstico Real do Banco `bandeirante` (Linx Farma BIG)

Gerado por leitura direta no banco `10.4.13-MariaDB-log` (`127.0.0.1` / `bandeirante`) em modo **somente leitura**.

---

## 1. Estrutura Real das Filiais e Dados Encontrados

| Filial | Nome | Curva ABC / Lote | Regra A (`min/max`) | Última Venda (`movment` 2/3) | Última Entrada (`entradas`) | Observação |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| `1` | `ESCRITORIO` | — | `3 / 12` | *(sem vendas)* | *(sem entradas)* | Central administrativa (`filtrosugcompra` salvo aqui; `1` pedido antigo em `2022-08-31`) |
| `2` | `DROGARIA APRESENTACAO` | `/2890` | `3 / 12` | `2026-10-29 22:33:43` | `2026-10-28` | Loja ativa principal (`5.971.734` linhas de venda; também transfere para filial `3` via `oper = 10`) |
| `3` | `DROGARIA APRESENTACAO` | `/990` | `7 / 10` *(em `estoque_minimo2`)* | `2025-01-22 22:08:45` | `2025-01-21` | Backup sem vendas/entradas após jan/2025, porém recebe transferências `oper = 10` da filial `2` |

### Outras descobertas críticas de arquitetura no banco
- **`grupo` zerado em 100% dos grupos:** `0` registros com `minA..maxD > 0` ou `rep_subst <> 'N'`. Toda a parametrização vem da tabela `filial`.
- **Tabelas nativas do módulo de compras descobertas no schema real:**
  - `config_sugcompra` (`4` linhas): `prc_sugcompra = 'PE'` (filiais `1..3`), `atualizar_dados_diario = 'N'`, alerta de produto parado `30 / 60 / 90 / 120` dias (A/B/C/D).
  - `sugcompra_movment` (`1,60M` linhas na filial `2`, janela `2025-10-04` a `2026-10-29`): tabela intermediária de cálculo da sugestão.
  - `pedidos` é a tabela real de pedidos (`14.859` itens / `82` pedidos na filial `2` entre `2025-06-17` e `2026-10-21`), e não `pedidos_feitos` (`0` linhas). **Ponto de atenção:** todos os `14.859` itens constam com `recebido = 'N' AND falta = 'N'` (o pedido em aberto não está sendo baixado na entrada).
  - `fabricantes` (`2.592`), `codnofornec` (`5.091`), `qtde_cx_forn` (`121`), `filial_config_remanejamento` (`3`), `sugestao_compras_080323` (`313` snapshots completos da tela de sugestão).
- **Cuidado crítico com custo unitário vs. caixa (`qt_fr`):**
  - Em itens fracionados, `produto.preco_cmp` pode guardar o valor da caixa (ex.: `DORFLEX 10 CPR`, `qt_fr = 30`, `preco_cmp = R$ 154,50`), enquanto `preco_medio_custo.pmc_atual` (`R$ 5,599`) já está normalizado **por unidade** (`quanti_uni`).

---

## 2. Raio-X da Saúde de Estoque — Filial `2`

*(SKUs ativos e não-apagados com estoque `<> 0` ou `demanda > 0`; custo calculado via `pmc_atual`, fallback `preco_cmp`)*

| Curva | Total SKUs | Em Ruptura (`<= 0` c/ giro) | Abaixo do Mínimo | Acima do Máximo | Parados (`demanda = 0`) | Capital Total (R\$) | Capital Excedente > Máx (R\$) | Capital Parado `demanda = 0` (R\$) |
| :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **A** | `2.884` | `170` | `33` | `2.416` | `0` | `2.904.330,43` | `2.318.688,00` | `0,00` |
| **B** | `4.294` | `467` | `185` | `3.323` | `0` | `1.208.641,69` | `918.554,51` | `0,00` |
| **C** | `7.022` | `1.098` | `26` | `3.106` | `0` | `1.007.979,63` | `513.814,12` | `0,00` |
| **D** | `8.461` | `507` | `0` | `0` | `6.315` | `911.494,02` | `0,00` | `692.650,93` |
| **Sem Curva** | `44` | `0` | `0` | `0` | `39` | `7.386,93` | `0,00` | `6.995,09` |

### Principais distorções encontradas na prática
1. **Superestoque concentrado na Curva A e B + Ruptura simultânea:**
   - Exemplos reais de excesso em estoque na filial `2`: `NEOSIL ATTACK` (`808` un vs máx `94` = `R$ 166.087,63`), `DORFLEX 10 CPR` (`14.558` un vs máx `637` = `R$ 81.510,24`), `RESFENOL C/20` (`6.093` un vs máx `190` = `R$ 46.635,82`), `NEOSORO 30ML` (`7.945` un vs máx `572` = `R$ 32.558,61`) e itens de brinde/amostra como `PROVADOR MERCEDES (REVIS)` (`7.711` un paradas, Curva D = `R$ 22.477,57`).
   - Ao mesmo tempo, **`170` SKUs Curva A estão zerados/negativos**, como `GLYXAMBI 25/5MG` (estoque `-1`, demanda `1,016/dia`, ~`R$ 458/dia` em venda), `FASCIA 30 SACHÊS` (estoque `0`, ~`R$ 386/dia`), `NESINA PIO` (estoque `-3`, ~`R$ 251/dia`), `AMMY` (estoque `-1`, ~`R$ 194/dia`) e `INILOK 40MG` (estoque `0`, ~`R$ 168/dia`).
2. **Ruptura invisível em `vendasperdidas` vs. `estoque_posterior`:**
   - `vendasperdidas` tem apenas **`8` registros desde jan/2025** (equipe não aponta manualmente no PDV).
   - Cruzando `estoque_posterior` (`4,1M` registros na filial `2`) nos últimos 91 dias (`2026-07-29` a `2026-10-27`), **`620` dos `2.890` SKUs de Curva A** ficaram zerados em pelo menos 1 dia (média de `1,4` dia zerado entre os que zeraram).
3. **Bloqueios ativos e Lead Time mensurável:**
   - `205` produtos com compra suspensa vigente na filial `2` (`produtos_suspensos_compra`).
   - É possível calcular o *Lead Time* real cruzando `pedidos` × `entradas`: ex. `DICOPAR` (`35/36` itens atendidos, média `6,0` dias) e `HERBAMED` (`19/21`, média `12,4` dias, máx `44` dias).


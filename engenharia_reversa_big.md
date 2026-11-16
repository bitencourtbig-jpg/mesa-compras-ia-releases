# Engenharia Reversa — Motor de Estoque Mínimo, Máximo, Demanda e Curva ABC (Linx Farma BIG)

Documento vivo com as regras comprovadas na base real do cliente.

---

## 1. Descobertas Comprovadas na Amostra (Item 2 + Item 3)

### 1.1 Fórmula de `estoque_minimo2.minimo` e `estoque_minimo2.maximo`
Confirmado matematicamente em todos os 30 registros analisados (Curva A):

$$\text{minimo} = \text{ROUND}(\text{demanda} \times \text{dias\_min})$$
$$\text{maximo} = \text{ROUND}(\text{demanda} \times \text{dias\_max})$$

- **Lote `/2890`** (25 produtos da amostra, ex.: `133251`, `9963`, `142831`, `111580`):
  - Usou exatamente **`dias_min = 3`** e **`dias_max = 12`** (`filial.minA = 3`, `filial.maxA = 12`).
  - Ex.: `RESFENOL` (`9963`): `demanda = 15,841` -> `15,841 × 3 = 47,523 ≈ 48` (`minimo`) e `15,841 × 12 = 190,092 ≈ 190` (`maximo`).
  - Ex.: `ISOSOURCE` (`142831`): `demanda = 2,194` -> `2,194 × 3 = 6,582 ≈ 7` (`minimo`) e `2,194 × 12 = 26,328 ≈ 26` (`maximo`).
- **Lote `/990`** (5 produtos da amostra: `16796`, `122411`, `15855`, `31448`, `61191`):
  - Usou exatamente **`dias_min = 7`** e **`dias_max = 10`**.
  - Ex.: `NEOSORO` (`16796`): `demanda = 11,027` -> `11,027 × 7 = 77,189 ≈ 77` (`minimo`) e `11,027 × 10 = 110,27 ≈ 110` (`maximo`).
  - *Observação:* Tanto `16796` (`/990`, `7/10`) quanto `9963` (`/2890`, `3/12`) pertencem ao mesmo `grupo_id = 67002`. Isso indica que a diferença entre `/990` e `/2890` vem de **`filial_id` distintos** (provavelmente uma filial cujo cálculo rodou antes da alteração dos parâmetros `minA/maxA` ou com regra própria na época).

### 1.2 Papel do `desviopadrao`
- Em `filial`, todas as lojas ativas estão com `desviopadrao = 'N'`, `arred_desvio = 'S'`.
- Mesmo quando `estoque_minimo2.desviopadrao` tem valor alto (ex.: `ISOSOURCE` com `desviopadrao = 6.000000000` ou `SABONETE NIVEA` com `3.000000000`), **ele não foi somado** ao `minimo` nem ao `maximo`.
- Ou seja: o campo `estoque_minimo2.desviopadrao` continua sendo calculado/gravado, mas só entra na fórmula quando a flag de desvio padrão está habilitada.

### 1.3 `estoque_minimo` (legado) vs. `estoque_minimo2` (motor atual)
- `estoque_minimo.minimo` (`min_tab1`) está defasado/divergente do cálculo atual (ex.: `0` para `ISOSOURCE`, `15` para `RESFENOL`, `31` para `NEOSORO`).
- `estoque_minimo.estoque` guarda o **saldo atual em estoque**, enquanto `estoque_minimo2` guarda os **parâmetros calculados de reposição** (`demanda`, `desviopadrao`, `minimo`, `maximo`, `maximo_abs`, `faceamento`).

### 1.4 Formato de `curvaabc` e `curvaabc_est`
- `curvaabc`: segue o padrão `"<Curva> <Posição>/<Total_na_Curva>"` (ex.: `"A 1/2890"`, `"A 10/990"`).
- `curvaabc_est`: segue padrão semelhante (`"A 00854/9138"`, `"C 13051/1304"`, `"D"`).
- Note-se um caso extremo na amostra: produto `133251` (`"TAXA DE ENTREGA"`, `grupo_id = 2`) apareceu como `"A 1/2890"` com `demanda = 237,187` (`minimo = 712`, `maximo = 2846`). Em um novo motor de compras, itens de serviço/taxa precisam ser filtrados ou marcados como não compráveis.

---

## 2. Descobertas das Curvas B, C e D, Grupos e Divisor da Demanda

### 2.1 Precedência `grupo` vs. `filial`
- Na amostra da tabela `grupo` (`grupo_id` 1 a 55), **todos os grupos estão com `minA..maxD = 0`** (e `desvio_padrao = 'S'`, `rep_subst = 'N'`).
- Quando o grupo está zerado (`0`), o sistema aplica os parâmetros da **`filial`** (`minA=3, maxA=12, minB=13, maxB=15, minC=16, maxC=20, minD=0, maxD=0`).
- Todos os itens testados nas Curvas **B**, **C** e **D** bateram exatamente com `ROUND(demanda × dias)` usando os parâmetros da `filial`:
  - **Curva B (`13 / 15` dias):**
    - `15` (`0,233`): `0,233 × 13 = 3,029 ≈ 3` | `0,233 × 15 = 3,495 ≈ 3`
    - `30` (`0,258`): `0,258 × 13 = 3,354 ≈ 3` | `0,258 × 15 = 3,870 ≈ 4`
    - `58` (`0,112`): `0,112 × 13 = 1,456 ≈ 1` | `0,112 × 15 = 1,680 ≈ 2`
    - `60` (`0,165` na filial 2): `0,165 × 13 = 2,145 ≈ 2` | `0,165 × 15 = 2,475 ≈ 2`
    - `60` (`0,033` na filial 3): `0,033 × 13 = 0,429 ≈ 0` | `0,033 × 15 = 0,495 ≈ 0`
  - **Curva C (`16 / 20` dias):**
    - `9` (`0,033`): `0,033 × 16 = 0,528 ≈ 1` | `0,033 × 20 = 0,660 ≈ 1`
    - `79` (`0,088`): `0,088 × 16 = 1,408 ≈ 1` | `0,088 × 20 = 1,760 ≈ 2`
    - `79` (`0,022` na filial 3): `0,022 × 16 = 0,352 ≈ 0` | `0,022 × 20 = 0,440 ≈ 0`
  - **Curva D (`0 / 0` dias):**
    - Todos com `demanda = 0,000`, `minimo = 0`, `maximo = 0`.

### 2.2 Distorção detectada na parametrização atual
- Por causa do `ROUND()`, um item **Curva B** com `demanda = 0,033` (`~1 un/mês`) fica com `minimo = 0, maximo = 0` (`0,033 × 15 = 0,495`), enquanto um item **Curva C** com a mesma `demanda = 0,033` ganha `minimo = 1, maximo = 1` (`0,033 × 16 = 0,528`).
- Além disso, a configuração da filial (`A: 3-12d`, `B: 13-15d`, `C: 16-20d`) com `desviopadrao = 'N'` mantém cobertura mínima muito curta na Curva A (risco de ruptura se o fornecedor atrasar >3 dias) e cobertura alta na Curva C (capital imobilizado).

### 2.3 Evidência do divisor exato de `demanda`: `91` dias e exclusão de transferências
- Sete produtos distintos das Curvas B e C apresentaram valores exatos da série `N / 91` arredondados para 3 casas decimais:
  - `1/91 = 0,011`, `2/91 = 0,022`, `3/91 = 0,033`, `4/91 = 0,044`, `8/91 = 0,088`, `9/91 = 0,099`, `15/91 = 0,165`.
  - *(Com divisor `90`, `8/90 = 0,089`, `9/90 = 0,100` e `15/90 = 0,167`; com divisor `92`, `4/92 = 0,043`, `8/92 = 0,087`, `9/92 = 0,098`, `15/92 = 0,163` — nenhum outro inteiro além de `91` reproduz os 7 valores simultaneamente).*
- **Prova de que transferências (`oper = 10`) NÃO entram na `demanda`:**
  - Em `filial_id = 2`, a apuração de 92 dias com venda trouxe para `9963` (`RESFENOL`): `dias_91 = 2112` e `transf_saida = 616`, resultando em **`1496` vendas líquidas de balcão** (`2112 - 616`), contra `1480` em 90 dias (`2026-07-30` a `2026-10-28`). A `demanda` gravada em `estoque_minimo2` é `15,841` (`15,841 × 91 ≈ 1441,5`), compatível com vendas de balcão sem transferências — e compatível com corte até `2026-10-27 23:59:59`, já que `filial.calcdemanda` rodou em `2026-10-28 00:12:34`.
- **Confirmação de múltiplas filiais na amostra inicial (`16796`):**
  - Na `filial_id = 2`, `16796` (`NEOSORO`) somou `dias_91 = 6182` com `transf_saida = 1800` (**`4382` vendas líquidas**, ~`48/dia`). Já o registro de `16796` da amostra anterior (`curvaabc = "A 1/990"`, `demanda = 11,027`, regra `7/10`) pertence a **outra filial** da base.

---

## 3. Fluxo Real do Comprador (`filtrosugcompra`)

Amostra dos 5 filtros ativos em `filtrosugcompra` (`filial_id = 1`, Escritório Central):

| ID | Nome do Filtro | `tipofiltro` | Gatilho | `diasperiodo` | `meses_analise` | Escopo | `filialis` |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| `8` | `pedido etico novo` | `1` | `< MIN` | `1` | `4` | Lista de `grupos` (32 IDs) | `2` |
| `12` | `similar atualizado` | `1` | `< MIN` | `31` | `4` | Lista de `fabric` (38 IDs) | `2` |
| `13` | `pedido farmoquimica ol` | `1` | `< MIN` | `50` | `4` | Lista de `fabric` (9 IDs) | `2` |
| `14` | `PEDIDO CAPILAR IMPORTADOS` | `0` | `< MIN` | `0` | `4` | Lista de `fabric` (13 IDs) | `2` |
| `15` | `relatorio hypera` | `1` | `< MIN` | `39` | `4` | Lista de `fabric` (23 IDs) | *(vazio)* |

### Padrões identificados na rotina atual
- **Compra centralizada na filial administrativa:** Em redes multi-loja, os pedidos são concentrados na filial administrativa — em ~90% dos clientes o `filial_id = 1` (`nome = 'ESCRITORIO'`), onde estão gravados os filtros de compra (`filtrosugcompra.filial_id = 1`).
- **Gatilho único:** Todos usam `condicaominimo = '<'`, `condicaominimo2 = '<'`, `min_ou_max = 'MIN'`, `marcapendente = 'S'`, `diasa..diasd = 0` e `consultar_melhor_forn_compra = 'N'`.
- **Segmentação manual:** O comprador cria filtros estáticos com dezenas de `fabric` ou `grupos` hardcoded para conseguir analisar por laboratório/categoria (ex.: Hypera, Farmoquímica OL, Similares, Capilar Importados).
- **Transferência e PBM fora do filtro:** `incluir_transf = 'N'`, `incluir_transferencia = 'N'`, `pbm = 'N'`, `pbm_venda = 'N'`.
- **Janela do filtro:** `meses_analise = 4` em todos os filtros, variando `diasperiodo` (`0`, `1`, `31`, `39`, `50`) conforme o ciclo de compra daquela cesta de fabricantes.

---

## 4. Como Projetar o Novo Motor de Compras (Fora do ERP)

Com base na estrutura real do banco (`movment`, `estoque_minimo`, `estoque_minimo2`, `estoque_posterior`, `curvaabc`, `grupo`, `produto`, `precosfilial`, `preco_medio_custo`, `entradas`, `pedidos_feitos`, `produtos_suspensos_compra`, `remanejamento`, `cotacao`, `vendasperdidas`), a nova plataforma conectada ao banco pode substituir o fluxo antigo do ERP com **5 pilares estratégicos**:

1. **Demanda Real Ajustada (Fim da "Espiral da Ruptura")**
   - Em vez de dividir vendas por `91` dias corridos cegamente, usar `estoque_posterior` + `movment` (`E_S = 'S' AND oper IN (2, 3)`) para apurar os **dias em que o item teve `estoque > 0`** e somar `vendasperdidas`.
   - Separar obrigatoriamente vendas de balcão (`oper IN (2, 3)`) de transferências (`oper = 10`), excluindo serviços/taxas (ex.: `TAXA DE ENTREGA`, `grupo_id = 15` ou itens não compráveis).
2. **Mínimo, Máximo e Ponto de Pedido Estatístico (Superando o `ROUND` do BIG)**
   - Corrigir a distorção onde item Curva B (`0,033/dia`) zera e Curva C (`0,033/dia`) gera compra, usando cobertura coerente com giro e margem: ex. **A** (alta proteção + revisão frequente), **B** (equilíbrio), **C** (baixo imobilizado / sob demanda ou `CEIL` mínimo apenas se margem justificar), **D** (sem reposição automática / sob encomenda).
   - Ativar **Estoque de Segurança real** combinando a variabilidade da demanda (`desviopadrao` real) com o **Lead Time real de cada fornecedor** calculado pelo histórico `pedidos_feitos.data_hora` → `entradas.hr_fecha_entrada` / `datanota`.
3. **Necessidade Líquida Real (Sem Compra Duplicada)**
   - Fórmula sugerida por SKU/Filial:
     $$\text{Necessidade} = \text{Estoque Alvo (Máximo)} - \big(\text{estoque} - \text{estoque\_reserva} + \text{Pedidos em Trânsito}\big)$$
   - Respeitar `produtos_suspensos_compra` (bloqueios ativos por data) e múltiplo de caixa/apresentação (`produto.qt_fr`, `produto.qtde_apres`, `barras.qtde_cx`).
4. **Compra Centralizada no Escritório + Inteligência Multi-Loja (`remanejamento`)**
   - Como em ~90% das redes multi-loja a compra é emitida pela filial administrativa (`ESCRITORIO`, em geral `filial_id = 1`, configurável por cliente), o motor deve separar **quem compra/recebe (`filial_compra`)** de **quem vende na ponta (`filiais_venda`)**:
     - **Demanda consolidada pela ponta (`Sell-Out`):** Somar `E_S = 'S' AND oper IN (2, 3)` apenas nas lojas de venda, **sem somar `oper = 10`**, evitando dupla contagem (transferência da matriz/hub + venda na loja) e evitando "cegueira" no `ESCRITORIO` (que não tem venda de balcão).
     - **Estoque e Trânsito da Rede:** Abater o saldo físico de todas as lojas **+ saldo do `ESCRITORIO`/CD + pedidos em trânsito** da necessidade total consolidada.
     - **Remanejamento antes da compra e rateio:** Antes de comprar no fornecedor para uma loja em ruptura, sugerir transferência de lojas/CD com excesso acima do `maximo`; quando houver compra centralizada no `ESCRITORIO`, gerar já a sugestão de **rateio/distribuição por loja** (`remanejamento`).
5. **Visão Estratégica do Comprador (Fora do ERP)**
   - Agrupamento dinâmico por **Laboratório/Fabricante (`produto.labora` / `produto.fabricantes_id`)**, **Grupo (`grupo`)**, **Princípio Ativo (`principio_ativo`)** e **Curva (Giro × Margem)** — eliminando listas manuais engessadas em `filtrosugcompra`.
   - Comparativo na mesma linha de: **Custo Médio (`preco_medio_custo.pmc_atual`)**, **Última Entrada (`entradas.custo_item` / `preco_ult_ent`)**, **Preço de Venda (`precosfilial.preco`)**, **Margem Bruta %**, **Últimas Cotações (`cotacao`)** e **Cobertura atual em dias**.

---

## 5. Engenharia Reversa da Sequência Oficial `numlanc` e da Tabela `pedidos`

### 5.1 Descoberta do Gerador Central do Linx BIG: A Tabela `nlanc`
Uma auditoria comparativa entre `movment`, `pedidos`, `entradas` e tabelas de controle revelou como o Linx Farma BIG gera o identificador de lote/transação (`numlanc`):
1. **O que é o `numlanc`:** É o identificador numérico sequencial único compartilhado por mais de 70 tabelas transacionais do ERP (`movment`, `pedidos`, `entradas`, `orcament`, `caixa`, `pedeletronico`, etc.);
2. **O Gerador Oficial (`nlanc`):** 
   - A tabela `nlanc` possui uma única coluna: `nlanc_id bigint(20) auto_increment PRIMARY KEY`;
   - Quando qualquer tela do Linx BIG abre uma transação, cupom de venda ou lote de pedidos, ela executa:
     `INSERT INTO nlanc () VALUES ()`
     e consome o `LAST_INSERT_ID()`;
   - **Comprovação matemática na base real:**
     - `nlanc.max_nlanc_id = 50576269`
     - `movment.max_numlanc = 50576269`
     - Os dois números coincidem exatamente dígito por dígito.
3. **Por que NÃO usar `MAX(numlanc) FROM pedidos + 1`:**
   - Em `pedidos`, o último lote gerado pelo ERP tinha sido `50552960` em 21/outubro.
   - Enquanto isso, as vendas de balcão na loja continuaram acontecendo em `movment` até `50576269`.
   - Se o motor gerasse `50552960 + 1 = 50552961`, criaria um lote com numeração defasada em mais de 23.000 lançamentos em relação ao relógio transacional atual da loja, colidindo com números de vendas já fechadas;
   - Ao executar `INSERT INTO nlanc () VALUES ()`, o motor avança o contador oficial do próprio Linx BIG (gerando ex.: `50576270`), tornando o lote **100% legítimo, sequencial e auditável** para o suporte da Linx.

### 5.2 Critérios e Campos Nativos da Tabela `pedidos`
Auditamos um lote real gerado pela interface do Linx BIG (`numlanc = 50552960`, 86 itens) para mapear todas as colunas que o ERP preenche:

| Coluna | Valor Gravado pelo ERP | Regra / Significado no Linx BIG |
| :--- | :--- | :--- |
| `filial_id` | `2` | ID da loja compradora |
| `dafilial_id` | `2` | Filial de origem do pedido |
| `nfilial` | `'DROGARIA APRESENTACAO'` | Nome fantasia da filial |
| `produto_id` | `112315` | Código interno do produto no BIG |
| `pedir` | `26` | Quantidade aprovada para pedir |
| `pedir_sugerido`| `26` | Quantidade original sugerida |
| `datahora` | `2026-10-21 09:42:19` | Carimbo de data e hora do pedido |
| `numlanc` | `50552960` | Código da sessão gerado via `nlanc` |
| `marcado` | `'N'` | Flag de seleção da linha (`'N'` por padrão) |
| `barras` | `'7899706145510'` | Código EAN-13 |
| `lojas_leram` | `'0'` | Flag de replicação da matriz/filial |
| `apagado` | `'N'` | Flag de exclusão lógica |
| `descricao` | `'ÁGUA MICELAR...'` | Descrição do produto |
| `preco_cmp_un` | `18.83` | Custo unitário da última entrada |
| `preco_vnd` | `29.55` | Preço de venda atual |
| `preco_pro` | `24.90` | Preço promocional/convênio |
| `labora` | `'LOREAL PARIS'` | Fabricante / Laboratório |
| `estoque` | `1` | Estoque físico no momento do fechamento |
| `mediavenda` | `0.00` | Média de venda do BIG |
| `dgrupo` | `'DERMOCOSMÉTICOS'` | Categoria / Macro-grupo |
| `gp` | `72002` | `produto.grupo_id` |
| `ep` | `165002` | `produto.espec_id` |
| `comprar` | `'SANTA CRUZ'` / fornecedor | Fornecedor cotado ou `'NAO IDENTIFICADO'` |
| `fornece_id` | `10` / `0` | ID do fornecedor |
| `comprarfornece_id` | `10` / `0` | ID do fornecedor para compra |
| `cotacao_fornece_id` | `10` / `0` | ID do fornecedor cotado |
| `cotacao_fornece_nome` | Razão Social | Nome do fornecedor cotado |
| `desconto` | `0.00` | Percentual de desconto negociado |
| `recebido` | `'N'` | Pedido ainda em aberto (não recebido) |
| `falta` | `'N'` | Flag de corte da distribuidora |
| `fabricantes_id` | `351` | `produto.fabricantes_id` |
| `minimo` | `0` | Mínimo registrado |
| `cotacao_online` | `'N'` ou `'S'` | Flag de cotação eletrônica |
| `demanda` | `0.044` | Demanda diária calculada (DDV) |
| `demandames` | `1.32` | Demanda mensal projetada |
| `valid_pro` | `'2099-12-31'` | Data de validade padrão Linx BIG |
| `obs` | Texto do lote | Observação com rastreabilidade do lote |

Ao respeitar essa assinatura de 35+ campos, o registro fica **100% compatível e indistinguível** de uma cotação feita dentro da própria tela nativa do Linx BIG.



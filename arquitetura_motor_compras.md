# Arquitetura do Novo Motor de Compras — Melhores Práticas Farma (Fora do ERP)

Documento de referência técnica e comercial para substituir a configuração manual de Curvas/Grupos do Linx Farma BIG por um motor automatizado, assertivo e preparado para multi-loja, sazonalidade e **Compra de Molécula**.

---

## 1. Curva ABC×D + Matriz XYZ (Superando o Pareto Cego)

Na rotina atual do `bandeirante`, observamos que `curvaabc` ficou dividida por faixa fixa de SKUs (`20% / 30% / 50%` na filial `2`), mantendo `R$ 154 mil` de vendas em 91 dias dentro da Curva D e parametrizando a filial inteira com cobertura estática (`A: 3-12d`, `B: 13-15d`, `C: 16-20d`, `desviopadrao = 'N'`).

### Padrão recomendado de mercado
1. **Eixo ABC Econômico (Pareto Real sobre Lucro Bruto + Faturamento):**
   - Ranquear os SKUs com movimento na janela (ex.: 90 dias ou 12 meses ponderados):
     - **Curva A:** Primeiros **`55%`** do faturamento/margem acumulado *(alto impacto no caixa)*.
     - **Curva B:** Próximos **`30%`** (de `55%` a `85%` acumulados).
     - **Curva C:** Restantes **`15%`** com venda no período.
     - **Curva D:** `0` vendas no período *(sem reposição automática)*.
2. **Eixo XYZ + Uso Contínuo (Frequência e Estabilidade):**
   - Classificar pela regularidade da venda semanal em `movment` (`oper IN (2, 3)`):
     - **X — Uso Contínuo / Estável:** Coeficiente de Variação $CV \le 0,50$ e alta frequência de dias com venda (ex.: `DORFLEX`, `LOSARTANA`, anti-hipertensivos, antidiabéticos). Exige **nível de serviço de 98%–99%** ($Z = 2,05\text{–}2,33$), pois a falta faz o cliente recorrente migrar para a concorrência.
     - **Y — Variação Moderada / Sazonal:** $0,50 < CV \le 1,00$ (ex.: `RESFENOL`, antibióticos, pediátricos). Nível de serviço **95%** ($Z = 1,65$).
     - **Z — Esporádico / Baixo Giro:** $CV > 1,00$ ou vendas concentradas em poucos cupons. Nível de serviço **90%** ($Z = 1,28$); se for **`C + Z`**, entra em compra enxuta/sob demanda para não imobilizar capital.
3. **Regra de Popularidade (*Traffic Builders*):**
   - Itens de tíquete baixo, mas altíssima presença em cupons/dias (ex.: `NEOSORO`, `DIPIRONA`), recebem piso mínimo de classificação (**B** ou **A** operacional), evitando ruptura de itens que puxam fluxo de balcão.

---

## 2. Demanda Real, Ruptura e Sazonalidade (Zero Configuração Manual)

### 2.1 Janela em Semanas Fechadas + Demanda Diária Ajustada (Fim da Espiral da Ruptura)
- **Janela padrão em blocos fechados de 7 dias (sempre `ontem` − $7 \times N$ dias):**
  - Mantemos a melhor prática do setor de trabalhar com **semanas fechadas** — ex.: **`13` semanas (`91` dias)** como padrão (ou **`9` semanas / `63` dias** e **`6` semanas / `42` dias** para resposta rápida).
  - Por que semanas fechadas de 7 dias? Em drogarias há forte sazonalidade semanal (sexta/sábado vs. domingo). Blocos múltiplos de 7 dias garantem exatamente a mesma quantidade de segundas, sextas e sábados — inclusive o próprio BIG armazena o número da semana em `sugcompra_movment.semana`.
- **Correção da Ruptura:** Usando `estoque_posterior` + `movment`, apuramos os **dias disponíveis em que houve estoque (`> 0`)** dentro da janela (com piso mínimo de exposição, ex. `14` dias):
  $$\text{DDV}_{\text{ajustada}} = \frac{\sum \text{Vendas Balcão (oper 2, 3)}}{\max(\text{dias\_com\_estoque}, 14)}$$
- Ignora transferências (`oper = 10`) no consumo da loja ponta para evitar dupla contagem em compras centralizadas no `ESCRITORIO`.
- Não depende de `vendasperdidas` (que teve apenas `8` registros manuais desde jan/2025 no cliente).
- Aplica **média móvel ponderada por blocos de semanas** (ex. na janela de `13` semanas: **`50%`** nas últimas `4` semanas + **`30%`** nas semanas `5–9` + **`20%`** nas semanas `10–13`), capturando rapidamente SKUs em aceleração ou queda (ex.: `LOSARTANA MEDLE` `33307` que saltou de `71` un em Out/25 para `376` un/mês em Ago/26).

### 2.2 Sazonalidade Histórica (YoY)
Aproveitando o histórico multi-anual da `movment` (`2022–2026`):
$$I_{\text{saz}} = \text{clamp}\!\left(\frac{\text{Vendas dos próximos 30 dias no Ano Anterior}}{\text{Vendas dos 60 dias anteriores a essa data no Ano Anterior}}, \; 0{,}60, \; 2{,}20\right)$$
$$\text{DDV}_{\text{projetada}} = \text{DDV}_{\text{ajustada}} \times I_{\text{saz}}$$
- Aplicável quando houver histórico ativo no ano anterior e padrão sazonal consistente na categoria/SKU (ex.: `RESFENOL` `9963`, que salta de `296` un em Jan para `1.081` un em Jun — **3,65x** — exigindo subida antecipada do estoque em Abr/Mai e redução em Ago/Set).

---

## 3. Automatização de Estoque Mínimo, Segurança e Máximo

Para eliminar a dependência de o cliente configurar manualmente `minA..maxD` em `grupo`, o motor calcula automaticamente por SKU:

1. **Lead Time Real ($L$ e $\sigma_L$):**
   - Extraído automaticamente por fornecedor cruzando `pedidos.datahora` × `entradas.datanota` (fallback configurável: `3d` distribuidor / `7d` indústria).
2. **Estoque de Segurança Estatístico ($ES$):**
   $$ES = Z_{(\text{ABC}\times\text{XYZ})} \times \sqrt{L \cdot \sigma_{\text{venda}}^2 + \text{DDV}_{\text{proj}}^2 \cdot \sigma_L^2}$$
3. **Mínimo (Ponto de Pedido) e Máximo (Estoque Alvo):**
   $$\text{Mínimo} = \lceil \text{DDV}_{\text{proj}} \times L + ES \rceil$$
   $$\text{Máximo} = \lceil \text{Mínimo} + \text{DDV}_{\text{proj}} \times R_{\text{ciclo}} \rceil$$
   - Onde $R_{\text{ciclo}}$ (cobertura do ciclo entre pedidos) vem pronto por perfil da matriz (ex.: **A** `10–14d`, **B** `14–21d`, **C** `15–25d` apenas se margem cobrir custo de capital, **D** `0d`), com um controle simples de perfil da farmácia (**Enxuto / Equilibrado / Alta Disponibilidade**) em vez de dezenas de parâmetros por grupo.
4. **Necessidade Líquida de Compra:**
   $$\text{Sugestão} = \max\Big(0, \; \text{Máximo} - (\text{Estoque} - \text{Reserva} + \text{Trânsito Real})\Big)$$
   - **Trânsito Real:** Calculado cruzando `pedidos` recentes com `entradas` já recebidas (não confiar cegamente em `pedidos.recebido = 'N'`).
   - Respeitar bloqueios vigentes (`produtos_suspensos_compra`) e arredondar para múltiplo de embalagem (`qt_fr` / `barras.qtde_cx` / `qtde_cx_forn`) quando aplicável.

### 3.1 Regra para TODO o Mix da Drogaria (Não-Medicamentos: Perfumaria, Suplementos, Higiene, Fraldas, Dermocosméticos)
O motor **não calcula apenas medicamentos** — ele roda sobre **100% dos itens compráveis do mix**, respeitando que **não-medicamentos** costumam ter ciclo de reposição e fornecedores mais lentos:
- **Peso real na loja (`bandeirante`, filial 2):** `medicamento = 'N'` soma **`16.421` SKUs (`72,3%`)** e **`R$ 3.269.377,07` em capital (`54,2%`)** — incluindo `HIGIENE PESSOAL`, `LINHA CABELOS`, `PERFUMARIA`, `FRALDA`, `DERMOCOSMÉTICOS`, `LEITES`, `CONVENIÊNCIA` e `SUPLEMENTOS`.
- **Lead Time real muito maior em HPC/Suplementos (comprovado no banco):** Cruzando `pedidos` × `entradas`, `SUPLEMENTOS` teve **média de `23,3` dias** (máx. `44` dias) e `PERFUMARIA` **`17,2` dias** (máx. `44` dias), contra `~6` dias em distribuidores locais — se usarmos o mesmo mínimo de distribuidora (`3` dias), esses itens rompem antes do caminhão da indústria/distribuidor chegar!
- **Como o motor trata automaticamente:**
  1. **Escopo Universal de Reposição:** ABC×XYZ, Semanas Fechadas (`6/9/13`), Ruptura (`estoque_posterior`), Sazonalidade YoY e Remanejamento rodam para **todos os produtos compráveis** (excluindo apenas serviços/taxas/brindes). A **Compra de Molécula** entra como uma **camada extra** apenas para medicamentos intercambiáveis (inclusive corrigindo medicamentos marcados errado com `medicamento = 'N'`, como `113` SKUs em `SIMILAR` e `89` em `ÉTICO LIBERADO`).
  2. **Perfis de Lead Time e Cobertura por Canal/Grupo (`grupo` + `fornece`):** Em vez de usar uma regra única na filial (`minA=3, maxA=12`), o motor usa:
     - **Lead Time medido por Fornecedor/Grupo** (`pedidos` × `entradas`) + **buffer de ciclo próprio por macro-categoria** (ex.: *Medicamento Distribuidor Rápido* vs. *Indústria Direta / Perfumaria / Suplementos / Importados* com ciclo maior, ex.: `15–30d` ou conforme cadência de compra daquele fornecedor/grupo);
     - **Faceamento / Exposição mínima de gôndola (`estoque_minimo2.faceamento` ou mínimo por categoria)** para perfumaria, dermocosméticos e suplementos não ficarem com prateleira vazia mesmo com giro baixo.
  3. **Saneamento de flag `medicamento`:** Detector automático de cadastro inconsistente (ex.: produto em grupo `SIMILAR`/`ÉTICO` com `medicamento = 'N'`).

---

## 4. "Compra de Molécula" (Princípio Ativo + Dosagem + Apresentação)

No diagnóstico real da `bandeirante`, identificamos dois obstáculos que impedem o uso direto do ERP para compra por molécula:
1. Apenas **`23%`** dos medicamentos Curva A têm `produto_apresentacao_id` preenchido (e apenas `1,2%` com `considera_prod_apresentacao = 'S'`).
2. Há sinônimos no cadastro de `principio_ativo` (ex.: `LOSARTANA` vs `LOSARTANA POTASSICA`).

### Solução: Chave Canônica Híbrida de Molécula
Cada medicamento recebe uma chave estruturada combinando:
1. **`principio_normalizado`:** Padronização de texto (sem acentos, sinônimos mapeados: ex. `LOSARTANA POTASSICA` -> `LOSARTANA`).
2. **`concentracao`:** Extraída de `produto_apresentacao.concentracao` quando houver, ou via parser na `descricao` (ex.: `50MG`, `50/12,5MG`, `100MG`, `500MG/ML`).
3. **`forma_farmaceutica` + `qtd_embalagem`:** Normalizando `CPR/COMPRIMIDOS`, `CAPS`, `GTS/GOTAS`, `XPE/XAROPE`, `SOL`, `INJ`, `POM/CREME` e a quantidade (`30`, `60`, `90`, `100ML`, etc.).

$$\text{molecule\_key} = \text{principio\_normalizado} \;|\; \text{concentracao} \;|\; \text{forma} \;|\; \text{embalagem}$$

### Como isso protege a compra na prática (Caso real observado em `LOSARTANA 50MG C/30`)
- No banco hoje, `LOSARTANA 50MG C/30 (MEDLE)` (`33307`) gira `9,98/dia` e está com **`1` caixa** no estoque (ruptura iminente).
- Na **mesma molécula genérica (`LOSARTANA | 50MG | CPR | 30`)**, a loja possui **`305` caixas de `TEUTO`** (`custo R$ 2,07`) e **`517` caixas de `NEO Q`** (`custo R$ 2,29`), totalizando **`853` caixas** para uma demanda genérica agregada de ~`15,9/dia` (**~54 dias de cobertura na molécula!**).
- **Regra comercial no Painel de Molécula:**
  - Separar **Referência/Marca Fiel (`ÉTICOS`)** de **Intercambiáveis (`GENÉRICOS + SIMILARES`)**.
  - Calcular a **cobertura e necessidade consolidada da molécula** (e destacar divergências: *"SKU em ruptura, porém há excesso na molécula em outro laboratório"* ou *"Falta na molécula: comprar no laboratório de menor custo/melhor margem na cotação"*).

### 4.1 Auditoria, Fonte CMED/ABCFARMA, De → Para e Curadoria Assistida
Na inspeção direta do `bandeirante` (incluindo verificação em `information_schema.columns`), confirmamos **onde fica amarrado o vínculo**, a existência nativa da tabela CMED e as falhas manuais:
- **Onde fica a chave no banco:** Não existe tabela intermediária N:N. O vínculo é direto na tabela **`produto`**:
  - `produto.produto_apresentacao_id` → aponta para `produto_apresentacao.produto_apresentacao_id` (`substancia`, `concentracao`, `qtd_forma_farmaceutica`).
  - `produto.considera_prod_apresentacao` (`'S'` / `'N'`) controla a ativação no módulo de sugestão por apresentação (`sugestao_compras_apresentacao_*`).
  - Já `apresentacoes` está vazia (`0` linhas) e `produto.apresentacao_id = 0` na base inteira.
- **Tabela CMED já disponível no BIG (`lfi_cmed_produto`):**
  - O banco já conta com **`lfi_cmed_produto`** (`25.701` registros, última carga `2026-10-26`, com `registro_ms`, `ean1/2/3`, `substancia_norm`, `dosagem`, `qtde_emb`, `apresentacao`) além de `tabguiafar` (`15.330` registros).
  - Só pelo cruzamento via `produto.registro_ms`, **`3.700` dos `4.832` medicamentos ativos com giro (`76,6%`)** já batem direto na CMED (corrigindo inclusive sinônimos como `52871 LOSARTANA EMS`, que aparece na CMED padronizado como `LOSARTANA POTASSICA | 50MG | 30`).
- **Erros reais detectados dentro de `produto_apresentacao`:**
  - **Código `1` (`ESZOPLICONA | 3MG | 20CP`):** `139397` (`VIVERDAL 3 MG C/30 CPR`) está amarrado num grupo de `20CP` — e a CMED (`registro_ms = 1049711340097`) revelou que **VIVERDAL é `RISPERIDONA`**, ou seja, substância totalmente trocada!
  - **Duplicidades de texto livre na grade:** Ex. códigos `4` e `5` (`Cloridrato de Clomipramina | 25mg | 20 cp` vs `clor de clomipramina | 25mg | 20cp`) e códigos `14` e `15` (`CLOR. BUPROPIONA` vs `CLORIDRATO DE BUPROPIONA`).
  - Grupo `15` (`CLORIDRATO DE BUPROPIONA | 150MG | 30CP`): contém `60CP` (`80402`, `146119`) e `300MG` (`151559`) vinculados por engano junto com `150MG 30CP`.
  - Grupo `179` (`OLMESARTANA MEDOXOMILA | 20MG | 30 COMPRIMIDOS`): contém `40MG` (`149929`), `60 COMPRIMIDOS` (`155656`) e `ODT` (`138665`) misturados.
- **Principais moléculas multi-laboratório ainda sem vínculo:** ex. `ROSUVASTATINA CÁLCICA` (`65/73` SKUs sem vínculo em `18` labs), `LEVOTIROXINA SODICA` (`57/57` sem vínculo), `COLECALCIFEROL` (`165/185` sem vínculo em `19` labs), `IBUPROFENO` (`36/40` sem vínculo em `16` labs) e `PARACETAMOL` (`50/61` sem vínculo em `25` labs).

**Regras de Equivalência e Fluxo Seguro de Curadoria no Novo Sistema:**
1. **Regra de Tolerância de Embalagem (ex. `28` vs `30` CP):**
   - **Tolerância zero** para `substancia`, `concentracao` (`20MG ≠ 40MG`) e `forma_farmaceutica` (`comprimido ≠ gotas/xarope`).
   - **Tolerância configurável para pequenas diferenças de embalagem por laboratório** em sólidos orais: ex. `28` e `30` comprimidos (`28–30 CP` = faixa `"~30CP"`), `14–15 CP`, `56–60 CP`, `84–90 CP` (regra de diferença baixa, ex. $\le 10\%$ ou $\pm 2$ un, ativável por parâmetro).
2. **Prioridade de Fontes (EAN-first) + Tabela `barras` + Alerta CMED/ABCFARMA:**
   - **Cascata de Match por Código de Barras (EAN-first):** Antes de confiar em `registro_ms` (que pode estar desatualizado em cadastros antigos), o motor busca na CMED nesta ordem: (1) `produto.barras`, (2) tabela `barras` adicionais (`caixa_master <> 'S'`), (3) `produto.gtin14`, (4) tabela `barras` (`caixa_master = 'S'`) e, só se nenhum EAN bater, (5) fallback por `produto.registro_ms`. Em paralelo, `barras.qtde_cx` e `barras.caixa_master` preservam os múltiplos de caixa do fornecedor.
   - *Validado na `bandeirante` (`4.832` meds A/B/C):* apenas EAN atinge **`3.974` (`82,2%`)** (`3.693` via `produto.barras` + **`281` extras** resgatados pela tabela `barras`), contra `3.666` (`75,9%`) via `registro_ms`; combinado chega a **`3.983` (`82,4%`)**, e detectou **`77` divergências** entre o EAN do produto e o `registro_ms` digitado no cadastro.
   - Usa **`produto.descricao`** como parser complementar/validador para `concentracao`, `forma` e `qtde_emb`.
   - Se o cliente estiver com `lfi_cmed_produto` vazia/desatualizada ou muitos medicamentos sem EAN/`registro_ms`/princípio ativo, o sistema exibe alerta recomendando **rodar a atualização ABCFARMA ou importar o arquivo oficial da CMED do governo** antes da carga em massa.
3. **De → Para, Auditoria e Sugestão Ranqueada:**
   - **Auditor de Conflitos:** Compara o vínculo atual em `produto_apresentacao` contra CMED + `produto.descricao` e aponta substâncias trocadas (caso `VIVERDAL`), dosagem errada ou embalagem divergente fora da tolerância.
   - **Sugestor de Moléculas:** Agrupa os itens sem vínculo priorizando **maior nº de laboratórios (`>= 3`) e maior demanda/faturamento** para aprovação do comprador.
   - **De → Para não invasivo:** Permite corrigir/unir/separar grupos no nosso sistema imediatamente sem depender de mexer no ERP.
4. **Backup Obrigatório & Opção de Reset/Repovoamento no BIG:**
   - Caso o usuário opte por aplicar as sugestões/correções direto no banco do BIG, o módulo **obrigatoriamente gera antes um backup completo** (`produto_apresentacao` + vínculo `produto_apresentacao_id`/`considera_prod_apresentacao` de `produto`) com opção de **Rollback 1-clique**, além da opção de **limpar a estrutura antiga (duplicada/errada) e repovoar do zero** com os grupos padronizados e aprovados.

---

## 5. Motor de Remanejamento Multi-Loja (Sempre Antes de Comprar ou Cotar)

Na base `bandeirante`, o módulo nativo `remanejamento` teve apenas `2` cabeçalhos criados em `2024-04-22` (`20` itens da filial `3` para `2`), todos parados com `enviado = 'N'`, porque roda isolado do fluxo de compras. No novo motor, o remanejamento passa a ser **uma etapa obrigatória da cascata antes de gerar pedido ou cotação externa**:

### Ordem Econômica em Cascata (Rede -> Distribuidora)
Para toda necessidade detectada em uma loja destino ($N_{\text{destino}} = \max(0, \text{Máx}_{\text{destino}} - (\text{Estoque} + \text{Trânsito}))$):

1. **Prioridade 1 — Resgate de Produto Parado (*Sem Giro lá × Gira aqui*):**
   - Identificar filiais cedentes que possuem `estoque > 0` porém **`demanda = 0`** ou **dias sem venda acima do limite da curva** (ex.: referência vista em `filial_config_remanejamento`: `A: 30d`, `B: 60d`, `C: 90d`, `D: 120d`).
   - Como esse item não tem perspectiva de saída na loja cedente, **100% do saldo parado elegível** (limitado ao espaço/máximo da loja destino) vira sugestão de transferência **`Cedente → Destino`**.
2. **Prioridade 2 — Rebalanceamento de Excesso Acima do Máximo:**
   - Identificar filiais cedentes (ou `ESCRITORIO`/CD) com saldo acima do seu próprio estoque alvo de segurança:
     $$\text{Excedente Cedente} = \max\big(0, \; \text{Estoque}_{\text{cedente}} - \text{Máximo}_{\text{cedente}}\big)$$
   - Transferir o excesso para as lojas deficitárias (respeitando lote/múltiplo prático para não pulverizar transferências de 1 unidade de baixo valor).
3. **Prioridade 3 — Saldo Líquido para Compra / Cotação Externa:**
   $$\text{Comprar na Distribuidora} = \max\Big(0, \; N_{\text{destino}} - \sum \text{Remanejamento Sugerido}\Big)$$
   - Só o que não pôde ser suprido dentro da própria rede segue para a **lista de cotação e pedido aos fornecedores** (em lote consolidado no `ESCRITORIO` quando a rede compra centralizada).
4. **Extensão para Compra de Molécula Multi-Loja:**
   - Exibir também na mesma visão quando um SKU falta na Loja B, não há excesso exato daquele SKU na Loja A, mas há **excesso na mesma molécula genérica/similar** parada na Loja A.

---

## 6. Visão do Cockpit do Comprador & Gancho de Ofertas

Para cada **Molécula** ou **SKU**, a tela exibe objetivamente:
- **Giro & Ruptura:** Vendas `6 / 9 / 13 semanas`, dias sem estoque no período, índice de sazonalidade e tendência (`↑` / `→` / `↓`).
- **Histórico de Entradas (Configurável — Padrão últimas `5` entradas, ajustável de `1..20`):** Para cada SKU (ou ao expandir a linha), exibir as últimas $N$ entradas (`entradas` × `fornece`): data da nota, número NF, **fornecedor**, quantidade (`quantiuni`), preço bruto da NF (`precouni`), **valor líquido absorvido pelo BIG (`entradas.custo_item`)**, `preco_ult_ent`, flag `calc_pmc` e flag `reposicao_pbm` (`'S'`/`'N'`).
- **Posição & Remanejamento:** Estoque atual por loja + `ESCRITORIO`/CD, trânsito real, cobertura em dias, **Transferências Sugeridas (Parados + Excessos)** e **Sugestão Líquida para Compra/Cotação**.
- **Motor Futuro de Cotações/Ofertas:** Ranqueamento automático dos fornecedores (`cotacao`, histórico `entradas`, OL) apenas para o **saldo líquido pós-remanejamento**, por menor custo líquido + *lead time* confiável + margem projetada sobre o preço de venda.

---

## 7. Inteligência & Relatório de PBM (Reposição Automática sem Compra Duplicada)

No diagnóstico real da `bandeirante`, confirmamos exatamente a lacuna do ERP:
- As tabelas de parametrização manual de credenciadoras (`credenc_pbm`, `credenc_pbm_prod`, `credenc_pbm_config`, `transacao_pbm_reposicao`) estão **vazias (`0` registros)**.
- Porém, **100% das vendas PBM efetivas no PDV** ficam gravadas na trilha real:
  - **`transacao_pbm`** (`operadora`, `projeto` — ex.: `LOGIXPHARMA`, `NOVO DIA`, `FAZBEM`, `SUPERA PROG DE BENEFICIOS`, **`nsu`**, **`autorizacao`**, **`cartao` / `cpf`**, `numlanc`, `data_hora`, `confirmada = 'S'`, `cancelado <> 'S'`);
  - **`transacao_pbm_desconto_item`** (`movment_id`, `numlanc`, `operadora`, `produto_id`, `percentual_desconto`, `valor_desconto`);
  - **`movment`** (`E_S = 'S' AND oper IN (2, 3)` + `quanti_uni`) e **`entradas.reposicao_pbm`**.
- **Impacto crítico comprovado no banco (`91` dias na filial `2`):** Produtos caríssimos que apareciam no topo da lista de ruptura (`GLYXAMBI 25/5MG`: `86` de `~92` un no PBM; `AMMY 4MG`: `105` un; `NESINA PIO`: `44` un; `POVIZTRA 1MG`: `92` un; `DIOVAN 160MG`: `48` un; `FIASP FLEXTOUCH`: `39` un) tiveram grande parte da saída via PBM — comprar novamente sem descontar o PBM gera **duplicidade imediata de estoque**.

### Como o Novo Sistema Resolve:
1. **Desconto / Sinalização na Demanda e Sugestão de Compra:**
   - Para cada `(operadora, projeto)` detectado em `transacao_pbm`, o comprador configura 1 vez no nosso sistema se ele possui **Reposição Automática (`Sim / Parcial / Não`)**.
   - Quando marcado como **Reposição Automática**, a quantidade vendida com NSU/autorização confirmada é **abatida da necessidade de compra comum** (ou exibida em coluna separada: `Demanda Total` = `Demanda Balcão Normal` + `Demanda PBM Auto-Reposto`), impedindo compra duplicada em distribuidora enquanto aguarda a nota marcada com `reposicao_pbm = 'S'`.
2. **Tela & Relatório Auditável de Vendas PBM (Por NSU, Autorização e Cartão/CPF):**
   - Filtro por período, loja, operadora/projeto (`LOGIXPHARMA`, `NOVO DIA`, `FAZBEM`, etc.), produto, `NSU`, `autorizacao` e `cartao`/`cpf` mascarado ou completo sob permissão;
   - Conciliação **Vendido no PBM (NSU/Autorização) × Reposições já recebidas (`entradas.reposicao_pbm` / mesmo produto/laboratório)** para saber exatamente o que ainda está pendente de chegar da indústria vs. o que o cliente precisa repor manualmente se algum programa não repuser 100%.

---

## 8. Ecossistema Fechado: Trânsito Faturado (XML DFe), Inserção em `pedidos` e Conciliação PBM

### 8.1 Trânsito Faturado em `nfe_cab` / `nfe_det` (A Caminho na Estrada)
Quando o distribuidor emite a NF-e e o sistema DFe/Silo/Dome da drogaria baixa o XML:
- O registro é inserido em `nfe_cab` com `importada = 'N'` e os itens em `nfe_det`.
- A mercadoria **já foi faturada** e está no caminhão da transportadora, mas **ainda não virou entrada física** em `entradas`.
- O motor lê esses itens e soma automaticamente ao **Trânsito Real** (`NFE_FATURADA_EM_TRANSITO`), impedindo que o comprador recompre o que já está na estrada.

### 8.2 Padrões Fiscais de Reposição de PBM no XML da Distribuidora
Auditado no banco real:
- `nfe_cab.numero_pedido = 'PBM'` ou código OL (ex.: `2607020002EPH03` na Santa Cruz, `Num Ped. Original 66263250` na D Center).
- `nfe_cab.inf_complementares` / `<obsCont>`: `@REPOSICAO@ LGX - LOGIX(SEVEN PDV)`, `REPOSICAO SEVENPDV`, `Rep%: 8.52%`.
- `nfe_det.cfop IN ('5910', '6910')` (*Remessa em bonificação / reposição*).
- O motor faz a conciliação FIFO (Saldo Vendido em `transacao_pbm` $\rightarrow$ Saldo Faturado em `nfe_det` $\rightarrow$ Saldo Entrado em `entradas`), garantindo que o comprador saiba se a indústria faturou no prazo (3 a 7 dias) ou se está em atraso (> 12 dias), gerando alerta de risco de ruptura.

### 8.3 Inserção Nativa na Tabela `pedidos` do BIG (Pedidos Fechados Externamente)
Para pedidos gerados pelo Cotefácil ou pelo nosso Cockpit, a gravação pode alimentar diretamente a tabela `pedidos` do BIG com os campos obrigatórios (`filial_id`, `produto_id`, `pedir`, `datahora`, `numlanc`, `barras`, `descricao`, `preco_cmp_un`, `preco_vnd`, `labora`, `fornece_id`, `recebido='N'`, `falta='N'`, `marcado='N'`, `cotacao_online='S'`). Tanto o BIG quanto a inteligência passam a reconhecer o trânsito aberto instantaneamente.

---

## 9. Arquitetura Multi-Cliente, Exportações Oficiais e Inteligência de Preço 30 Dias

### 9.1 Painel de Configuração Multi-Cliente & Diagnóstico do MariaDB
Para permitir a implantação em múltiplos clientes/redes sem alteração de código:
- Cada farmácia possui seu perfil isolado em `client_profiles` no SQLite (`data/analytics.db`), armazenando:
  - `Host / IP`: IP do servidor MariaDB do cliente;
  - `Porta`: padrão `3306`;
  - `Usuário` e `Senha`: credenciais de banco (leitura para análise e escrita transacional apenas para pedidos);
  - `Database`: nome da base do Linx BIG (ex.: `bandeirante`);
  - `Filial Compradora`: ID da loja que faz o faturamento do pedido (ex.: Filial 2);
  - `CNPJ Loja Destinatária`: CNPJ 14 dígitos formatado;
  - `Fornecedor Padrão / ID`: código do fornecedor técnico usado para registrar lotes de cotação.
- **Validação de Conexão em Tempo Real:** Endpoint `/api/config/test-connection` executa handshake com o MariaDB, verifica a versão do banco e lista todas as filiais cadastradas.
- **Lookup de Fornecedor Instantâneo:** Ao digitar o ID no campo (ex.: `10`), o sistema consulta a tabela nativa `fornece` (`cgc`, `nome`, `fantasia`, `cidade`, `estado`) e renderiza imediatamente o feedback visual (`✓ [10] SANTA CRUZ - CNPJ: 19.221.783/0001-61`), impedindo erros humanos de digitação de código de fornecedor.

### 9.2 Exportação Oficial Cotefácil TXT (Layout 3.0)
Formato de intercâmbio de cotação mais difundido no varejo farmacêutico brasileiro, gerado fielmente pelo motor (`src/services/exportFormatsService.mjs`):
- **Linha 1 (Header):** `1;<CNPJ_DESTINATARIO>;3.0`
- **Linha 2..N (Itens Tipo 2):** `2;<EAN_13_DIGITOS>;<QUANTIDADE>;<COD_SKU>;<DESCRICAO>;<LABORATORIO>;<PRECO_TARGET>`
  - *EAN*: Tratado como string pura e normalizado para 13 dígitos (`padStart(13, '0')`);
  - *Preço Target*: 2 decimais com ponto (ex.: `12.00`), utilizando o menor preço dos últimos 30 dias para balizar a negociação;
- **Linha Final (Trailer Tipo 9):** `9;<TOTAL_ITENS_TIPO_2>`
- *Exemplo real gerado e validado:*
  ```text
  1;28660206000167;3.0
  2;0000001473438;6;147343;CHAVEIRO CH12;REVISAR;12.00
  2;7898744000133;1;152874;PROTETOR DE SEIO FITA UP SILICONE 8CM 1 PAR;FITA UP;38.34
  9;2
  ```

### 9.3 Planilha Nativa de Importação do Compras Linx BIG (10 Colunas)
Para clientes que não desejam ou não possuem permissão de escrita direta no banco MySQL/MariaDB (evitando a necessidade de senhas master ou autorização de TI da Linx), o motor gera a planilha exata consumida pela rotina de importação do Linx Farma BIG:
- **10 Colunas Oficiais (Estilo e Tipagem Estrita):**
  1. `CNPJ`: CNPJ da filial compradora (ex.: `28660206000167`, formatado como texto puro `@` para não truncar nem exibir notação científica);
  2. `LOJA`: Código da filial (ex.: `2`);
  3. `COD_PRODUTO`: SKU do sistema Linx BIG (ex.: `147343`);
  4. `EAN`: Código de barras em formato texto puro;
  5. `DESCRIÇÃO PRODUTO`: Nome do medicamento/produto;
  6. `QUANTIDADE`: Quantidade calculada pelo motor ou ajustada pelo comprador;
  7. `PREÇO`: Custo unitário com formato moeda brasileira (`#,##0.00`);
  8. `DESCONTO`: Percentual negociado (ex.: `0.00` ou `0.10`);
  9. `CNPJ FORNECEDOR`: CNPJ da distribuidora mais barata nos 30d;
  10. `DESCRIÇÃO FORNECEDOR`: Razão social ou fantasia da distribuidora cotada.
- **Visual:** Cabeçalho institucional azul escuro (`#2F5597`), texto em branco negrito e bordas alinhadas, idêntica ao layout nativo de tela do ERP.

### 9.4 Inteligência de Preço: Menor Custo dos Últimos 30 Dias (Poder de Negociação)
O motor supera a limitação do ERP (que olha apenas a última entrada estática):
- Varre o histórico de `entradas` de todos os fornecedores nos últimos 30 dias em relação à data de referência;
- Localiza qual fornecedor praticou o menor custo unitário real (`custo_item` ou `precouni`);
- Apresenta na Mesa de Compras e no Modal de Cotação o selo visual de oportunidade:
  - Exemplo: `★ R$ 8,50 • NDS DISTRIB (-15%)` comparado ao custo de `R$ 10,00` da última entrada da Santa Cruz;
  - O comprador envia a cotação já balizado pelo menor preço que o mercado cobrou recentemente da própria farmácia, garantindo economia imediata e margem superior.

### 9.5 Gravação Transacional em `pedidos` (Transação ACID & Geração de `numlanc`)
Quando o cliente opta pela gravação direta com 1 clique:
1. O backend abre conexão de escrita segura (`createWriteConnection`);
2. Inicia transação SQL (`conn.beginTransaction()`);
3. Obtém o próximo lote sequencial: `numlanc = COALESCE(MAX(numlanc), 50550000) + 1`;
4. Grava em lote cada SKU com `cotacao_online = 'S'`, `marcado = 'N'`, `recebido = 'N'` e observação identificando o motor;
5. Executa `conn.commit()`;
6. Salva auditoria completa no SQLite (`big_orders_log`) com ID do lote, fornecedor, quantidade de itens, unidades e total em R$.



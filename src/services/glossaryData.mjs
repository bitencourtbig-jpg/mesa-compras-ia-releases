/**
 * Glossario oficial de siglas, indicadores e codigos de excecao do Motor de Compras BIG.
 */

export const GLOSSARY_SECTIONS = [
  {
    id: 'curvas',
    title: 'Classificacao ABC x XYZ e Mix',
    description: 'Define prioridade financeira (quanto fatura) e estabilidade da procura (quao previsivel e a venda).',
    items: [
      {
        code: 'ABC (A / B / C / D)',
        meaning: 'Curva de Importancia Financeira (Lucro Bruto e Receita 91d)',
        detail: 'A = primeiros 55% do resultado; B = proximos 30%; C = ultimos 15%; D = itens sem giro nos ultimos 91 dias.',
        action: 'Curva A nunca pode faltar. Curva D parada deve ser bloqueada de nova compra ou liquidada.',
      },
      {
        code: 'XYZ (X / Y / Z)',
        meaning: 'Indice de Previsibilidade da Demanda (CV semanal)',
        detail: 'X = venda estavel (CV <= 0,5); Y = variacao moderada (0,5 < CV <= 1,0); Z = demanda irregular ou por encomenda (CV > 1,0).',
        action: 'Itens X aceitam estoque minimo enxuto. Itens Z exigem checar se a venda foi pico isolado antes de comprar grande lote.',
      },
      {
        code: 'AX / AZ / CZ...',
        meaning: 'Matriz Combinada Receita x Previsibilidade',
        detail: 'Junta a curva financeira (A..D) com a previsibilidade (X..Z). Ex.: AX = campeao estavel; AZ = campeao com picos; CZ = item pequeno e esporadico.',
        action: 'Priorize verba em AX e AY. Em CZ/DZ, compre apenas o minimo ou sob demanda.',
      },
      {
        code: 'Chamariz (Traf.)',
        meaning: 'Construtor de Trafego / Fidelidade de Cupom',
        detail: 'Produto que aparece em muitos cupons fiscais diferentes (alta frequencia de clientes na loja), mesmo tendo ticket unitario baixo.',
        action: 'Evite ruptura mesmo se o lucro unitario parecer baixo, pois o cliente vai embora sem levar a cesta.',
      },
      {
        code: 'CV',
        meaning: 'Coeficiente de Variacao',
        detail: 'Desvio padrao dividido pela media semanal de vendas. Quanto maior o CV, mais imprevisivel e a saida semanal.',
        action: 'Quanto maior o CV, mais importante validar os picos na Memoria de Calculo.',
      },
      {
        code: 'HPC / SUP / DERMO',
        meaning: 'Macrocategorias de Nao-Medicamentos',
        detail: 'HPC = Higiene, Perfumaria e Cosmeticos; SUP = Suplementos, Vitaminas e Nutricao; DERMO = Dermocosmeticos; MED = Medicamentos.',
        action: 'Cada grupo respeita Lead Time e ciclo proprios (nao-medicamentos costumam ter reposicao mais longa).',
      },
    ],
  },
  {
    id: 'reposicao',
    title: 'Calculo de Demanda, Cobertura e Reposiçao',
    description: 'Parametros matematicos usados pelo motor para definir o Quanto Comprar.',
    items: [
      {
        code: 'SKU',
        meaning: 'Stock Keeping Unit (Codigo Interno do Produto no BIG)',
        detail: 'Identificador unico do cadastro do item no Linx Farma BIG (tabela produto).',
        action: 'Use para localizar o item diretamente nas telas do BIG.',
      },
      {
        code: 'EAN / Barras',
        meaning: 'Codigo de Barras Comercial (GTIN-13 / GTIN-14)',
        detail: 'Considera produto.barras e tambem os codigos adicionais da tabela barras (caixa/unitario). Chave principal para Cotefacil e CMED.',
        action: 'Confira sempre se o EAN principal na exportacao bate com o fornecedor cotado.',
      },
      {
        code: 'DDV (Bruta / Ajust. / Liq. / Proj.)',
        meaning: 'Demanda Media Diaria de Venda',
        detail: 'Bruta = media ponderada recente (6/9/13 sem); Ajustada = corrige dias em que a loja ficou zerada; Liquida = apos abater PBM auto-reposto; Projetada = aplicada sazonalidade YoY.',
        action: 'A DDV Projetada e o ritmo diario real usado para calcular Minimo, Maximo e sugestao de compra.',
      },
      {
        code: 'LT (Lead Time)',
        meaning: 'Tempo Medio de Entrega do Fornecedor/Grupo (em dias)',
        detail: 'Medido automaticamente entre pedidos emitidos e notas de entrada recebidas no BIG (ou padrao do grupo de perfumaria/suplementos).',
        action: 'Se Cobertura < LT, o estoque vai acabar antes do proximo pedido chegar.',
      },
      {
        code: 'Cob. (Cobertura)',
        meaning: 'Dias de Estoque Disponivel no Ritmo Atual',
        detail: 'Calculado por (Estoque Atual + Transito Real) dividido pela DDV Projetada.',
        action: 'Abaixo do Lead Time significa compra urgente; muito acima do Maximo indica excesso.',
      },
      {
        code: 'Min / Seg / Max',
        meaning: 'Estoque Minimo, Seguranca e Maximo Alvo',
        detail: 'Min = Demanda no Lead Time + Seguranca (ponto de pedido); Max = Minimo + Ciclo de Compra. Itens abaixo do Minimo disparam sugestao ate o Maximo.',
        action: 'Voce pode ajustar o perfil (Enxuto / Equilibrado / Alta) no topo para apertar ou folgar o estoque de seguranca.',
      },
      {
        code: 'Saz (YoY)',
        meaning: 'Sazonalidade Ano contra Ano (Year-over-Year)',
        detail: 'Compara as vendas dos proximos 30 dias do ano passado contra os 60 dias anteriores do ano passado (limitado entre 0,60x e 2,20x).',
        action: 'Protege contra viradas sazonais (inverno, verao, protetor solar, antigripais).',
      },
      {
        code: 'Tr. (Transito)',
        meaning: 'Pedido em Aberto Aguardando Entrega',
        detail: 'Saldo de pedidos ainda nao faturados no BIG, descontando eventuais entregas parciais ja recebidas.',
        action: 'O motor ja desconta esse saldo antes de sugerir nova compra para evitar pedido duplicado.',
      },
      {
        code: 'Mg % / ROI Marginal',
        meaning: 'Margem Bruta e Retorno Diario por R$ Investido',
        detail: 'Mg % = (Preco Medio Praticado - Custo Un.) / Preco. ROI Marginal ordena onde cada R$ 1,00 aplicado gera mais lucro diario.',
        action: 'Usado pelo Simulador de Verba para priorizar os itens de maior retorno quando o caixa e limitado.',
      },
    ],
  },
  {
    id: 'farmacia',
    title: 'Regras Farmaceuticas, PBM, Lotes e CMED',
    description: 'Inteligencia especifica de drogaria integrada ao Linx Farma BIG.',
    items: [
      {
        code: 'PBM / NSU / CPF',
        meaning: 'Programa de Beneficio em Medicamentos e Trilha de Venda',
        detail: 'Vendas em programas como Logixpharma, Novo Dia ou FazBem geram NSU, Autorizacao e Cartao/CPF e costumam ter reposicao automatica.',
        action: 'O motor abate o giro coberto por PBM auto-reposto para voce nao comprar duplicado. Farmacia Popular e Fidelidade permanecem isolados.',
      },
      {
        code: 'CMED / MS',
        meaning: 'Base Oficial ANVISA/CMED e Registro Ministerio da Saude',
        detail: 'Cruza primeiro por EAN (produto.barras e barras extra) para identificar Principio Ativo, Concentracao, Forma e Tolerancia 28-30 CP.',
        action: 'Permite consolidar compras por molecula e apontar cadastros com MS divergente ou flag medicamento incorreta.',
      },
      {
        code: 'FEFO',
        meaning: 'First Expired, First Out (Vence Primeiro Sai Primeiro)',
        detail: 'Prioriza transferir (remanejar) ou escoar lotes com menor data de validade em lote_novo antes de comprar novos.',
        action: 'Itens com lote vencendo em <= 90 dias tem alerta para nao recomprar sem antes liquidar o lote atual.',
      },
    ],
  },
  {
    id: 'excecoes',
    title: 'Codigos de Excecao Sinalizados pela IA',
    description: 'Etiquetas exibidas na coluna Diagnostico quando um item foge do comportamento normal.',
    items: [
      {
        code: 'RUPTURA_A / RUPTURA_B',
        meaning: 'Item de Alta/Media Curva Zerado em Estoque',
        detail: 'Produto Curva A ou B com estoque <= 0 e giro diario ativo — venda perdida acontecendo agora.',
        action: 'Comprar com prioridade maxima no proximo envio ao Cotefacil/distribuidor.',
      },
      {
        code: 'ESTOQUE_NEGATIVO_DIVERGENTE',
        meaning: 'Saldo Negativo com Venda Recente',
        detail: 'Indica possivel NF ainda nao dada entrada no BIG, troca de codigo no PDV ou erro de inventario.',
        action: 'Conferir fisico na gondola ou NFs pendentes antes de confirmar a quantidade do pedido.',
      },
      {
        code: 'PBM_AUTO_REPOSICAO',
        meaning: 'Giro Abatido por Reposicao Automatica de PBM',
        detail: 'Pelo menos 40% das vendas do SKU ocorreram em programa PBM configurado como auto-reposto.',
        action: 'Quantidade sugerida ja considera apenas o saldo balcao/loja nao coberto pelo PBM.',
      },
      {
        code: 'MOLECULA_COBERTA_OUTRO_LAB',
        meaning: 'Equivalencia Coberta por Outro Laboratorio na Rede',
        detail: 'Outro laboratorio da mesma molecula/concentracao/apresentacao ja possui cobertura >= 15 dias em estoque.',
        action: 'Avaliar na aba Moleculas & CMED se compensa realmente comprar essa marca ou girar o substituto em estoque.',
      },
      {
        code: 'LOTE_CURTO_90D / LOTE_VENCIDO',
        meaning: 'Risco de Validade na Tabela lote_novo',
        detail: 'Existe quantidade com validade <= 90 dias ou ja vencida em lote_novo.',
        action: 'Negociar promocao ou transferencia entre lojas antes de repor unidades novas.',
      },
      {
        code: 'ALTA_CUSTO_ENTRADA',
        meaning: 'Aumento de Custo >= 15% na Ultima NF',
        detail: 'O custo_item absorvido na entrada mais recente subiu pelo menos 15% frente a media das entradas anteriores.',
        action: 'Expandir linha para ver ultimos fornecedores e abrir cotacao concorrente antes de fechar.',
      },
      {
        code: 'HISTORICO_PERDA_ALTO',
        meaning: 'Teto Reduzido por Quebras/Vencimentos',
        detail: 'Perdas registradas nos ultimos 365 dias relevantes frente ao giro trimestral.',
        action: 'O motor reduz automaticamente o estoque maximo para evitar novo encalhe e perda.',
      },
      {
        code: 'FLAG_MEDICAMENTO_INCORRETO',
        meaning: 'Divergencia Cadastro BIG x Base Oficial CMED',
        detail: 'Produto encontrado na CMED como medicamento, porem marcado no BIG com medicamento != S.',
        action: 'Corrigir flag no cadastro BIG para evitar erros fiscais, tributarios e de classificacao.',
      },
      {
        code: 'NFE_FATURADA_EM_TRANSITO',
        meaning: 'NF-e Emitida pelo Fornecedor Aguardando Conferência na Loja',
        detail: 'O XML da nota fiscal de compra ou reposição PBM já foi baixado no banco (nfe_cab com importada=N), mercadoria está em trânsito no caminhão.',
        action: 'O motor já soma ao trânsito para evitar compra duplicada de mercadoria que já foi faturada.',
      },
      {
        code: 'ALTA_SAZONAL',
        meaning: 'Aceleracao Sazonal Aplicada (>= 1,20x)',
        detail: 'Historico do mesmo periodo no ano passado mostra aceleracao expressiva de procura nos proximos 30 dias.',
        action: 'Manter a folga sugerida para nao perder venda na entrada da estacao.',
      },
    ],
  },
];

export const GLOSSARY_TERM_HINTS = {
  sku: 'SKU: Codigo interno unico do produto no cadastro do Linx BIG.',
  ean: 'EAN: Codigo de barras comercial (GTIN) usado em PDV, CMED e cotacoes (Cotefacil).',
  abcxyz: 'ABC = impacto financeiro (A 55%, B 30%, C 15%, D parado). XYZ = estabilidade (X estavel, Y moderada, Z picos).',
  estoque: 'Saldo fisico atual na filial + unidades em pedidos abertos (Transito Real).',
  ddv: 'DDV Projetada: Demanda Media Diaria ajustada por rupturas silenciosas, abatida de PBM auto-reposto e multiplicada pela sazonalidade YoY.',
  lt: 'LT (Lead Time): Prazo medio real em dias que o fornecedor/grupo leva entre pedido e recebimento NF.',
  minmax: 'Minimo = ponto de pedido (LT + Seguranca). Maximo = teto alvo do ciclo.',
  cob: 'Cobertura: Quantos dias o estoque + transito atual suportam no ritmo da DDV Projetada.',
  custo: 'Custo Unitario de referencia (PMC/Ultimo Custo Absorvido em NF) e Margem Bruta estimada.',
  comprar: 'Quantidade liquida sugerida para atingir o Estoque Maximo apos remanejamentos e travas.',
  confianca: 'Confianca IA: Mede qualidade do dado (estabilidade XYZ, saldo positivo, NF recente e consistencia CMED).',
};


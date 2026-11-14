import fs from 'fs';

const file = 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/dev_reviews/backlog_melhorias.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const resolutions = {
  'REV-019': {
    data: '2026-11-13T16:45:00.000Z',
    notas: 'Corrigido e Sincronizado 100%: 1) Causa-raiz identificada: Subgrupos homônimos no Linx BIG (ex: grupo_id 6 e 62002, ambos com nome "ÉTICOS") eram filtrados por string no SQL, misturando subgrupos ou perdendo precisão; 2) O botão da árvore agora envia estritamente data-grupo-id com o ID numérico nativo do BIG; 3) O backend /api/skus filtra por grupo_id = ? garantindo fidedignidade matemática absoluta de 100% com o valor e a contagem de SKUs exibidos no botão da árvore; 4) Eliminada a trava hardcoded de 80 SKUs que ocultava a outra metade dos itens recomendados.'
  },
  'REV-018': {
    data: '2026-11-13T16:45:00.000Z',
    notas: 'Implementado: 1) Novo Hero Card Executivo de Cotação (.hero-quotation-card) no topo da área de trabalho, exibindo com alto impacto visual: Badge "🛒 X SKUs Marcados", Total Cotado em R$ em destaque esmeralda (#047857), e Volume Físico em unidades; 2) Botão de ação rápida "⭐ Ver Apenas Selecionados", "📋 Fechar Pedido e Cotefácil (F8)" e "✕ Limpar"; 3) Design Impeccable autoexplicativo, eliminando necessidade de treinamento manual.'
  },
  'REV-017': {
    data: '2026-11-13T16:45:00.000Z',
    notas: 'Implementado: 1) Barra de Paginação completa no rodapé da tabela (.pagination-bar) com indicador "Mostrando X–Y de Z SKUs recomendados", botões "◀ Anterior" / "Próxima ▶" e seletor de densidade (50, 80, 150, 300 itens por página); 2) Nova aba dedicada "⭐ Meus Selecionados" no menu de abas e no Hero Card, permitindo ao comprador isolar e validar exclusivamente os produtos marcados para cotação antes de exportar.'
  },
  'REV-016': {
    data: '2026-11-13T16:45:00.000Z',
    notas: 'Implementado: 1) Piso de Ruptura Crítica de Curva A: Se o produto é Curva A (pelo motor ou BIG) e o estoque físico está zerado (<= 0), o motor garante compra mínima preventiva (mínimo de 1 a 2 un) mesmo em horizontes curtos (3d ou 5d), impedindo perda de vendas por DDV rebaixado; 2) IA com parecer explícito para Curvas C e D zeradas ("Sugerida compra sob demanda de balcão"); 3) Sincronização multi-filtros de grupo_pai, subgrupo e grupo_id integrado aos pills dinâmicos do topo.'
  }
};

for (const rev of data.reviews) {
  if (resolutions[rev.id]) {
    rev.status = 'concluido';
    rev.resolucao = resolutions[rev.id];
  }
}
data.updated_at = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log('Backlog atualizado com sucesso: REV-016, REV-017, REV-018, REV-019 marcados como concluídos.');


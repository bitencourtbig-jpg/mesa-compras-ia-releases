import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456big',
    database: 'bandeirante'
  });

  const [rows] = await conn.query(`
    SELECT 
      g.grupo_id,
      g.codigo,
      g.descricao,
      g.desc_arvore,
      CASE 
        WHEN LOCATE('.', g.codigo) > 0 THEN SUBSTRING_INDEX(g.codigo, '.', 1)
        ELSE g.codigo 
      END AS codigo_pai,
      CASE 
        WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING_INDEX(g.desc_arvore, ' - ', 1)
        ELSE g.desc_arvore 
      END AS grupo_pai_nome,
      CASE 
        WHEN LOCATE(' - ', g.desc_arvore) > 0 THEN SUBSTRING(g.desc_arvore, LOCATE(' - ', g.desc_arvore) + 3)
        ELSE g.descricao 
      END AS grupo_filho_nome,
      COUNT(p.produto_id) AS total_produtos
    FROM grupo g
    LEFT JOIN produto p ON p.grupo_id = g.grupo_id AND p.apagado = 'N'
    WHERE g.apagado = 'N'
    GROUP BY g.grupo_id
    ORDER BY codigo_pai ASC, g.codigo ASC
  `);
  
  // Agrupar por Grupo Pai
  const tree = {};
  for (const r of rows) {
    const pai = r.grupo_pai_nome || 'OUTROS';
    if (!tree[pai]) tree[pai] = { total_produtos: 0, filhos: [] };
    tree[pai].total_produtos += r.total_produtos;
    tree[pai].filhos.push({
      grupo_id: r.grupo_id,
      codigo: r.codigo,
      nome_filho: r.grupo_filho_nome,
      produtos: r.total_produtos
    });
  }

  console.log('=== ÁRVORE COMPLETA DE GRUPOS DO LINX BIG (PAI E FILHO) ===');
  for (const [pai, data] of Object.entries(tree)) {
    console.log(`\n📁 GRUPO PAI: [${pai}] (Total: ${data.total_produtos} produtos cadastrados)`);
    for (const f of data.filhos) {
      console.log(`   └── 📄 Filho [${f.grupo_id}] ${f.nome_filho} (Cód: ${f.codigo}) -> ${f.produtos} produtos`);
    }
  }

  await conn.end();
}

main().catch(console.error);

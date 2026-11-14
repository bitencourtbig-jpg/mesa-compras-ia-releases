import fs from 'node:fs';
import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';
import { loadCmedIndex, normCode } from '../lib/cmedLoader.mjs';
import { buildPresentationSignature } from '../lib/moleculeNormalizer.mjs';

const ZIP_PATH = 'C:/Users/quemf/Downloads/Lista_PMC_20261109_111901661.zip';

async function main() {
  const t0 = Date.now();
  console.log('Carregando CMED 2026-11-09...');
  const cmed = await loadCmedIndex(ZIP_PATH, {
    extractDir: 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/data/cmed',
    allowTolerance: true,
  });
  console.log(`CMED carregada em ${((Date.now() - t0) / 1000).toFixed(1)}s: ${cmed.totalRows} linhas.`);

  const conn = await createReadOnlyConnection();
  try {
    const bigGroups = await runReadOnlyQuery(
      conn,
      `SELECT produto_apresentacao_id, substancia, concentracao, qtd_forma_farmaceutica
       FROM produto_apresentacao
       WHERE apagado = 'N'`
    );

    const prods = await runReadOnlyQuery(
      conn,
      `SELECT p.Produto_id, p.descricao, p.labora, p.registro_ms, p.barras AS prod_barras, p.gtin14,
              p.medicamento, p.produto_apresentacao_id, p.considera_prod_apresentacao,
              pa.descricao AS princ_big,
              pap.substancia AS pap_subst, pap.concentracao AS pap_conc, pap.qtd_forma_farmaceutica AS pap_qtd,
              GROUP_CONCAT(DISTINCT CASE WHEN COALESCE(b.caixa_master, 'N') <> 'S' THEN b.barras END) AS extra_barras_unit,
              GROUP_CONCAT(DISTINCT CASE WHEN b.caixa_master = 'S' THEN b.barras END) AS extra_barras_master,
              COALESCE(em1.estoque, 0) AS estoque,
              COALESCE(em2.demanda, 0) AS demanda,
              SUBSTRING_INDEX(COALESCE(c.curvaabc, 'D'), ' ', 1) AS curva,
              ROUND(COALESCE(NULLIF(pmc.pmc_atual, 0), p.preco_cmp / GREATEST(p.qt_fr, 1), 0), 2) AS custo_unit
       FROM produto p
       LEFT JOIN principio_ativo pa ON pa.principio_ativo_id = p.principio_ativo_id AND pa.apagado = 'N'
       LEFT JOIN produto_apresentacao pap ON pap.produto_apresentacao_id = p.produto_apresentacao_id AND pap.apagado = 'N'
       LEFT JOIN barras b ON b.produto_id = p.Produto_id AND b.apagado = 'N'
       LEFT JOIN estoque_minimo em1 ON em1.filial_id = 2 AND em1.produto_id = p.Produto_id AND em1.apagado = 'N'
       LEFT JOIN estoque_minimo2 em2 ON em2.filial_id = 2 AND em2.produto_id = p.Produto_id AND em2.apagado = 'N'
       LEFT JOIN curvaabc c ON c.filial_id = 2 AND c.produto_id = p.Produto_id AND c.apagado = 'N'
       LEFT JOIN preco_medio_custo pmc ON pmc.fillogica_id = 2 AND pmc.produto_id = p.Produto_id AND pmc.apagado = 'N'
       WHERE p.apagado = 'N' AND p.inativo = 'N'
         AND (p.medicamento = 'S' OR p.produto_apresentacao_id > 0)
         AND (COALESCE(em1.estoque, 0) <> 0 OR COALESCE(em2.demanda, 0) > 0 OR p.produto_apresentacao_id > 0)
       GROUP BY p.Produto_id`
    );

    // 1. Auditoria de duplicidades na propria tabela produto_apresentacao
    const bigSigMap = new Map();
    for (const g of bigGroups) {
      const sig = buildPresentationSignature({
        substancia: g.substancia,
        textoFonte: `${g.concentracao || ''} ${g.qtd_forma_farmaceutica || ''}`,
        isCmed: false,
        allowTolerance: true,
      });
      if (!bigSigMap.has(sig.key)) bigSigMap.set(sig.key, []);
      bigSigMap.get(sig.key).push(g);
    }
    const duplicatedBigGroups = [...bigSigMap.entries()]
      .filter(([, arr]) => arr.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    // 2. Classificar todos os produtos via CMED (EAN-first: produto.barras -> barras unitario -> gtin14 -> barras caixa_master -> fallback registro_ms) + parser
    let matchCmedTotal = 0;
    let matchByProdBarras = 0;
    let matchByExtraBarras = 0;
    let matchByGtin14 = 0;
    let matchByRegFallback = 0;
    const eanMsDivergences = [];
    const conflicts = [];
    const missingGroupsMap = new Map();

    const lookupByList = (list) => {
      for (const code of list) {
        const nc = normCode(code);
        if (nc && cmed.byEan.has(nc)) return cmed.byEan.get(nc);
      }
      return null;
    };

    for (const p of prods) {
      const reg = normCode(p.registro_ms);
      const regHit = reg ? cmed.byRegistro.get(reg) : null;

      let eanHit = null;
      let hitSource = null;

      const prodHit = lookupByList([p.prod_barras]);
      if (prodHit) {
        eanHit = prodHit;
        hitSource = 'produto.barras';
        matchByProdBarras += 1;
      } else {
        const unitList = p.extra_barras_unit ? p.extra_barras_unit.split(',') : [];
        const unitHit = lookupByList(unitList);
        if (unitHit) {
          eanHit = unitHit;
          hitSource = 'barras(unit)';
          matchByExtraBarras += 1;
        } else {
          const gtinHit = lookupByList([p.gtin14]);
          if (gtinHit) {
            eanHit = gtinHit;
            hitSource = 'produto.gtin14';
            matchByGtin14 += 1;
          } else {
            const masterList = p.extra_barras_master ? p.extra_barras_master.split(',') : [];
            const masterHit = lookupByList(masterList);
            if (masterHit) {
              eanHit = masterHit;
              hitSource = 'barras(master)';
              matchByExtraBarras += 1;
            }
          }
        }
      }

      if (eanHit && regHit && eanHit.registro !== regHit.registro) {
        eanMsDivergences.push({
          produtoId: p.Produto_id,
          descricao: p.descricao,
          eanReg: eanHit.registro,
          eanKey: eanHit.sig.key,
          msReg: regHit.registro,
          msKey: regHit.sig.key,
        });
      }

      let cHit = eanHit;
      if (!cHit && regHit) {
        cHit = regHit;
        hitSource = 'registro_ms';
        matchByRegFallback += 1;
      }
      if (cHit) matchCmedTotal += 1;

      const prodSig = cHit
        ? cHit.sig
        : buildPresentationSignature({
            substancia: p.princ_big || '',
            textoFonte: p.descricao,
            isCmed: false,
            allowTolerance: true,
          });

      // Auditoria nos itens ja vinculados no BIG
      if (p.produto_apresentacao_id > 0 && p.pap_subst) {
        const groupSig = buildPresentationSignature({
          substancia: p.pap_subst,
          textoFonte: `${p.pap_conc || ''} ${p.pap_qtd || ''}`,
          isCmed: false,
          allowTolerance: true,
        });

        const motivos = [];
        if (
          prodSig.substanciaNorm &&
          groupSig.substanciaNorm &&
          prodSig.substanciaNorm !== groupSig.substanciaNorm &&
          !prodSig.substanciaNorm.startsWith(groupSig.substanciaNorm) &&
          !groupSig.substanciaNorm.startsWith(prodSig.substanciaNorm)
        ) {
          motivos.push(`Substância divergente (${groupSig.substanciaNorm} vs ${prodSig.substanciaNorm})`);
        }
        if (prodSig.concentracao && groupSig.concentracao && groupSig.concentracao !== '?' && prodSig.concentracao !== groupSig.concentracao) {
          motivos.push(`Concentração (${groupSig.concentracao} vs ${prodSig.concentracao})`);
        }
        if (
          prodSig.packBucket &&
          groupSig.packBucket &&
          groupSig.packBucket !== '?' &&
          prodSig.packBucket !== '?' &&
          prodSig.packBucket !== groupSig.packBucket
        ) {
          motivos.push(`Embalagem (${groupSig.packExact || groupSig.packBucket} vs ${prodSig.packExact || prodSig.packBucket})`);
        }
        if (
          prodSig.forma !== 'OUTROS' &&
          groupSig.forma !== 'OUTROS' &&
          prodSig.forma !== groupSig.forma
        ) {
          motivos.push(`Forma (${groupSig.forma} vs ${prodSig.forma})`);
        }

        if (motivos.length > 0) {
          conflicts.push({
            grupoId: p.produto_apresentacao_id,
            grupoNome: `${p.pap_subst} | ${p.pap_conc} | ${p.pap_qtd}`,
            produtoId: p.Produto_id,
            descricao: p.descricao,
            fonte: cHit ? 'CMED' : 'Parser',
            chaveDetectada: prodSig.key,
            motivos: motivos.join('; '),
          });
        }
      }

      // Sugestoes para itens SEM produto_apresentacao_id (apenas se chave completa: substancia + conc + pack)
      if (!p.produto_apresentacao_id || p.produto_apresentacao_id === 0) {
        if (
          prodSig.substanciaNorm &&
          prodSig.concentracao &&
          prodSig.packBucket &&
          prodSig.packBucket !== '?'
        ) {
          if (!missingGroupsMap.has(prodSig.key)) {
            missingGroupsMap.set(prodSig.key, {
              key: prodSig.key,
              substancia: prodSig.substanciaNorm,
              concentracao: prodSig.concentracao,
              forma: prodSig.forma,
              packBucket: prodSig.packBucket,
              skus: [],
              labs: new Set(),
              packVariants: new Set(),
              demandaTotal: 0,
              estoqueTotal: 0,
              cmedCount: 0,
            });
          }
          const grp = missingGroupsMap.get(prodSig.key);
          grp.skus.push({ ...p, cmedTipo: cHit?.tipoProduto || '' });
          if (p.labora && p.labora.trim()) grp.labs.add(p.labora.trim());
          if (prodSig.packExact) grp.packVariants.add(prodSig.packExact);
          grp.demandaTotal += Number(p.demanda || 0);
          grp.estoqueTotal += Number(p.estoque || 0);
          if (cHit) grp.cmedCount += 1;
        }
      }
    }

    const topSuggested = [...missingGroupsMap.values()]
      .filter((g) => g.skus.length >= 3 && g.labs.size >= 3 && g.demandaTotal > 0)
      .sort((a, b) => b.labs.size * 10 + b.demandaTotal - (a.labs.size * 10 + a.demandaTotal));

    // Montar relatorio Markdown
    const lines = [];
    lines.push('# Auditoria CMED (09/11/2026) & Sugestor de Moléculas — Base `bandeirante`');
    lines.push('');
    lines.push(`- **Planilha CMED carregada:** \`Lista_PMC_20261109_111901661.xlsx\` (${cmed.totalRows} apresentações oficiais)`);
    lines.push(`- **Medicamentos ativos analisados (filial 2 + vinculados):** ${prods.length}`);
    lines.push(
      `- **Match automático com CMED (EAN-first -> Registro MS):** ${matchCmedTotal} (${((matchCmedTotal * 100) / prods.length).toFixed(1)}%) — \`produto.barras\`: ${matchByProdBarras} | \`barras\` adicionais: +${matchByExtraBarras} | \`gtin14\`: +${matchByGtin14} | fallback \`registro_ms\`: +${matchByRegFallback}`
    );
    lines.push(`- **Divergências detectadas entre EAN e \`registro_ms\` cadastrado:** ${eanMsDivergences.length} (priorizado EAN)`);
    lines.push(`- **Grupos duplicados em \`produto_apresentacao\`:** ${duplicatedBigGroups.length} chaves equivalentes repetidas (ex.: 20cp vs 20 cp, CLOR. vs CLORIDRATO DE)`);
    lines.push(`- **Conflitos detectados em SKUs já vinculados no BIG:** ${conflicts.length} divergências de substância/MG/embalagem/forma`);
    lines.push(`- **Novos grupos multi-laboratório sugeridos (>=3 labs e com giro):** ${topSuggested.length} grupos`);
    lines.push('');

    lines.push('## 1. Amostra de Grupos Duplicados em `produto_apresentacao` (Top 15)');
    lines.push('');
    lines.push('| Chave Normalizada | Qtd Duplicados | IDs e Nomes no BIG |');
    lines.push('| :--- | :---: | :--- |');
    for (const [k, arr] of duplicatedBigGroups.slice(0, 15)) {
      const desc = arr.map((g) => `#${g.produto_apresentacao_id} (${g.substancia} | ${g.concentracao} | ${g.qtd_forma_farmaceutica})`).join('; ');
      lines.push(`| \`${k}\` | ${arr.length} | ${desc} |`);
    }
    lines.push('');

    lines.push('## 2. Erros Detectados nos Vínculos Atuais do BIG (Top 30)');
    lines.push('');
    lines.push('| Grupo Atual BIG | SKU | Descrição do Produto | Detectado (`Fonte`) | Motivo do Conflito |');
    lines.push('| :--- | :---: | :--- | :--- | :--- |');
    for (const c of conflicts.slice(0, 30)) {
      lines.push(`| #${c.grupoId} ${c.grupoNome} | \`${c.produtoId}\` | ${c.descricao.replace(/\|/g, '/')} | \`${c.chaveDetectada}\` (${c.fonte}) | ${c.motivos} |`);
    }
    lines.push('');

    lines.push('## 3. Top 25 Novas Moléculas Sugeridas (Sem Vínculo Atual, >= 3 Labs, com Regra 28~30 CP)');
    lines.push('');
    lines.push('| Chave Canônica | SKUs | Labs | Embalagens Agrupadas | Demanda/Dia | Estoque Atual | Cobertura (dias) | Exemplos de SKUs |');
    lines.push('| :--- | :---: | :---: | :--- | ---: | ---: | ---: | :--- |');
    for (const g of topSuggested.slice(0, 25)) {
      const cob = g.demandaTotal > 0 ? (g.estoqueTotal / g.demandaTotal).toFixed(0) : '0';
      const ex = g.skus
        .sort((a, b) => Number(b.demanda) - Number(a.demanda))
        .slice(0, 3)
        .map((s) => `${s.Produto_id} (${s.labora || '?'}, est:${s.estoque}, dem:${Number(s.demanda).toFixed(1)})`)
        .join('; ');
      lines.push(
        `| \`${g.key}\` | ${g.skus.length} | ${g.labs.size} | ${[...g.packVariants].join(', ')} | ${g.demandaTotal.toFixed(1)} | ${g.estoqueTotal} | ${cob}d | ${ex} |`
      );
    }

    if (eanMsDivergences.length > 0) {
      lines.push('');
      lines.push('## 4. Divergências EAN × `registro_ms` (Top 15 — Prioridade aplicada: EAN)');
      lines.push('');
      lines.push('| SKU | Descrição | CMED via EAN | CMED via `registro_ms` |');
      lines.push('| :---: | :--- | :--- | :--- |');
      for (const d of eanMsDivergences.slice(0, 15)) {
        lines.push(`| \`${d.produtoId}\` | ${d.descricao.replace(/\|/g, '/')} | \`${d.eanKey}\` (${d.eanReg}) | \`${d.msKey}\` (${d.msReg}) |`);
      }
    }

    const outPath = 'C:/Users/quemf/.gemini/antigravity/scratch/linx_farma_big/auditoria_moleculas_bandeirante.md';
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Relatorio salvo em ${outPath}`);
    console.log(`Resumo: Match CMED=${matchCmedTotal}/${prods.length} (prod.barras=${matchByProdBarras}, barras=${matchByExtraBarras}, gtin14=${matchByGtin14}, reg_fallback=${matchByRegFallback}) | EAN!=MS=${eanMsDivergences.length} | Duplicados=${duplicatedBigGroups.length} | Conflitos=${conflicts.length} | Novos Grupos (>=3 labs)=${topSuggested.length}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});


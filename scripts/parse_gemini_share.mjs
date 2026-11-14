import fs from 'node:fs';

const html = fs.readFileSync('C:/Users/quemf/.gemini/antigravity/brain/61b1a913-8f27-4e4e-8d9b-22613ace1722/scratch/gemini_share.html', 'utf8');

const keywords = ['compras', 'estoque', 'curva', 'farmacia', 'demanda', 'linx', 'gemini'];
for (const kw of keywords) {
  let idx = 0;
  let matches = 0;
  while ((idx = html.toLowerCase().indexOf(kw, idx)) !== -1) {
    matches++;
    if (matches <= 2) {
      console.log(`Keyword [${kw}] at ${idx}:`, html.slice(Math.max(0, idx - 40), idx + 160));
    }
    idx += kw.length;
  }
  console.log(`Total occurrences of [${kw}]:`, matches);
}


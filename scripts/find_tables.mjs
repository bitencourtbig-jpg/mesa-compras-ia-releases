import fs from 'node:fs';
const s = fs.readFileSync('src/store/analyticsDb.mjs', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('molecule_de_para') || l.includes('CREATE TABLE')) {
    console.log(`${i + 1}: ${l}`);
  }
});

import fs from 'node:fs';
const s = fs.readFileSync('src/server.mjs', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes("'/api/skus'") || l.includes('tab === \'buy\'') || l.includes('tab === \'all\'') || l.includes('tab === \'exceptions\'')) {
    console.log(`${i + 1}: ${l}`);
  }
});

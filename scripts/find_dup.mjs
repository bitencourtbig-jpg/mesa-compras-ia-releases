import fs from 'node:fs';
const s = fs.readFileSync('src/store/analyticsDb.mjs', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('function recordBuyerLearning')) {
    console.log(`${i + 1}: ${l}`);
  }
});

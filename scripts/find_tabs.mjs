import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');
let found = false;
let count = 0;
lines.forEach((l, i) => {
  if (l.includes('sku-tabs')) {
    found = true;
  }
  if (found && count < 35) {
    console.log(`${i + 1}: ${l}`);
    count++;
  }
});

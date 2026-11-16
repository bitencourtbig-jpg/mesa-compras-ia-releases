import fs from 'node:fs';
const serverJs = fs.readFileSync('src/server.mjs', 'utf8');
const lines = serverJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('/api/remanejamento') || l.includes('expiringLots')) {
    console.log((i+1) + ': ' + l.slice(0, 120));
  }
});

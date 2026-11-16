import fs from 'node:fs';
const s = fs.readFileSync('src/server.mjs', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes("pathname === '/api/overview'") || l.includes('getFiliaisPolicies')) {
    console.log(`${i + 1}: ${l}`);
  }
});

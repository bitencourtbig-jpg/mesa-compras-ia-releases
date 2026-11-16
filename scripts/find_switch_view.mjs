import fs from 'node:fs';
const appJs = fs.readFileSync('public/app.js', 'utf8');
const lines = appJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('function switchView')) {
    console.log(`${i + 1}: ${l}`);
  }
});

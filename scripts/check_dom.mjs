import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const appJs = fs.readFileSync('public/app.js', 'utf8');

const regex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const ids = new Set();
let match;
while ((match = regex.exec(appJs)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  const pattern1 = 'id="' + id + '"';
  const pattern2 = "id='" + id + "'";
  if (!html.includes(pattern1) && !html.includes(pattern2)) {
    missing.push(id);
  }
}

console.log('Total IDs in app.js:', ids.size);
console.log('Missing in index.html (may be generated dynamically):', missing);


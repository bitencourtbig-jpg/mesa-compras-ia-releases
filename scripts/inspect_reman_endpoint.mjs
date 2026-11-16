import fs from 'fs';

const content = fs.readFileSync('src/server.mjs', 'utf8');
const pos = content.indexOf("pathname === '/api/remanejamento'");
console.log(content.slice(pos, pos + 1500));

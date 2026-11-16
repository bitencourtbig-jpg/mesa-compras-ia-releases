import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const start = html.indexOf('id="view-transfers"');
const end = html.indexOf('id="view-pbm"');

console.log('view-transfers section:');
console.log(html.slice(start, end));

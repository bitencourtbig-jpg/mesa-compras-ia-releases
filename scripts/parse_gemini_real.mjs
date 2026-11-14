import fs from 'node:fs';

const text = fs.readFileSync('C:/Users/quemf/.gemini/antigravity/brain/61b1a913-8f27-4e4e-8d9b-22613ace1722/scratch/gemini_real_share.html', 'utf8');

const metaOgDesc = text.match(/<meta property="og:description" content="([^"]+)"/i);
if (metaOgDesc) console.log('og:description:', metaOgDesc[1]);

const metaTitle = text.match(/<title>([^<]+)<\/title>/i);
if (metaTitle) console.log('title:', metaTitle[1]);

// Let's inspect all script tags
const scripts = text.match(/<script[\s\S]*?<\/script>/gi) || [];
console.log('Total script tags:', scripts.length);

for (let i = 0; i < scripts.length; i++) {
  const s = scripts[i];
  if (s.includes('AF_initDataCallback') || s.includes('window.WIZ_global_data') || s.includes('ds:')) {
    console.log(`Script ${i} matches callback/data, length: ${s.length}`);
    fs.writeFileSync(`C:/Users/quemf/.gemini/antigravity/brain/61b1a913-8f27-4e4e-8d9b-22613ace1722/scratch/script_${i}.js`, s, 'utf8');
  }
}


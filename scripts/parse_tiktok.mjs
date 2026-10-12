import fs from 'node:fs';

const html = fs.readFileSync('assets/tiktok_dom.html', 'utf8');

const metas = [];
const metaRegex = /<meta\s+([^>]+)>/gi;
let m;
while ((m = metaRegex.exec(html)) !== null) {
  metas.push(m[1]);
}

for (const meta of metas) {
  if (/property="(og:|twitter:)|name="(description|title)/i.test(meta)) {
    console.log('META:', meta);
  }
}

const title = html.match(/<title>([^<]+)<\/title>/i);
if (title) console.log('TITLE:', title[1]);

// Look for SIGI_STATE or __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON
const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i) ||
                  html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);

if (jsonMatch) {
  try {
    const data = JSON.parse(jsonMatch[1]);
    console.log('Found structured JSON data keys:', Object.keys(data));
    const itemModule = data.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    if (itemModule) {
      console.log('Video description:', itemModule.desc);
      console.log('Video duration:', itemModule.video?.duration);
      console.log('Play address:', itemModule.video?.playAddr);
      console.log('Download address:', itemModule.video?.downloadAddr);
      console.log('Cover:', itemModule.video?.cover);
    }
  } catch (e) {
    console.log('JSON parse error:', e.message);
  }
}

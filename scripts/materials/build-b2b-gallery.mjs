import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'node:crypto';

const directory = path.resolve('public/materials/b2b-f');
const originals = path.resolve('.research/b2b-f-library');
const manifest = JSON.parse(await fs.readFile(path.join(originals, 'manifest.json'), 'utf8'));
await fs.mkdir(path.join(directory, 'images'), { recursive: true });
const byHash = new Map();
for (const material of manifest.materials) {
  for (const image of material.images) {
    if (image.kind !== 'supplier-design-download') continue;
    if (image.usage === 'unspecified') { image.kind = 'supplier-reference-download'; continue; }
    const entries = byHash.get(image.sha256) || [];
    entries.push({ material, image });
    byHash.set(image.sha256, entries);
  }
}
const sourceConflicts = [];
for (const entries of byHash.values()) {
  const codes = [...new Set(entries.map(x => x.material.decorCode))];
  if (codes.length < 2) continue;
  sourceConflicts.push({ codes, materials: [...new Set(entries.map(x => x.material.name))] });
  for (const { material, image } of entries) {
    image.sharedDecorCodes = codes;
    material.requiresSourceReview = true;
    material.candidateBaseColor = null;
  }
}
manifest.counts.designDownloads = manifest.materials.reduce((n, m) => n + m.images.filter(i => i.kind === 'supplier-design-download').length, 0);
manifest.counts.materialsWithDesignFiles = manifest.materials.filter(m => m.images.some(i => i.kind === 'supplier-design-download')).length;
manifest.counts.sourceReviewRequired = manifest.materials.filter(m => m.requiresSourceReview).length;
manifest.sourceConflicts = sourceConflicts;
await fs.writeFile(path.join(originals, 'source-audit.json'), `${JSON.stringify({ counts: manifest.counts, sourceConflicts }, null, 2)}\n`);
let totalBytes = 0;
let originalBytes = 0;
for (const material of manifest.materials) {
  material.candidateBaseColor = material.requiresSourceReview ? null : (material.images.find(i => i.kind === 'supplier-design-download' && i.usage === 'render') || material.images.find(i => i.kind === 'supplier-design-download') || material.images.find(i => i.kind === 'catalog-swatch'))?.file || null;
  const candidate = material.candidateBaseColor;
  for (const image of material.images) {
    const bytes = await fs.readFile(path.join(originals, image.file));
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== image.width || metadata.height !== image.height) throw new Error(`Invalid dimensions: ${image.file}`);
    originalBytes += bytes.length;
    image.original = { file: `.research/b2b-f-library/${image.file}`, width: image.width, height: image.height, bytes: image.bytes, sha256: image.sha256 };
    const optimized = await sharp(bytes).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    const optimizedMeta = await sharp(optimized).metadata();
    const originalFile = image.file;
    image.file = image.file.replace(/\.[^.]+$/, '.webp');
    image.width = optimizedMeta.width;
    image.height = optimizedMeta.height;
    image.bytes = optimized.length;
    image.sha256 = crypto.createHash('sha256').update(optimized).digest('hex');
    await fs.writeFile(path.join(directory, image.file), optimized);
    if (candidate === originalFile) material.candidateBaseColor = image.file;
    totalBytes += optimized.length;
  }
}
manifest.notes = 'WebP derivatives, maximum 2048 px, preserving aspect ratio. Unchanged supplier originals are stored locally under .research/b2b-f-library. No normal/roughness maps synthesized; seamlessness and physical repeat require review.';
await fs.writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const json = JSON.stringify(manifest).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="mn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>B2B-F · Хавтангийн материалын сан</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f3ef;color:#202923;font:15px/1.5 system-ui,sans-serif}header{background:#163a31;color:#fff;padding:36px max(24px,calc((100vw - 1440px)/2))}h1{font-size:clamp(25px,4vw,40px);line-height:1.15;margin:8px 0 15px}header p{max-width:820px;color:#d9e7df}.eyebrow{font-size:12px;letter-spacing:.15em}.stats{display:flex;gap:24px;flex-wrap:wrap}.stats strong{font-size:27px;display:block}.stats span{font-size:13px;color:#b9d0c3}main{max-width:1488px;margin:auto;padding:24px}.controls{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}input,select{font:inherit;border:1px solid #cbcfc7;border-radius:8px;padding:12px;background:white;min-width:200px}input{flex:1}.notice{font-size:13px;color:#5d675f;max-width:1000px}#count{color:#5d675f;margin:20px 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}.card{background:#fff;border:1px solid #e1e4dc;border-radius:12px;overflow:hidden}.sample{height:210px;background:#eeece7;display:flex;align-items:center;justify-content:center}.sample img{width:100%;height:100%;object-fit:contain}.body{padding:17px}.badge{font-size:11px;background:#e9f2e9;color:#356043;padding:4px 8px;border-radius:4px;display:inline-block}.badge.swatch{background:#f7eddb;color:#805c27}h2{font-size:16px;margin:10px 0 5px}.category,.size{font-size:12px;color:#667067}.links{display:flex;gap:14px;margin-top:16px}a{color:#155b46;text-decoration:none;font-size:13px}a:hover{text-decoration:underline}footer{padding:30px 0;font-size:13px;color:#667067}.empty{padding:50px;color:#667067}@media(max-width:540px){main{padding:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sample{height:160px}.body{padding:12px}h2{font-size:13px}.links{flex-wrap:wrap;gap:8px}input,select{min-width:0;width:100%}header{padding:28px 20px}}
</style>
<header><div class="eyebrow">МАТЕРИАЛЫН ЦУГЛУУЛГА · 2026.10.22</div><h1>Хавтангийн хээгээ сонгоорой</h1><p>B2B-F сайтаас цуглуулсан ДСП, MDF, арын хана, ажлын тавцан болон бусад хавтангийн хээ. Код, ангиллаар хайж, эх файлыг татах боломжтой.</p><div class="stats"><div><strong>${manifest.counts.products}</strong><span>хавтангийн бүртгэл</span></div><div><strong>${manifest.counts.designDownloads}</strong><span>нийлүүлэгчийн texture файл</span></div><div><strong>${manifest.counts.images}</strong><span>нийт зураг</span></div></div></header>
<main><div class="controls"><input id="search" type="search" aria-label="Хээний код эсвэл нэр" placeholder="Код, нэрээр хайх · H3303, Oak, White…"><select id="category" aria-label="Хавтангийн төрөл"><option value="">Бүх төрөл</option></select><select id="kind" aria-label="Файлын төрөл"><option value="">Бүх зураг</option><option value="design">Texture файлтай</option><option value="swatch">Зөвхөн бүтээгдэхүүний зураг</option></select></div><p class="notice">“Texture” тэмдэгтэй файл нь нийлүүлэгчийн татах холбоосоос авсан эх зураг. Давтаж залгахад хээ нь таарах эсэх, бодит хэмжээ, normal болон roughness зураг баталгаажаагүй. “Бүтээгдэхүүний зураг” тэмдэгтэйг 3D материалд хэрэглэхээс өмнө шалгана.</p><div id="count"></div><div id="grid" class="grid"></div><footer>Эх сурвалж: <a href="https://b2b-f.mn/mn" target="_blank" rel="noopener">B2B-F</a> · Файлуудыг эхээр нь хадгалсан · <a href="manifest.json" download>Материалын бүртгэл (JSON)</a></footer></main>
<script id="data" type="application/json">${json}</script>
<script>
const data=JSON.parse(document.getElementById('data').textContent);const search=document.getElementById('search'),category=document.getElementById('category'),kind=document.getElementById('kind'),grid=document.getElementById('grid');
const labels={mfc:'ДСП','mdf-perfect-sense':'MDF',laminates:'Ламинат / Хуулга','thin-chipboard':'Аргиллит',chipboard:'Арын хана',worktop:'Ажлын тавцан',compact:'Компакт'};
for(const [value,label] of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=label;category.append(option)}
function render(){const q=search.value.trim().toLocaleLowerCase();const items=data.materials.filter(m=>!q||m.name.toLocaleLowerCase().includes(q)).filter(m=>!category.value||m.categories.includes(category.value)).filter(m=>!kind.value||(kind.value==='design')===m.images.some(i=>i.kind==='supplier-design-download'));grid.replaceChildren();document.getElementById('count').textContent=items.length+' хээ';for(const m of items){const image=m.images.find(i=>i.kind==='supplier-design-download')||m.images[0];const card=document.createElement('article');card.className='card';const sample=document.createElement('div');sample.className='sample';if(image){const img=document.createElement('img');img.src=image.file;img.alt=m.name;img.loading='lazy';sample.append(img)}const body=document.createElement('div');body.className='body';const badge=document.createElement('span');const isDesign=image?.kind==='supplier-design-download';badge.className='badge'+(isDesign?'':' swatch');badge.textContent=isDesign?'TEXTURE':'БҮТЭЭГДЭХҮҮНИЙ ЗУРАГ';const title=document.createElement('h2');title.textContent=m.name;const type=document.createElement('div');type.className='category';type.textContent=m.categories.map(c=>labels[c]).join(' · ');const size=document.createElement('div');size.className='size';size.textContent=image?image.width+' × '+image.height+' px':'Зураг татагдаагүй';const links=document.createElement('div');links.className='links';if(image){const download=document.createElement('a');download.href=image.file;download.download='';download.textContent='Файл татах';links.append(download)}const source=document.createElement('a');source.href=m.sourceUrl;source.target='_blank';source.rel='noopener';source.textContent='Эх сурвалж ↗';links.append(source);body.append(badge,title,type,size,links);card.append(sample,body);grid.append(card)}}
for(const control of [search,category,kind])control.addEventListener('input',render);render();
</script></html>`;
const galleryHtml = html
  .replace('эх файлыг татах', 'вебэд зориулсан зургийг татах')
  .replace('Файлуудыг эхээр нь хадгалсан', 'Вебэд зориулсан WebP хувилбар')
  .replace("const image=m.images.find(i=>i.kind==='supplier-design-download')||m.images[0]", "const image=m.requiresSourceReview?m.images.find(i=>i.kind==='catalog-swatch'):m.images.find(i=>i.kind==='supplier-design-download'&&i.usage==='render')||m.images.find(i=>i.kind==='supplier-design-download')||m.images.find(i=>i.kind==='catalog-swatch')||m.images[0]")
  .replace("badge.textContent=isDesign?'TEXTURE':'БҮТЭЭГДЭХҮҮНИЙ ЗУРАГ'", "badge.textContent=m.requiresSourceReview?'ЭХ ХОЛБООСЫГ ШАЛГАХ':isDesign?'TEXTURE':'БҮТЭЭГДЭХҮҮНИЙ ЗУРАГ'")
  .replace('3D материалд хэрэглэхээс өмнө шалгана.', `3D материалд хэрэглэхээс өмнө шалгана. ${manifest.counts.sourceReviewRequired} бүртгэлийн татах холбоос өөр кодын хавтантай ижил файл зааж байгаа тул бүтээгдэхүүний зургийг харуулав.`);
await fs.writeFile(path.join(directory, 'index.html'), galleryHtml);
const previews = manifest.materials.filter(m => !m.requiresSourceReview && m.images.some(i => i.kind === 'supplier-design-download')).slice(0, 24);
const composites = [];
for (let n = 0; n < previews.length; n++) {
  const material = previews[n];
  const image = material.images.find(i => i.usage === 'render') || material.images.find(i => i.kind === 'supplier-design-download');
  composites.push({ input: await sharp(path.join(directory, image.file)).resize(220, 180, { fit: 'contain', background: '#f4f3ef' }).jpeg().toBuffer(), left: (n % 6) * 240 + 10, top: Math.floor(n / 6) * 210 + 10 });
  const label = material.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').slice(0, 34);
  composites.push({ input: Buffer.from(`<svg width="230" height="25"><text x="0" y="17" font-family="Arial" font-size="11" fill="#20332c">${label}</text></svg>`), left: (n % 6) * 240 + 10, top: Math.floor(n / 6) * 210 + 190 });
}
if (previews.length) await sharp({ create: { width: 1440, height: Math.ceil(previews.length / 6) * 210, channels: 3, background: '#ffffff' } }).composite(composites).jpeg({ quality: 88 }).toFile(path.join(directory, 'contact-sheet.jpg'));
console.log(JSON.stringify({ ...manifest.counts, totalMB: +(totalBytes / 1024 / 1024).toFixed(2), originalMB: +(originalBytes / 1024 / 1024).toFixed(2), verified: true }));

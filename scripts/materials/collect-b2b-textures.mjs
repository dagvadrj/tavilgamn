import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Category seeds are exported from the hydrated, public category pages.
// The site's server-rendered category HTML can contain unrelated products.
const root = process.cwd();
const cache = path.join(root, '.research/b2b-f-source');
const output = path.join(root, '.research/b2b-f-library');
const categories = ['mfc', 'mdf-perfect-sense', 'laminates', 'thin-chipboard', 'chipboard', 'worktop', 'compact'];
const limit = Number(process.argv.find(x => x.startsWith('--limit='))?.split('=')[1] || Infinity);
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const unique = values => [...new Set(values)];
await fs.mkdir(path.join(cache, 'details'), { recursive: true });
await fs.mkdir(path.join(output, 'images'), { recursive: true });

async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'MaterialCatalog/1.0 (public texture download)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const size = Number(response.headers.get('content-length'));
  if (size > 150 * 1024 * 1024) throw new Error('File exceeds 150 MB');
  return response;
}

async function downloadImage(url, key) {
  const recordPath = path.join(cache, `${key}.asset.json`);
  try {
    const previous = JSON.parse(await fs.readFile(recordPath, 'utf8'));
    await fs.access(path.join(output, previous.file));
    return previous;
  } catch { /* Download an uncached image. */ }
  const response = await request(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 150 * 1024 * 1024) throw new Error('File exceeds 150 MB');
  if (bytes.subarray(0, 5).toString() === '%PDF-') throw new Error('Supplier link is a PDF document, not an image');
  const meta = await sharp(bytes).metadata();
  if (!['jpeg', 'png', 'webp', 'avif', 'tiff'].includes(meta.format)) throw new Error(`Unsupported image: ${meta.format}`);
  const extension = meta.format === 'jpeg' ? 'jpg' : meta.format;
  const file = `images/${key}.${extension}`;
  await fs.writeFile(path.join(output, file), bytes);
  const result = { file, width: meta.width, height: meta.height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), sourceUrl: url };
  await fs.writeFile(recordPath, JSON.stringify(result, null, 2));
  return result;
}

const products = new Map();
const savedSeeds = JSON.parse(await fs.readFile(path.join(root, 'research/b2b-f-category-seeds-2026-10-22.json'), 'utf8'));
for (const category of categories) {
  let items;
  try { items = JSON.parse(await fs.readFile(path.join(cache, `${category}.json`), 'utf8')); }
  catch { items = savedSeeds[category]; }
  if (!items.length || items.some(x => !x.sourceUrl || !x.category)) throw new Error(`Invalid category seed: ${category}`);
  for (const item of items) {
    const existing = products.get(item.sourceUrl);
    if (existing) existing.categories = unique([...existing.categories, category]);
    else products.set(item.sourceUrl, { ...item, categories: [category] });
  }
}
const items = [...products.values()].slice(0, limit);
const result = [];
let cursor = 0;
async function worker() {
  while (cursor < items.length) {
    const item = items[cursor++];
    const slug = new URL(item.sourceUrl).pathname.split('/').pop();
    const id = crypto.createHash('sha256').update(item.sourceUrl).digest('hex').slice(0, 10);
    const code = item.name.match(/^[A-Za-z]\d+/)?.[0]?.toUpperCase() || 'board';
    const key = `${code.toLowerCase()}-${id}`;
    const record = { id: `b2bf-${key}`, name: item.name, decorCode: code, category: item.category, categories: item.categories, sourceUrl: item.sourceUrl, designDownloads: [], images: [], issues: [], maps: { normal: null, roughness: null, metalness: null }, seamless: 'unverified', physicalRepeatMm: null };
    try {
      const detailPath = path.join(cache, 'details', `${slug}.html`);
      let html;
      try { html = await fs.readFile(detailPath, 'utf8'); }
      catch { html = await (await request(item.sourceUrl)).text(); await fs.writeFile(detailPath, html); }
      // Next.js embeds the HTML description in escaped RSC strings.
      const readable = html.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\"/g, '"');
      const driveLinks = unique([...readable.matchAll(/https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view/g)].map(x => x[0]));
      for (let n = 0; n < driveLinks.length; n++) {
        const link = driveLinks[n];
        const fileId = link.match(/\/d\/([^/]+)/)[1];
        const linkPosition = readable.indexOf(link);
        const row = readable.slice(readable.lastIndexOf('<tr', linkPosition), linkPosition);
        const usage = row.includes('Зурганд ашиглах') ? 'render' : row.includes('Хэвлэхэд тохиромжтой') ? 'print' : 'unspecified';
        const download = { sourceUrl: link, usage, status: 'pending' };
        record.designDownloads.push(download);
        try {
          const asset = await downloadImage(`https://drive.google.com/uc?export=download&id=${fileId}`, `${key}-design-${n + 1}`);
          download.status = 'downloaded';
          record.images.push({ ...asset, kind: 'supplier-design-download', usage, sourcePage: link });
        } catch (error) { download.status = 'unavailable'; download.error = error.message; }
      }
      // Preserve the actual listing swatch, even when the supplier download is unavailable.
      const detailImage = readable.match(/https:\/\/cdnp\.cody\.mn\/spree\/images\/\d+\/large\/[^"<>\s\\]+/)?.[0];
      const swatchUrl = detailImage || item.imageUrl;
      if (swatchUrl) {
        try { record.images.push({ ...await downloadImage(decode(swatchUrl), `${key}-${detailImage ? 'catalog-large' : 'swatch'}`), kind: 'catalog-swatch' }); }
        catch (error) { record.issues.push(`Swatch: ${error.message}`); }
      }
      record.candidateBaseColor = record.images.find(x => x.usage === 'render')?.file || record.images.find(x => x.kind === 'supplier-design-download')?.file || record.images[0]?.file || null;
    } catch (error) { record.issues.push(error.message); }
    result.push(record);
    console.log(`${result.length}/${items.length} ${item.name}: ${record.images.length} images, ${record.designDownloads.length} design links`);
  }
}
await Promise.all([worker(), worker(), worker()]);
result.sort((a, b) => a.name.localeCompare(b.name));
const manifest = { source: 'https://b2b-f.mn/mn', retrievedOn: '2026-10-22', notes: 'Original supplier files and catalog swatches, unchanged. No normal/roughness maps synthesized. Seamlessness and physical texture repeat have not been verified. Candidate base color requires visual review before production use.', counts: { products: result.length, images: result.reduce((n, x) => n + x.images.length, 0), designDownloads: result.reduce((n, x) => n + x.images.filter(i => i.kind === 'supplier-design-download').length, 0) }, materials: result };
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.counts));

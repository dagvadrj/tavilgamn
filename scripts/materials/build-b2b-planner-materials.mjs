import fs from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('public/materials/b2b-f');
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
const seen = new Set();
const materials = [];
for (const entry of manifest.materials) {
  if (entry.requiresSourceReview) continue;
  const image = entry.images.find(i => i.kind === 'supplier-design-download' && i.usage === 'render')
    ?? entry.images.find(i => i.kind === 'supplier-design-download');
  if (!image || !/^images\/[a-z0-9_-]+\.webp$/.test(image.file)) continue;
  const key = `${entry.name.trim().replace(/\s+/g, ' ').toLowerCase()}:${image.original?.sha256 ?? image.sha256}`;
  if (seen.has(key)) continue;
  seen.add(key);
  await fs.access(path.join(directory, image.file));
  materials.push({
    id: entry.id,
    name: `B2B-F · ${entry.name.trim().replace(/\s+/g, ' ')}`,
    surfaceKind: 'general',
    baseColor: '#FFFFFF',
    // Neutral preview values; these are not manufacturer-measured PBR maps.
    roughness: 0.65,
    metalness: 0,
    texturePaths: { baseColor: `/materials/b2b-f/${image.file}` },
    sourceUrl: entry.sourceUrl,
  });
}
await fs.writeFile(path.join(directory, 'planner-materials.json'), `${JSON.stringify({ source: manifest.source, retrievedOn: manifest.retrievedOn, materials }, null, 2)}\n`);
console.log(`${materials.length} supplier textures prepared for Kitchen Planner; conflicted links and catalog-only photos excluded.`);

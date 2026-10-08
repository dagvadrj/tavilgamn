// Convert the generated diffuse material into compact, aligned PBR assets.
// Usage: node scripts/materials/build-oak-assets.cjs <source-oak-image.png>
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs/promises');
async function buildOakAssets(source) {
  const directory = path.resolve(__dirname, '../../public/textures/room');
  await fs.mkdir(directory, { recursive: true });
  const size = 1024;
  const { data } = await sharp(source).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const height = new Float32Array(size * size), normal = Buffer.alloc(size * size * 3), roughness = Buffer.alloc(size * size);
  for (let i = 0; i < height.length; i++) height[i] = (.2126 * data[i * 3] + .7152 * data[i * 3 + 1] + .0722 * data[i * 3 + 2]) / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (height[y * size + (x + size - 1) % size] - height[y * size + (x + 1) % size]) * 2;
    const dy = (height[((y + size - 1) % size) * size + x] - height[((y + 1) % size) * size + x]) * 2;
    const length = Math.hypot(dx, dy, 1);
    normal[i * 3] = Math.round((dx / length * .5 + .5) * 255);
    normal[i * 3 + 1] = Math.round((dy / length * .5 + .5) * 255);
    normal[i * 3 + 2] = Math.round((1 / length * .5 + .5) * 255);
    roughness[i] = Math.round(Math.max(.42, Math.min(.72, .48 + (1 - height[i]) * .13 + Math.hypot(dx, dy) * .32)) * 255);
  }
  await Promise.all([
    sharp(data, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 88 }).toFile(path.join(directory, 'oak-natural-v1-color.webp')),
    sharp(normal, { raw: { width: size, height: size, channels: 3 } }).resize(512, 512).png({ palette: true, colors: 256, dither: 0 }).toFile(path.join(directory, 'oak-natural-v1-normal.png')),
    sharp(roughness, { raw: { width: size, height: size, channels: 1 } }).resize(512, 512).png({ palette: true, colors: 32, dither: 0 }).toFile(path.join(directory, 'oak-natural-v1-roughness.png')),
  ]);
  return Promise.all(['oak-natural-v1-color.webp', 'oak-natural-v1-normal.png', 'oak-natural-v1-roughness.png'].map(async file => ({ file, bytes: (await fs.stat(path.join(directory, file))).size })));
}
module.exports = { buildOakAssets };
if (require.main === module) {
  if (!process.argv[2]) { console.error('Pass the generated source image path.'); process.exitCode = 1; }
  else buildOakAssets(process.argv[2]).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}

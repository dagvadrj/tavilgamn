const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createKitchenTexture } = loadSource('src/three/kitchenTextures.ts');

test('procedural kitchen materials filter correctly when viewed from far away or at an angle', () => {
  for (const finish of ['oak', 'walnut', 'marble', 'concrete']) {
    const texture = createKitchenTexture(finish);
    assert.equal(texture.image.width, 256);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.wrapS, THREE.RepeatWrapping);
    assert.ok(texture.anisotropy >= 4);
    texture.dispose();
  }
  assert.equal(createKitchenTexture('matte'), null);
  assert.equal(createKitchenTexture('gloss'), null);
});

test('wood and marble patterns remain subtle and do not add harsh dark stripes', () => {
  for (const finish of ['oak', 'walnut', 'marble']) {
    const texture = createKitchenTexture(finish);
    const pixels = texture.image.data;
    let min = 255, max = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      min = Math.min(min, pixels[index]); max = Math.max(max, pixels[index]);
      assert.equal(pixels[index], pixels[index + 1]);
      assert.equal(pixels[index + 3], 255);
    }
    assert.ok(min >= 220, `${finish}: minimum ${min}`);
    assert.ok(max - min < 36, `${finish}: contrast ${max - min}`);
    texture.dispose();
  }
});

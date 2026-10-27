import * as THREE from "three";

export interface ModelResourceBytes {
  geometryBytes: number;
  textureBytes: number;
  totalBytes: number;
}

/** Residency estimate, distinct from encoded GLB transfer bytes. Compressed
 * texture mip payloads stay compressed; ordinary images expand on upload. */
export function modelResourceBytes(scene: THREE.Object3D): ModelResourceBytes {
  const buffers = new Set<ArrayBufferLike>();
  const textures = new Set<THREE.Texture>();
  const sourceSlots = new Set<string>();
  let geometryBytes = 0,
    textureBytes = 0;
  const add = (
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  ) => {
    const array =
      attribute instanceof THREE.InterleavedBufferAttribute
        ? attribute.data.array
        : attribute.array;
    if (!buffers.has(array.buffer)) {
      buffers.add(array.buffer);
      geometryBytes += array.buffer.byteLength;
    }
  };
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    Object.values(geometry.attributes).forEach(add);
    if (geometry.index) add(geometry.index);
    Object.values(geometry.morphAttributes).forEach((attributes) =>
      attributes.forEach(add),
    );
    if (object instanceof THREE.InstancedMesh) {
      add(object.instanceMatrix);
      if (object.instanceColor) add(object.instanceColor);
    }
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
  });
  for (const texture of textures) {
    // Texture objects sharing the same source and sampler can share a GL upload.
    const key = [
      texture.source.uuid,
      texture.format,
      texture.type,
      texture.colorSpace,
      texture.minFilter,
      texture.magFilter,
      texture.wrapS,
      texture.wrapT,
      (texture as THREE.Data3DTexture).wrapR || 0,
      texture.anisotropy,
      texture.internalFormat,
      texture.premultiplyAlpha,
      texture.unpackAlignment,
      texture.flipY,
      texture.generateMipmaps,
    ].join(":");
    if (sourceSlots.has(key)) continue;
    sourceSlots.add(key);
    if (texture instanceof THREE.CompressedTexture) {
      textureBytes += (texture.mipmaps ?? []).reduce(
        (sum, mip) => sum + (mip.data?.byteLength ?? 0),
        0,
      );
      continue;
    }
    const images = Array.isArray(texture.image)
      ? texture.image
      : [texture.image];
    const channels =
      texture.format === THREE.RedFormat
        ? 1
        : texture.format === THREE.RGFormat
          ? 2
          : 4;
    const bytes =
      texture.type === THREE.FloatType ||
      texture.type === THREE.UnsignedIntType ||
      texture.type === THREE.IntType
        ? 4
        : texture.type === THREE.HalfFloatType ||
            texture.type === THREE.UnsignedShortType
          ? 2
          : 1;
    for (const image of images) {
      const width = image?.width || image?.videoWidth || 0,
        height = image?.height || image?.videoHeight || 0;
      const mipmaps = (texture.mipmaps ?? []) as {
        data?: ArrayBufferView;
        width: number;
        height: number;
      }[];
      if (mipmaps.length) {
        textureBytes += mipmaps.reduce(
          (sum, mip) =>
            sum +
            (mip.data?.byteLength ?? mip.width * mip.height * channels * bytes),
          0,
        );
      } else
        textureBytes +=
          width *
          height *
          channels *
          bytes *
          (texture.generateMipmaps ? 4 / 3 : 1);
    }
  }
  return {
    geometryBytes,
    textureBytes: Math.ceil(textureBytes),
    totalBytes: Math.ceil(geometryBytes + textureBytes),
  };
}

/** This is only spare-cache allowance. Leased scene models are never evicted. */
export function idleModelCacheBudget(deviceMemory?: number) {
  return (
    (deviceMemory !== undefined && deviceMemory <= 4 ? 32 : 64) * 1024 * 1024
  );
}

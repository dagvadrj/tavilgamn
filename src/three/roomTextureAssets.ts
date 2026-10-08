import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

// Images are shared; each surface keeps independent UV transforms and disposes
// its own texture clones. Three shares their immutable image source on the GPU.
const images = new Map<string, Promise<Texture>>();
function loadImage(url: string): Promise<Texture> {
  let pending = images.get(url);
  if (!pending) {
    pending = new TextureLoader().loadAsync(url).catch(error => { images.delete(url); throw error; });
    images.set(url, pending);
  }
  return pending;
}
export async function loadRoomAssetTextures(paths: { color: string; normal: string; roughness: string }, anisotropy: number) {
  const sources = await Promise.all([loadImage(paths.color), loadImage(paths.normal), loadImage(paths.roughness)]);
  const textures = sources.map((source, index) => {
    const texture = source.clone();
    texture.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.flipY = false;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  });
  return { map: textures[0], normalMap: textures[1], roughnessMap: textures[2] };
}

import * as THREE from "three";
import type { Material } from "@/lib/types";

export const PRODUCT_FINISH: Record<Material, { roughness: number; metalness: number; bumpScale: number }> = {
  wood: { roughness: .65, metalness: .02, bumpScale: .003 },
  fabric: { roughness: .9, metalness: 0, bumpScale: .006 },
  leather: { roughness: .42, metalness: 0, bumpScale: .004 },
  velvet: { roughness: .98, metalness: 0, bumpScale: .003 },
  metal: { roughness: .25, metalness: .85, bumpScale: 0 },
};

/** Small deterministic surface maps: no downloads or model reloads on swatch changes. */
export function createProductTexture(finish: Material): THREE.DataTexture | null {
  if (finish === "metal") return null;
  const size = 128, data = new Uint8Array(size * size * 4), heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((x * 37 + y * 101 + x * y * 13) % 47) / 47;
    const grain = finish === "wood" ? Math.sin(x * .5 + Math.sin(y * .13) * 1.8) * 12 + Math.sin(x * .12) * 8
      : finish === "fabric" ? ((x % 4 < 2) !== (y % 4 < 2) ? 12 : -12)
      : finish === "leather" ? noise * 25 - 12
      : noise * 8 - 4;
    heights[y * size + x] = grain / 24;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
    const dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
    const normal = new THREE.Vector3(-dx, -dy, 1).normalize(), i = (y * size + x) * 4;
    data[i] = Math.round((normal.x * .5 + .5) * 255);
    data[i + 1] = Math.round((normal.y * .5 + .5) * 255);
    data[i + 2] = Math.round((normal.z * .5 + .5) * 255); data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(finish === "wood" ? 2 : 6, finish === "wood" ? 2 : 6);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function isConfigurableSurface(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) {
  if (mesh.userData.configurable === false || material.userData.configurable === false) return false;
  if (mesh.userData.configurable === true || material.userData.configurable === true) return true;
  return material.metalness < .5 && !(material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) &&
    !/glass|metal|chrome|leg|handle|hardware|frame|book|screen|trim|хөл|бариул/i.test(`${mesh.name} ${material.name}`);
}

type Transition = { key: string; start: THREE.Color; end: THREE.Color; roughness: number; metalness: number; elapsed: number };
export function createAppearanceController() {
  const textures = new Map<Material, THREE.DataTexture | null>();
  let transitions = new WeakMap<THREE.MeshStandardMaterial, Transition>();
  const configurable = new WeakSet<THREE.MeshStandardMaterial>();
  const ownedTextures = new Set<THREE.DataTexture>();
  return {
    update(root: THREE.Object3D, color: string, finish: Material, delta: number, reducedMotion = false) {
      let animating = false;
      const visited = new Set<THREE.Material>();
      const key = `${color}:${finish}`, target = PRODUCT_FINISH[finish];
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          if (visited.has(material)) continue;
          visited.add(material);
          let transition = transitions.get(material);
          if (!configurable.has(material)) {
            if (!isConfigurableSurface(object, material)) continue;
            configurable.add(material);
          }
          if (transition?.key !== key) {
            transition = { key, start: material.color.clone(), end: new THREE.Color(color), roughness: material.roughness, metalness: material.metalness, elapsed: 0 };
            transitions.set(material, transition);
            if (!textures.has(finish)) {
              const texture = createProductTexture(finish);
              textures.set(finish, texture);
              if (texture) ownedTextures.add(texture);
            }
            material.map = null;
            material.roughnessMap = null;
            material.metalnessMap = null;
            material.normalMap = textures.get(finish) ?? null;
            material.normalScale.set(target.bumpScale * 70, target.bumpScale * 70);
            material.bumpMap = null;
            material.needsUpdate = true;
          }
          transition!.elapsed += Math.max(0, delta);
          const t = reducedMotion ? 1 : Math.min(1, transition!.elapsed / .32);
          const ease = t * t * (3 - 2 * t);
          material.color.copy(transition!.start).lerp(transition!.end, ease);
          material.roughness = THREE.MathUtils.lerp(transition!.roughness, target.roughness, ease);
          material.metalness = THREE.MathUtils.lerp(transition!.metalness, target.metalness, ease);
          if (t < 1) animating = true;
        }
      });
      return animating;
    },
    dispose() { ownedTextures.forEach(texture => texture.dispose()); ownedTextures.clear(); textures.clear(); transitions = new WeakMap(); },
  };
}

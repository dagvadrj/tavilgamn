import * as THREE from "three";
import {
  KITCHEN_TEXTURE_KINDS,
  type KitchenTextureKind,
} from "@/lib/kitchenMaterials";

export type KitchenMaterialTextureSet = Partial<
  Record<KitchenTextureKind, THREE.Texture>
>;

type TextureEntry = {
  promise: Promise<THREE.Texture>;
  refs: number;
  texture?: THREE.Texture;
  idle?: ReturnType<typeof setTimeout>;
};

const pool = new Map<string, TextureEntry>();
let loader: THREE.TextureLoader | null = null;

function configureTexture(texture: THREE.Texture, kind: KitchenTextureKind) {
  texture.colorSpace =
    kind === "baseColor" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function acquireTexture(kind: KitchenTextureKind, url: string) {
  const key = `${kind}:${url}`;
  let entry = pool.get(key);
  if (!entry) {
    loader ??= new THREE.TextureLoader().setCrossOrigin("anonymous");
    entry = {
      refs: 0,
      promise: Promise.resolve(null as unknown as THREE.Texture),
    };
    const pending = entry;
    pool.set(key, entry);
    entry.promise = loader
      .loadAsync(url)
      .then((texture) => {
        pending.texture = configureTexture(texture, kind);
        return pending.texture;
      })
      .catch((error) => {
        pool.delete(key);
        throw error;
      });
  }
  if (entry.idle) clearTimeout(entry.idle);
  entry.refs++;
  const owned = entry;
  let released = false;
  return {
    kind,
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      owned.refs--;
      void owned.promise.then(
        () => {
          if (owned.refs || pool.get(key) !== owned) return;
          owned.idle = setTimeout(() => {
            if (!owned.refs && pool.get(key) === owned) {
              owned.texture?.dispose();
              pool.delete(key);
            }
          }, 30_000);
          if (typeof owned.idle === "object" && "unref" in owned.idle)
            owned.idle.unref();
        },
        () => undefined,
      );
    },
  };
}

export function acquireKitchenMaterialTextures(
  paths: Record<string, string> | undefined,
) {
  const leases = KITCHEN_TEXTURE_KINDS.flatMap((kind) => {
    const url = paths?.[kind];
    return typeof url === "string" && url ? [acquireTexture(kind, url)] : [];
  });
  let released = false;
  return {
    promise: Promise.allSettled(
      leases.map(async (lease) => [lease.kind, await lease.promise] as const),
    ).then(
      (results) =>
        Object.fromEntries(
          results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          ),
        ) as KitchenMaterialTextureSet,
    ),
    release() {
      if (released) return;
      released = true;
      leases.forEach((lease) => lease.release());
    },
  };
}

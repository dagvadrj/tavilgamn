import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { instanceRepeatedModules } from "./instanceModules";
export interface LoadedModel { scene: THREE.Group; bounds: THREE.Box3 }
interface Entry { promise: Promise<LoadedModel>; refs: number; ready?: LoadedModel; used: number }
interface Pool { loader: GLTFLoader; draco: DRACOLoader; ktx: KTX2Loader; entries: Map<string, Entry>; idle?: ReturnType<typeof setTimeout> }
const pools = new WeakMap<THREE.WebGLRenderer, Pool>();
const queue: (() => void)[] = [];
let active = 0;
function pump() { while (active < 3 && queue.length) queue.shift()!(); }
function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => { active++; task().then(resolve, reject).finally(() => { active--; pump(); }); }); pump();
  });
}
export function createModelLoader(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath("/decoders/draco/").setWorkerLimit(2);
  const ktx = new KTX2Loader().setTranscoderPath("/decoders/basis/").setWorkerLimit(2).detectSupport(renderer);
  return { loader: new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx), draco, ktx };
}
function disposeModel(model: LoadedModel) {
  const resources = new Set<{ dispose: () => void }>();
  model.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}
function trim(pool: Pool, renderer: THREE.WebGLRenderer) {
  const unused = [...pool.entries.entries()].filter(([, entry]) => !entry.refs && entry.ready).sort((a, b) => a[1].used - b[1].used);
  for (const [url, entry] of unused.slice(0, Math.max(0, unused.length - 4))) { disposeModel(entry.ready!); pool.entries.delete(url); }
  if (pool.idle) clearTimeout(pool.idle);
  if ([...pool.entries.values()].every(entry => !entry.refs && entry.ready)) {
    pool.idle = setTimeout(() => {
      pool.entries.forEach(entry => { if (entry.ready) disposeModel(entry.ready); });
      pool.entries.clear(); pool.draco.dispose(); pool.ktx.dispose(); pools.delete(renderer);
    }, 30000);
  }
}
export function acquireModel(renderer: THREE.WebGLRenderer, url: string) {
  let pool = pools.get(renderer);
  if (!pool) { pool = { ...createModelLoader(renderer), entries: new Map() }; pools.set(renderer, pool); }
  if (pool.idle) clearTimeout(pool.idle);
  const owner = pool;
  let entry = owner.entries.get(url);
  if (!entry) {
    entry = { refs: 0, used: Date.now(), promise: Promise.resolve(null as unknown as LoadedModel) };
    const pending = entry;
    owner.entries.set(url, entry);
    entry.promise = schedule(async () => {
      const gltf = await owner.loader.loadAsync(url);
      gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      if (!gltf.animations.length) instanceRepeatedModules(gltf.scene);
      gltf.scene.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(gltf.scene);
      const authored = gltf.scene.userData.pipelineBounds;
      if (authored && [authored.min, authored.max].every(value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) && authored.min.every((value: number, i: number) => value < authored.max[i])) {
        bounds = new THREE.Box3(new THREE.Vector3().fromArray(authored.min), new THREE.Vector3().fromArray(authored.max));
      }
      const result = { scene: gltf.scene, bounds };
      const size = bounds.getSize(new THREE.Vector3());
      if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 1e-9)) {
        disposeModel(result);
        throw new Error("Model has empty or invalid dimensions");
      }
      pending.ready = result; return result;
    }).catch(error => { owner.entries.delete(url); throw error; }).finally(() => trim(owner, renderer));
  }
  entry.refs++; entry.used = Date.now();
  const leased = entry; let released = false;
  return { promise: entry.promise, release() {
    if (released) return;
    released = true; leased.refs--; leased.used = Date.now(); trim(owner, renderer);
  } };
}
export function cloneModel(model: LoadedModel): LoadedModel { return { scene: clone(model.scene) as THREE.Group, bounds: model.bounds }; }
export function disposeModelClone(model: LoadedModel) {
  model.scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { instanceRepeatedModules } from "./instanceModules";
import { configureModelTextureSampling } from "./modelTextureSampling";
import { configureModelCutoutSampling } from "./modelCutoutSampling";
import { configureModelDefaultMaterials } from "./modelDefaultMaterials";
import { disposeKitchenTextureCoordinates } from "./kitchenTextureCoordinates";
import { idleModelCacheBudget, modelResourceBytes, type ModelResourceBytes } from "./modelResources";
import { enableAcceleratedRaycast, scheduleRaycastTrees } from "./modelRaycast";
enableAcceleratedRaycast();
export interface ModelLoadMetrics {
  queuedAt: number;
  startedAt: number;
  completedAt: number;
  queueMs: number;
  loadDecodeMs: number;
  resourceDurationMs: number | null;
  encodedBodySize: number | null;
}
export interface LoadedModel { scene: THREE.Group; bounds: THREE.Box3; metrics: ModelLoadMetrics; animations?: THREE.AnimationClip[]; triangles?: number; resources?: ModelResourceBytes }
interface Entry { promise: Promise<LoadedModel>; refs: number; ready?: LoadedModel; used: number }
interface Pool { loader: GLTFLoader; draco: DRACOLoader; ktx: KTX2Loader; entries: Map<string, Entry>; budget: number; idle?: ReturnType<typeof setTimeout> }
const pools = new WeakMap<THREE.WebGLRenderer, Pool>();
const queue: (() => void)[] = [];
let active = 0;
function pump() { while (active < 3 && queue.length) queue.shift()!(); }
function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    // acquireModel must finish establishing the lease before cancellation checks.
    queue.push(() => { active++; Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; pump(); }); }); pump();
  });
}
export function createModelLoader(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath("/decoders/draco/").setWorkerLimit(2);
  const ktx = new KTX2Loader().setTranscoderPath("/decoders/basis/").setWorkerLimit(2).detectSupport(renderer);
  return {
    loader: new GLTFLoader()
      .setDRACOLoader(draco)
      .setKTX2Loader(ktx)
      .setMeshoptDecoder(MeshoptDecoder),
    draco,
    ktx,
  };
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
  // A failed lease can be released after its retired pool's idle timeout.
  // It must never schedule cleanup against a newer pool on the same renderer.
  if (pools.get(renderer) !== pool) return;
  const unused = [...pool.entries.entries()].filter(([, entry]) => !entry.refs && entry.ready).sort((a, b) => a[1].used - b[1].used);
  let bytes = unused.reduce((sum, [, entry]) => sum + (entry.ready!.resources?.totalBytes ?? 0), 0);
  let count = unused.length;
  for (const [url, entry] of unused) {
    if (count <= 4 && bytes <= pool.budget) break;
    bytes -= entry.ready!.resources?.totalBytes ?? 0; count--;
    disposeModel(entry.ready!); pool.entries.delete(url);
  }
  if (pool.idle) clearTimeout(pool.idle);
  if ([...pool.entries.values()].every(entry => !entry.refs && entry.ready)) {
    pool.idle = setTimeout(() => {
      if (pools.get(renderer) !== pool) return;
      pool.entries.forEach(entry => { if (entry.ready) disposeModel(entry.ready); });
      pool.entries.clear(); pool.draco.dispose(); pool.ktx.dispose(); pools.delete(renderer);
    }, 30000);
  }
}
export function acquireModel(renderer: THREE.WebGLRenderer, url: string, options: { preserveHierarchy?: boolean } = {}) {
  let pool = pools.get(renderer);
  if (!pool) { pool = { ...createModelLoader(renderer), entries: new Map(), budget: idleModelCacheBudget(typeof navigator === 'undefined' ? undefined : (navigator as Navigator & {deviceMemory?: number}).deviceMemory) }; pools.set(renderer, pool); }
  if (pool.idle) clearTimeout(pool.idle);
  const owner = pool;
  // Assembly sockets and individually replaceable nodes must keep their authored hierarchy.
  const key = options.preserveHierarchy ? `hierarchy:${url}` : url;
  let entry = owner.entries.get(key);
  const cacheHit = Boolean(entry?.ready);
  if (!entry) {
    const queuedAt = performance.now();
    entry = { refs: 0, used: Date.now(), promise: Promise.resolve(null as unknown as LoadedModel) };
    const pending = entry;
    owner.entries.set(key, entry);
    entry.promise = schedule(async () => {
      if (!pending.refs) throw new DOMException('Model request no longer has consumers', 'AbortError');
      const startedAt = performance.now();
      const gltf = await owner.loader.loadAsync(url);
      // GLTFLoader cannot safely abort a running Draco worker. Discard its result
      // before expensive scene preparation when every consumer has gone away.
      const discard = () => disposeModel({ scene: gltf.scene } as LoadedModel);
      if (!pending.refs) { discard(); throw new DOMException('Model request no longer has consumers', 'AbortError'); }
      try {
      configureModelDefaultMaterials(gltf.scene, gltf.parser?.associations);
      configureModelTextureSampling(gltf.scene, renderer);
      configureModelCutoutSampling(gltf.scene, renderer);
      gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = object.userData.applianceGlass !== true; object.receiveShadow = true; } });
      if (!gltf.animations.length && !options.preserveHierarchy) instanceRepeatedModules(gltf.scene);
      scheduleRaycastTrees(gltf.scene);
      gltf.scene.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(gltf.scene);
      const authored = gltf.scene.userData.pipelineBounds;
      if (authored && [authored.min, authored.max].every(value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) && authored.min.every((value: number, i: number) => value < authored.max[i])) {
        bounds = new THREE.Box3(new THREE.Vector3().fromArray(authored.min), new THREE.Vector3().fromArray(authored.max));
      }
      const completedAt = performance.now();
      let triangles = 0;
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const count = object.geometry.index?.count ?? object.geometry.getAttribute("position")?.count ?? 0;
        triangles += count / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1);
      });
      const resource = performance
        .getEntriesByName(typeof window === "undefined" ? url : new URL(url, window.location.href).href)
        .filter((entry): entry is PerformanceResourceTiming =>
          entry.entryType === "resource",
        )
        .at(-1);
      const result = {
        scene: gltf.scene,
        triangles,
        bounds,
        animations: gltf.animations,
        resources: modelResourceBytes(gltf.scene),
        metrics: {
          queuedAt,
          startedAt,
          completedAt,
          queueMs: startedAt - queuedAt,
          loadDecodeMs: completedAt - startedAt,
          resourceDurationMs: resource?.duration ?? null,
          encodedBodySize: resource?.encodedBodySize ?? null,
        },
      };
      const size = bounds.getSize(new THREE.Vector3());
      if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 1e-9)) {
        throw new Error("Model has empty or invalid dimensions");
      }
      pending.ready = result; return result;
      } catch (error) { discard(); throw error; }
    }).catch(error => { if (owner.entries.get(key) === pending) owner.entries.delete(key); throw error; }).finally(() => trim(owner, renderer));
  }
  entry.refs++; entry.used = Date.now();
  const leased = entry; let released = false;
  return { promise: entry.promise, cacheHit, release() {
    if (released) return;
    released = true; leased.refs--; leased.used = Date.now(); trim(owner, renderer);
  } };
}
export function modelCacheStats(renderer: THREE.WebGLRenderer) {
  const pool = pools.get(renderer);
  let activeBytes = 0, idleBytes = 0, pending = 0;
  for (const entry of pool?.entries.values() ?? []) {
    if (!entry.ready) pending++;
    else if (entry.refs) activeBytes += entry.ready.resources?.totalBytes ?? 0;
    else idleBytes += entry.ready.resources?.totalBytes ?? 0;
  }
  return { activeBytes, idleBytes, pending, entries: pool?.entries.size ?? 0, idleBudgetBytes: pool?.budget ?? 0 };
}
export function cloneModel(model: LoadedModel): LoadedModel { return { ...model, scene: clone(model.scene) as THREE.Group }; }
export function disposeModelClone(model: LoadedModel) {
  disposeKitchenTextureCoordinates(model.scene);
  model.scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
}

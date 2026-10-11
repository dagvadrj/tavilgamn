"use client";
import { useEffect, useRef, useState } from "react";
import {
  Box3,
  Vector3,
  Scene,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  Texture,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createModelLoader } from "@/three/modelLoader";
import { authFetch } from "@/lib/authFetch";

export default function HistoryGlbPreview({
  url,
  owner,
}: {
  url: string;
  owner: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const controller = new AbortController();
    let cancelled = false;
    let cleanup = () => {};
    setLoading(true);
    setError(null);
    void (async () => {
      const response = await authFetch(
        url,
        { signal: controller.signal, cache: "no-store" },
        owner,
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "GLB preview ачаалсангүй.");
      }
      const bytes = await response.arrayBuffer();
      if (cancelled) return;
      const renderer = new WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      const { loader, draco, ktx } = createModelLoader(renderer);
      const scene = new Scene();
      scene.background = new Color("#edece7");
      const camera = new PerspectiveCamera(40, 1, 0.001, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      scene.add(new HemisphereLight(0xffffff, 0x777766, 3));
      const light = new DirectionalLight(0xffffff, 3);
      light.position.set(2, 3, 4);
      scene.add(light);
      const render = () => renderer.render(scene, camera);
      const resize = () => {
        const width = container.clientWidth,
          height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        render();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      controls.addEventListener("change", render);
      cleanup = () => {
        observer.disconnect();
        controls.dispose();
        draco.dispose();
        ktx.dispose();
        const resources = new Set<{ dispose(): void }>();
        scene.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          resources.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            resources.add(material);
            for (const value of Object.values(material))
              if (value instanceof Texture) resources.add(value);
          }
        });
        resources.forEach((resource) => resource.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
      const asset = await loader.parseAsync(bytes, "");
      scene.add(asset.scene);
      if (cancelled) {
        cleanup();
        return;
      }
      const bounds = new Box3().setFromObject(asset.scene),
        size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.01);
      camera.near = radius / 1000;
      camera.far = radius * 100;
      // Frame the original geometry without changing its shape or materials.
      const width = container.clientWidth,
        height = container.clientHeight;
      const distance =
        (radius * 2.2) / Math.min(1, width / Math.max(height, 1));
      camera.position
        .copy(center)
        .add(new Vector3(1, 0.65, 1.8).normalize().multiplyScalar(distance));
      controls.target.copy(center);
      controls.update();
      resize();
      setLoading(false);
    })().catch((reason) => {
      cleanup();
      if (!cancelled) {
        setLoading(false);
        setError(
          reason instanceof Error ? reason.message : "GLB preview ачаалсангүй.",
        );
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
      cleanup();
    };
  }, [url, owner]);
  return (
    <div className="product-history-viewer">
      <div
        ref={host}
        className="product-history-canvas"
        aria-label="Сонгосон GLB хувилбарын 3D харагдац"
      />
      {loading && (
        <p className="product-history-overlay" role="status">
          GLB ачаалж байна…
        </p>
      )}
      {error && (
        <p className="product-history-overlay" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

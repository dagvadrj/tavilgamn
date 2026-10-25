"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "@/three/modelLoader";
import type { MarketingModel } from "@/lib/marketingModel";
import type { TourIllustration } from "@/features/planner/components/plannerTourSteps";
import { advanceDemoAxis, type DemoAxis } from "@/lib/demoMotion";
import { isConfigurableSurface } from "@/three/productSurfaceController";
import { useCanvasPerformance } from "@/three/canvasPerformance";
import {
  performanceDiagnosticsEnabled,
  reportCanvasMetric,
  summarizeFrames,
  summarizeMotionFrames,
} from "@/lib/performanceDiagnostics";

type Props = {
  model: MarketingModel;
  scene: TourIllustration;
  active: boolean;
  visible: boolean;
  reduced: boolean;
  onReady: () => void;
  onError: () => void;
};
class PreviewBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[marketing canvas]", error.message);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Model({ model, scene, active, reduced, onReady, onError }: Props) {
  const { gl, camera, invalidate, size } = useThree();
  const [asset, setAsset] = useState<LoadedModel | null>(null);
  const root = useRef<Group>(null);
  const selectedColor = useMemo(
    () => (model.colors?.[0] ? new Color(model.colors[0]) : null),
    [model.colors],
  );
  const surfaces = useRef<
    { material: MeshStandardMaterial; original: Color }[]
  >([]);
  const transition = useRef({
    running: false,
    y: { value: 0.18, velocity: 0, target: 0 } as DemoAxis,
    angle: { value: -0.1, velocity: 0, target: 0 } as DemoAxis,
    tint: { value: 0, velocity: 0, target: 0 } as DemoAxis,
  });
  const callbacks = useRef({ onReady, onError });
  const sample = useRef({
    enabled: false,
    last: 0,
    frames: 0,
    intervals: [] as number[],
  });
  useEffect(() => {
    sample.current.enabled = performanceDiagnosticsEnabled();
  }, []);
  callbacks.current = { onReady, onError };
  useEffect(() => {
    let cancelled = false,
      clone: LoadedModel | null = null;
    const request = acquireModel(
      gl,
      `/api/models/files/${model.id}/${encodeURIComponent(model.file)}`,
      { preserveHierarchy: true },
    );
    void request.promise
      .then((loaded) => {
        if (cancelled) return;
        clone = cloneModel(loaded);
        clone.scene.traverse((object) => {
          if (object instanceof Mesh) {
            object.castShadow = false;
            object.receiveShadow = false;
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (
                material instanceof MeshStandardMaterial &&
                isConfigurableSurface(object, material)
              ) {
                material.envMapIntensity = 0.7;
                surfaces.current.push({
                  material,
                  original: material.color.clone(),
                });
              }
            }
          }
        });
        const box = new Box3().setFromObject(clone.scene),
          center = box.getCenter(new Vector3()),
          extent = box.getSize(new Vector3());
        const scale = 2.7 / Math.max(extent.x, extent.y, extent.z, 0.01);
        clone.scene.position.sub(center);
        clone.scene.scale.multiplyScalar(scale);
        clone.scene.position.multiplyScalar(scale);
        setAsset(clone);
        invalidate();
        callbacks.current.onReady();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn(
            "[marketing preview]",
            model.id,
            error instanceof Error ? error.message : "Model load failed",
          );
          callbacks.current.onError();
        }
      });
    return () => {
      cancelled = true;
      if (clone) {
        clone.scene.traverse((object) => {
          if (object instanceof Mesh)
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              material.dispose();
        });
        disposeModelClone(clone);
      }
      surfaces.current = [];
      request.release();
    };
  }, [gl, model.id, model.file, invalidate]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    camera.position
      .set(3.4, 2.1, 4.8)
      .multiplyScalar(Math.max(1, 0.85 / aspect));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    if (!root.current) return;
    const state = transition.current;
    state.running = true;
    state.y.target = scene === "catalog" ? 0.06 : 0;
    state.angle.target =
      scene === "view"
        ? Math.PI * 0.6
        : scene === "material"
          ? Math.PI * 0.08
          : scene === "place"
            ? -Math.PI * 0.12
            : 0;
    state.tint.target = scene === "material" && selectedColor ? 1 : 0;
    invalidate();
  }, [scene, asset, selectedColor, invalidate]);
  useEffect(() => {
    sample.current.last = 0;
    invalidate();
  }, [active, reduced, invalidate]);
  useFrame((_, delta) => {
    if (!root.current || !transition.current.running) return;
    const state = transition.current;
    if (!active && !reduced) return;
    const measurement = sample.current;
    if (measurement.enabled) {
      const now = performance.now();
      if (measurement.last && measurement.intervals.length < 600)
        measurement.intervals.push(now - measurement.last);
      measurement.last = now;
      measurement.frames++;
    }
    const movingY = advanceDemoAxis(state.y, delta, reduced);
    const movingAngle = advanceDemoAxis(state.angle, delta, reduced);
    const movingTint = advanceDemoAxis(state.tint, delta, reduced);
    root.current.position.y = state.y.value;
    root.current.rotation.y = state.angle.value;
    for (const surface of surfaces.current) {
      surface.material.color.copy(surface.original);
      if (selectedColor)
        surface.material.color.lerp(
          selectedColor,
          Math.max(0, Math.min(1, state.tint.value)),
        );
    }
    state.running = movingY || movingAngle || movingTint;
    if (state.running) invalidate();
    else if (measurement.enabled && measurement.frames) {
      const durationMs = Math.round(
        measurement.intervals.reduce((sum, value) => sum + value, 0),
      );
      reportCanvasMetric({
        scene: "marketing-demo",
        frames: measurement.frames,
        durationMs,
        ...summarizeFrames(
          measurement.intervals,
          measurement.frames,
          durationMs,
        ),
        ...summarizeMotionFrames(measurement.intervals),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        dpr: gl.getPixelRatio(),
        heapMiB: null,
        loop: "demand",
      });
      measurement.frames = 0;
      measurement.last = 0;
      measurement.intervals = [];
    }
  });
  return asset ? (
    <group ref={root} position={[0, 0.18, 0]} rotation={[0, -0.1, 0]}>
      <primitive object={asset.scene} />
    </group>
  ) : null;
}

export default function ModelDemoCanvas(props: Props) {
  const quality = useCanvasPerformance();
  return (
    <PreviewBoundary onError={props.onError}>
      <Canvas
        className="model-demo-canvas"
        dpr={quality.dpr}
        frameloop={props.visible ? "demand" : "never"}
        camera={{ fov: 35, near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", props.onError, {
            once: true,
          });
        }}
        fallback={
          <span>3D дэмжигдэхгүй байна. Бүтээгдэхүүний зургийг ашиглаарай.</span>
        }
      >
        <ambientLight intensity={1.5} />
        <hemisphereLight args={["#ffffff", "#b0b8c0", 1.3]} />
        <directionalLight position={[4, 6, 5]} intensity={2.6} />
        <directionalLight position={[-4, 2, -3]} intensity={1.3} />
        <Model {...props} />
      </Canvas>
    </PreviewBoundary>
  );
}

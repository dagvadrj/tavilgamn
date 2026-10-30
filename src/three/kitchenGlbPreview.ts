import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { createModelLoader } from "./modelLoader";
import { addModelEdges } from "./modelEdges";
import type {
  KitchenGlbModule,
  KitchenGlbModuleRole,
} from "@/lib/kitchenGlbModules";

const THUMBNAIL = { width: 1200, height: 900 };
/** Viewport is dark grey so the model and colour coding stand out. */
const STAGE_BACKGROUND = "#26282c";
/** Listing pictures keep the light studio backdrop of the shop. */
const PHOTO_BACKGROUND = "#f1f0eb";
const ROLE_COLORS: Record<KitchenGlbModuleRole, number> = {
  base: 0x3fae7a,
  wall: 0xe8913f,
  tall: 0x4f7fe0,
};

/** Non-selectable outlines: the worktop and recognised appliances. */
export type KitchenGlbMarker = {
  kind: "countertop" | "appliance";
  box: { min: number[]; max: number[] };
};
const MARKER_COLORS = { countertop: 0xb8bcc6, appliance: 0xa35fdc } as const;

/** What a click in the preview hit: a cabinet overlay or a bare model part. */
export type KitchenGlbPick = {
  moduleId: string | null;
  partId: number | null;
  /** Shift / Ctrl held: add to the selection instead of replacing it. */
  additive: boolean;
};
export type KitchenGlbTool = "select" | "multi" | "hand" | "measure" | "add";
export type KitchenGlbView = "3d" | "front" | "right" | "back" | "left";

/** Camera directions (from the target towards the camera); front is +Z. */
const VIEW_DIRECTIONS: Record<KitchenGlbView, Vector3> = {
  "3d": new Vector3(-0.75, 0.55, 1.25).normalize(),
  front: new Vector3(0, 0.08, 1).normalize(),
  right: new Vector3(1, 0.08, 0).normalize(),
  back: new Vector3(0, 0.08, -1).normalize(),
  left: new Vector3(-1, 0.08, 0).normalize(),
};
export const KITCHEN_GLB_VIEW_LABELS: Record<KitchenGlbView, string> = {
  "3d": "3D",
  front: "Урд",
  right: "Баруун",
  back: "Ар",
  left: "Зүүн",
};

const mm = (value: number) => Math.round(value * 1000);

/**
 * Orbit preview of a prepared full-kitchen GLB (metres, Y up, bottom-centre)
 * with editing tools: hover highlight, cabinet boxes, colour coding, dimension
 * lines, a tape measure and pictures for the listing.
 */
export async function renderKitchenGlbPreview(
  host: HTMLElement,
  source: Blob | ArrayBuffer,
  {
    aspect = 0.62,
    editing = false,
  }: {
    aspect?: number;
    /** Merchant editor: hover read-outs and tools (off on the shop page). */
    editing?: boolean;
  } = {},
) {
  const renderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "kg-canvas";
  host.appendChild(canvas);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "kg-labels";
  host.appendChild(labels.domElement);
  const tooltip = document.createElement("div");
  tooltip.className = "kg-tooltip";
  tooltip.hidden = true;
  host.appendChild(tooltip);
  const { loader, draco, ktx } = createModelLoader(renderer);
  const scene = new Scene();
  const stageBackground = new Color(STAGE_BACKGROUND);
  scene.background = stageBackground;
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.add(new HemisphereLight(0xffffff, 0x8a8577, 1.2));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new PerspectiveCamera(38, 4 / 3, 0.01, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * 0.495;

  let disposed = false;
  let edges: ReturnType<typeof addModelEdges> | null = null;
  const render = () => {
    if (disposed) return;
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.round(width * aspect);
    renderer.setSize(width, height, false);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    labels.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);

  const modelRoot = new Group();
  scene.add(modelRoot);
  const overlays = new Group();
  overlays.name = "kg-modules";
  scene.add(overlays);
  const dimensions = new Group();
  dimensions.name = "kg-dimensions";
  dimensions.visible = false;
  scene.add(dimensions);
  const measures = new Group();
  measures.name = "kg-measures";
  scene.add(measures);
  const highlight = new Group();
  highlight.name = "kg-highlight";
  scene.add(highlight);

  const disposeTree = (group: Object3D) => {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        if (object instanceof CSS2DObject) object.element.remove();
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose();
          (object.material as Material).dispose();
        }
      });
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    controls.dispose();
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerleave", pointerLeave);
    for (const group of [overlays, dimensions, measures, highlight])
      disposeTree(group);
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
    for (const mesh of partMeshes.values())
      for (const item of mesh) {
        const original = item.userData.kgOriginal as
          | Material
          | Material[]
          | undefined;
        if (original)
          for (const material of Array.isArray(original)
            ? original
            : [original])
            resources.add(material);
      }
    tintMaterials.forEach((material) => resources.add(material));
    resources.forEach((value) => value.dispose());
    edges?.dispose();
    environment.dispose();
    pmrem.dispose();
    draco.dispose();
    ktx.dispose();
    renderer.dispose();
    canvas.remove();
    labels.domElement.remove();
    tooltip.remove();
  };

  // ---- Module boxes -------------------------------------------------------
  let currentModules: readonly KitchenGlbModule[] = [];
  let selected = new Set<string>();
  let hoveredModule: string | null = null;
  const boxCentre = (box: { min: number[]; max: number[] }) =>
    new Vector3(
      (box.min[0] + box.max[0]) / 2000,
      (box.min[1] + box.max[1]) / 2000,
      (box.min[2] + box.max[2]) / 2000,
    );
  function setModules(
    modules: readonly KitchenGlbModule[],
    selectedIds: readonly string[] | string | null,
    markers: readonly KitchenGlbMarker[] = [],
  ) {
    currentModules = modules;
    selected = new Set(
      selectedIds === null
        ? []
        : typeof selectedIds === "string"
          ? [selectedIds]
          : selectedIds,
    );
    disposeTree(overlays);
    for (const marker of markers) {
      const size = marker.box.max.map(
        (value, axis) => Math.max(value - marker.box.min[axis], 6) / 1000,
      );
      const geometry = new BoxGeometry(size[0], size[1], size[2]);
      const outline = new LineSegments(
        new EdgesGeometry(geometry),
        new LineBasicMaterial({ color: MARKER_COLORS[marker.kind] }),
      );
      geometry.dispose();
      outline.position.copy(boxCentre(marker.box));
      outline.renderOrder = 3;
      outline.raycast = () => {};
      overlays.add(outline);
    }
    for (const item of modules) {
      const size = item.box.max.map(
        (value, axis) => Math.max(value - item.box.min[axis], 10) / 1000,
      );
      const color = ROLE_COLORS[item.role];
      const box = new Group();
      box.userData.kgModule = item.id;
      box.position.copy(boxCentre(item.box));
      const geometry = new BoxGeometry(size[0], size[1], size[2]);
      const fill = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      );
      fill.userData.kgModule = item.id;
      fill.renderOrder = 2;
      const outline = new LineSegments(
        new EdgesGeometry(geometry),
        new LineBasicMaterial({ color, transparent: true, opacity: 0.7 }),
      );
      outline.renderOrder = 3;
      outline.raycast = () => {};
      box.add(fill, outline);
      overlays.add(box);
    }
    styleOverlays();
    if (dimensions.visible) buildDimensions();
    render();
  }
  /** Selected and hovered boxes glow in their own colour. */
  function styleOverlays() {
    for (const box of overlays.children) {
      const id = box.userData.kgModule as string | undefined;
      if (!id) continue;
      const active = selected.has(id);
      const hover = id === hoveredModule;
      const [fill, outline] = box.children as [Mesh, LineSegments];
      (fill.material as MeshBasicMaterial).opacity = active
        ? 0.34
        : hover
          ? 0.26
          : 0.08;
      (outline.material as LineBasicMaterial).opacity =
        active || hover ? 1 : 0.6;
      outline.scale.setScalar(hover && !active ? 1.004 : 1);
    }
  }

  // ---- Parts ---------------------------------------------------------------
  const partMeshes = new Map<number, Mesh[]>();
  const partOf = (object: Object3D | null) => {
    for (let item = object; item; item = item.parent)
      if (typeof item.userData.kgPart === "number")
        return item.userData.kgPart as number;
    return null;
  };
  const partBox = (id: number) => {
    const box = new Box3();
    for (const mesh of partMeshes.get(id) ?? []) box.expandByObject(mesh);
    return box;
  };
  const outlineBox = (box: Box3, color: number, opacity = 1) => {
    const size = box.getSize(new Vector3());
    const geometry = new BoxGeometry(
      Math.max(size.x, 0.004),
      Math.max(size.y, 0.004),
      Math.max(size.z, 0.004),
    );
    const outline = new LineSegments(
      new EdgesGeometry(geometry),
      new LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
      }),
    );
    geometry.dispose();
    outline.position.copy(box.getCenter(new Vector3()));
    outline.renderOrder = 6;
    outline.raycast = () => {};
    return outline;
  };
  let selectedParts: number[] = [];
  let hoveredPart: number | null = null;
  function drawHighlight() {
    disposeTree(highlight);
    for (const id of selectedParts)
      highlight.add(outlineBox(partBox(id), 0xffffff));
    if (hoveredPart !== null && !hoveredModule)
      highlight.add(outlineBox(partBox(hoveredPart), 0xfff2a8, 0.9));
  }

  // Colour coding: every part painted by its category (cabinet role, worktop …).
  const tintMaterials = new Map<string, MeshStandardMaterial>();
  let tints: ReadonlyMap<number, string> | null = null;
  function applyTints(on: boolean) {
    for (const [id, meshes] of partMeshes)
      for (const mesh of meshes) {
        if (!mesh.userData.kgOriginal) mesh.userData.kgOriginal = mesh.material;
        const color = on ? tints?.get(id) : undefined;
        if (!color) {
          mesh.material = mesh.userData.kgOriginal;
          continue;
        }
        let material = tintMaterials.get(color);
        if (!material) {
          material = new MeshStandardMaterial({
            color,
            roughness: 0.75,
            metalness: 0,
          });
          tintMaterials.set(color, material);
        }
        mesh.material = material;
      }
  }
  let tinted = false;

  // ---- Dimension lines (SketchUp style) -----------------------------------
  const lineMaterial = () =>
    new LineBasicMaterial({ color: 0xf4f4f0, depthTest: false });
  const label = (text: string, at: Vector3, kind = "") => {
    const element = document.createElement("span");
    element.className = `kg-dim-label ${kind}`;
    element.textContent = text;
    const object = new CSS2DObject(element);
    object.position.copy(at);
    return object;
  };
  /**
   * A dimension from a to b drawn `offset` away (metres) along `out`, with
   * extension lines back to the object and end ticks, labelled in mm.
   */
  function dimension(
    a: Vector3,
    b: Vector3,
    out: Vector3,
    offset: number,
    kind = "",
  ) {
    const shift = out.clone().multiplyScalar(offset);
    const a2 = a.clone().add(shift);
    const b2 = b.clone().add(shift);
    const tick = out.clone().multiplyScalar(0.025);
    const reach = out.clone().multiplyScalar(0.012);
    const points = [
      a2, b2,
      a.clone().add(out.clone().multiplyScalar(0.01)), a2.clone().add(reach),
      b.clone().add(out.clone().multiplyScalar(0.01)), b2.clone().add(reach),
      a2.clone().sub(tick), a2.clone().add(tick),
      b2.clone().sub(tick), b2.clone().add(tick),
    ];
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3),
    );
    const lines = new LineSegments(geometry, lineMaterial());
    lines.renderOrder = 8;
    lines.raycast = () => {};
    const group = new Group();
    group.add(
      lines,
      label(String(mm(a.distanceTo(b))), a2.clone().add(b2).multiplyScalar(0.5), kind),
    );
    dimensions.add(group);
  }
  function buildDimensions() {
    disposeTree(dimensions);
    for (const cabinet of currentModules) {
      const min = new Vector3(...cabinet.box.min).multiplyScalar(0.001);
      const max = new Vector3(...cabinet.box.max).multiplyScalar(0.001);
      const depthAxis = cabinet.facing[1] === "x" ? "x" : "z";
      const along = depthAxis === "x" ? "z" : "x";
      const sign = cabinet.facing[0] === "+" ? 1 : -1;
      const out = new Vector3();
      out[depthAxis] = sign;
      const front = sign > 0 ? max[depthAxis] : min[depthAxis];
      const corner = (alongValue: number, y: number, depthValue = front) => {
        const point = new Vector3();
        point[along] = alongValue;
        point.y = y;
        point[depthAxis] = depthValue;
        return point;
      };
      const top = max.y;
      const bottom = min.y;
      const up = new Vector3(0, cabinet.role === "wall" ? -1 : 1, 0);
      const edgeY = cabinet.role === "wall" ? bottom : top;
      // Width along the front edge, height on the left front edge, depth on top.
      dimension(
        corner(min[along], edgeY),
        corner(max[along], edgeY),
        up,
        0.06,
      );
      const side = new Vector3();
      side[along] = -1;
      dimension(
        corner(min[along], bottom),
        corner(min[along], top),
        side,
        0.04,
      );
      const back = sign > 0 ? min[depthAxis] : max[depthAxis];
      dimension(
        corner(max[along], edgeY, back),
        corner(max[along], edgeY, front),
        up,
        0.06,
      );
      // Module number, matching the bill of materials.
      const index = currentModules.indexOf(cabinet) + 1;
      dimensions.add(
        label(
          String(index),
          corner((min[along] + max[along]) / 2, (bottom + top) / 2),
          "is-number",
        ),
      );
    }
    // Overall size of the whole kitchen.
    const bounds = new Box3().setFromObject(modelRoot);
    const { min, max } = bounds;
    dimension(
      new Vector3(min.x, min.y, max.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(0, 0, 1),
      0.25,
      "is-total",
    );
    dimension(
      new Vector3(max.x, min.y, max.z),
      new Vector3(max.x, max.y, max.z),
      new Vector3(1, 0, 0),
      0.25,
      "is-total",
    );
    dimension(
      new Vector3(max.x, min.y, min.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(1, 0, 0),
      0.25,
      "is-total",
    );
  }

  // ---- Tape measure ---------------------------------------------------------
  let measureStart: Vector3 | null = null;
  const dot = (at: Vector3) => {
    const sphere = new Mesh(
      new SphereGeometry(0.008, 12, 8),
      new MeshBasicMaterial({ color: 0xffd84a, depthTest: false }),
    );
    sphere.position.copy(at);
    sphere.renderOrder = 9;
    sphere.raycast = () => {};
    return sphere;
  };
  /** Hits snap to the part's faces and corners within 12 mm. */
  const snap = (point: Vector3, part: number | null) => {
    if (part === null) return point;
    const box = partBox(part);
    const result = point.clone();
    for (const axis of ["x", "y", "z"] as const)
      for (const value of [box.min[axis], box.max[axis]])
        if (Math.abs(result[axis] - value) <= 0.012) result[axis] = value;
    return result;
  };
  function measureClick(point: Vector3) {
    if (!measureStart) {
      measureStart = point;
      measures.add(dot(point));
      render();
      return;
    }
    const start = measureStart;
    measureStart = null;
    const geometry = new BufferGeometry().setFromPoints([start, point]);
    const line = new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0xffd84a, depthTest: false }),
    );
    line.renderOrder = 9;
    line.raycast = () => {};
    const delta = point.clone().sub(start);
    const parts = [
      ["X", delta.x],
      ["Y", delta.y],
      ["Z", delta.z],
    ].filter(([, value]) => Math.abs(value as number) >= 0.002);
    const text =
      `${mm(start.distanceTo(point))} мм` +
      (parts.length > 1
        ? ` (${parts.map(([axis, value]) => `${axis} ${Math.abs(mm(value as number))}`).join(" · ")})`
        : "");
    measures.add(
      dot(point),
      line,
      label(text, start.clone().add(point).multiplyScalar(0.5), "is-measure"),
    );
    render();
  }

  // ---- Pointer --------------------------------------------------------------
  let tool: KitchenGlbTool = "select";
  const raycaster = new Raycaster();
  let pickListener: ((pick: KitchenGlbPick) => void) | null = null;
  let down: { x: number; y: number } | null = null;
  const cast = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const model = raycaster.intersectObject(modelRoot, true)[0];
    const box = overlays.visible
      ? raycaster
          .intersectObjects(overlays.children, true)
          .find((hit) => hit.object instanceof Mesh)
      : undefined;
    const part = partOf(model?.object ?? null);
    // The nearer of the two wins, so a part in front of a box stays reachable.
    const moduleHit =
      box && (!model || box.distance <= model.distance + 0.02)
        ? (box.object.userData.kgModule as string)
        : null;
    // A part inside a cabinet's box belongs to that cabinet even with boxes hidden.
    const moduleId =
      moduleHit ??
      (part !== null
        ? (currentModules.find((item) => item.parts.includes(part))?.id ??
          null)
        : null);
    return { model, part, moduleId };
  };
  const pointerDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = (event: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved > 4 || tool === "hand") return;
    const hit = cast(event);
    if (tool === "measure") {
      if (hit.model) measureClick(snap(hit.model.point, hit.part));
      return;
    }
    pickListener?.({
      moduleId: tool === "add" ? null : hit.moduleId,
      partId: hit.part,
      additive: tool === "multi" || event.shiftKey || event.ctrlKey,
    });
  };
  let frame = 0;
  const pointerMove = (event: PointerEvent) => {
    if (frame || event.buttons) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (disposed) return;
      const hit = cast(event);
      const moduleId = tool === "add" || tool === "measure" ? null : hit.moduleId;
      const changed = moduleId !== hoveredModule || hit.part !== hoveredPart;
      hoveredModule = moduleId;
      hoveredPart = tool === "measure" ? null : hit.part;
      const cabinet = currentModules.find((item) => item.id === moduleId);
      const rect = host.getBoundingClientRect();
      if (cabinet) {
        tooltip.textContent = `${currentModules.indexOf(cabinet) + 1}. ${cabinet.name} · ${cabinet.widthMm} × ${cabinet.heightMm} × ${cabinet.depthMm} мм`;
      } else if (hit.part !== null && tool !== "measure") {
        const size = partBox(hit.part).getSize(new Vector3());
        tooltip.textContent = `${tool === "add" ? "Модуль болгох · " : "Модульд ороогүй · "}${mm(size.x)} × ${mm(size.y)} × ${mm(size.z)} мм`;
      } else if (tool === "measure" && hit.model) {
        const point = snap(hit.model.point, hit.part);
        tooltip.textContent = measureStart
          ? `${mm(measureStart.distanceTo(point))} мм`
          : "Эхлэх цэгээ дарна уу";
      } else tooltip.textContent = "";
      tooltip.hidden = !tooltip.textContent;
      tooltip.style.left = `${event.clientX - rect.left + 14}px`;
      tooltip.style.top = `${event.clientY - rect.top + 14}px`;
      if (changed) {
        styleOverlays();
        drawHighlight();
        render();
      }
    });
  };
  const pointerLeave = () => {
    tooltip.hidden = true;
    if (hoveredModule === null && hoveredPart === null) return;
    hoveredModule = null;
    hoveredPart = null;
    styleOverlays();
    drawHighlight();
    render();
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  if (editing) {
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerleave", pointerLeave);
  }

  try {
    const bytes = source instanceof Blob ? await source.arrayBuffer() : source;
    const asset = await loader.parseAsync(bytes, "");
    modelRoot.add(asset.scene);
    edges = addModelEdges(asset.scene);
  } catch (error) {
    dispose();
    throw error instanceof Error ? error : new Error("3D загвар ачаалсангүй.");
  }
  modelRoot.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const id = partOf(object);
    if (id === null) return;
    partMeshes.set(id, [...(partMeshes.get(id) ?? []), object]);
  });
  const bounds = new Box3().setFromObject(modelRoot);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.5);
  const grid = new GridHelper(
    Math.ceil(radius * 2.4),
    Math.ceil(radius * 2.4) * 2,
    0x5a5e66,
    0x383b41,
  );
  scene.add(grid);

  /** Frames the model from a direction; straight views use a long lens. */
  function frame3d(view: KitchenGlbView, cameraAspect = camera.aspect) {
    const direction = VIEW_DIRECTIONS[view];
    const straight = view !== "3d";
    camera.fov = straight ? 22 : 38;
    camera.updateProjectionMatrix();
    if (!straight) {
      camera.position
        .copy(center)
        .add(direction.clone().multiplyScalar(radius * 1.75));
    } else {
      const across =
        Math.abs(direction.z) * size.x + Math.abs(direction.x) * size.z;
      const deep =
        Math.abs(direction.x) * size.x + Math.abs(direction.z) * size.z;
      const half = Math.tan((camera.fov * Math.PI) / 360);
      const distance =
        (Math.max(across / cameraAspect, size.y) / (2 * half)) * 1.12 +
        deep / 2;
      camera.position
        .copy(center)
        .add(direction.clone().multiplyScalar(distance));
    }
    controls.target.copy(center);
    controls.update();
  }
  frame3d("3d");
  controls.addEventListener("change", render);
  observer.observe(host);
  resize();

  /** Renders one view at thumbnail size without overlays, as a JPEG file. */
  async function shoot(
    view: KitchenGlbView,
    name: string,
    { photo = true, annotate = false } = {},
  ) {
    const previous = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      fov: camera.fov,
    };
    const visible = {
      overlays: overlays.visible,
      dimensions: dimensions.visible,
      measures: measures.visible,
      highlight: highlight.visible,
    };
    grid.visible = false;
    overlays.visible = false;
    dimensions.visible = false;
    measures.visible = false;
    highlight.visible = false;
    if (photo) scene.background = new Color(PHOTO_BACKGROUND);
    // Photos show the real finishes; the BOM picture shows the colour coding.
    applyTints(annotate);
    renderer.setPixelRatio(1);
    renderer.setSize(THUMBNAIL.width, THUMBNAIL.height, false);
    camera.aspect = THUMBNAIL.width / THUMBNAIL.height;
    frame3d(view, camera.aspect);
    renderer.render(scene, camera);
    let target: HTMLCanvasElement = canvas;
    if (annotate) target = annotateBom();
    const blob = await new Promise<Blob>((resolve, reject) =>
      target.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("Зураг үүссэнгүй.")),
        "image/jpeg",
        0.9,
      ),
    );
    scene.background = stageBackground;
    applyTints(tinted);
    grid.visible = true;
    overlays.visible = visible.overlays;
    dimensions.visible = visible.dimensions;
    measures.visible = visible.measures;
    highlight.visible = visible.highlight;
    camera.fov = previous.fov;
    camera.position.copy(previous.position);
    controls.target.copy(previous.target);
    controls.update();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    resize();
    return new File([blob], name, { type: "image/jpeg" });
  }

  /** Colour-coded view with cabinet numbers and a legend: the BOM picture. */
  function annotateBom() {
    const sheet = document.createElement("canvas");
    sheet.width = THUMBNAIL.width;
    sheet.height = THUMBNAIL.height;
    const context = sheet.getContext("2d")!;
    context.drawImage(canvas, 0, 0, sheet.width, sheet.height);
    context.font = "600 22px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    currentModules.forEach((cabinet, index) => {
      const point = boxCentre(cabinet.box).project(camera);
      const x = ((point.x + 1) / 2) * sheet.width;
      const y = ((1 - point.y) / 2) * sheet.height;
      context.fillStyle = `#${ROLE_COLORS[cabinet.role].toString(16).padStart(6, "0")}`;
      context.beginPath();
      context.arc(x, y, 18, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = "#ffffff";
      context.fillText(String(index + 1), x, y + 1);
    });
    return sheet;
  }

  return {
    dispose,
    /** Listing thumbnail: the kitchen straight from the front. */
    capture: () => shoot("front", "kitchen-glb-thumbnail.jpg"),
    /** Extra listing pictures: the other three sides and a 3D view. */
    async captureViews() {
      const files: File[] = [];
      for (const view of ["right", "back", "left", "3d"] as const)
        files.push(await shoot(view, `kitchen-glb-${view}.jpg`));
      return files;
    },
    /** Colour-coded, numbered 3D view matching the bill of materials. */
    captureBom: () =>
      shoot("3d", "kitchen-glb-bom.jpg", { photo: false, annotate: true }),
    setModules,
    setSelectedParts(ids: readonly number[]) {
      selectedParts = [...ids];
      drawHighlight();
      render();
    },
    setCategories(colors: ReadonlyMap<number, string>) {
      tints = colors;
      applyTints(tinted);
      render();
    },
    showCategories(visible: boolean) {
      tinted = visible;
      applyTints(visible);
      render();
    },
    showDimensions(visible: boolean) {
      dimensions.visible = visible;
      if (visible) buildDimensions();
      else disposeTree(dimensions);
      render();
    },
    setTool(next: KitchenGlbTool) {
      tool = next;
      controls.mouseButtons.LEFT = next === "hand" ? MOUSE.PAN : MOUSE.ROTATE;
      canvas.dataset.tool = next;
      if (next !== "measure") measureStart = null;
      render();
    },
    clearMeasurements() {
      measureStart = null;
      disposeTree(measures);
      render();
    },
    view(view: KitchenGlbView) {
      frame3d(view);
      render();
    },
    onPick(listener: ((pick: KitchenGlbPick) => void) | null) {
      pickListener = listener;
    },
    showEdges(visible: boolean) {
      edges?.setVisible(visible);
      render();
    },
    showModules(visible: boolean) {
      overlays.visible = visible;
      render();
    },
  };
}

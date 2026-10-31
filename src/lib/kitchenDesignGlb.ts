import type { Document, Scene } from "@gltf-transform/core";
import {
  KITCHEN_LAYOUT_LABELS,
  KITCHEN_STYLE_LABELS,
  type KitchenListingSuggestions,
} from "./kitchenListingSuggestions";
import { kitchenGlbApplianceLines } from "./kitchenGlbCarcass";
import {
  KITCHEN_GLB_ROLE_LABELS,
  detectKitchenGlbModules,
  kitchenGlbAssignMaterials,
  type KitchenGlbDetection,
  type KitchenGlbMaterial,
  type KitchenGlbPart,
} from "./kitchenGlbModules";
import {
  kitchenGlbMeasureModules,
  kitchenGlbModuleLines,
} from "./kitchenGlbChecks";

/** A whole ready-made kitchen uploaded as one GLB (not a single cabinet). */
export const KITCHEN_DESIGN_GLB = {
  maxInputBytes: 50 * 1024 * 1024,
  maxOutputBytes: 40 * 1024 * 1024,
  maxTriangles: 3_000_000,
  minSideMm: 300,
  maxSideMm: 20_000,
  maxHeightMm: 10_000,
  /** Origin must be bottom-centre after preparation. */
  originToleranceMm: 5,
} as const;

export type KitchenGlbUnit = "m" | "cm" | "mm" | "in";
export const KITCHEN_GLB_UNITS: Record<
  KitchenGlbUnit,
  { label: string; metres: number }
> = {
  m: { label: "Метр", metres: 1 },
  cm: { label: "Сантиметр", metres: 0.01 },
  mm: { label: "Миллиметр", metres: 0.001 },
  in: { label: "Инч", metres: 0.0254 },
};

export type KitchenGlbModelInfo = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  bytes: number;
  meshes: number;
  triangles: number;
  materialNames: string[];
  nodeNames: string[];
};

/** Stored per version in kitchen_design_versions.design.model. */
export type KitchenGlbModelRecord = Pick<
  KitchenGlbModelInfo,
  "widthMm" | "depthMm" | "heightMm" | "bytes" | "meshes" | "triangles"
> & { path: string; uploadId: string; originalName: string };

const KITCHEN_SIZE_METRES = [1.2, 15];

/**
 * A full kitchen is 1.2–15 m along its longest side. Pick the first unit that
 * puts the exported extent in that range; CAD exports are often mm or inches.
 */
export function detectKitchenGlbUnit(maxExtent: number): KitchenGlbUnit {
  if (!Number.isFinite(maxExtent) || maxExtent <= 0) return "m";
  const order: KitchenGlbUnit[] = ["m", "mm", "cm", "in"];
  return (
    order.find((unit) => {
      const metres = maxExtent * KITCHEN_GLB_UNITS[unit].metres;
      return (
        metres >= KITCHEN_SIZE_METRES[0] && metres <= KITCHEN_SIZE_METRES[1]
      );
    }) ?? "m"
  );
}

export function kitchenGlbIssues(
  info: Pick<
    KitchenGlbModelInfo,
    "widthMm" | "depthMm" | "heightMm" | "bytes" | "triangles"
  >,
) {
  const issues: string[] = [];
  const limits = KITCHEN_DESIGN_GLB;
  if (
    [info.widthMm, info.depthMm].some(
      (side) => !(side >= limits.minSideMm && side <= limits.maxSideMm),
    )
  )
    issues.push(
      `Өргөн, гүн ${limits.minSideMm}–${limits.maxSideMm} мм байх ёстой. Нэгжээ шалгана уу.`,
    );
  if (!(
    info.heightMm >= limits.minSideMm && info.heightMm <= limits.maxHeightMm
  ))
    issues.push(
      `Өндөр ${limits.minSideMm}–${limits.maxHeightMm} мм байх ёстой. Нэгж эсвэл дээш тэнхлэгээ шалгана уу.`,
    );
  if (info.bytes > limits.maxOutputBytes)
    issues.push(
      "Бэлтгэсэн GLB 40 MB-аас их байна. Текстурын хэмжээг багасгана уу.",
    );
  if (info.triangles > limits.maxTriangles)
    issues.push("Гурвалжны тоо 3 саяас их байна. Загвараа хөнгөлнө үү.");
  return issues;
}

// Names exported by SketchUp/3ds Max/Blender usually carry the appliance or
// material family. Only clear words count; generic names give no suggestion.
const APPLIANCES: Array<[RegExp, string]> = [
  [/sink|мойк|угаалтуур|раковин/i, "Угаалтуур"],
  [/faucet|\btap\b|mixer|смесител|холигч/i, "Холигч цорго"],
  [/oven|духов|шарах/i, "Шарах шүүгээ"],
  [/cooker|cooktop|\bhob\b|плит|stove/i, "Плитка"],
  [/hood|вытяж|сорогч/i, "Агаар сорогч"],
  [/fridge|refrigerator|холодил|хөргөгч/i, "Хөргөгч"],
  [/dish ?washer|посудомо|аяга таваг/i, "Аяга таваг угаагч"],
  [/microwave|микровол|богино долгион/i, "Богино долгионы зуух"],
];
const MATERIALS: Array<[RegExp, string]> = [
  [/\boak\b|царс/i, "Царс"],
  [/walnut|хушга/i, "Хушга"],
  [/marble|гантиг/i, "Гантиг"],
  [/quartz|кварц/i, "Кварц чулуун тавцан"],
  [/granite|боржин/i, "Чулуун тавцан"],
  [/\bmdf\b/i, "MDF"],
  [/laminat|ламинат/i, "Ламинат хавтан"],
  [/glass|шил/i, "Шил"],
  [/inox|stainless|steel|ган\b/i, "Зэвэрдэггүй ган"],
];
// Optional naming convention for exact module counts: base_600, wall-900, tall_1 …
const MODULE_NAME = /^(base|wall|tall|corner|cabinet|module)[\s_-]/i;

const FINISH_LABELS = {
  matte: "Матт фасад",
  gloss: "Гялгар фасад",
  wood: "Модон өнгөлгөөтэй фасад",
} as const;
const COUNTERTOP_LABELS = {
  laminate: "Ламинат тавцан",
  granite: "Чулуун тавцан",
  wood: "Модон тавцан",
} as const;

export function kitchenGlbListingSuggestions(
  info: Pick<
    KitchenGlbModelInfo,
    "widthMm" | "depthMm" | "materialNames" | "nodeNames"
  >,
  name = "",
  style = "modern",
  detection: Pick<
    KitchenGlbDetection,
    "modules" | "countertopM2" | "backsplashM2" | "fronts" | "appliances"
  > &
    Partial<Pick<KitchenGlbDetection, "countertopKind">> | null = null,
): KitchenListingSuggestions {
  const names = [...info.materialNames, ...info.nodeNames];
  const found = (rules: Array<[RegExp, string]>) =>
    rules.flatMap(([pattern, label]) =>
      names.some((value) => pattern.test(value)) ? [label] : [],
    );
  const appliances = found(APPLIANCES);
  // Finishes read from the fronts and worktop are offered next to named materials.
  const finishes = new Set<string>(
    (detection?.modules ?? []).flatMap((item) =>
      item.finish ? [FINISH_LABELS[item.finish]] : [],
    ),
  );
  if (detection?.countertopKind)
    finishes.add(COUNTERTOP_LABELS[detection.countertopKind]);
  const materials = [...new Set([...found(MATERIALS), ...finishes])];
  const named = new Set(
    info.nodeNames.filter((value) => MODULE_NAME.test(value.trim())),
  ).size;
  const modules = detection?.modules ?? [];
  const cabinetCount = modules.length || named;
  // Floor runs decide the shape: each facing is one run. Three runs (or two
  // facing each other plus one across) are a U, two facing each other a
  // double-sided kitchen, two across an L whose side run decides left/right.
  const floor = modules.filter((item) => item.role !== "wall");
  const runs = floor.length ? floor : modules;
  const facings = new Set(runs.map((item) => item.facing));
  const opposite = (axis: "x" | "z") =>
    facings.has(`+${axis}`) && facings.has(`-${axis}`);
  const onAxis = (axis: "x" | "z") =>
    facings.has(`+${axis}`) || facings.has(`-${axis}`);
  const alongZ = runs.filter((item) => item.facing[1] === "x");
  const sideX = alongZ.length
    ? alongZ.reduce((sum, item) => sum + item.box.min[0] + item.box.max[0], 0) /
      (2 * alongZ.length)
    : 0;
  const layout = modules.length
    ? facings.size >= 3 ||
      (opposite("z") && onAxis("x")) ||
      (opposite("x") && onAxis("z"))
      ? "u"
      : opposite("z") || opposite("x")
        ? "double-side"
        : onAxis("x") && onAxis("z")
          ? sideX < 0
            ? "l-left"
            : "l-right"
          : "straight"
    : Math.min(info.widthMm, info.depthMm) >= 1500
      ? "l-left"
      : "straight";
  const styleLabel = KITCHEN_STYLE_LABELS[style] ?? style;
  // "L хэлбэр" keeps its Latin capital; only a Cyrillic first letter is lowered.
  const layoutLabel = (KITCHEN_LAYOUT_LABELS[layout] ?? layout).replace(
    /^[А-ЯЁӨҮ]/,
    (letter) => letter.toLocaleLowerCase("mn"),
  );
  const size = `${Math.round(info.widthMm)} × ${Math.round(info.depthMm)} мм`;
  const short = `${styleLabel} хэв маягийн ${layoutLabel} бэлэн гал тогоо. Гадна хэмжээ ${size}${cabinetCount ? `, ${cabinetCount} модультай` : ""}. Өрөөндөө тааруулан захиалах боломжтой.`;
  const fileTitle = name
    .replace(/\.glb$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const counts = (["base", "tall", "wall"] as const).flatMap((role) => {
    const count = modules.filter((item) => item.role === role).length;
    return count ? [`${KITCHEN_GLB_ROLE_LABELS[role]} · ${count} ш`] : [];
  });
  const area = (value: number) => Number(value.toFixed(2));
  const moduleList = modules.length
    ? `\n\nБүрдэл: ${modules.map((item) => `${item.name} (${item.widthMm} мм)`).join(", ")}.`
    : "";
  return {
    titles: [
      ...new Set(
        [fileTitle, `${styleLabel} ${layoutLabel} гал тогоо`].filter(Boolean),
      ),
    ],
    shortDescriptions: [short],
    descriptions: [
      `${short}${moduleList}\n\nХэмжээ, өнгө, материал болон захиалгын нөхцөлийг үйлдвэрлэгчтэй тохиролцоно.`,
    ],
    materials,
    tags: [
      ...new Set([
        styleLabel.toLocaleLowerCase("mn"),
        KITCHEN_LAYOUT_LABELS[layout] ?? layout,
        ...materials.map((item) => item.toLocaleLowerCase("mn")),
        "захиалгаар",
      ]),
    ],
    inclusions: [
      ...(counts.length ? counts : named ? [`Шүүгээ · ${named} ш`] : []),
      // Exact sizes per module, so the factory list is one click away.
      ...kitchenGlbModuleLines(modules),
      ...(detection?.fronts && modules.length
        ? [`Хаалга ба шургуулганы нүүр · ${detection.fronts} ш`]
        : []),
      ...(detection?.countertopM2
        ? [`Тавцан · ${area(detection.countertopM2)} м2`]
        : []),
      ...(detection?.backsplashM2
        ? [`Ханын хавтан · ${area(detection.backsplashM2)} м2`]
        : []),
    ],
    // As in the planner BOM, appliances and plumbing are quoted separately.
    exclusions: detection?.appliances?.length
      ? kitchenGlbApplianceLines(detection.appliances)
      : appliances.map((item) => `${item} · 1 ш`),
    layout,
    cabinetCount,
    widthMm: Math.round(info.widthMm),
    depthMm: Math.round(info.depthMm),
  };
}

export type PreparedKitchenGlb = {
  file: File;
  info: KitchenGlbModelInfo;
  unit: KitchenGlbUnit;
  /** Mesh nodes (mm boxes); each node carries extras.kgPart = id in the GLB. */
  parts: KitchenGlbPart[];
  detection: KitchenGlbDetection;
  materials: Record<string, KitchenGlbMaterial>;
};

/**
 * Browser-side preparation of a full-kitchen GLB:
 * unit → metres, Z-up → Y-up, origin → bottom-centre, spec/gloss → metal/rough
 * (three.js no longer renders spec/gloss), duplicate data pruned.
 */
export async function prepareKitchenDesignGlb(
  source: File,
  options: { unit?: KitchenGlbUnit; zUp?: boolean } = {},
): Promise<PreparedKitchenGlb> {
  if (!/\.glb$/i.test(source.name))
    throw new Error("Зөвхөн .glb файл оруулна.");
  if (source.size > KITCHEN_DESIGN_GLB.maxInputBytes)
    throw new Error("GLB файл 50 MB-аас ихгүй байна.");
  const [
    { WebIO, getBounds, Logger },
    { KHRONOS_EXTENSIONS },
    { dedup, metalRough, prune },
  ] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
  ]);
  const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);
  const document = await io
    .readBinary(new Uint8Array(await source.arrayBuffer()))
    .catch(() => {
      throw new Error(
        "GLB уншигдсангүй. Draco/Meshopt-оор шахаагүй, glTF 2.0 GLB оруулна уу.",
      );
    });
  document.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = document.getRoot();
  if (
    root
      .listExtensionsUsed()
      .some((extension) =>
        ["KHR_draco_mesh_compression", "EXT_meshopt_compression"].includes(
          extension.extensionName,
        ),
      )
  )
    throw new Error(
      "Шахсан (Draco/Meshopt) GLB-г боловсруулах боломжгүй. Шахаагүй GLB оруулна уу.",
    );
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error("GLB-д scene алга.");
  for (const extra of root.listScenes()) if (extra !== scene) extra.dispose();
  for (const animation of root.listAnimations()) animation.dispose();

  // One wrapper node carries the unit scale, the up-axis fix and the origin shift.
  const wrapper = document.createNode("kitchen");
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);
  if (options.zUp) wrapper.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  const raw = getBounds(scene);
  const extent = Math.max(
    ...raw.max.map((value, axis) => value - raw.min[axis]),
  );
  const unit = options.unit ?? detectKitchenGlbUnit(extent);
  const scale = KITCHEN_GLB_UNITS[unit].metres;
  wrapper.setScale([scale, scale, scale]);
  const scaled = getBounds(scene);
  const [x, y, z] = wrapper.getTranslation();
  wrapper.setTranslation([
    x - (scaled.min[0] + scaled.max[0]) / 2,
    y - scaled.min[1],
    z - (scaled.min[2] + scaled.max[2]) / 2,
  ]);
  await document.transform(metalRough(), dedup(), prune({ keepLeaves: false }));
  root.getAsset().generator = "tavilga.mn kitchen design";

  // Every mesh node becomes an addressable part for detection and click-to-tag.
  const parts: KitchenGlbPart[] = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const bounds = getBounds(node);
    const id = parts.length;
    node.setExtras({ ...node.getExtras(), kgPart: id });
    const shell = meshShell(mesh, node.getWorldMatrix());
    parts.push({
      id,
      ...shell,
      name: node.getName(),
      materials: mesh
        .listPrimitives()
        .map((primitive) => primitive.getMaterial()?.getName() ?? "")
        .filter(Boolean),
      box: {
        min: bounds.min.map((value) => value * 1000) as [
          number,
          number,
          number,
        ],
        max: bounds.max.map((value) => value * 1000) as [
          number,
          number,
          number,
        ],
      },
    });
  }

  // Material surfaces (after spec/gloss → metal/rough) for front / worktop colours.
  const materials: Record<string, KitchenGlbMaterial> = {};
  for (const material of root.listMaterials()) {
    const name = material.getName();
    if (!name || materials[name]) continue;
    const [r, g, b] = material.getBaseColorFactor();
    const hex = (value: number) =>
      Math.round(Math.min(1, Math.max(0, value)) ** (1 / 2.2) * 255)
        .toString(16)
        .padStart(2, "0");
    // A textured finish is represented by its texture's average colour.
    const texture = material.getBaseColorTexture();
    const average = texture
      ? await averageTextureColor(texture.getImage(), texture.getMimeType())
      : null;
    const tint = average
      ? [r * average[0], g * average[1], b * average[2]]
      : [r, g, b];
    materials[name] = {
      color: `#${hex(tint[0])}${hex(tint[1])}${hex(tint[2])}`,
      roughness: material.getRoughnessFactor(),
      metalness: material.getMetallicFactor(),
      textured: !!texture,
    };
  }

  const bytes = await io.writeBinary(document);
  const file = new File([bytes], source.name.replace(/[^\w.-]+/g, "-"), {
    type: "model/gltf-binary",
    lastModified: Date.now(),
  });
  return {
    file,
    unit,
    info: kitchenGlbDocumentInfo(document, getBounds, file.size),
    parts,
    materials,
    // Colours come from the fronts; sizes are then re-measured on the carcass.
    detection: kitchenGlbMeasureModules(
      kitchenGlbAssignMaterials(
        detectKitchenGlbModules(parts),
        parts,
        materials,
      ),
      parts,
    ),
  };
}

/**
 * Surface area and shell thickness of a mesh in millimetres. A closed board
 * has volume ≈ area/2 · thickness, which also holds for bent / rounded panels
 * whose bounding box is not thin. Open meshes give no thickness.
 */
function meshShell(
  mesh: { listPrimitives(): Array<{
    getMode(): number;
    getAttribute(name: string): { getCount(): number; getElement(index: number, target: number[]): number[] } | null;
    getIndices(): { getCount(): number; getScalar(index: number): number } | null;
  }> },
  matrix: ArrayLike<number>,
): { areaMm2?: number; thicknessMm?: number } {
  let area = 0;
  let volume = 0;
  const point = (accessor: { getElement(index: number, target: number[]): number[] }, index: number) => {
    const [x, y, z] = accessor.getElement(index, [0, 0, 0]);
    return [
      (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * 1000,
      (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * 1000,
      (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * 1000,
    ];
  };
  for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMode() !== 4) continue; // triangles only
    const position = primitive.getAttribute("POSITION");
    if (!position) continue;
    const indices = primitive.getIndices();
    const count = indices ? indices.getCount() : position.getCount();
    const at = (index: number) => (indices ? indices.getScalar(index) : index);
    for (let index = 0; index + 2 < count; index += 3) {
      const a = point(position, at(index));
      const b = point(position, at(index + 1));
      const c = point(position, at(index + 2));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      area += Math.hypot(cross[0], cross[1], cross[2]) / 2;
      volume +=
        (a[0] * (b[1] * c[2] - b[2] * c[1]) -
          a[1] * (b[0] * c[2] - b[2] * c[0]) +
          a[2] * (b[0] * c[1] - b[1] * c[0])) /
        6;
    }
  }
  if (area <= 0) return {};
  const thickness = (2 * Math.abs(volume)) / area;
  return {
    areaMm2: Math.round(area),
    // Tiny or open shells give nonsense; keep only plausible board thicknesses.
    ...(thickness >= 2 && thickness <= 80
      ? { thicknessMm: Math.round(thickness * 10) / 10 }
      : {}),
  };
}

/** Linear average colour of an embedded texture; null outside the browser. */
async function averageTextureColor(image: Uint8Array | null, mimeType: string) {
  if (
    !image ||
    typeof createImageBitmap !== "function" ||
    typeof OffscreenCanvas === "undefined"
  )
    return null;
  try {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(image)], { type: mimeType || "image/png" }),
    );
    const canvas = new OffscreenCanvas(16, 16);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, 16, 16);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 16, 16).data;
    const sum = [0, 0, 0];
    for (let index = 0; index < pixels.length; index += 4)
      for (let channel = 0; channel < 3; channel++)
        sum[channel] += (pixels[index + channel] / 255) ** 2.2;
    return sum.map((value) => value / (pixels.length / 4));
  } catch {
    return null;
  }
}

/** Shared by the browser preparation and the server re-check of the upload. */
export function kitchenGlbDocumentInfo(
  document: Document,
  getBounds: (scene: Scene) => { min: number[]; max: number[] },
  bytes: number,
): KitchenGlbModelInfo & { origin: { x: number; y: number; z: number } } {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const bounds = getBounds(scene);
  const triangles = root.listMeshes().reduce(
    (total, mesh) =>
      total +
      mesh.listPrimitives().reduce((sum, primitive) => {
        const count =
          primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0;
        return sum + (primitive.getMode() === 4 ? count / 3 : 0);
      }, 0),
    0,
  );
  return {
    widthMm: Math.round((bounds.max[0] - bounds.min[0]) * 1000),
    heightMm: Math.round((bounds.max[1] - bounds.min[1]) * 1000),
    depthMm: Math.round((bounds.max[2] - bounds.min[2]) * 1000),
    bytes,
    meshes: root.listMeshes().length,
    triangles: Math.round(triangles),
    materialNames: [
      ...new Set(
        root
          .listMaterials()
          .map((item) => item.getName())
          .filter(Boolean),
      ),
    ].slice(0, 200),
    nodeNames: [
      ...new Set(
        root
          .listNodes()
          .map((item) => item.getName())
          .filter(Boolean),
      ),
    ].slice(0, 500),
    origin: {
      x: Math.round(((bounds.min[0] + bounds.max[0]) / 2) * 1000),
      y: Math.round(bounds.min[1] * 1000),
      z: Math.round(((bounds.min[2] + bounds.max[2]) / 2) * 1000),
    },
  };
}

import { cloneKitchen } from "./kitchenAssembly";
import { roomWalls, validateCabinet, type ModularCabinet, type ModularKitchen } from "./kitchenCabinets";
import { kitchenVariantFits, kitchenVariantFromModule, type KitchenCatalogModule } from "./kitchenModuleCatalog";
import { cabinetAxes, cabinetsOverlap, placementIssues, resolveElevations } from "./kitchenPlacement";
import { PCMALL_APPLIANCES, pcmallProductId } from "./pcmallAppliances";

/** Explicit conversion: preserve each run and item identity; use measured catalog
 * dimensions and pack only where a wider real box requires more room. */
export function furnishKitchenFromCatalog(kitchen: ModularKitchen, modules: KitchenCatalogModule[], options: { alignEquipment?: boolean } = {}) {
  const next = cloneKitchen(kitchen);
  const choices = modules.filter(m => m.active).flatMap(module => module.variants
    .map(v => ({ module, variant: kitchenVariantFromModule(module, v) }))
    .filter(({ variant: v }) => v.active && v.glbFile && v.processingStatus === "ready" && !v.assetValidationIssues?.length));
  let changed = 0;
  let omitted = 0;
  for (const c of next.cabinets) {
    const opening = c.opening ?? "doors";
    if (opening === 'oven' && c.type === 'tall') {
      const a = PCMALL_APPLIANCES.find(item => item.type === 'oven')!;
      if (c.catalogHousing === 'oven-tower' && c.applianceProductId === pcmallProductId(a)) continue;
      c.catalogHousing = 'oven-tower'; c.applianceProductId = pcmallProductId(a);
      delete c.variantId; delete c.catalogAdaptation; delete c.partSelections;
      changed++; continue;
    }
    if (opening === "hood" || opening === "refrigerator") {
      const a = PCMALL_APPLIANCES.find(item => item.type === (opening === "hood" ? "hood" : "fridge"))!;
      if (opening === 'refrigerator') {
        const installation = c.refrigeratorInstallation ?? (c.applianceProductId || c.refrigeratorStyle === 'side-by-side' ? 'freestanding' : 'integrated');
        c.refrigeratorInstallation = installation;
        if (installation === 'integrated') {
          if (c.catalogHousing === 'fridge-integrated') continue;
          // The available PC Mall fridge is freestanding. Reserve an honestly
          // labelled cabinet for an integrated unit instead of substituting it.
          c.catalogHousing = 'fridge-integrated'; c.width = 600; c.depth = 650;
          c.height = Math.min(2160, next.room.height - 100); c.doorCount = 1;
          c.fitToCeiling = false; c.autoElevation = false; c.drawerCount = 0;
          delete c.applianceProductId; delete c.variantId; delete c.partSelections; delete c.components;
          changed++; continue;
        }
      }
      if (opening === 'hood' && c.hoodMount === 'under-cabinet') {
        const box = choices.filter(item => item.module.cabinetType === 'wall' && item.variant.opening === 'doors' && item.module.widthMm >= a.width)
          .sort((x, y) => Math.abs(x.module.widthMm - c.width) - Math.abs(y.module.widthMm - c.width))[0];
        if (!box) return { error: 'Сорогчийн дээр байрлуулах дээд box-ийн бэлэн загвар санд алга.', changed: 0 };
        if (c.variantId === box.variant.furnitureModelId && c.catalogAdaptation === 'hood' && c.applianceProductId === pcmallProductId(a)) continue;
        c.variantId = box.variant.furnitureModelId; c.catalogAdaptation = 'hood'; c.applianceProductId = pcmallProductId(a);
        c.width = box.module.widthMm; c.height = box.module.heightMm; c.depth = box.module.depthMm;
        c.doorCount = box.variant.doorCount >= 2 ? 2 : 1; c.drawerCount = 0; c.autoElevation = false;
        delete c.catalogHousing; delete c.components; delete c.partSelections;
        changed++; continue;
      }
      const housing = opening === 'hood' ? 'wall-hood' : undefined;
      if (c.applianceProductId === pcmallProductId(a) && c.catalogHousing === housing) continue;
      c.applianceProductId = pcmallProductId(a);
      c.width = a.width; c.depth = a.depth; c.height = opening === 'hood' ? 600 : a.height;
      c.autoElevation = false; c.fitToCeiling = false; c.drawerCount = 0;
      if (opening === "hood") { c.catalogHousing = 'wall-hood'; c.doorCount = 1; }
      else { c.refrigeratorStyle = "top-bottom"; delete c.catalogHousing; }
      delete c.catalogAdaptation;
      delete c.variantId; delete c.partSelections; delete c.components;
      changed++; continue;
    }
    const current = choices.find(item => item.variant.furnitureModelId === c.variantId);
    if (current && kitchenVariantFits(current.variant, c)) continue;
    const fitting = choices.filter(({ module: m, variant: v }) =>
      m.cabinetType === c.type &&
      // A sink needs the single bottom door with a removable upper drawer;
      // never turn a stack of drawers into a plumbing cabinet.
      (opening !== "sink" || v.opening === "sink" || v.opening === "doors" || (v.doorCount > 0 && v.drawerCount <= 1)) &&
      (!['sink', 'hob', 'oven'].includes(opening) || m.widthMm >= 600) &&
      (opening !== "oven" || m.depthMm >= 570) &&
      (opening !== "oven" || ['oven', 'doors', 'drawers', 'open'].includes(v.opening)))
      .map(item => ({ ...item, score: Math.abs(item.module.widthMm - c.width) * 20 +
        Math.abs(item.module.heightMm - c.height) * 3 + Math.abs(item.module.depthMm - c.depth) +
        (item.variant.opening === opening ? 0 : 100) + item.variant.sortOrder / 100 }))
      .sort((a, b) => a.score - b.score);
    const picked = fitting[0];
    if (!picked) return { error: `${c.type === 'wall' ? 'Дээд' : 'Доод'} box-д тохирох бэлэн 3D загвар санд алга.`, changed: 0 };
    const { module: m, variant: v } = picked;
    c.variantId = v.furnitureModelId; c.width = m.widthMm; c.height = m.heightMm; c.depth = m.depthMm;
    // A rectangular catalog box remains rectangular at an L return; do not
    // label it as an unavailable special corner SKU.
    if (c.corner) { c.corner = false; delete c.cornerSide; }
    c.doorCount = v.doorCount >= 2 ? 2 : 1; c.drawerCount = v.drawerCount;
    if (['sink', 'hob', 'oven'].includes(opening)) {
      c.catalogAdaptation = opening as 'sink' | 'hob' | 'oven';
      c.drawerCount = 0;
      if (opening === 'oven') c.applianceProductId = pcmallProductId(PCMALL_APPLIANCES.find(a => a.type === 'oven')!);
    } else { c.opening = v.opening; delete c.catalogAdaptation; }
    delete c.partSelections; delete c.components;
    changed++;
  }
  if (!changed && !options.alignEquipment) return { design: kitchen, changed };
  // Retain wall assignment/back alignment when a 600mm logical depth becomes 598mm.
  const groups = new Map<string, { wall: ReturnType<typeof roomWalls>[number]; items: ModularCabinet[] }>();
  for (const old of kitchen.cabinets) {
    const c = next.cabinets.find(item => item.id === old.id)!;
    const { front } = cabinetAxes(old.position.rotation);
    const wall = roomWalls(kitchen.room).find(w => Math.abs(w.inward.x - front.x) + Math.abs(w.inward.z - front.z) < .01 &&
      Math.abs((old.position.x - w.start.x) * w.inward.x + (old.position.z - w.start.z) * w.inward.z - old.depth / 2) < 100);
    if (!wall) continue; // Deliberate islands keep their centre and rotation.
    const key = `${wall.id}:${c.type === 'wall' ? 'upper' : 'floor'}`;
    const group = groups.get(key) ?? { wall, items: [] }; group.items.push(c); groups.set(key, group);
  }
  for (const { wall, items } of groups.values()) {
    if (items[0]?.type === 'wall') continue;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, length = Math.hypot(dx, dz);
    const tx = dx / length, tz = dz / length;
    const along = (c: ModularCabinet) => (c.position.x - wall.start.x) * tx + (c.position.z - wall.start.z) * tz;
    items.sort((a, b) => along(a) - along(b));
    const gapBetween = (a?: ModularCabinet, b?: ModularCabinet) => {
      if (!a || !b) return 0;
      const cooker = a.type === 'base' && ['oven', 'hob'].includes(a.opening ?? '') && b.type === 'tall' ? a
        : b.type === 'base' && ['oven', 'hob'].includes(b.opening ?? '') && a.type === 'tall' ? b : undefined;
      const hood = cooker && next.cabinets.find(c => c.opening === 'hood' && c.hoodMount === 'under-cabinet');
      return hood && cooker ? Math.max(0, (hood.width - cooker.width) / 2) : 0;
    };
    const edgeBuffer = (c?: ModularCabinet) => c?.type === 'base' && ['oven', 'hob'].includes(c.opening ?? '')
      ? Math.max(0, ((next.cabinets.find(h => h.opening === 'hood' && h.hoodMount === 'under-cabinet')?.width ?? c.width) - c.width) / 2) : 0;
    const startBuffer = edgeBuffer(items[0]), endBuffer = edgeBuffer(items.at(-1));
    if (items.reduce((sum, c, i) => sum + c.width + gapBetween(items[i - 1], c), startBuffer + endBuffer) > length + .01)
      return { error: 'Бодит хэмжээтэй box-ууд энэ хананд багтахгүй байна. Нэг box-ийг хасах эсвэл өөр өргөн сонгоно уу.', changed: 0 };
    let edge = startBuffer;
    const centres = items.map((c, i) => { const centre = Math.max(along(c), edge + gapBetween(items[i - 1], c) + c.width / 2); edge = centre + c.width / 2; return centre; });
    edge = length - endBuffer;
    for (let i = items.length - 1; i >= 0; i--) { centres[i] = Math.min(centres[i], edge - items[i].width / 2); edge = centres[i] - items[i].width / 2 - gapBetween(items[i - 1], items[i]); }
    items.forEach((c, i) => {
      c.position.x = wall.start.x + tx * centres[i] + wall.inward.x * c.depth / 2;
      c.position.z = wall.start.z + tz * centres[i] + wall.inward.z * c.depth / 2;
    });
  }
  // A hood follows the cooking centre, at its former installation height.
  for (const hood of next.cabinets.filter(c => c.opening === 'hood')) {
    const cooker = next.cabinets.filter(c => c.type === 'base' && ['oven', 'hob'].includes(c.opening ?? '')).sort((a, b) =>
      Math.hypot(a.position.x - hood.position.x, a.position.z - hood.position.z) - Math.hypot(b.position.x - hood.position.x, b.position.z - hood.position.z))[0];
    if (!cooker) continue;
    const { front } = cabinetAxes(cooker.position.rotation);
    const desired = { ...hood, position: { ...hood.position, rotation: cooker.position.rotation,
      x: cooker.position.x + front.x * (hood.depth - cooker.depth) / 2,
      z: cooker.position.z + front.z * (hood.depth - cooker.depth) / 2 } };
    hood.position = desired.position;
  }
  // Real 800mm uppers may replace a run of narrower unmodelled placeholders.
  // Keep the cooking gap and fridge volume clear, retaining each wall/run.
  const uppers = next.cabinets.filter(c => c.type === 'wall' && c.opening !== 'hood');
  const placed = next.cabinets.filter(c => !uppers.includes(c));
  for (const upper of uppers) {
    const group = [...groups.values()].find(g => g.items.includes(upper));
    if (!group) { placed.push(upper); continue; }
    const { wall } = group, dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, length = Math.hypot(dx, dz);
    const tx = dx / length, tz = dz / length;
    const wanted = (upper.position.x - wall.start.x) * tx + (upper.position.z - wall.start.z) * tz;
    const points = [Math.max(upper.width / 2, Math.min(length - upper.width / 2, wanted))];
    for (let at = upper.width / 2; at <= length - upper.width / 2; at += 25) points.push(at);
    points.push(length - upper.width / 2);
    const candidate = points.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted)).map(at => {
      const c = { ...upper, position: { ...upper.position, x: wall.start.x + tx * at + wall.inward.x * upper.depth / 2,
        z: wall.start.z + tz * at + wall.inward.z * upper.depth / 2 } };
      // A shallow hood can sit under an upper box. A fridge may also support an
      // upper at its measured top, provided the complete box fits below ceiling.
      for (const device of placed.filter(item => item.applianceProductId && ['hood', 'refrigerator'].includes(item.opening ?? '')))
        if (cabinetsOverlap(c, device)) { c.position.y = device.position.y + device.height + 2; c.autoElevation = false; }
      return c;
    }).find(c => c.position.y + c.height <= kitchen.room.height && !placed.some(other => cabinetsOverlap(c, other)));
    if (candidate) { upper.position = candidate.position; upper.autoElevation = candidate.autoElevation; placed.push(upper); }
    else if (!kitchen.cabinets.find(c => c.id === upper.id)?.variantId) {
      next.cabinets = next.cabinets.filter(c => c.id !== upper.id); omitted++;
    } else return { error: 'Одоо байгаа дээд box-ийг бусад тавилгатай давхцуулахгүй байрлуулах зай алга.', changed: 0 };
  }
  const resolved = resolveElevations(next);
  const invalid = resolved.cabinets.map(validateCabinet).find(Boolean) ?? placementIssues(resolved).find(i => i.severity === 'error')?.message;
  return invalid ? { error: invalid, changed: 0 } : { design: resolved, changed, omitted };
}

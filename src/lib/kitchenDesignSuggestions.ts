import { validateCabinet, type KitchenLayout, type ModularCabinet, type ModularKitchen } from "./kitchenCabinets";
import { arrangeKitchen } from "./kitchenAssembly";
import { cabinetAxes, placementIssues, kitchenOpeningIssues } from "./kitchenPlacement";
import { roomContainsPoint } from "./kitchenRoomOutline";
import { cabinetFromCatalog } from "./kitchenCatalogInsertion";
import { similarKitchenVariants, type KitchenCatalogModule } from "./kitchenModuleCatalog";
import { buildKitchenBom } from "./kitchenBom";
import type { Product } from "./types";
import { hasAvailableStock } from "./inventory";

export const SUGGESTION_GOALS = [
  { id: "balanced", title: "Тэнцвэртэй", description: "Ажлын урсгал, сул зай, өөрчлөлтийг хамтад нь тооцно." },
  { id: "budget", title: "Төсөв хэмнэх", description: "Каталогийн үнэтэй бүтээгдэхүүнүүдээс бага дүнтэй хувилбарыг эхэнд харуулна." },
  { id: "storage", title: "Хадгалалт", description: "Төхөөрөмжгүй шүүгээний нийт эзлэхүүнийг харьцуулна." },
  { id: "workflow", title: "Ажлын урсгал", description: "Угаалтуур, плитка, хөргөгч хоорондын зайг багасгана." },
  { id: "prep", title: "Ажлын тавцан", description: "Төхөөрөмжгүй, залгаа шүүгээний тавцанг уртасгана." },
  { id: "space", title: "Сул зай", description: "Шүүгээний урд талын сул зайг харьцуулна." },
  { id: "minimal", title: "Бага өөрчлөлт", description: "Одоогийн байрлалаас цөөн шүүгээ зөөнө." },
] as const;
export type SuggestionGoal = typeof SUGGESTION_GOALS[number]["id"];
export type SuggestionPreferences = { goal?: SuggestionGoal; lockAppliances?: boolean;
  modules?: KitchenCatalogModule[]; products?: Product[]; useCatalog?: boolean; budget?: number; style?: string };
export const LAYOUT_LABELS: Record<KitchenLayout, string> = {
  straight: "Шулуун", "l-right": "Баруун L", "l-left": "Зүүн L", u: "U байрлал", "double-side": "Хоёр талт",
};
const layouts = Object.keys(LAYOUT_LABELS) as KitchenLayout[];
const appliance = (c: ModularCabinet) => ["sink", "hob", "oven", "hood", "refrigerator"].includes(c.opening ?? "");
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const samePose = (a: ModularCabinet, b: ModularCabinet) => distance(a.position, b.position) < 1 &&
  Math.abs(a.position.y - b.position.y) < 1 && Math.cos(a.position.rotation - b.position.rotation) > 0.99999;
export const suggestionSignature = (k: ModularKitchen) => JSON.stringify(k.cabinets.map(c => JSON.stringify([
  c.type,c.opening ?? "doors",c.width,c.height,c.depth,c.variantId,c.corner ?? false,c.cornerSide,
  c.doorCount,c.drawerCount,c.finish,c.frontStyle,c.handleStyle,c.color,c.material,c.frontMaterialId,c.carcassMaterialId,c.components,c.partSelections,
  Math.round(c.position.x),Math.round(c.position.y),Math.round(c.position.z),
  Math.round(Math.sin(c.position.rotation)*1000),Math.round(Math.cos(c.position.rotation)*1000),
])).sort());

/** Identity, colour and finish cannot make a second physical layout. */
export const suggestionGeometrySignature = (k: ModularKitchen) => JSON.stringify(k.cabinets.map(c => [
  c.type, c.opening ?? "doors", c.width, c.height, c.depth, Boolean(c.corner), c.cornerSide,
  Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z),
  Math.round(Math.sin(c.position.rotation) * 1000), Math.round(Math.cos(c.position.rotation) * 1000),
].join(":")).sort());

/** Measured free distance along each non-corner cabinet's front centre, sampled at 50 mm. */
function frontSpace(kitchen: ModularKitchen) {
  const floor = kitchen.cabinets.filter(c => c.type !== "wall");
  const obstacles = [...floor, ...(kitchen.extras ?? [])];
  const gaps = floor.filter(c => !c.corner).slice(0,12).map(c => {
    const { front } = cabinetAxes(c.position.rotation);
    const origin = { x: c.position.x + front.x * c.depth / 2, z: c.position.z + front.z * c.depth / 2 };
    const max = Math.hypot(kitchen.room.width, kitchen.room.depth);
    let free = 0;
    for (let step = 50; step <= max; step += 50) {
      const p = { x: origin.x + front.x * step, z: origin.z + front.z * step };
      if (!roomContainsPoint(kitchen.room, p)) break;
      if (obstacles.some(other => {
        if (other.id === c.id) return false;
        const { right, front: facing } = cabinetAxes(other.position.rotation);
        const dx = p.x - other.position.x, dz = p.z - other.position.z;
        return Math.abs(dx * right.x + dz * right.z) < other.width / 2 && Math.abs(dx * facing.x + dz * facing.z) < other.depth / 2;
      })) break;
      free = step;
    }
    return free;
  });
  return gaps.length ? gaps.reduce((sum, n) => sum + n, 0) / gaps.length : 0;
}
function prepRun(kitchen: ModularKitchen) {
  let longest = 0;
  const visited = new Set<string>();
  const free = kitchen.cabinets.filter(c => c.type === "base" && !appliance(c) && !c.corner);
  for (const first of free) {
    if (visited.has(first.id)) continue;
    const { right, front } = cabinetAxes(first.position.rotation);
    const line = free.filter(c => Math.cos(c.position.rotation - first.position.rotation) > .99999 &&
      Math.abs((c.position.x - first.position.x) * front.x + (c.position.z - first.position.z) * front.z) < 2 && Math.abs(c.height - first.height) < 2)
      .sort((a,b) => (a.position.x - b.position.x) * right.x + (a.position.z - b.position.z) * right.z);
    let run = 0, edge = -Infinity;
    for (const c of line) {
      visited.add(c.id);
      const center = c.position.x * right.x + c.position.z * right.z;
      run = Math.abs(center - c.width / 2 - edge) < 2 ? run + c.width : c.width;
      edge = center + c.width / 2;
      longest = Math.max(longest, run);
    }
  }
  return longest;
}
export function kitchenSuggestionMetrics(design: ModularKitchen, original: ModularKitchen, preferences: SuggestionPreferences = {}) {
  const sink = design.cabinets.find(c => c.opening === "sink");
  const hob = design.cabinets.find(c => c.opening === "hob" || c.opening === "oven");
  const fridge = design.cabinets.find(c => c.opening === "refrigerator");
  const pairs = [[sink,hob],[hob,fridge],[fridge,sink]].filter((p): p is [ModularCabinet,ModularCabinet] => !!p[0] && !!p[1]);
  const services = design.cabinets.flatMap(c => {
    const kind = c.opening === "sink" ? "water" : c.opening === "hood" ? "vent" : ["oven","hob","refrigerator"].includes(c.opening ?? "") ? "power" : null;
    const points = (design.room.items ?? []).filter(p => p.kind === kind);
    return points.length ? [Math.min(...points.map(p => distance(c.position,p)))] : [];
  });
  const bom = buildKitchenBom(design, preferences.modules ?? [], preferences.products ?? []);
  const furniture = bom.items.filter(item => !item.included && item.unit === "ш");
  const unpricedFurniture = furniture.filter(item => item.unitPrice === null).length;
  return {
    moved: design.cabinets.filter(c => !samePose(c, original.cabinets.find(o => o.id === c.id)!)).length,
    workflow: pairs.length ? pairs.reduce((sum,[a,b]) => sum + distance(a.position,b.position),0) : null,
    services: services.length ? services.reduce((sum,n) => sum+n,0) : null,
    prep: prepRun(design), space: frontSpace(design),
    storage: design.cabinets.filter(c => !appliance(c)).reduce((sum, c) => sum + c.width * c.depth * c.height / 1e6, 0),
    price: unpricedFurniture ? null : furniture.reduce((sum, item) => sum + item.unitPrice! * item.quantity, 0),
    knownSubtotal: bom.knownSubtotal, unpriced: bom.unpricedCount,
    changedProducts: design.cabinets.filter(c => c.variantId !== original.cabinets.find(o => o.id === c.id)?.variantId).length,
  };
}
export type KitchenSuggestion = {
  id: string; title: string; layout: KitchenLayout; design: ModularKitchen; fits: true;
  metrics: ReturnType<typeof kitchenSuggestionMetrics>; warnings: string[]; current: boolean;
  reason: string;
};

export function kitchenDesignSuggestionResult(kitchen: ModularKitchen, preferences: SuggestionPreferences = {}) {
  const candidates: Omit<KitchenSuggestion,"title" | "reason">[] = [];
  const seen = new Set<string>();
  const rejected = { placement: 0, windows: 0, locked: 0, budget: 0, unpriced: 0, style: 0, stock: 0 };
  const consider = (design: ModularKitchen) => {
    if(!design.cabinets.length)return;
    const id = suggestionSignature(design);
    if (seen.has(id)) return;
    seen.add(id);
    if (design.cabinets.some(c => validateCabinet(c))) { rejected.placement++; return; }
    if (kitchenOpeningIssues(design).length) { rejected.windows++; return; }
    const issues = placementIssues(design);
    if (issues.some(i => i.severity === "error")) { rejected.placement++; return; }
    if (preferences.lockAppliances && design.cabinets.some(c => appliance(c) && !samePose(c,kitchen.cabinets.find(o=>o.id===c.id)!))) { rejected.locked++; return; }
    if (preferences.useCatalog) {
      const quantities = new Map<string, number>();
      for (const c of design.cabinets) {
        const variant = preferences.modules?.flatMap(m => m.variants).find(v => v.furnitureModelId === c.variantId);
        if (variant) quantities.set(variant.productId, (quantities.get(variant.productId) ?? 0) + 1);
      }
      const changedIds = new Set(design.cabinets.filter(c => c.variantId !== kitchen.cabinets.find(o => o.id === c.id)?.variantId)
        .flatMap(c => preferences.modules?.flatMap(m => m.variants).filter(v => v.furnitureModelId === c.variantId).map(v => v.productId) ?? []));
      if ([...changedIds].some(id => {
        const p = preferences.products?.find(p => p.id === id);
        return !p || !p.inStock || !hasAvailableStock(p) || (quantities.get(id) ?? 0) > (p.stockQuantity ?? 0);
      })) { rejected.stock++; return; }
    }
    const metrics = kitchenSuggestionMetrics(design, kitchen, preferences);
    if (preferences.budget !== undefined) {
      if (metrics.price === null) { rejected.unpriced++; return; }
      if (metrics.price > preferences.budget) { rejected.budget++; return; }
    }
    if (preferences.style && design.cabinets.some(c => !appliance(c) && !preferences.modules?.some(m => m.variants.some(v => v.furnitureModelId === c.variantId && v.configuration.style === preferences.style)))) {
      rejected.style++; return;
    }
    candidates.push({id, design, layout: design.layout ?? "straight", fits:true, metrics,
      warnings: issues.filter(i=>i.severity === "warning").map(i=>i.message),current: id === suggestionSignature(kitchen)});
  };
  if (kitchen.cabinets.length) consider(structuredClone(kitchen));
  const seeds = [kitchen];
  if (preferences.useCatalog && preferences.modules?.length) for (const goal of ["budget", "storage"]) {
    const cabinets = kitchen.cabinets.map(c => {
      if (appliance(c)) return c;
      const choices = similarKitchenVariants(preferences.modules!, c, 100).filter(({ variant }) =>
        variant.opening === (c.opening ?? "doors") && (!preferences.style || variant.configuration.style === preferences.style));
      const productFor = (id: string) => preferences.products?.find(p => p.id === id);
      const available = choices.filter(choice => {
        const p = productFor(choice.variant.productId);
        return p?.inStock && hasAvailableStock(p) && p.basePrice > 0;
      });
      available.sort((a, b) => goal === "budget" ? productFor(a.variant.productId)!.basePrice - productFor(b.variant.productId)!.basePrice :
        b.module.widthMm * b.module.depthMm * b.module.heightMm - a.module.widthMm * a.module.depthMm * a.module.heightMm);
      for (const choice of available) {
        const next = cabinetFromCatalog(choice.module, choice.variant, c.id, kitchen.room.height);
        if (!next || next.type !== c.type) continue;
        const p = productFor(choice.variant.productId)!;
        return { ...next, color: p.colors.find(color => color.id === p.defaultColor)?.hex ?? next.color,
          position: { ...c.position }, autoElevation: c.autoElevation };
      }
      return c;
    });
    seeds.push({ ...kitchen, cabinets });
  }
  for (const seed of seeds) {
  const floor = seed.cabinets.filter(c=>c.type!=="wall");
  const upper = seed.cabinets.filter(c=>c.type==="wall");
  // Search different appliance sequences as well as layout shapes. Equivalent
  // cupboards swapped only by identity are deduplicated by physical signature.
  const orders: ModularCabinet[][] = [];
  const orderKeys = new Set<string>();
  const addOrder = (items: ModularCabinet[]) => {const key=items.map(c=>c.id).join("|");if(!orderKeys.has(key)){orderKeys.add(key);orders.push(items);}};
  for(let shift=0;shift<Math.min(floor.length,6);shift++){
    const order=[...floor.slice(shift),...floor.slice(0,shift)];addOrder(order);addOrder([...order].reverse());
  }
  for(let a=0;a<Math.min(floor.length,8);a++)for(let b=a+1;b<Math.min(floor.length,8);b++){
    const order=[...floor];[order[a],order[b]]=[order[b],order[a]];addOrder(order);
  }
  addOrder([...floor].sort((a,b)=>Number(appliance(a))-Number(appliance(b))));
  addOrder([...floor].sort((a,b)=>Number(appliance(b))-Number(appliance(a))));
  for (const layout of layouts) for (const ordered of orders) {
    const input = structuredClone({...seed,cabinets:[...ordered,...upper]});
    input.cabinets.forEach(c=>{if(!c.corner)c.corner=false;});
    const arranged = arrangeKitchen(input,layout);
    // Each seed keeps its real product specifications while only poses change.
    if(arranged.cabinets.some(c=>{const old=kitchen.cabinets.find(o=>o.id===c.id)!;return !!old.corner && c.cornerSide!==old.cornerSide;}))continue;
    arranged.cabinets = seed.cabinets.map(old=>({...structuredClone(old),position:arranged.cabinets.find(c=>c.id===old.id)!.position}));
    consider(arranged);
  }
  }
  const goals = SUGGESTION_GOALS.filter(g => ["balanced", "budget", "storage", "prep", "space", preferences.goal].includes(g.id));
  const goal = preferences.goal ?? "balanced";
  goals.sort((a,b)=>Number(b.id===goal)-Number(a.id===goal));
  const range = (key: "workflow"|"services"|"prep"|"space"|"moved"|"storage"|"price", value: number|null, maximize=false) => {
    if(value===null)return key === "price" ? 1 : 0;
    const values=candidates.map(c=>c.metrics[key]).filter((n):n is number=>n!==null);
    const low=Math.min(...values),high=Math.max(...values);
    if(high===low)return 0;
    const normalized=(value-low)/(high-low);
    return maximize?1-normalized:normalized;
  };
  const score=(c:typeof candidates[number], goal:SuggestionGoal)=>{
    const m=c.metrics,w=range("workflow",m.workflow),s=range("services",m.services),p=range("prep",m.prep,true),f=range("space",m.space,true),n=range("moved",m.moved);
    const balanced=(w+s+p+f+n+range("price",m.price)+range("storage",m.storage,true))/7;
    return balanced*.15 + (goal==="budget" ? range("price", m.price)*.85 : goal==="storage" ? range("storage", m.storage, true)*.85 : goal==="workflow" ? w*.65+s*.2 : goal==="prep" ? p*.85 : goal==="space" ? f*.85 : goal==="minimal" ? n*.85 : balanced*.85);
  };
  // Never advertise a rearrangement that is no better on any measured goal.
  const dominates=(a:typeof candidates[number],b:typeof candidates[number])=>{
    const cost=(c:typeof candidates[number])=>[c.metrics.workflow ?? 0,c.metrics.services ?? 0,-c.metrics.prep,-c.metrics.space,c.metrics.moved,-c.metrics.storage,c.metrics.price ?? Infinity];
    const x=cost(a),y=cost(b);
    return x.every((n,i)=>n<=y[i]+.01)&&x.some((n,i)=>n<y[i]-.01);
  };
  const pool=candidates.filter(c=>!candidates.some(other=>other!==c&&dominates(other,c))),suggestions:KitchenSuggestion[]=[];
  const geometries = new Set<string>();
  for(const target of goals){
    if (suggestions.length === 5) break;
    pool.sort((a,b)=>score(a,target.id)-score(b,target.id)||a.id.localeCompare(b.id));
    const best=pool.find(c => !geometries.has(suggestionGeometrySignature(c.design)));if(!best)break;
    pool.splice(pool.indexOf(best), 1);
    geometries.add(suggestionGeometrySignature(best.design));
    const m = best.metrics;
    const reason = target.id === "budget" ? (m.price === null ? "Каталогийн үнэ дутуу тул төсвийг бүрэн харьцуулах боломжгүй." : `Бүтээгдэхүүний дүн ${m.price.toLocaleString("mn-MN")} ₮.`) :
      target.id === "storage" ? `Төхөөрөмжгүй шүүгээний гадна эзлэхүүн ${Math.round(m.storage)} л; доторх бодит багтаамж биш.` :
      target.id === "prep" ? `Залгаа бэлтгэх тавцан ${Math.round(m.prep / 10)} см.` : target.id === "space" ? `Урд талын дундаж сул зай ойролцоогоор ${Math.round(m.space / 10)} см.` :
      `${m.moved} шүүгээ зөөж, ажлын урсгал ба сул зайг хамтад нь харьцуулсан.`;
    suggestions.push({...best,title:best.current ? "Одоогийн байрлал" : target.title, reason});
  }
  return {suggestions,rejected,checked:seen.size,valid:candidates.length};
}
export function kitchenDesignSuggestions(kitchen: ModularKitchen, preferences: SuggestionPreferences = {}) {
  return kitchenDesignSuggestionResult(kitchen,preferences).suggestions;
}

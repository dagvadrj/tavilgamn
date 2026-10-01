import { cabinetLabel, type ModularKitchen } from "./kitchenCabinets";
import { cabinetCorners, fitCountertops } from "./kitchenPlacement";
import { fitBacksplashes } from "./kitchenBacksplash";
import { COMPONENT_LABELS, getComponents, getComponentSize } from "./kitchenComponents";
import type { KitchenCatalogModule } from "./kitchenModuleCatalog";
import type { Product } from "./types";
export type BomRow = { id:string; label:string; quantity:number; unit:string; dimensions:string; material:string; unitPrice:number|null; included:boolean };
export type KitchenBom = { items:BomRow[]; knownSubtotal:number; unpricedCount:number; complete:boolean };
const dims=(w:number,h:number,d:number)=>`${Math.round(w*100)/100} × ${Math.round(h*100)/100} × ${Math.round(d*100)/100} мм`;
const rounded=(n:number)=>Math.round(n*1000)/1000;
export function buildKitchenBom(kitchen:ModularKitchen, modules:KitchenCatalogModule[], products:Product[]):KitchenBom {
  const variants=new Map(modules.flatMap(m=>m.variants.map(v=>[v.furnitureModelId,v] as const)));
  const catalog=new Map(products.map(p=>[p.id,p]));
  const price=(p:Product|undefined,color?:string):number|null=>{
    if(!p||!Number.isFinite(p.basePrice)||p.basePrice<=0)return null;
    const total=p.basePrice+(p.colors.find(c=>c.hex.toLowerCase()===color?.toLowerCase())?.priceDelta??0);
    return Number.isFinite(total)&&total>=0?total:null;
  };
  const items:BomRow[]=[];
  for(const cabinet of kitchen.cabinets) {
    const variant=variants.get(cabinet.variantId??""), product=catalog.get(variant?.productId??"");
    items.push({id:cabinet.id,label:variant?.modelName??cabinetLabel(cabinet),quantity:1,unit:"ш",dimensions:dims(cabinet.width,cabinet.height,cabinet.depth),
      material:`Фасад: ${cabinet.frontMaterialId??cabinet.finish??cabinet.material}; их бие: ${cabinet.carcassMaterialId??cabinet.finish??cabinet.material}`,
      unitPrice:price(product,cabinet.color),included:false});
    for(const component of getComponents(cabinet).filter(c=>c.type!=="worktop")) {
      const size=getComponentSize(cabinet,component,kitchen);
      const quantity=component.type==="door-front" ? cabinet.doorCount : component.type==="drawer-front" ? cabinet.drawerCount : component.type==="handle" ? Math.max(1,cabinet.doorCount+cabinet.drawerCount) : 1;
      if(!quantity)continue;
      items.push({id:`${cabinet.id}/${component.type}`,label:`${COMPONENT_LABELS[component.type]} · ${component.model}`,quantity,unit:"ш",
        dimensions:dims(size.width,size.height,size.depth),material:component.finish??component.color??"Стандарт",unitPrice:null,included:true});
    }
  }
  for(const extra of kitchen.extras??[])items.push({id:extra.id,label:extra.name,quantity:1,unit:"ш",dimensions:dims(extra.width,extra.height,extra.depth),
    material:`${extra.material} · ${extra.color}`,unitPrice:price(catalog.get(extra.productId),extra.color),included:false});
  for(const [index,top] of fitCountertops(kitchen).entries())items.push({id:top.id,label:`Тавцан ${index+1}`,quantity:rounded(top.width*top.depth/1e6),unit:"м²",
    dimensions:dims(top.width,top.thickness,top.depth),material:kitchen.countertop.materialId??kitchen.countertop.finish??kitchen.countertop.material,unitPrice:null,included:false});
  for(const [index,panel] of fitBacksplashes(kitchen).entries())items.push({id:panel.id,label:`Ханын хавтан ${index+1}`,quantity:rounded(panel.width*panel.height/1e6),unit:"м²",
    dimensions:dims(panel.width,panel.height,panel.thickness),material:kitchen.countertop.materialId??kitchen.countertop.finish??kitchen.countertop.material,unitPrice:null,included:false});
  const billable=items.filter(i=>!i.included),unpricedCount=billable.filter(i=>i.unitPrice===null).length;
  return {items,knownSubtotal:billable.reduce((sum,i)=>sum+(i.unitPrice??0)*i.quantity,0),unpricedCount,complete:unpricedCount===0};
}
function csvCell(value:string|number) {
  let text=String(value);if(/^[\s]*[=+@-]/.test(text))text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function kitchenBomCsv(bom:KitchenBom) {
  const rows=[['ID','Нэр','Тоо','Нэгж','Хэмжээ','Материал','Нэгж үнэ (MNT)','Тайлбар'],...bom.items.map(i=>[i.id,i.label,i.quantity,i.unit,i.dimensions,i.material,i.unitPrice??'',i.included?'Шүүгээний бүрэлдэхүүн, давхар үнэлэхгүй':i.unitPrice===null?'Үнэ шаардлагатай':'Каталогийн суурь үнэ'])];
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export const escapeReportText=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function kitchenPlanSvg(kitchen:ModularKitchen) {
  const w=kitchen.room.width,d=kitchen.room.depth;
  const polygons=[...kitchen.cabinets,...(kitchen.extras??[])].map(item=>`<polygon points="${cabinetCorners(item).map(p=>`${p.x},${p.z}`).join(' ')}" fill="${escapeReportText(item.color)}" fill-opacity="0.65" stroke="#293c32" stroke-width="10"/><text x="${item.position.x}" y="${item.position.z}" text-anchor="middle" font-size="65">${item.width}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 ${w+400} ${d+400}" role="img" aria-label="2D plan"><rect x="0" y="0" width="${w}" height="${d}" fill="#f8f9f7" stroke="#293c32" stroke-width="12"/>${polygons}<text x="${w/2}" y="-65" text-anchor="middle" font-size="85">${w} mm</text><text x="${w+45}" y="${d/2}" font-size="85" transform="rotate(90 ${w+45} ${d/2})">${d} mm</text></svg>`;
}
export function kitchenReportHtml(name:string,kitchen:ModularKitchen,bom:KitchenBom,imageDataUrl?:string) {
  const image=imageDataUrl&&/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl) ? `<img alt="3D зураг" src="${imageDataUrl}"/>` : '';
  const rows=bom.items.map(i=>`<tr><td>${escapeReportText(i.label)}</td><td>${i.quantity} ${escapeReportText(i.unit)}</td><td>${escapeReportText(i.dimensions)}</td><td>${escapeReportText(i.material)}</td><td>${i.included?'Бүрэлдэхүүн':i.unitPrice===null?'Үнэ шаардлагатай':i.unitPrice.toLocaleString('en-US')+' ₮'}</td></tr>`).join('');
  return `<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>${escapeReportText(name)} — BOM</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#293c32;max-width:1000px;margin:20px auto}h1{font-size:24px}img,svg{display:block;max-width:100%;max-height:330px;margin:12px auto}table{width:100%;border-collapse:collapse}th,td{padding:6px;border:1px solid #ccd4cd;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}small{display:block;margin:12px 0}@media print{body{margin:0}}</style></head><body><h1>${escapeReportText(name)}</h1><p>Өрөө: ${kitchen.room.width} × ${kitchen.room.depth} × ${kitchen.room.height} мм · Метр/мм бодит хэмжээ</p>${image}${kitchenPlanSvg(kitchen)}<h2>Тавилга, эд анги, материалын жагсаалт (BOM)</h2><table><thead><tr><th>Нэр</th><th>Тоо</th><th>Хэмжээ</th><th>Материал</th><th>Нэгж үнэ</th></tr></thead><tbody>${rows}</tbody></table><p>Үнэтэй бүтээгдэхүүний дэд дүн: ${bom.knownSubtotal.toLocaleString('en-US')} ₮ · Үнэ шаардлагатай мөр: ${bom.unpricedCount}</p><small>Урьдчилсан жагсаалт; үйлдвэрлэлийн cut-list эсвэл баталгаат үнийн санал биш. Шүүгээний эд ангийг тусад нь давхар үнэлээгүй. Материалын нэмэгдэл, угсралт, хүргэлт болон үнэгүй эсэх нь батлагдаагүй 0 үнэтэй бүтээгдэхүүн дэд дүнд ороогүй.</small></body></html>`;
}

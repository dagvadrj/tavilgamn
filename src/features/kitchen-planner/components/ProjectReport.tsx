"use client";
import { useMemo, useRef, useState } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import type { KitchenCatalogModule } from "@/lib/kitchenModuleCatalog";
import type { Product } from "@/lib/types";
import { buildKitchenBom, kitchenBomCsv, kitchenReportHtml } from "@/lib/kitchenBom";
const safeName=(name:string)=>name.replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').slice(0,80)||'kitchen';
export function ProjectReport({ name, kitchen, modules, products, capture, disabled }: {
  name:string; kitchen:ModularKitchen; modules:KitchenCatalogModule[]; products:Product[];
  capture:()=>Promise<Blob|null>; disabled:boolean;
}) {
  const bom=useMemo(()=>buildKitchenBom(kitchen,modules,products),[kitchen,modules,products]);
  const [working,setWorking]=useState(false),[message,setMessage]=useState('');
  const lock=useRef(false);
  async function exportReport(format:'image'|'csv'|'html'|'pdf') {
    if(disabled||lock.current)return;
    // Open synchronously so browser popup protection does not block PDF printing.
    const printWindow=format==='pdf'?window.open('about:blank','_blank'):null;
    if(format==='pdf'&&!printWindow){setMessage('Браузерын popup зөвшөөрөөд дахин оролдоно уу.');return;}
    lock.current=true;setWorking(true);setMessage('');
    try {
      const {downloadKitchenFile}=await import('@/three/kitchenExport');
      if(format==='csv'){downloadKitchenFile(new Blob([kitchenBomCsv(bom)],{type:'text/csv;charset=utf-8'}),`${safeName(name)}-BOM.csv`);return;}
      const image=await capture();
      if(format==='image') {
        if(!image)throw new Error('3D зураг бэлэн болоогүй байна.');
        downloadKitchenFile(image,`${safeName(name)}.webp`);return;
      }
      const imageUrl=image?await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(image);}):undefined;
      const html=kitchenReportHtml(name,kitchen,bom,imageUrl);
      if(printWindow){
        printWindow.document.open();printWindow.document.write(html);printWindow.document.close();
        await Promise.all(Array.from(printWindow.document.images).map(img=>img.decode().catch(()=>{})));
        printWindow.focus();printWindow.print();
        setMessage('Хэвлэх цонхонд Save as PDF сонгоно уу.');
      } else downloadKitchenFile(new Blob([html],{type:'text/html;charset=utf-8'}),`${safeName(name)}-report.html`);
    } catch(error){printWindow?.close();setMessage(error instanceof Error?error.message:'Тайлан гаргасангүй.');}
    finally{lock.current=false;setWorking(false);}
  }
  return <section className="km-project-report" aria-label="BOM болон үнийн тооцоо"><h2>Материалын жагсаалт ба үнэ</h2>
    <p>Үнэтэй бүтээгдэхүүний дэд дүн: <strong>{bom.knownSubtotal.toLocaleString('en-US')} ₮</strong></p>
    <p>{bom.unpricedCount} мөрийн үнэ шаардлагатай. Энэ нь эцсийн нийт үнэ биш; эд ангийг давхар үнэлэхгүй.</p>
    <details><summary>BOM · {bom.items.length} мөр</summary><div className="km-bom-table"><table><thead><tr><th>Нэр</th><th>Тоо</th><th>Материал</th><th>Үнэ</th></tr></thead><tbody>
      {bom.items.map(i=><tr key={i.id}><td>{i.label}<small>{i.dimensions}</small></td><td>{i.quantity} {i.unit}</td><td>{i.material}</td><td>{i.included?'Бүрэлдэхүүн':i.unitPrice===null?'Үнэ шаардлагатай':`${i.unitPrice.toLocaleString('en-US')} ₮`}</td></tr>)}
    </tbody></table></div></details>
    <div className="km-report-actions">{([['image','3D зураг татах'],['csv','BOM CSV татах'],['html','Тайлан HTML татах'],['pdf','PDF / Хэвлэх']] as const).map(([format,label])=>
      <button type="button" key={format} disabled={disabled||working} onClick={()=>void exportReport(format)}>{label}</button>)}</div>
    {message&&<p role="status">{message}</p>}
  </section>;
}

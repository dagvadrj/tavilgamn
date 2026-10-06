"use client";
import Link from "next/link";
import { useState } from "react";
import { Ruler } from "lucide-react";
import type { Product } from "@/lib/types";
import { productScaleLayout } from "@/lib/productExperience";
import { formatMeasurement } from "@/lib/furnitureMeasurements";

export function ProductScaleHUD({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const { floor, pxPerMetre, product: box, human } = productScaleLayout(product.dimensions);
  return <div className="pdp-scale">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="product-scale-comparison"><Ruler size={16} aria-hidden="true" />Хэмжээ шалгах</button>
    {open && <div id="product-scale-comparison" className="pdp-scale-panel">
      <svg viewBox="0 0 520 230" role="img" aria-label={`${product.name}: өргөн ${formatMeasurement(product.dimensions.w)}, өндөр ${formatMeasurement(product.dimensions.h)}. Хүн 170 см. Нэг масштабтай урд талын харьцуулалт.`}>
        <line x1="20" y1={floor} x2="495" y2={floor} stroke="#a1a1aa" />
        <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="3" fill="#dbeafe" stroke="#2563eb" />
        <text x={box.x + box.width / 2} y={box.y - 10} textAnchor="middle">{formatMeasurement(product.dimensions.h)} өндөр</text>
        <text x={box.x + box.width / 2} y={floor + 20} textAnchor="middle">{formatMeasurement(product.dimensions.w)} өргөн</text>
        <g transform={`translate(${human.x}, ${human.y}) scale(${pxPerMetre})`} fill="#52525b">
          <circle cx="0" cy=".115" r=".115" />
          <path d="M-.13 .28 Q0 .22 .13 .28 L.23 .84 L.15 .87 L.07 .53 L.08 .97 L.14 1.7 L.04 1.7 L0 1.1 L-.04 1.7 L-.14 1.7 L-.08 .97 L-.07 .53 L-.15 .87 L-.23 .84 Z" />
        </g>
        <text x={human.x} y={human.y - 10} textAnchor="middle">Хүн · 170 см</text>
      </svg>
      <p>Урд талын хэмжээний харьцуулалт. Гүн: <strong>{formatMeasurement(product.dimensions.d)}</strong>. Өрөөний зай, хаалга, гарцыг давхар хэмжээрэй.</p>
      <Link href="/planner">Өрөөний төлөвлөгчөөр байрлуулж үзэх →</Link>
    </div>}
  </div>;
}

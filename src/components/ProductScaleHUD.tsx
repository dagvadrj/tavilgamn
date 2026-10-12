"use client";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Ruler, ChevronDown, PersonStanding } from "lucide-react";
import type { Product } from "@/lib/types";
import { productScaleLayout } from "@/lib/productExperience";
import { formatMeasurement } from "@/lib/furnitureMeasurements";

export function ProductScaleHUD({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [heightCm, setHeightCm] = useState(170);
  const {
    floor,
    product: box,
    human,
  } = productScaleLayout(product.dimensions, heightCm / 100);
  return (
    <div className="pdp-scale">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="product-scale-comparison"
      >
        <Ruler size={16} aria-hidden="true" />
        Хэмжээ шалгах
        <ChevronDown
          size={14}
          className={open ? "pdp-scale-chevron is-open" : "pdp-scale-chevron"}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id="product-scale-comparison" className="pdp-scale-panel">
          <div className="pdp-scale-measurements" aria-label="Барааны хэмжээ">
            <span>
              Өргөн <strong>{formatMeasurement(product.dimensions.w)}</strong>
            </span>
            <span>
              Гүн <strong>{formatMeasurement(product.dimensions.d)}</strong>
            </span>
            <span>
              Өндөр <strong>{formatMeasurement(product.dimensions.h)}</strong>
            </span>
          </div>
          <svg
            viewBox="0 0 520 230"
            role="img"
            aria-label={`${product.name}: өргөн ${formatMeasurement(product.dimensions.w)}, өндөр ${formatMeasurement(product.dimensions.h)}. Хүн ${heightCm} см. Нэг масштабтай урд талын харьцуулалт.`}
          >
            <line x1="20" y1={floor} x2="495" y2={floor} stroke="#a1a1aa" />
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx="3"
              fill="#dbeafe"
              stroke="#2563eb"
            />
            <text x={box.x + box.width / 2} y={box.y - 10} textAnchor="middle">
              {formatMeasurement(product.dimensions.h)} өндөр
            </text>
            <text x={box.x + box.width / 2} y={floor + 20} textAnchor="middle">
              {formatMeasurement(product.dimensions.w)} өргөн
            </text>
            <g
              transform={`translate(${human.x}, ${human.y}) scale(${human.height / 180})`}
            >
              <path d="M-5 21H5L6 33L0 38L-6 33Z" fill="#c69b80" />
              <ellipse cx="0" cy="13" rx="9" ry="12" fill="#d6b099" />
              <path
                d="M-9 13C-12-3 10-5 10 9L8 14L6 7C1 10-3 7-7 8L-8 14Z"
                fill="#3e3530"
              />
              <path
                d="M-7 18Q0 29 7 18Q5 26 0 27Q-5 26-7 18"
                fill="#b98d75"
                opacity=".45"
              />
              <path
                d="M-19 38Q-25 43-26 55L-30 86L-33 99Q-35 107-30 108Q-26 107-26 99L-24 89L-16 58Z M19 38Q25 43 26 55L30 86L33 99Q35 107 30 108Q26 107 26 99L24 89L16 58Z"
                fill="#d6b099"
              />
              <path
                d="M-6 30L-20 35Q-24 36-26 45L-27 57L-16 60L-13 51L-14 94Q0 100 14 94L13 51L16 60L27 57L26 45Q24 36 20 35L6 30Q0 37-6 30Z"
                fill="#67796f"
              />
              <path
                d="M-6 30Q0 37 6 30M-10 49L-8 88M11 68L9 90"
                fill="none"
                stroke="#506459"
                strokeWidth="1.5"
              />
              <path
                d="M-14 94Q0 97 14 94L13 120L10 171L2 171L0 119L-2 171L-10 171L-13 120Z"
                fill="#3f4a58"
              />
              <path
                d="M0 101V119M-10 120L-7 164M10 120L7 164"
                fill="none"
                stroke="#536172"
                strokeWidth="1"
              />
              <path
                d="M-10 170L-2 170L-1 177Q-1 180-4 180H-16Q-19 177-14 174Z M2 170H10L14 174Q19 177 16 180H4Q1 180 1 177Z"
                fill="#303238"
              />
              <path
                d="M-16 179H-3M3 179H16"
                stroke="#d4d4d8"
                strokeWidth="1.5"
              />
            </g>
            <text x={human.x} y={human.y - 10} textAnchor="middle">
              Хүн · {heightCm} см
            </text>
          </svg>
          <div className="pdp-human-height">
            <label htmlFor="comparison-human-height">Таны өндөр</label>
            <div
              className="pdp-height-slider"
              style={{ "--p": (heightCm - 80) / 140 } as CSSProperties}
            >
              <input
                id="comparison-human-height"
                type="range"
                min="80"
                max="220"
                step="1"
                value={heightCm}
                aria-valuetext={`${heightCm} см`}
                onChange={(event) => setHeightCm(Number(event.target.value))}
              />
              <PersonStanding className="pdp-height-icon" aria-hidden="true" />
              <output htmlFor="comparison-human-height">{heightCm} см</output>
            </div>
          </div>
          <p>
            Урд талын хэмжээний харьцуулалт. Гүн:{" "}
            <strong>{formatMeasurement(product.dimensions.d)}</strong>. Өрөөний
            зай, хаалга, гарцыг давхар хэмжээрэй.
          </p>
          <Link href="/planner">Өрөөний төлөвлөгчөөр байрлуулж үзэх →</Link>
        </div>
      )}
    </div>
  );
}

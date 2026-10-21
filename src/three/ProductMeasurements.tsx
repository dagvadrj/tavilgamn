"use client";
import { Html, Line } from "@react-three/drei";
import {
  productDimensionAnnotations,
  productDimensionLabelPositions,
  type ProductBounds,
} from "@/lib/productDimensions";

export function ProductMeasurements({ bounds }: { bounds: ProductBounds }) {
  return (
    <group userData={{ exportExclude: true }}>
      {productDimensionAnnotations(bounds).map((item) => (
        <group key={item.id}>
          <Line
            points={[item.from, item.to]}
            color={item.color}
            lineWidth={1.3}
            transparent
            opacity={0.75}
          />
          <Html
            position={item.anchor}
            center
            calculatePosition={(_object, camera, size) =>
              productDimensionLabelPositions(bounds, camera, size).find(
                (label) => label.id === item.id,
              )!.point
            }
            zIndexRange={[8, 0]}
            style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
          >
            <span
              data-product-dimension={item.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                padding: "7px 10px",
                background: "#242828",
                color: "#fff",
                fontSize: 11,
                fontWeight: 650,
                boxShadow: "0 3px 12px #0002",
              }}
            >
              <i
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: item.color,
                }}
              />
              {item.label}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

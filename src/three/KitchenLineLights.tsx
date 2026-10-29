"use client";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import {
  KITCHEN_LIGHT_COLORS,
  kitchenLightStrips,
} from "@/lib/kitchenLighting";

export function KitchenLineLights({ kitchen }: { kitchen: ModularKitchen }) {
  const settings = kitchen.lineLighting;
  if (!settings) return null;
  const color = KITCHEN_LIGHT_COLORS[settings.tone],
    strength = settings.brightness / 100;
  return (
    <group name="Kitchen-line-lighting">
      {kitchenLightStrips(kitchen).map((strip, index) => (
        <group
          key={strip.id}
          name={strip.id}
          position={[
            strip.position.x / 1000,
            strip.position.y / 1000,
            strip.position.z / 1000,
          ]}
          rotation={[0, strip.position.rotation, 0]}
        >
          <mesh raycast={() => {}}>
            <boxGeometry args={[strip.length / 1000, 0.008, 0.016]} />
            <meshStandardMaterial
              color={strength ? color : "#e0ddd5"}
              emissive={color}
              emissiveIntensity={strength * 3}
              roughness={0.3}
              toneMapped={false}
            />
          </mesh>
          {strength > 0 && index < 6 && (
            <pointLight
              userData={{ exportExclude: true }}
              color={color}
              position={[
                0,
                strip.kind === "underCabinet" ? -0.07 : -0.025,
                0.03,
              ]}
              intensity={strength * (strip.kind === "underCabinet" ? 1.6 : 0.5)}
              distance={2}
              decay={2}
            />
          )}
        </group>
      ))}
    </group>
  );
}

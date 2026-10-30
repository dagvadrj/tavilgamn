"use client";

/**
 * Pendant lamp over the room centre. The real light is the scene's ceiling
 * spotlight; this is its visible fixture, glowing brighter at night.
 */
export function KitchenCeilingLamp({ x, z, ceiling, lit }: { x: number; z: number; ceiling: number; lit: boolean }) {
  const drop = Math.min(0.55, Math.max(0.2, ceiling - 2.2));
  const shadeY = ceiling - drop;
  return (
    <group name="CeilingLamp" position={[x, 0, z]} userData={{ roomContactCaster: false }}>
      {/* Canopy and cord: no shadows, so the spotlight inside the shade stays unblocked. */}
      <mesh position={[0, ceiling - 0.012, 0]} raycast={() => {}}>
        <cylinderGeometry args={[0.07, 0.07, 0.024, 32]} />
        <meshStandardMaterial color="#e9e6e0" roughness={0.5} />
      </mesh>
      <mesh position={[0, ceiling - drop / 2, 0]} raycast={() => {}}>
        <cylinderGeometry args={[0.004, 0.004, drop, 8]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.6} />
      </mesh>
      <mesh position={[0, shadeY, 0]} raycast={() => {}}>
        <cylinderGeometry args={[0.05, 0.2, 0.16, 48, 1, true]} />
        <meshStandardMaterial color="#f3efe7" roughness={0.45} side={2} emissive="#ffd9a0" emissiveIntensity={lit ? 0.45 : 0} />
      </mesh>
      <mesh position={[0, shadeY - 0.05, 0]} raycast={() => {}}>
        <sphereGeometry args={[0.045, 24, 16]} />
        <meshStandardMaterial
          color="#fff6e5"
          emissive="#ffd9a0"
          emissiveIntensity={lit ? 4 : 0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

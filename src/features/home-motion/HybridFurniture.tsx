"use client";
import { memo } from "react";
import type { Product } from "@/lib/types";
import type { RoomFurniture } from "./scrollRoomStory";
import type { PremiumMaterials } from "./premiumRoomMaterials";
import { Block, Finish, Bookcase, OfficeChair } from "./PremiumRoomSet";
import { PremiumRoomModel } from "./PremiumRoomModel";
import { heroModelUrl } from "./heroModelUrl";
import { PremiumBed } from "./PremiumBed";
import { StaticFurniture } from "./StaticFurniture";

type Props = {
  item: RoomFurniture;
  m: PremiumMaterials;
  color?: string;
  product?: Product;
  onStatus?: (s: string) => void;
};
export const HybridFurniture = memo(function HybridFurniture(props: Props) {
  return ["desk", "officeChair", "bookshelf", "nightstand"].includes(
    props.item,
  ) ? (
    <StaticFurniture>
      <FurnitureBody {...props} />
    </StaticFurniture>
  ) : (
    <FurnitureBody {...props} />
  );
});
function FurnitureBody({ item, m, color, product, onStatus }: Props) {
  if (item === "sofa")
    return (
      <PremiumRoomModel
        prepare
        url={heroModelUrl(product)}
        size={[3.4, 1.3, 1.5]}
        color={color}
        onStatus={onStatus}
      >
        <Block at={[0, 0.43, 0]} size={[3.1, 0.55, 1.2]} round={0.2}>
          <Finish m={m} color={color} />
        </Block>
        <Block at={[0, 0.91, -0.44]} size={[3.1, 0.82, 0.36]} round={0.17}>
          <Finish m={m} color={color} />
        </Block>
        {[-1.4, 1.4].map((x) => (
          <Block
            key={x}
            at={[x, 0.65, 0]}
            size={[0.34, 0.75, 1.2]}
            round={0.15}
          >
            <Finish m={m} color={color} />
          </Block>
        ))}
      </PremiumRoomModel>
    );
  if (item === "chair")
    return (
      <PremiumRoomModel
        prepare
        url="/interior/premium/lounge-chair.glb"
        size={[1.2, 1.3, 1.3]}
        color={color}
      />
    );
  if (item === "table")
    return (
      <>
        <mesh position={[0, 0.47, 0]}>
          <cylinderGeometry args={[0.88, 0.88, 0.16, 64]} />
          <Finish m={m} color={color} wood />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.57, 0.57, 0.44, 48]} />
          <Finish m={m} color={color} wood />
        </mesh>
        <Block at={[-0.22, 0.575, 0]} size={[0.44, 0.06, 0.3]}>
          <meshStandardMaterial color="#b9ab90" roughness={0.9} />
        </Block>
        <mesh position={[0.33, 0.65, -0.08]}>
          <cylinderGeometry args={[0.08, 0.07, 0.18, 24]} />
          <meshStandardMaterial color="#34322c" roughness={0.65} />
        </mesh>
      </>
    );
  if (item === "bed")
    return (
      <PremiumRoomModel
        prepare
        url={heroModelUrl(product)}
        size={[3.2, 1.65, 3.9]}
        color={color}
        onStatus={onStatus}
      >
        <PremiumBed m={m} color={color} />
      </PremiumRoomModel>
    );
  if (item === "nightstand")
    return (
      <>
        <Block at={[0, 0.4, 0]} size={[0.85, 0.65, 0.66]} round={0.02}>
          <Finish m={m} color={color} wood />
        </Block>
        {[0.3, 0.55].map((y) => (
          <group key={y}>
            <Block at={[0, y, 0.34]} size={[0.75, 0.23, 0.035]}>
              <Finish m={m} color={color} wood />
            </Block>
            <mesh position={[0, y, 0.37]} material={m.brass}>
              <sphereGeometry args={[0.025, 12, 8]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.86, 0]}>
          <sphereGeometry args={[0.12, 24, 16]} />
          <meshStandardMaterial color="#51483c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <cylinderGeometry args={[0.14, 0.21, 0.24, 24]} />
          <meshStandardMaterial
            color="#ebd9b9"
            map={m.fabricMap}
            emissive="#dfab66"
            emissiveIntensity={0.3}
          />
        </mesh>
      </>
    );
  if (item === "wardrobe")
    return (
      <PremiumRoomModel
        prepare
        url={heroModelUrl(product)}
        size={[2.65, 3.5, 0.7]}
        color={color}
        onStatus={onStatus}
      >
        <Block at={[0, 1.75, 0]} size={[2.65, 3.5, 0.7]}>
          <Finish m={m} color={color} wood />
        </Block>
        {[-0.87, 0, 0.87].map((x) => (
          <group key={x}>
            <Block at={[x, 1.75, 0.37]} size={[0.85, 3.4, 0.05]}>
              <Finish m={m} color={color} wood />
            </Block>
            <Block
              at={[x + 0.3, 1.55, 0.42]}
              size={[0.018, 0.5, 0.02]}
              material={m.metal}
            />
          </group>
        ))}
      </PremiumRoomModel>
    );
  if (item === "bookshelf")
    return <Bookcase at={[0, 0, 0]} m={m} color={color} light={false} />;
  if (item === "officeChair") return <OfficeChair m={m} color={color} />;
  if (item === "desk")
    return (
      <>
        <Block at={[0, 0.79, 0]} size={[3.9, 0.12, 1.15]} round={0.025}>
          <Finish m={m} color={color} wood />
        </Block>
        <Block at={[-1.35, 0.38, 0]} size={[0.65, 0.76, 0.95]} round={0.02}>
          <Finish m={m} color={color} wood />
        </Block>
        {[0.22, 0.44, 0.66].map((y) => (
          <Block
            key={y}
            at={[-1.35, y, 0.49]}
            size={[0.58, 0.012, 0.018]}
            material={m.metal}
          />
        ))}
        <Block
          at={[1.75, 0.38, 0]}
          size={[0.08, 0.76, 1.05]}
          material={m.metal}
        />
        <Block
          at={[-0.15, 0.875, 0]}
          size={[0.7, 0.025, 0.45]}
          material={m.metal}
          round={0.008}
        />
        <group position={[-0.15, 1.11, -0.22]} rotation={[-0.15, 0, 0]}>
          <Block
            at={[0, 0, 0]}
            size={[0.7, 0.46, 0.024]}
            material={m.metal}
            round={0.008}
          />
          <mesh position={[0, 0, 0.014]}>
            <planeGeometry args={[0.65, 0.4]} />
            <meshStandardMaterial color="#182123" roughness={0.25} />
          </mesh>
        </group>
        <mesh position={[-1.3, 0.94, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.18, 20]} />
          <meshStandardMaterial color="#302e28" roughness={0.7} />
        </mesh>
      </>
    );
  return null;
}

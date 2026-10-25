"use client";
import {
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Product } from "@/lib/types";
import { SceneHtml } from "@/three/SceneHtml";
import { PremiumBed } from "./PremiumBed";
import { PremiumRoomModel } from "./PremiumRoomModel";
import type { PremiumMaterials } from "./premiumRoomMaterials";
import {
  ROOM_ITEMS,
  type RoomFurniture,
  type RoomPoint,
} from "./scrollRoomStory";

type Props = {
  index: number;
  active: boolean;
  materials: PremiumMaterials;
  colors: Partial<Record<RoomFurniture, string>>;
  sofa?: Product;
  bed?: Product;
  wardrobe?: Product;
  onSelect: (item: RoomFurniture) => void;
  onSofaStatus: (s: string) => void;
  onBedStatus: (s: string) => void;
  onWardrobeStatus: (s: string) => void;
};
function Block({
  at,
  size,
  material,
  children,
  round = 0,
}: {
  at: RoomPoint;
  size: RoomPoint;
  material?: THREE.Material;
  children?: ReactNode;
  round?: number;
}) {
  return round ? (
    <RoundedBox
      position={at}
      args={size}
      radius={Math.min(round, ...size.map((n) => n / 2 - 0.001))}
      smoothness={4}
      castShadow
      receiveShadow
      material={material}
    >
      {children}
    </RoundedBox>
  ) : (
    <mesh position={at} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
      {children}
    </mesh>
  );
}
function Finish({
  m,
  color,
  wood = false,
}: {
  m: PremiumMaterials;
  color?: string;
  wood?: boolean;
}) {
  return (
    <meshStandardMaterial
      color={color || (wood ? "#c3ac8e" : "#d9d2c4")}
      map={wood ? m.woodMap : m.fabricMap}
      normalMap={wood ? m.woodNormal : m.linenNormal}
      normalScale={new THREE.Vector2(0.3, 0.3)}
      roughnessMap={wood ? m.woodRoughness : m.linenRoughness}
      roughness={wood ? 0.95 : 0.96}
    />
  );
}
function Pendant({ at, m }: { at: RoomPoint; m: PremiumMaterials }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.8, 0]} material={m.metal}>
        <cylinderGeometry args={[0.008, 0.008, 1.6, 8]} />
      </mesh>
      <mesh material={m.brass}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 24]} />
      </mesh>
      <mesh position={[0, -0.27, 0]}>
        <sphereGeometry args={[0.25, 32, 20]} />
        <meshPhysicalMaterial
          color="#ccb59a"
          roughness={0.06}
          transparent
          opacity={0.23}
          metalness={0.15}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <capsuleGeometry args={[0.028, 0.14, 4, 12]} />
        <meshStandardMaterial
          color="#ffe0a1"
          emissive="#ffb04c"
          emissiveIntensity={5}
        />
      </mesh>
      <pointLight
        position={[0, -0.25, 0]}
        color="#ffc78d"
        intensity={7}
        distance={4}
        decay={2}
      />
    </group>
  );
}
function Curtains({ m }: { m: PremiumMaterials }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.1, 3.5, 64, 12),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setZ(i, Math.sin(p.getX(i) * 40) * 0.065);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[4.85, 1.85, -1.4]} rotation={[0, -Math.PI / 2, 0]}>
      {[-2.55, 2.55].map((z) => (
        <mesh key={z} geometry={geometry} position={[z, 0, 0]} receiveShadow>
          <meshStandardMaterial
            color="#a69f91"
            map={m.fabricMap}
            normalMap={m.linenNormal}
            normalScale={new THREE.Vector2(0.13, 0.13)}
            roughness={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
function ShelfBooks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    const pose = new THREE.Object3D();
    let n = 0;
    [0.08, 0.7, 1.4, 2.1, 2.8].forEach((y, row) => {
      for (let i = 0; i < 12; i++) {
        const h = 0.25 + ((i * 7 + row * 11) % 10) * 0.023;
        pose.position.set(-1.3 + i * 0.225, y + 0.035 + h / 2, 0.01);
        pose.rotation.z = i % 5 === 0 ? 0.12 : 0;
        pose.scale.set(0.06 + (i % 3) * 0.024, h, 0.25);
        pose.updateMatrix();
        instance.setMatrixAt(n, pose.matrix);
        instance.setColorAt(
          n,
          new THREE.Color(
            ["#7f7564", "#353732", "#b2a58d", "#5d5042", "#c3b69c"][i % 5],
          ),
        );
        n++;
      }
    });
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    instance.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 60]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.92} />
    </instancedMesh>
  );
}
function Bookcase({
  at,
  m,
  color,
}: {
  at: RoomPoint;
  m: PremiumMaterials;
  color?: string;
}) {
  return (
    <group position={at}>
      <ShelfBooks />

      <Block at={[0, 1.8, -0.25]} size={[3, 3.6, 0.08]}>
        <Finish m={m} color={color} wood />
      </Block>
      {[-1.5, 0, 1.5].map((x) => (
        <Block key={x} at={[x, 1.8, 0]} size={[0.08, 3.6, 0.52]}>
          <Finish m={m} color={color} wood />
        </Block>
      ))}
      {[0.08, 0.7, 1.4, 2.1, 2.8, 3.55].map((y, row) => (
        <group key={y}>
          <Block at={[0, y, 0]} size={[3, 0.06, 0.52]}>
            <Finish m={m} color={color} wood />
          </Block>
          {row > 1 && (
            <>
              <mesh position={[0, y - 0.035, -0.17]}>
                <boxGeometry args={[2.88, 0.012, 0.018]} />
                <meshStandardMaterial
                  color="#ffe2b1"
                  emissive="#ffb968"
                  emissiveIntensity={4}
                />
              </mesh>
            </>
          )}
        </group>
      ))}
      <rectAreaLight
        position={[0, 1.8, 0.35]}
        rotation={[0, Math.PI, 0]}
        width={2.7}
        height={2.8}
        intensity={0.7}
        color="#ffc18a"
      />
    </group>
  );
}
function TableLamp({ at, m }: { at: RoomPoint; m: PremiumMaterials }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial color="#51483c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={m.brass}>
        <cylinderGeometry args={[0.018, 0.018, 0.18, 16]} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.14, 0.21, 0.24, 32, 1, true]} />
        <meshStandardMaterial
          color="#ebd9b9"
          map={m.fabricMap}
          emissive="#dfab66"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        position={[0, 0.36, 0]}
        color="#ffd097"
        intensity={3}
        distance={3}
      />
    </group>
  );
}
function OfficeChair({ m, color }: { m: PremiumMaterials; color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.5, 20]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
          <Block
            at={[0, 0.09, 0.22]}
            size={[0.045, 0.05, 0.44]}
            material={m.metal}
            round={0.02}
          />
          <mesh
            position={[0, 0.06, 0.43]}
            rotation={[0, 0, Math.PI / 2]}
            material={m.metal}
          >
            <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
          </mesh>
        </group>
      ))}
      <Block at={[0, 0.6, 0]} size={[0.64, 0.16, 0.64]} round={0.075}>
        <Finish m={m} color={color} />
      </Block>
      <group rotation={[-0.1, 0, 0]}>
        <Block at={[0, 1.02, -0.27]} size={[0.6, 0.74, 0.14]} round={0.06}>
          <Finish m={m} color={color} />
        </Block>
        <Block at={[0, 1.49, -0.24]} size={[0.43, 0.27, 0.14]} round={0.065}>
          <Finish m={m} color={color} />
        </Block>
      </group>
      {[-0.39, 0.39].map((x) => (
        <group key={x}>
          <Block
            at={[x, 0.76, -0.08]}
            size={[0.035, 0.34, 0.035]}
            material={m.metal}
          />
          <Block
            at={[x, 0.92, 0]}
            size={[0.09, 0.06, 0.44]}
            round={0.025}
            material={m.metal}
          />
        </group>
      ))}
    </group>
  );
}
const modelUrl = (p?: Product) =>
  p?.model ? `/api/models/files/${p.model.id}/${p.model.file}` : undefined;
export function PremiumRoomSet({
  index,
  active,
  materials: m,
  colors,
  sofa,
  bed,
  wardrobe,
  onSelect,
  onSofaStatus,
  onBedStatus,
  onWardrobeStatus,
}: Props) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);
  const pick = (item: RoomFurniture) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(item);
  };
  const city = useTexture("/interior/premium/window-city.webp");
  const hotspot = (item: RoomFurniture, at: RoomPoint) =>
    active ? (
      <SceneHtml position={at} center zIndexRange={[5, 4]}>
        <button
          className="scroll-room-hotspot"
          aria-label={`${ROOM_ITEMS[item].label} · Дэлгэрэнгүй`}
          onClick={() => onSelect(item)}
        >
          <i />
          <span>{ROOM_ITEMS[item].label}</span>
        </button>
      </SceneHtml>
    ) : null;
  return (
    <>
      <Block at={[0, -0.08, 0]} size={[10, 0.16, 12]} material={m.floor} />
      <Block at={[0, 2, -4.85]} size={[10, 4, 0.16]} material={m.concrete} />
      {[-3.3, -1.65, 0, 1.65, 3.3].map((x) => (
        <Block
          key={x}
          at={[x, 2, -4.75]}
          size={[0.009, 4, 0.005]}
          material={m.metal}
        />
      ))}
      <Block at={[0, 4.1, 0]} size={[10, 0.16, 12]}>
        <meshStandardMaterial color="#383229" roughness={1} />
      </Block>
      <Block at={[-5, 2, 0]} size={[0.12, 4, 12]} material={m.concrete} />
      {[-4.7, -1.5, 1.7, 4.8].map((z) => (
        <Block
          key={z}
          at={[5, 2, z]}
          size={[0.065, 4, 0.06]}
          material={m.metal}
        />
      ))}
      {[0.1, 3.9].map((y) => (
        <Block
          key={y}
          at={[5, y, 0]}
          size={[0.07, 0.06, 9.6]}
          material={m.metal}
        />
      ))}
      <mesh position={[5.2, 2, -0.3]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[10, 4]} />
        <meshBasicMaterial map={city} toneMapped={false} />
      </mesh>
      <Curtains m={m} />
      <rectAreaLight
        position={[4.7, 2.4, -0.8]}
        rotation={[0, -Math.PI / 2, 0]}
        width={4}
        height={3}
        intensity={3}
        color="#dce5ee"
      />
      <Block
        at={[1, 0.014, -0.4]}
        size={[5.5, 0.028, 4.6]}
        material={m.rug}
        round={0.012}
      />
      <group position={[-3.7, 0, -3.5]}>
        <PremiumRoomModel
          url="/interior/potted_plant_04.glb"
          size={[1.3, 2.1, 1.3]}
        />
      </group>
      {index === 0 && (
        <>
          <Bookcase at={[2.7, 0, -4.45]} m={m} />
          <Block
            at={[-1.1, 2.25, -4.7]}
            size={[1.45, 1.85, 0.07]}
            material={m.wood}
          />
          <Block
            at={[-1.1, 2.25, -4.65]}
            size={[1.35, 1.75, 0.015]}
            material={m.concrete}
          />
          <group position={[1.8, 0.025, -2.1]} onClick={pick("sofa")}>
            <PremiumRoomModel
              url={modelUrl(sofa)}
              size={[3.4, 1.3, 1.5]}
              color={colors.sofa}
              onStatus={onSofaStatus}
            >
              <Block at={[0, 0.43, 0]} size={[3.1, 0.55, 1.2]} round={0.2}>
                <Finish m={m} color={colors.sofa} />
              </Block>
              <Block
                at={[0, 0.91, -0.44]}
                size={[3.1, 0.82, 0.36]}
                round={0.17}
              >
                <Finish m={m} color={colors.sofa} />
              </Block>
              {[-1.4, 1.4].map((x) => (
                <Block
                  key={x}
                  at={[x, 0.65, 0]}
                  size={[0.34, 0.75, 1.2]}
                  round={0.15}
                >
                  <Finish m={m} color={colors.sofa} />
                </Block>
              ))}
            </PremiumRoomModel>
          </group>
          <group
            onClick={pick("chair")}
            position={[-1.2, 0.01, -1]}
            rotation={[0, 0.4, 0]}
          >
            <PremiumRoomModel
              url="/interior/premium/lounge-chair.glb"
              size={[1.2, 1.3, 1.3]}
              color={colors.chair}
            />
          </group>
          <group position={[1, 0.01, 0.6]} onClick={pick("table")}>
            <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.88, 0.88, 0.16, 64]} />
              <Finish m={m} color={colors.table} wood />
            </mesh>
            <mesh position={[0, 0.24, 0]} castShadow>
              <cylinderGeometry args={[0.57, 0.57, 0.44, 48]} />
              <Finish m={m} color={colors.table} wood />
            </mesh>
            <Block at={[-0.22, 0.575, 0]} size={[0.44, 0.06, 0.3]}>
              <meshStandardMaterial color="#b9ab90" roughness={0.9} />
            </Block>
            <mesh position={[0.33, 0.65, -0.08]} castShadow>
              <cylinderGeometry args={[0.08, 0.07, 0.18, 24]} />
              <meshStandardMaterial color="#34322c" roughness={0.65} />
            </mesh>
          </group>
          <Pendant at={[2.9, 3.2, -1.6]} m={m} />
          <Pendant at={[3.55, 2.85, -0.8]} m={m} />
          {hotspot("sofa", [3.1, 0.9, -1.7])}
          {hotspot("chair", [-1.2, 0.8, -0.6])}
          {hotspot("table", [0.9, 0.6, 0.65])}
        </>
      )}
      {index === 1 && (
        <>
          <group position={[0.9, 0.02, -2.35]} onClick={pick("bed")}>
            <PremiumRoomModel
              url={modelUrl(bed)}
              size={[3.2, 1.65, 3.9]}
              color={colors.bed}
              onStatus={onBedStatus}
            >
              <PremiumBed m={m} color={colors.bed} />
            </PremiumRoomModel>
          </group>
          {[-1.45, 2.85].map((x) => (
            <group key={x} onClick={pick("nightstand")} position={[x, 0, -3.9]}>
              <Block at={[0, 0.4, 0]} size={[0.85, 0.65, 0.66]} round={0.02}>
                <Finish m={m} color={colors.nightstand} wood />
              </Block>
              {[0.3, 0.55].map((y) => (
                <Block key={y} at={[0, y, 0.34]} size={[0.75, 0.23, 0.035]}>
                  <Finish m={m} color={colors.nightstand} wood />
                </Block>
              ))}
              <TableLamp at={[0, 0.74, 0]} m={m} />
            </group>
          ))}
          <group
            onClick={pick("wardrobe")}
            position={[4.25, 0, -2.6]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <PremiumRoomModel
              url={modelUrl(wardrobe)}
              size={[2.65, 3.5, 0.7]}
              color={colors.wardrobe}
              onStatus={onWardrobeStatus}
            >
              <Block at={[0, 1.75, 0]} size={[2.65, 3.5, 0.7]}>
                <Finish m={m} color={colors.wardrobe} wood />
              </Block>
              {[-0.87, 0, 0.87].map((x) => (
                <group key={x}>
                  <Block at={[x, 1.75, 0.37]} size={[0.85, 3.4, 0.05]}>
                    <Finish m={m} color={colors.wardrobe} wood />
                  </Block>
                  <Block
                    at={[x + 0.3, 1.55, 0.42]}
                    size={[0.018, 0.5, 0.02]}
                    material={m.metal}
                  />
                </group>
              ))}
            </PremiumRoomModel>
          </group>
          <Pendant at={[2.5, 3.3, -2.6]} m={m} />
          {hotspot("bed", [1.1, 0.75, -0.8])}
          {hotspot("nightstand", [-1.45, 0.5, -3.4])}
          {hotspot("wardrobe", [3.8, 2, -2.5])}
        </>
      )}
      {index === 2 && (
        <>
          <group onClick={pick("bookshelf")}>
            <Bookcase at={[2.5, 0, -4.4]} m={m} color={colors.bookshelf} />
          </group>
          <group position={[0.5, 0, -1.5]} onClick={pick("desk")}>
            <Block at={[0, 0.79, 0]} size={[3.9, 0.12, 1.15]} round={0.025}>
              <Finish m={m} color={colors.desk} wood />
            </Block>
            <Block at={[-1.35, 0.38, 0]} size={[0.65, 0.76, 0.95]} round={0.02}>
              <Finish m={m} color={colors.desk} wood />
            </Block>
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
              />
              <Block at={[0, 0, 0.014]} size={[0.65, 0.4, 0.005]}>
                <meshStandardMaterial
                  color="#142126"
                  roughness={0.15}
                  metalness={0.2}
                />
              </Block>
            </group>
            <TableLamp at={[1.25, 0.85, -0.28]} m={m} />
            <Block at={[-1.2, 0.9, 0]} size={[0.48, 0.09, 0.32]}>
              <meshStandardMaterial color="#b9ae96" roughness={0.95} />
            </Block>
          </group>
          <group
            onClick={pick("officeChair")}
            position={[1.7, 0, 0.15]}
            rotation={[0, -0.3, 0]}
          >
            <OfficeChair m={m} color={colors.officeChair} />
          </group>
          <Pendant at={[0, 3.15, -1.2]} m={m} />
          {hotspot("desk", [0, 0.85, -0.9])}
          {hotspot("officeChair", [1.7, 1.1, 0.2])}
          {hotspot("bookshelf", [3.3, 2.5, -3.9])}
        </>
      )}
    </>
  );
}

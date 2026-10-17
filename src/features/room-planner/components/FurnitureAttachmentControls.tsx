"use client";
import { useState } from "react";
import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { dimsFor } from "@/three/collision";
import { findInitialFurniturePlacement, furnitureWallId, wallAttachedPiece } from "@/lib/furnitureAttachment";
import { normalizePlacementMetadata } from "@/lib/placementMetadata";
import { NumberControl } from "./PlannerPanels";
export function FurnitureAttachmentControls({ piece, pieces, room, roomId, onChange }: {
    piece: PlacedFurniture;
    pieces: PlacedFurniture[];
    room: RoomShape;
    roomId: string;
    onChange: (piece: PlacedFurniture) => string | null;
}) {
    const [error, setError] = useState("");
    const attachment = piece.attachment;
    const metadata = normalizePlacementMetadata(piece.placement);
    const walls = getRoomGeometry(room).segments.filter(s => !s.hole);
    const apply = (next: PlacedFurniture) => setError(onChange(next) ?? "");
    function attachWall(segmentId: string, along?: number, elevation?: number) {
        try {
            const wall = walls.find(s => furnitureWallId(s) === segmentId);
            if (!wall) throw new Error("Бэхлэх хана олдсонгүй.");
            apply(wallAttachedPiece(piece, room, roomId, segmentId, along ?? wall.length / 2, elevation ?? metadata.defaultElevation ?? 1.4));
        }
        catch (reason) {
            setError((reason as Error).message);
        }
    }
    return <section className="planner-transform" aria-label="Тавилгын бэхэлгээ">
    <h3>Байрлуулах гадаргуу</h3>
    <div className="planner-filter-pills">
      {metadata.surfaces.includes("floor") && <button type="button" aria-pressed={!attachment || attachment.kind === "floor"} onClick={() => {
            const floor = { ...piece, elevation: 0, attachment: undefined, placement: { ...normalizePlacementMetadata(piece.placement), surfaces: ["floor"] as [
                        "floor"
                    ] } };
            const next = findInitialFurniturePlacement(floor, pieces, room, roomId);
            if (next)
                apply({ ...next, placement: piece.placement });
            else
                setError("Шалан дээр байрлуулах зай хүрэлцэхгүй байна.");
        }}>Шалан дээр</button>}
      {metadata.surfaces.includes("wall") && <button type="button" aria-pressed={attachment?.kind === "wall"} onClick={() => {
        const next = findInitialFurniturePlacement({ ...piece, attachment: undefined, elevation: attachment?.kind === "wall" ? attachment.elevation : metadata.defaultElevation ?? 1.4, placement: { ...metadata, surfaces: ["wall"] } }, pieces, room, roomId);
        if (next) apply({ ...next, placement: piece.placement });
        else setError("Хананд бэхлэх сул зай олдсонгүй.");
      }}>Хананд бэхлэх</button>}
    </div>
    {attachment?.kind === "wall" && <>
      <label>Бэхлэх хана<select value={attachment.segmentId} onChange={e => attachWall(e.target.value, undefined, attachment.elevation)}>{walls.map((s, i) => <option key={furnitureWallId(s)} value={furnitureWallId(s)}>Хана {i + 1}</option>)}</select></label>
      <NumberControl label="Төв цэг · ханын эхнээс метр" value={attachment.along} min={dimsFor(piece).w / 2 + .01} max={Math.max(dimsFor(piece).w / 2 + .01, (walls.find(s => furnitureWallId(s) === attachment.segmentId)?.length ?? 20) - dimsFor(piece).w / 2 - .01)} step={.05} onCommit={along => attachWall(attachment.segmentId, along, attachment.elevation)}/>
      <NumberControl label="Доод ирмэг · шалнаас метр" value={attachment.elevation} min={0} max={Math.max(0,(room.height ?? 2.7) - dimsFor(piece).h)} step={.05} onCommit={elevation => attachWall(attachment.segmentId, attachment.along, elevation)}/>
      <p>3D дээр ханын дагуу, дээш доош чирнэ. Дээрээс харахад өндөр өөрчлөгдөхгүй.</p>
    </>}
    {metadata.surfaces.includes("surface") && <label>Тавих тулгуур гадаргуу<select value={attachment?.kind === "surface" ? `${attachment.parentInstanceId}|${attachment.surfaceId}` : ""} onChange={e => {
            const [parentInstanceId, surfaceId] = e.target.value.split("|");
            const parent = pieces.find(p => p.instanceId === parentInstanceId), surface = parent?.placement?.supportSurfaces?.find(s => s.id === surfaceId);
            if (!surface)
                return;
            apply({ ...piece, attachment: { kind: "surface", parentInstanceId, surfaceId, localPosition: [0, surface.elevation, 0], localQuaternion: [0, 0, 0, 1] } });
        }}><option value="">Гадаргуу сонгох</option>{pieces.filter(p => p.instanceId !== piece.instanceId).flatMap(parent => parent.placement?.supportSurfaces?.map(s => <option key={`${parent.instanceId}|${s.id}`} value={`${parent.instanceId}|${s.id}`}>{parent.details?.name ?? parent.productId} · {s.id}</option>) ?? [])}</select></label>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

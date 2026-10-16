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
    const walls = getRoomGeometry(room).segments.filter(s => !s.hole);
    const apply = (next: PlacedFurniture) => setError(onChange(next) ?? "");
    function attachWall(segmentId: string, along?: number, elevation?: number) {
        try {
            const wall = walls.find(s => furnitureWallId(s) === segmentId)!;
            const mounted = { ...piece, placement: { ...normalizePlacementMetadata(piece.placement), surfaces: ["wall"] as [
                        "wall"
                    ] } };
            apply(wallAttachedPiece(mounted, room, roomId, segmentId, along ?? wall.length / 2, elevation ?? (piece.elevation && piece.elevation > 0 ? piece.elevation : 1.4)));
        }
        catch (reason) {
            setError((reason as Error).message);
        }
    }
    return <section className="planner-transform" aria-label="Тавилгын бэхэлгээ">
    <h3>Байрлуулах гадаргуу</h3>
    <div className="planner-filter-pills">
      <button type="button" aria-pressed={!attachment || attachment.kind === "floor"} onClick={() => {
            const floor = { ...piece, elevation: 0, attachment: undefined, placement: { ...normalizePlacementMetadata(piece.placement), surfaces: ["floor"] as [
                        "floor"
                    ] } };
            const next = findInitialFurniturePlacement(floor, pieces, room, roomId);
            if (next)
                apply(next);
            else
                setError("Шалан дээр байрлуулах зай хүрэлцэхгүй байна.");
        }}>Шалан дээр</button>
      <button type="button" aria-pressed={attachment?.kind === "wall"} onClick={() => { if (walls[0])
        attachWall(furnitureWallId(walls[0])); }}>Хананд бэхлэх</button>
    </div>
    {attachment?.kind === "wall" && <>
      <label>Бэхлэх хана<select value={attachment.segmentId} onChange={e => attachWall(e.target.value, undefined, attachment.elevation)}>{walls.map((s, i) => <option key={furnitureWallId(s)} value={furnitureWallId(s)}>Хана {i + 1}</option>)}</select></label>
      <NumberControl label="Ханын эхнээс · метр" value={attachment.along} min={0} max={walls.find(s => furnitureWallId(s) === attachment.segmentId)?.length ?? 20} step={.05} onCommit={along => attachWall(attachment.segmentId, along, attachment.elevation)}/>
      <NumberControl label="Шалнаас өндөр · метр" value={attachment.elevation} min={0} max={(room.height ?? 2.7) - dimsFor(piece).h} step={.05} onCommit={elevation => attachWall(attachment.segmentId, attachment.along, elevation)}/>
      <p>Ханын дагуу болон дээш, доош чирж зөөнө.</p>
    </>}
    <label>Тавих тулгуур гадаргуу<select value={attachment?.kind === "surface" ? `${attachment.parentInstanceId}|${attachment.surfaceId}` : ""} onChange={e => {
            const [parentInstanceId, surfaceId] = e.target.value.split("|");
            const parent = pieces.find(p => p.instanceId === parentInstanceId), surface = parent?.placement?.supportSurfaces?.find(s => s.id === surfaceId);
            if (!surface)
                return;
            apply({ ...piece, placement: { ...normalizePlacementMetadata(piece.placement), surfaces: ["surface"] }, attachment: { kind: "surface", parentInstanceId, surfaceId, localPosition: [0, surface.elevation, 0], localQuaternion: [0, 0, 0, 1] } });
        }}><option value="">Гадаргуу сонгох</option>{pieces.filter(p => p.instanceId !== piece.instanceId).flatMap(parent => parent.placement?.supportSurfaces?.map(s => <option key={`${parent.instanceId}|${s.id}`} value={`${parent.instanceId}|${s.id}`}>{parent.details?.name ?? parent.productId} · {s.id}</option>) ?? [])}</select></label>
    <button type="button" onClick={() => { const d = dimsFor(piece); apply({ ...piece, placement: { ...normalizePlacementMetadata(piece.placement), supportSurfaces: [{ id: "top", width: d.w, depth: d.d, elevation: d.h }] } }); }}>Дээд талыг тулгуур гадаргуу болгох</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

import { parseRoomProject, type RoomProjectDocument } from "./roomProjectValidation";
export type RoomProjectSummary = { id: string; name: string; revision: number; roomCount: number; pieceCount: number;
  importKey: string | null; archivedAt: string | null; createdAt: string; updatedAt: string };
export type RoomProject = RoomProjectSummary & { document: RoomProjectDocument };
export type ProjectVersionSummary = { revision: number; name: string; created_at: string };
export function readRoomProject(row: Record<string, unknown>): RoomProject {
  return { id: String(row.id), name: String(row.name), revision: Number(row.revision), roomCount: Number(row.room_count), pieceCount: Number(row.piece_count),
    importKey: typeof row.import_key === "string" ? row.import_key : null, archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), document: parseRoomProject(row.document) };
}
export function readRoomSummary(row: Record<string, unknown>): RoomProjectSummary {
  return { id: String(row.id), name: String(row.name), revision: Number(row.revision), roomCount: Number(row.room_count), pieceCount: Number(row.piece_count),
    importKey: typeof row.import_key === "string" ? row.import_key : null, archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

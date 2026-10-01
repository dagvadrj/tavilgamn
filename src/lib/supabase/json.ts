import type { Json } from "./database.types";

/** Validated domain DTO -> the actual JSON sent on the wire (no unchecked type cast). */
export function toJson(value: unknown): Json {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Expected JSON data");
  return JSON.parse(serialized) as Json;
}
export function jsonArray(value: Json | null): Json[] {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error("Expected a JSON array from database");
  return value;
}
export function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object from database");
  return value as Record<string, unknown>;
}

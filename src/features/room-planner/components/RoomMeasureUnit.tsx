"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import "./room-measure-editing.css";

export const useRoomMeasureUnit = create(persist<{
  unit: "см" | "мм";
  setUnit: (unit: "см" | "мм") => void;
}>((set) => ({ unit: "см", setUnit: (unit) => set({ unit }) }), {
  name: "room-measure-unit",
}));

export function RoomMeasureUnit() {
  const { unit, setUnit } = useRoomMeasureUnit();
  return <label className="room-unit-choice">Хэмжих нэгж <select aria-label="Хэмжих нэгж" value={unit} onChange={e => setUnit(e.target.value as "см" | "мм")}><option value="см">см</option><option value="мм">мм</option></select></label>;
}

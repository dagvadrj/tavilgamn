"use client";
import { useState } from "react";
import type { Category, RoomWall, RoomType } from "@/lib/types";
import type { EnvironmentTab } from "@/components/RoomEnvironmentPanel";

export interface CustomInterior {
  id: string;
  basePath: string;
  glb: string;
  scale?: number;
  label: string;
}

/** The one left workspace panel: three tabs plus nested views over them. */
export type RoomPanelTab = "add" | "added" | "cart";
export type RoomPanelView = "list" | "detail" | "room" | "designs";

/** Ephemeral editor UI only. Persisted room data remains owned by useDesigns. */
export function useRoomPlannerUi() {
  const [selected, setSelected] = useState<string | null>(null);
  const [environmentTab, setEnvironmentTab] =
    useState<EnvironmentTab>("room");
  const [surface, setSurface] = useState<"floor" | "wall" | "ceiling">("floor");
  const [selectedWall, setSelectedWall] = useState<RoomWall | null>(null);
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [placementTemplate, setPlacementTemplate] = useState<string | null>(
    null,
  );
  const [showStartHint, setShowStartHint] = useState(false);
  const [view, setView] = useState<"plan" | "perspective">("perspective");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [locked, setLocked] = useState(false);
  const [paletteCat, setPaletteCat] = useState<Category | "all">("all");
  const [showCompare, setShowCompare] = useState(false);
  const [showRoomGeometry, setShowRoomGeometry] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [activePreset, setActivePreset] = useState<CustomInterior | null>(null);
  const [presetStatus, setPresetStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [presetError, setPresetError] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localScale, setLocalScale] = useState(1);
  const [query, setQuery] = useState("");
  const [gridEnabled, setGridEnabled] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [newRoomType, setNewRoomType] = useState<RoomType>("bedroom");
  // Desktop starts with the panel open; small screens open it on demand.
  const [panelOpen, setPanelOpen] = useState(
    () =>
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(min-width: 960px)").matches,
  );
  const [panelTab, setPanelTab] = useState<RoomPanelTab>("add");
  const [panelView, setPanelView] = useState<RoomPanelView>("list");
  return {
    panelOpen, setPanelOpen, panelTab, setPanelTab, panelView, setPanelView,
    selected, setSelected, environmentTab, setEnvironmentTab, surface, setSurface, selectedWall, setSelectedWall, selectedOpening, setSelectedOpening, placementTemplate, setPlacementTemplate, showStartHint, setShowStartHint, view, setView, snapEnabled, setSnapEnabled, locked, setLocked, paletteCat, setPaletteCat, showCompare, setShowCompare, showRoomGeometry, setShowRoomGeometry, compareIds, setCompareIds, saveName, setSaveName, activePreset, setActivePreset, presetStatus, setPresetStatus, presetError, setPresetError, localFile, setLocalFile, localUrl, setLocalUrl, localScale, setLocalScale, query, setQuery, gridEnabled, setGridEnabled, showDimensions, setShowDimensions, resetKey, setResetKey, notice, setNotice, expanded, setExpanded, newRoomType, setNewRoomType
  };
}

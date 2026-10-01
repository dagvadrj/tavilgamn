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

/** Ephemeral editor UI only. Persisted room data remains owned by useDesigns. */
export function useRoomPlannerUi() {
  const [selected, setSelected] = useState<string | null>(null);
  const [environmentTab, setEnvironmentTab] =
    useState<EnvironmentTab>("surfaces");
  const [surface, setSurface] = useState<"floor" | "wall" | "ceiling">("floor");
  const [selectedWall, setSelectedWall] = useState<RoomWall | null>(null);
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [placementTemplate, setPlacementTemplate] = useState<string | null>(
    null,
  );
  const [showStartHint, setShowStartHint] = useState(true);
  const [view, setView] = useState<"plan" | "perspective">("perspective");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [locked, setLocked] = useState(false);
  const [paletteCat, setPaletteCat] = useState<Category>("sofa");
  const [showCompare, setShowCompare] = useState(false);
  const [showRoomGeometry, setShowRoomGeometry] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
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
  return {
    selected, setSelected, environmentTab, setEnvironmentTab, surface, setSurface, selectedWall, setSelectedWall, selectedOpening, setSelectedOpening, placementTemplate, setPlacementTemplate, showStartHint, setShowStartHint, view, setView, snapEnabled, setSnapEnabled, locked, setLocked, paletteCat, setPaletteCat, showCompare, setShowCompare, showRoomGeometry, setShowRoomGeometry, compareIds, setCompareIds, saveName, setSaveName, leftOpen, setLeftOpen, rightOpen, setRightOpen, activePreset, setActivePreset, presetStatus, setPresetStatus, presetError, setPresetError, localFile, setLocalFile, localUrl, setLocalUrl, localScale, setLocalScale, query, setQuery, gridEnabled, setGridEnabled, showDimensions, setShowDimensions, resetKey, setResetKey, notice, setNotice, expanded, setExpanded, newRoomType, setNewRoomType
  };
}

"use client";
import dynamic from "next/dynamic";
import { useRoomPlannerUi, type CustomInterior } from "@/features/room-planner/hooks/useRoomPlannerUi";
import { Drawer, CompareModal, NumberControl, PlannerSkeleton } from "@/features/room-planner/components/PlannerPanels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ViewportControls } from "@/features/planner/components/ViewportControls";
import { PlannerRail } from "@/features/planner/components/PlannerRail";
import type { CameraAction, CameraRequest } from "@/lib/plannerCamera";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Save,
  Trash2,
  RotateCw,
  Eye,
  LayoutGrid,
  Magnet,
  Copy,
  Layers,
  ShoppingBag,
  Maximize,
  Lock,
  Unlock,
  Menu,
  Settings,
  X,
  Sparkles,
  Upload,
  Undo2,
  Redo2,
  Ruler,
  Search,
  Download,
  Check,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Paintbrush,
  DoorOpen,
  Lightbulb,
  House,
} from "lucide-react";
import { CATEGORIES, priceFor } from "@/lib/products";
import { getProduct, useCatalog } from "@/store/catalog";
import { hasAvailableStock } from "@/lib/inventory";
import { CatalogStatus } from "@/components/CatalogStatus";
import { useDesigns, ROOM_DIMENSIONS } from "@/store/designs";
import { stockLabel } from "@/lib/inventory";
import { useCart } from "@/store/cart";
import type {
  PlacedFurniture,
  RoomDesign,
  RoomSize,
  Material,
  RoomShape,
  RoomType,
  RoomWall,
  RoomOpening,
} from "@/lib/types";
import { getRoomGeometry, ROOM_TYPES } from "@/lib/roomGeometry";
import { RoomGeometryModal } from "./RoomGeometryModal";
import {
  RoomEnvironmentPanel,
} from "./RoomEnvironmentPanel";
import {
  createOpening,
  validateOpening,
  validateRoomOpenings,
} from "@/lib/roomOpenings";
import { SavedKitchenList } from "./SavedKitchenList";
import { useKitchens } from "@/store/kitchens";
import { useAuth } from "@/store/auth";
import { assessKitchenRoomFit } from "@/lib/kitchenRoomFit";
import type { SavedKitchen } from "@/lib/kitchenAssembly";
import { formatPrice, cn } from "@/lib/format";
import { modelDeliveryUrl, prefetchModel } from "@/lib/modelPrefetch";
import {
  isPlacementValid,
  findFreePlacement,
  dimsFor,
} from "@/three/collision";
import {
  getFurnitureMeasurements,
  formatMeasurement,
} from "@/lib/furnitureMeasurements";
import "./room-planner.css";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-reference.css";
import { type DbModelInfo, getDbModel } from "@/lib/modelRegistry";

const RoomCanvas = dynamic(
  () => import("@/three/RoomCanvas").then((m) => m.RoomCanvas),
  { ssr: false, loading: () => <PlannerSkeleton /> },
);

const ROOM_OPTIONS: { id: RoomSize; label: string; sub: string }[] = [
  { id: "40", label: "40 м² орон сууц", sub: "6.3 × 6.3 м" },
  { id: "80", label: "80 м² орон сууц", sub: "8.9 × 8.9 м" },
  { id: "120", label: "120 м² байшин", sub: "11 × 11 м" },
];


const STATIC_PRESETS: CustomInterior[] = [
  {
    id: "tvfurniture",
    basePath: "/models/tv/",
    glb: "tv.glb",
    scale: 0.001,
    label: "tv (өөрийн загвар)",
  },
];

export function RoomPlanner() {
  const {
    current,
    designs,
    createNew,
    addRoom,
    selectRoom,
    loadDesign,
    saveCurrent,
    deleteDesign,
    duplicateDesign,
    updatePieces,
    updateRoom,
    past,
    future,
    undo,
    redo,
    beginEdit,
    endEdit,
  } = useDesigns();
  const catalog = useCatalog();
  const kitchenLibrary = useKitchens(),
    kitchenUser = useAuth((state) => state.user);
  const handledKitchen = useRef<string | null>(null);
  const {
    inspector, setInspector,
    selected, setSelected, environmentTab, setEnvironmentTab, surface,
    setSurface, selectedWall, setSelectedWall, selectedOpening, setSelectedOpening,
    placementTemplate, setPlacementTemplate, showStartHint, setShowStartHint, view,
    setView, snapEnabled, setSnapEnabled, locked, setLocked,
    paletteCat, setPaletteCat, showCompare, setShowCompare, showRoomGeometry,
    setShowRoomGeometry, compareIds, setCompareIds, saveName, setSaveName,
    leftOpen, setLeftOpen: setCatalogOpen, rightOpen, setRightOpen: setPropertiesOpen, activePreset,
    setActivePreset, presetStatus, setPresetStatus, presetError, setPresetError,
    localFile, setLocalFile, localUrl, setLocalUrl, localScale,
    setLocalScale, query, setQuery, gridEnabled, setGridEnabled,
    showDimensions, setShowDimensions, resetKey, setResetKey, notice,
    setNotice, expanded, setExpanded, newRoomType, setNewRoomType,
  } = useRoomPlannerUi();
  const setLeftOpen = useCallback((open: boolean) => {
    setCatalogOpen(open);
    if (open) { setInspector("catalog"); setPropertiesOpen(false); }
  }, [setCatalogOpen, setInspector, setPropertiesOpen]);
  const setRightOpen = useCallback((open: boolean) => {
    setPropertiesOpen(open);
    if (open) { setInspector("environment"); setCatalogOpen(false); }
  }, [setCatalogOpen, setInspector, setPropertiesOpen]);
  const dbModels = useMemo(
    () =>
      catalog.products
        .filter((product) => product.model)
        .map((product) => getDbModel(product.id))
        .filter((model): model is DbModelInfo => !!model),
    [catalog.products],
  );
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  function navigateView(action: CameraAction) {
    if (action === "top") setView("plan");
    if (action === "front") setView("perspective");
    setCameraRequest(previous => ({ id: (previous?.id ?? 0) + 1, action }));
  }
  const shortcuts = useRef<Record<string, () => void>>({});
  const addToCart = useCart((s) => s.add);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);
  useEffect(() => {
    if (
      selected &&
      !current?.pieces.some((piece) => piece.instanceId === selected)
    )
      setSelected(null);
  }, [current, selected, setSelected]);
  useEffect(() => {
    setSelected(null);
    setSelectedWall(null);
    setSelectedOpening(null);
    setPlacementTemplate(null);
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    setResetKey((key) => key + 1);
    const type = current?.roomType;
    if (type === "bedroom") setPaletteCat("bed");
    else if (type === "kitchen") setPaletteCat("dining-table");
    else if (type === "office") setPaletteCat("office");
    else setPaletteCat("sofa");
  }, [current?.id, current?.activeRoomId, current?.roomType, setSelected,
    setSelectedWall, setSelectedOpening, setPlacementTemplate, setActivePreset,
    setLocalFile, setLocalUrl, setResetKey, setPaletteCat]);
  useEffect(() => {
    if (
      selectedOpening &&
      !current?.openings?.some((opening) => opening.id === selectedOpening)
    )
      setSelectedOpening(null);
  }, [current?.openings, selectedOpening, setSelectedOpening]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "dialog, input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;
      const action = command
        ? key === "z"
          ? event.shiftKey
            ? "redo"
            : "undo"
          : key === "y"
            ? "redo"
            : key === "d"
              ? "duplicate"
              : key === "s"
                ? "save"
                : ""
        : key;
      if (shortcuts.current[action]) {
        event.preventDefault();
        shortcuts.current[action]();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    // The first hydration render can still hold the server's null snapshot.
    // Read the live store before creating anything so persisted work survives reload.
    if (!useDesigns.getState().current) createNew("80", "Миний гэр", "living");
  }, [current, createNew]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("kitchen");
    if (!id || handledKitchen.current === id || !current) return;
    if (!kitchenUser) {
      setLeftOpen(true);
      return;
    }
    if (kitchenLibrary.owner !== kitchenUser.id) return;
    if (!kitchenLibrary.loaded) {
      if (!kitchenLibrary.loading && !kitchenLibrary.error)
        void kitchenLibrary.refresh();
      if (kitchenLibrary.error) setLeftOpen(true);
      return;
    }
    handledKitchen.current = id;
    const saved = kitchenLibrary.items.find((item) => item.id === id);
    const fit = saved
      ? assessKitchenRoomFit(
          saved,
          current.pieces,
          current,
          `p_${crypto.randomUUID()}`,
        )
      : null;
    const piece = fit?.placement;
    if (piece) {
      updatePieces([...current.pieces, piece]);
      setSelected(piece.instanceId);
      setRightOpen(true);
      setNotice(`Гарнитурыг өрөөнд байрлууллаа. ${fit.message}`);
    } else {
      setNotice(
        saved
          ? `${fit?.message} Өрөө, байрлалаа тохируулаад Өөрийн загвараас дахин нэмээрэй.`
          : "Хадгалсан гарнитур олдсонгүй.",
      );
      setLeftOpen(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("kitchen");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [current, kitchenLibrary, kitchenUser, updatePieces, setSelected,
    setNotice, setLeftOpen, setRightOpen]);

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const handleLocalGlbSelect = (file: File | null) => {
    if (file && (!/\.glb$/i.test(file.name) || file.size > 100 * 1024 * 1024)) {
      setNotice("100 MB хүртэл хэмжээтэй .glb файл сонгоно уу.");
      return;
    }
    if (localUrl) URL.revokeObjectURL(localUrl);
    if (!file) {
      setLocalFile(null);
      setLocalUrl(null);
      setPresetStatus("idle");
      setPresetError(null);
      return;
    }
    setActivePreset(null);
    setLocalFile(file);
    setLocalUrl(URL.createObjectURL(file));
    setPresetStatus("loading");
    setPresetError(null);
  };

  const paletteItems = useMemo(
    () =>
      catalog.products.filter(
        (product) =>
          hasAvailableStock(product) &&
          !product.model &&
          product.category === paletteCat &&
          product.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [catalog.products, paletteCat, query],
  );
  const dbPaletteItems = useMemo(
    () =>
      dbModels.filter(
        (m) =>
          hasAvailableStock(m) &&
          m.category === paletteCat &&
          m.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [dbModels, paletteCat, query],
  );
  if (!current) {
    shortcuts.current = {};
    return <PlannerSkeleton />;
  }

  const addPiece = (productId: string) => {
    const product = getProduct(productId);
    if (!product) return;
    const piece: PlacedFurniture = {
      instanceId: `p_${Math.random().toString(36).slice(2, 10)}`,
      productId,
      x: 0,
      z: 0,
      rotation: 0,
      color: product.defaultColor,
      material: product.materials[0].id,
    };
    const room = current;
    const placed = findFreePlacement(piece, current.pieces, room);
    if (!placed) {
      setNotice(
        "Тавилга байрлуулах сул зай хүрэлцэхгүй байна. Өрөөг томруулах эсвэл байрлалаа өөрчилнө үү.",
      );
      return;
    }
    updatePieces([...current.pieces, placed]);
    setSelected(placed.instanceId);
    setLeftOpen(false);
  };

  const addModelPiece = (model: DbModelInfo) => {
    const defaultColor = model.colors[0]?.id ?? "default";
    const defaultMaterial = (model.materials[0]?.id ?? "wood") as Material;
    const piece: PlacedFurniture = {
      instanceId: `m_${Math.random().toString(36).slice(2, 10)}`,
      productId: model.id,
      modelId: model.id,
      x: 0,
      z: 0,
      rotation: 0,
      color: defaultColor,
      material: defaultMaterial,
    };
    const room = current;
    const placed = findFreePlacement(piece, current.pieces, room);
    if (!placed) {
      setNotice("Энэ загварыг байрлуулах сул зай хүрэлцэхгүй байна.");
      return;
    }
    updatePieces([...current.pieces, placed]);
    setSelected(placed.instanceId);
    setLeftOpen(false);
  };

  const onMove = (id: string, x: number, z: number) => {
    updatePieces(
      current.pieces.map((p) => (p.instanceId === id ? { ...p, x, z } : p)),
    );
  };

  const rotateSelected = () => {
    if (!selected) return;
    const piece = current.pieces.find((p) => p.instanceId === selected);
    if (!piece) return;
    const rotated: PlacedFurniture = {
      ...piece,
      rotation: (piece.rotation + Math.PI / 2) % (Math.PI * 2),
    };
    const room = current;
    if (!isPlacementValid(rotated, current.pieces, room)) {
      setNotice("Эргүүлэхэд хана эсвэл бусад тавилгатай давхцаж байна.");
      return;
    }

    updatePieces(
      current.pieces.map((p) => (p.instanceId === selected ? rotated : p)),
    );
  };

  const removeSelected = () => {
    if (selectedOpening) {
      updateRoom({
        openings: (current.openings ?? []).filter(
          (opening) => opening.id !== selectedOpening,
        ),
      });
      setSelectedOpening(null);
      return;
    }
    if (!selected) return;
    updatePieces(current.pieces.filter((p) => p.instanceId !== selected));
    setSelected(null);
  };

  const resizeRoom = (size: RoomSize) => {
    const dims = ROOM_DIMENSIONS[size];
    const resizedRoom = {
      ...current,
      width: dims.w,
      depth: dims.d,
    };
    const shapeError = validateRoomOpenings(resizedRoom);
    if (shapeError) {
      setNotice(shapeError);
      return;
    }
    const resizedGeometry = getRoomGeometry(resizedRoom);
    if (
      current.lighting?.fixtures.some(
        (fixture) =>
          fixture.x < resizedGeometry.bounds.minX ||
          fixture.x > resizedGeometry.bounds.maxX ||
          fixture.z < resizedGeometry.bounds.minZ ||
          fixture.z > resizedGeometry.bounds.maxZ ||
          resizedGeometry.voids.some(
            (rect) =>
              fixture.x >= rect.minX &&
              fixture.x <= rect.maxX &&
              fixture.z >= rect.minZ &&
              fixture.z <= rect.maxZ,
          ),
      )
    ) {
      setNotice(
        "Таазны гэрэл шинэ өрөөний гадна үлдэж байна. Эхлээд гэрлийн байрлалыг өөрчилнө үү.",
      );
      return;
    }
    const allPiecesValid = current.pieces.every((p) =>
      isPlacementValid(p, current.pieces, resizedRoom),
    );
    if (!allPiecesValid) {
      setNotice(
        "Энэ хэмжээнд тавилга багтахгүй байна. Эхлээд байрлалыг нь өөрчилнө үү.",
      );
      return;
    }
    updateRoom({ size, width: dims.w, depth: dims.d });
  };

  const togglePreset = (preset: CustomInterior) => {
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
      setLocalFile(null);
    }
    if (activePreset?.id === preset.id) {
      setActivePreset(null);
      setPresetStatus("idle");
      setPresetError(null);
    } else {
      setActivePreset(preset);
      setPresetStatus("loading");
      setPresetError(null);
    }
  };

  const allPresets = STATIC_PRESETS;

  const getDbPieceModel = (piece: PlacedFurniture) =>
    dbModels.find((model) => model.id === (piece.modelId ?? piece.productId));

  const getPiecePrice = (piece: PlacedFurniture) => {
    const product = getProduct(piece.productId);

    if (product) {
      return priceFor(product, piece.color, piece.material);
    }

    const model = getDbPieceModel(piece);
    if (!model) return 0;

    const colorDelta =
      model.colors.find((color) => color.id === piece.color)?.priceDelta ?? 0;

    const materialDelta =
      model.materials.find((material) => material.id === piece.material)
        ?.priceDelta ?? 0;

    return model.basePrice + colorDelta + materialDelta;
  };

  const totalPrice = current.pieces.reduce(
    (sum, piece) => sum + getPiecePrice(piece),
    0,
  );

  const buyEverything = () => {
    if (!current.pieces.length) return;
    let added = 0;
    let skipped = 0;
    current.pieces.forEach((piece) => {
      const product = getProduct(piece.productId);
      if (
        !product?.inStock ||
        !product.colors.some((c) => c.id === piece.color) ||
        !product.materials.some((m) => m.id === piece.material)
      ) {
        skipped++;
        return;
      }
      const count = addToCart({
        productId: product.id,
        name: product.name,
        image: product.image,
        color: piece.color,
        material: piece.material,
        unitPrice: getPiecePrice(piece),
        qty: 1,
        stockQuantity: product.stockQuantity,
      });
      added += count;
      if (!count) skipped++;
    });
    setNotice(
      added
        ? added +
            " тавилгыг сагсанд нэмлээ." +
            (skipped
              ? " " +
                skipped +
                " тавилга нөөц хүрэлцэхгүй эсвэл сонголт өөрчлөгдсөн тул нэмэгдсэнгүй."
              : "")
        : "Тавилга нэмэгдсэнгүй. Нөөц болон сагсны тоо ширхэгээ шалгана уу.",
    );
  };

  const selectedPiece = selected
    ? current.pieces.find((p) => p.instanceId === selected)
    : null;
  const selectedProduct = selectedPiece
    ? getProduct(selectedPiece.productId)
    : null;

  const selectedDbModel = selectedPiece
    ? dbModels.find(
        (model) =>
          model.id === (selectedPiece.modelId ?? selectedPiece.productId),
      )
    : null;

  const selectedDetails = selectedPiece?.kitchen
    ? {
        name: selectedPiece.kitchen.name,
        basePrice: 0,
        colors: [],
        materials: [],
      }
    : (selectedProduct ?? selectedDbModel);
  const measurements =
    showDimensions && selectedPiece && selectedDetails
      ? getFurnitureMeasurements(
          current,
          selectedPiece,
          dimsFor(selectedPiece),
        ).filter((item) => !(activePreset || localUrl) || item.kind === "size")
      : [];

  const transformSelected = (
    patch: Partial<Pick<PlacedFurniture, "x" | "z" | "rotation">>,
  ) => {
    if (!selectedPiece) return;
    const candidate = { ...selectedPiece, ...patch };
    if (!isPlacementValid(candidate, current.pieces, current)) {
      setNotice("Энэ байрлалд хана эсвэл өөр тавилга байна.");
      return;
    }
    updatePieces(
      current.pieces.map((piece) =>
        piece.instanceId === candidate.instanceId ? candidate : piece,
      ),
    );
  };
  const duplicateSelected = () => {
    if (!selectedPiece) return;
    const copy = findFreePlacement(
      { ...selectedPiece, instanceId: `p_${crypto.randomUUID()}` },
      current.pieces,
      current,
    );
    if (!copy) {
      setNotice("Хуулбар байрлуулах зай хүрэлцэхгүй байна.");
      return;
    }
    updatePieces([...current.pieces, copy]);
    setSelected(copy.instanceId);
  };
  const save = () => {
    endEdit();
    saveCurrent(saveName.trim() || current.name.trim() || "Миний өрөө");
    setSaveName("");
    setNotice("Загварыг энэ төхөөрөмж дээр хадгаллаа.");
  };
  const nudge = (x: number, z: number) => {
    if (selectedPiece)
      transformSelected({
        x: Math.round((selectedPiece.x + x) * 100) / 100,
        z: Math.round((selectedPiece.z + z) * 100) / 100,
      });
  };
  shortcuts.current = {
    undo,
    redo,
    duplicate: duplicateSelected,
    save,
    r: rotateSelected,
    delete: removeSelected,
    backspace: removeSelected,
    arrowup: () => nudge(0, -0.1),
    arrowdown: () => nudge(0, 0.1),
    arrowleft: () => nudge(-0.1, 0),
    arrowright: () => nudge(0.1, 0),
    escape: () => {
      setSelected(null);
      setSelectedWall(null);
      setSelectedOpening(null);
      setPlacementTemplate(null);
      setLeftOpen(false);
      setRightOpen(false);
      setExpanded(false);
      setShowCompare(false);
    },
  };
  const exportImage = () => {
    const canvas = workspaceRef.current?.querySelector("canvas");
    if (!canvas) {
      setNotice("3D дүрслэл ачаалсны дараа дахин оролдоно уу.");
      return;
    }
    try {
      const link = document.createElement("a");
      link.download = `${current.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "room"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setNotice("Өрөөний зургийг PNG хэлбэрээр татлаа.");
    } catch {
      setNotice(
        "Зураг татаж чадсангүй. Загвар бүрэн ачаалсны дараа дахин оролдоно уу.",
      );
    }
  };
  const geometry = getRoomGeometry(current);
  const applyRoomShape = (
    shape: RoomShape,
    contentShift?: { x: number; z: number },
  ) => {
    // Pointer samples can arrive within one render. Validate and update the
    // latest room, including its already shifted contents, as one store write.
    const latest = useDesigns.getState().current;
    if (!latest) return "Өрөөг дахин нээнэ үү.";
    const shifted =
      contentShift && (contentShift.x !== 0 || contentShift.z !== 0);
    const pieces = shifted
      ? latest.pieces.map((piece) => ({
          ...piece,
          x: piece.x + contentShift.x,
          z: piece.z + contentShift.z,
        }))
      : latest.pieces;
    const lighting =
      shifted && latest.lighting
        ? {
            ...latest.lighting,
            fixtures: latest.lighting.fixtures.map((fixture) => ({
              ...fixture,
              x: fixture.x + contentShift.x,
              z: fixture.z + contentShift.z,
            })),
          }
        : latest.lighting;
    const next = {
      ...latest,
      ...shape,
      openings: shape.openings ?? latest.openings,
      pieces,
      lighting,
    };
    const issue = validateRoomOpenings(next);
    if (issue) return issue;
    if (!pieces.every((piece) => isPlacementValid(piece, pieces, next)))
      return "Хана, товойлт эсвэл багана тавилгатай давхцаж байна. Эхлээд тавилгын байрлалыг өөрчилнө үү.";
    const nextGeometry = getRoomGeometry(next);
    if (
      lighting?.fixtures.some(
        (fixture) =>
          fixture.x < nextGeometry.bounds.minX ||
          fixture.x > nextGeometry.bounds.maxX ||
          fixture.z < nextGeometry.bounds.minZ ||
          fixture.z > nextGeometry.bounds.maxZ ||
          nextGeometry.voids.some(
            (rect) =>
              fixture.x >= rect.minX &&
              fixture.x <= rect.maxX &&
              fixture.z >= rect.minZ &&
              fixture.z <= rect.maxZ,
          ),
      )
    )
      return "Таазны гэрэл шинэ өрөөний гадна үлдэж байна. Эхлээд гэрлийн байрлалыг өөрчилнө үү.";
    updateRoom({ ...shape, openings: next.openings, pieces, lighting });
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    return null;
  };

  const selectOpening = (id: string | null) => {
    setSelectedOpening(id);
    if (id) {
      setSelected(null);
      setSelectedWall(
        current.openings?.find((item) => item.id === id)?.wallId ?? null,
      );
      setEnvironmentTab("openings");
    }
  };
  const selectWall = (wall: RoomWall) => {
    setSelectedWall(wall);
    setSelected(null);
    setSelectedOpening(null);
  };
  const changeOpening = (opening: RoomOpening) => {
    const issue = validateOpening(current, opening);
    if (issue) {
      setNotice(issue);
      return;
    }
    updateRoom({
      openings: (current.openings ?? []).map((item) =>
        item.id === opening.id ? opening : item,
      ),
    });
    setSelectedWall(opening.wallId);
  };
  const addOpening = (
    templateId: string,
    wallId: RoomWall,
    position?: number,
  ) => {
    const opening = createOpening(templateId, wallId, position ?? 0.5);
    if (position === undefined && validateOpening(current, opening)) {
      const positions = Array.from(
        { length: 99 },
        (_, i) => (i + 1) / 100,
      ).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
      const free = positions.find(
        (candidate) =>
          !validateOpening(current, { ...opening, position: candidate }),
      );
      if (free !== undefined) opening.position = free;
    }
    const issue = validateOpening(current, opening);
    if (issue) {
      setNotice(issue);
      return;
    }
    updateRoom({ openings: [...(current.openings ?? []), opening] });
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    setSelected(null);
    setSelectedOpening(opening.id);
    setSelectedWall(wallId);
    setPlacementTemplate(null);
    setEnvironmentTab("openings");
    setRightOpen(true);
  };
  const armPlacement = (templateId: string | null) => {
    setPlacementTemplate(templateId);
    setSelected(null);
    setSelectedOpening(null);
    if (templateId) {
      setActivePreset(null);
      setLocalFile(null);
      setLocalUrl(null);
      setRightOpen(false);
    }
  };

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "room-planner-layout planner-workspace planner-studio planner-reference room-reference relative overflow-hidden xl:grid",
        expanded && "planner-expanded",
      )}
    >
      <header className="studio-header room-studio-header">
        <Link href="/" className="studio-brand" aria-label="Tavilga.mn нүүр">
          <House size={19}/><span>tavilga.mn</span>
        </Link>
        <div className="studio-heading"><span>Өрөөний төлөвлөгч</span><small>{current.roomName ?? current.name}</small></div>
        <nav className="studio-switch" aria-label="Planner сонгох">
          <span aria-current="page">Өрөө</span>
          <Link href="/kitchen">Гал тогоо</Link>
        </nav>
        <div className="studio-file-actions">
          <button type="button" title="PNG зураг татах" aria-label="Зураг татах" onClick={exportImage}>
            <Download size={17}/><span>Зураг</span>
          </button>
          <button type="button" className="studio-primary" title="Хадгалах (Ctrl+S)" aria-label="Загвар хадгалах" onClick={save}>
            <Save size={17}/><span>Хадгалах</span>
          </button>
        </div>
      </header>
      {notice && (
        <div className="planner-notice" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {/* MOBILE TOOLBAR */}
      <div className="planner-mobile-toolbar absolute left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-[#293C32]/10 bg-[#FAF9F6]/95 px-3 py-2 backdrop-blur xl:hidden">
        <button
          onClick={() => setLeftOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#293C32] px-3 py-1.5 text-xs text-[#FFFFFF]"
        >
          <Menu className="h-3.5 w-3.5" /> Тавилга
        </button>
        <p className="truncate  text-sm">{current.roomName ?? current.name}</p>
        <button
          onClick={() => setRightOpen(true)}
          className="flex items-center gap-2 rounded-full border border-[#293C32]/15 px-3 py-1.5 text-xs"
        >
          <Settings className="h-3.5 w-3.5" /> Тохиргоо
        </button>
      </div>

      <PlannerRail items={[
        { id: "room", label: "Өрөө", Icon: House, active: inspector === "environment" && environmentTab === "room", onClick: () => { endEdit(); setPlacementTemplate(null); setEnvironmentTab("room"); setRightOpen(true); } },
        { id: "catalog", label: "Тавилгын каталог", Icon: LayoutGrid, active: inspector === "catalog", onClick: () => setLeftOpen(true) },
        { id: "materials", label: "Өнгө, материал", Icon: Paintbrush, active: inspector === "environment" && environmentTab === "surfaces", onClick: () => { endEdit(); setPlacementTemplate(null); setEnvironmentTab("surfaces"); setRightOpen(true); } },
        { id: "openings", label: "Хаалга, цонх", Icon: DoorOpen, active: inspector === "environment" && environmentTab === "openings", onClick: () => { endEdit(); setPlacementTemplate(null); setEnvironmentTab("openings"); setRightOpen(true); } },
        { id: "lighting", label: "Гэрэлтүүлэг", Icon: Lightbulb, active: inspector === "environment" && environmentTab === "lighting", onClick: () => { endEdit(); setPlacementTemplate(null); setEnvironmentTab("lighting"); setRightOpen(true); } },
        { id: "measure", label: "Хэмжээс харуулах", Icon: Ruler, active: showDimensions, onClick: () => setShowDimensions(value => !value) },
      ]} />

      {/* One shared right inspector; the catalog no longer consumes canvas width on the left. */}
      <Drawer
        side="right"
        open={leftOpen}
        active={inspector === "catalog"}
        onClose={() => setLeftOpen(false)}
        title="Тавилгын каталог"
      >
        <div className="border-b border-[#293C32]/10 p-4">
          <div className="planner-panel-heading">
            <span><LayoutGrid size={18}/> Тавилгын сан</span>
            <small>Орон зайгаа бүтээх бүх сонголт</small>
          </div>
          <label className="planner-search">
            <Search size={17} />
            <input
              aria-label="Тавилга нэрээр хайх"
              placeholder="Тавилга хайх…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="planner-reference-category">
            <span>Тавилгын ангилал</span>
            <select aria-label="Тавилгын ангилал" value={paletteCat} onChange={event => setPaletteCat(event.target.value as typeof paletteCat)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            </select>
          </label>
        </div>
        <div className="studio-catalog-scroll flex-1 overflow-y-auto p-3">
          <details className="planner-kitchen-library">
            <summary>Өөрийн загвар · гарнитур</summary>
            <SavedKitchenList
              onPlace={(saved: SavedKitchen) => {
                const fit = assessKitchenRoomFit(
                  saved,
                  current.pieces,
                  current,
                  `p_${crypto.randomUUID()}`,
                );
                const piece = fit.placement;
                if (!piece) {
                  setNotice(fit.message);
                  return;
                }
                updatePieces([...current.pieces, piece]);
                setSelected(piece.instanceId);
                setLeftOpen(false);
                setActivePreset(null);
                setLocalFile(null);
                setLocalUrl(null);
                setNotice(
                  `Гарнитурыг бодит хэмжээгээр байрлууллаа. ${fit.message}`,
                );
              }}
            />
            <Link className="btn-ghost mt-2" href="/kitchen">
              <Plus size={15} />
              Гарнитур үүсгэх
            </Link>
          </details>
          {(catalog.loading || !catalog.ready) && (
            <CatalogStatus
              loading={catalog.loading}
              error={catalog.error}
              retry={() => void catalog.refresh()}
            />
          )}
          <div className="studio-catalog-list grid gap-3">
            {catalog.ready &&
              !catalog.loading &&
              !paletteItems.length &&
              !dbPaletteItems.length && (
                <p className="planner-empty">
                  Энэ ангилалд тохирох тавилга олдсонгүй.
                </p>
              )}
            {paletteItems.map((p) => (
              <button
                key={p.id}
                onClick={() => addPiece(p.id)}
                className="group flex gap-3 rounded-lg border border-[#293C32]/10 bg-white p-2 text-left transition hover:border-[#293C32]/30"
              >
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[#EEEEE7]">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#6C726B]">
                    {formatPrice(p.basePrice)}
                    <span className="mt-1 block text-xs">{stockLabel(p)}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#737D6C]/70">
                    {p.dimensions.w} × {p.dimensions.d} м
                  </p>
                </div>
                <div className="grid h-7 w-7 self-center place-items-center rounded-full bg-[#293C32]/5 text-[#293C32] group-hover:bg-[#AD6547] group-hover:text-[#FFFFFF]">
                  <Plus className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
            {dbPaletteItems.map((m) => (
              <button
                key={m.id}
                onClick={() => addModelPiece(m)}
                onPointerEnter={() =>
                  void prefetchModel(
                    modelDeliveryUrl(
                      m.fileModelId ?? m.id,
                      m.previewGlbFile ?? m.glbFile,
                    ),
                  )
                }
                onFocus={() =>
                  void prefetchModel(
                    modelDeliveryUrl(
                      m.fileModelId ?? m.id,
                      m.previewGlbFile ?? m.glbFile,
                    ),
                  )
                }
                onTouchStart={() =>
                  void prefetchModel(
                    modelDeliveryUrl(
                      m.fileModelId ?? m.id,
                      m.previewGlbFile ?? m.glbFile,
                    ),
                  )
                }
                className="group flex gap-3 rounded-lg border border-[#AD6547]/30 bg-white p-2 text-left transition hover:border-[#AD6547]/60"
              >
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[#EEEEE7]">
                  {m.thumbnailFile ? (
                    <Image
                      src={`/api/models/files/${m.fileModelId ?? m.id}/${m.thumbnailFile}`}
                      alt={m.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Sparkles className="h-6 w-6 text-[#AD6547]/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <span className="flex-shrink-0 rounded-full bg-[#AD6547]/10 px-1.5 py-0.5 text-[10px] text-[#AD6547]">
                      3D
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[#6C726B]">
                    {m.basePrice > 0
                      ? formatPrice(m.basePrice)
                      : "Үнэ тогтоогдоогүй"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#737D6C]/70">
                    {m.dimensionsW} × {m.dimensionsD} м
                    <span className="mt-1 block text-xs">{stockLabel(m)}</span>
                  </p>
                </div>
                <div className="grid h-7 w-7 self-center place-items-center rounded-full bg-[#293C32]/5 text-[#293C32] group-hover:bg-[#AD6547] group-hover:text-[#FFFFFF]">
                  <Plus className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </Drawer>

      {/* CENTER: canvas */}
      <div className="planner-stage relative h-full">
        <div className="planner-view-toolbar">
          <div className="planner-segment" aria-label="Харах горим">
            <button
              aria-pressed={view === "plan"}
              onClick={() => setView("plan")}
            >
              <LayoutGrid size={16} /> 2D
            </button>
            <button
              aria-pressed={view === "perspective"}
              onClick={() => setView("perspective")}
            >
              <Eye size={16} /> 3D
            </button>
          </div>
          <div className="planner-tool-group">
            <button
              title="Буцаах (Ctrl+Z)"
              aria-label="Буцаах"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              title="Дахин хийх (Ctrl+Shift+Z)"
              aria-label="Дахин хийх"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <details className="planner-tools-menu">
            <summary aria-label="Засварлах хэрэгслүүд"><Settings size={17}/><span>Засвар</span></summary>
            <div className="planner-tools-popover">
            <button
              title="25 см тор ба торонд тааруулах"
              aria-label="Торонд тааруулах"
              aria-pressed={gridEnabled}
              onClick={() => setGridEnabled((v) => !v)}
            >
              <LayoutGrid size={18} /><span>25 см тор</span>
            </button>
            <button
              title="Хананд наалдуулах"
              aria-label="Хананд наалдуулах"
              aria-pressed={snapEnabled}
              onClick={() => setSnapEnabled((v) => !v)}
            >
              <Magnet size={18} /><span>Хананд тааруулах</span>
            </button>
            <button
              title="Measure · тавилга сонгоод хэмжээ, зайг харах"
              aria-label="Measure · хэмжих горим"
              aria-pressed={showDimensions}
              onClick={() => setShowDimensions((v) => !v)}
            >
              <Ruler size={18} /><span>Хэмжээс</span>
            </button>
            </div>
          </details>
        </div>
        <ViewportControls onAction={navigateView} plan={view === "plan"} disabled={locked}
          extra={<>
            <button type="button" title="Камер түгжих" aria-label="Камер түгжих" aria-pressed={locked}
              onClick={() => setLocked(value => !value)}>{locked ? <Lock size={18}/> : <Unlock size={18}/>}</button>
            <button type="button" title="Ажлын талбай томруулах" aria-label="Ажлын талбай томруулах" aria-pressed={expanded}
              onClick={() => setExpanded(value => !value)}><Maximize size={18}/></button>
          </>}/>
        <div className="planner-room-caption">
          <strong>
            {current.roomName ?? "Зочны өрөө"} · {current.width} ×{" "}
            {current.depth} м
          </strong>
          <span>
            {geometry.area.toFixed(2)} м² ашиглах талбай ·{" "}
            {current.pieces.length} тавилга
          </span>
        </div>
        {showDimensions && (
          <div className="planner-measure-readout" role="status">
            <strong>
              <Ruler size={14} /> Measure · см
            </strong>
            {measurements.length ? (
              <>
                <span>{selectedDetails?.name ?? "Тавилга"}</span>
                <span>
                  {measurements
                    .filter((item) => item.kind === "size")
                    .map((item) => formatMeasurement(item.value))
                    .join(" × ")}{" "}
                  · өргөн × урт × өндөр
                </span>
                {measurements.find((item) => item.id === "ceiling") && (
                  <span>
                    Тааз хүртэл:{" "}
                    {formatMeasurement(
                      measurements.find((item) => item.id === "ceiling")!.value,
                    )}
                  </span>
                )}
                {(activePreset || localUrl) && (
                  <span>
                    Өөрийн 3D интерьерийн хана, таазны хэмжилт дэмжигдэхгүй.
                  </span>
                )}
              </>
            ) : (
              <span>Хэмжих тавилга дээр дарна уу.</span>
            )}
          </div>
        )}

        {/* preset loading status */}
        {(activePreset || localFile) && (
          <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full border border-[#293C32]/10 bg-white/95 px-4 py-2 text-xs shadow-sm backdrop-blur md:top-16">
            {presetStatus === "loading" && "Загвар ачаалж байна…"}
            {presetStatus === "loaded" && "✓ Загвар амжилттай ачааллаа"}
            {presetStatus === "error" && (
              <span className="text-red-600">
                ⚠ Алдаа: {presetError ?? "загвар олдсонгүй"}
              </span>
            )}
          </div>
        )}

        {/* right-side selection actions */}
        <div className="planner-selection-toolbar">
          {selectedOpening && (
            <>
              <button
                onClick={() => {
                  setEnvironmentTab("openings");
                  setRightOpen(true);
                }}
              >
                <DoorOpen size={16} /> Хаалга, цонхны тохиргоо
              </button>
              <button
                onClick={removeSelected}
                aria-label="Сонгосон нээлхийг устгах"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {selected && (
            <>
              <button
                onClick={() => {
                  setEnvironmentTab("room");
                  setRightOpen(true);
                }}
                title="Сонгосон тавилгын тохиргоо"
                className="planner-selection-name"
              >
                <Settings size={16} />
                <span>{selectedDetails?.name ?? "Тавилга"}</span>
              </button>
              <button
                onClick={duplicateSelected}
                aria-label="Сонгосон тавилгыг хуулах"
                title="Хуулах (Ctrl+D)"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={rotateSelected}
                className="flex items-center gap-1.5 rounded-full bg-[#293C32] px-3 py-2 text-xs font-medium text-[#FFFFFF]"
              >
                <RotateCw className="h-3 w-3" /> 90°
              </button>
              <button
                onClick={removeSelected}
                className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                <Trash2 className="h-3 w-3" /> Устгах
              </button>
            </>
          )}
        </div>

        {/* bottom info bar */}
        <div className="planner-budget-bar">
          <span className="whitespace-nowrap text-[#6C726B]">
            {current.pieces.length} тавилга ·{" "}
            <strong className="font-mono text-[#293C32]">
              {formatPrice(totalPrice)}
            </strong>
          </span>
          <span className="h-4 w-px bg-[#293C32]/10" />
          <button
            onClick={buyEverything}
            disabled={!current.pieces.length}
            className="flex flex-shrink-0 items-center gap-1.5 text-[#AD6547] font-medium hover:underline"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Бүгдийг сагсанд
          </button>
        </div>

        {showStartHint &&
          !selectedWall &&
          !current.pieces.length &&
          !current.openings?.length &&
          !activePreset &&
          !localFile &&
          !placementTemplate && (
            <div className="planner-start-hint">
              <button
                className="planner-hint-dismiss"
                aria-label="Эхлэх зөвлөмжийг хаах"
                onClick={() => setShowStartHint(false)}
              >
                <X size={15} />
              </button>
              <Move size={20} />
              <strong>Өрөөгөө тохижуулж эхлээрэй</strong>
              <span>
                Материал сонгож, хаалга цонх нэмээд тавилгаа чирж байрлуулна.
              </span>
              <button onClick={() => setLeftOpen(true)}>
                Тавилга сонгох <Plus size={15} />
              </button>
            </div>
          )}
        <div className="room-camera-guide">
          {placementTemplate
            ? "Байрлуулах ханандаа дарна уу · Esc цуцлах"
            : view === "plan"
              ? "2D · Дунд товч: шилжүүлэх · Дугуй: ойртуулах"
              : "Дунд товч: эргүүлэх · Shift: шилжүүлэх · Дугуй: ойртуулах"}
        </div>

        <div className="planner-canvas h-full w-full pt-10 xl:pt-0">
          <RoomCanvas
            key={`${current.id}-${current.activeRoomId ?? "room"}`}
            design={current}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              if (id) {
                setRightOpen(true);
                setSelectedOpening(null);
                setSelectedWall(null);
                setPlacementTemplate(null);
                setEnvironmentTab("room");
              }
            }}
            selectedWall={selectedWall}
            onSelectWall={(wall) => {
              selectWall(wall);
              setSurface("wall");
              setEnvironmentTab("surfaces");
              setRightOpen(true);
            }}
            selectedOpening={selectedOpening}
            onSelectOpening={selectOpening}
            onUpdateOpening={changeOpening}
            placementTemplate={placementTemplate}
            onPlaceOpening={(wall, position) => {
              if (placementTemplate)
                addOpening(placementTemplate, wall, position);
            }}
            onPlacementError={setNotice}
            onMove={onMove}
            view={view}
            snapEnabled={snapEnabled}
            locked={locked}
            gridEnabled={gridEnabled}
            showDimensions={showDimensions}
            measurements={measurements}
            resetKey={resetKey}
            cameraRequest={cameraRequest}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            customInterior={
              localUrl
                ? {
                    basePath: "",
                    glb: localUrl,
                    scale: localScale,
                    onLoaded: () => setPresetStatus("loaded"),
                    onError: (msg) => {
                      setPresetStatus("error");
                      setPresetError(msg);
                    },
                  }
                : activePreset
                  ? {
                      basePath: activePreset.basePath,
                      glb: activePreset.glb,
                      scale: activePreset.scale,
                      onLoaded: () => setPresetStatus("loaded"),
                      onError: (msg) => {
                        setPresetStatus("error");
                        setPresetError(msg);
                      },
                    }
                  : null
            }
          />
        </div>
      </div>

      {/* RIGHT: properties + saved designs */}
      <Drawer
        side="right"
        open={rightOpen}
        active={inspector === "environment"}
        onClose={() => setRightOpen(false)}
        title="Тохиргоо"
      >
        <nav
          className="room-environment-tabs"
          aria-label="Өрөөний тохиргооны хэсэг"
        >
          {(
            [
              { id: "room", label: "Өрөө", Icon: House },
              { id: "surfaces", label: "Материал", Icon: Paintbrush },
              { id: "openings", label: "Хаалга, цонх", Icon: DoorOpen },
              { id: "lighting", label: "Гэрэл", Icon: Lightbulb },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-pressed={environmentTab === id}
              onClick={() => {
                endEdit();
                setEnvironmentTab(id);
                setPlacementTemplate(null);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {environmentTab !== "room" && (
          <>
            {(activePreset || localFile) && (
              <div className="room-custom-notice">
                <p>Өрөөг тохируулахын тулд үндсэн өрөө рүү шилжинэ үү.</p>
                <button
                  className="room-secondary-action"
                  onClick={() => {
                    setActivePreset(null);
                    setLocalFile(null);
                    setLocalUrl(null);
                  }}
                >
                  Үндсэн өрөөг харуулах
                </button>
              </div>
            )}
            <RoomEnvironmentPanel
              key={`${current.id}:${current.activeRoomId}:${environmentTab}`}
              design={current}
              tab={environmentTab}
              surface={surface}
              onSurfaceChange={setSurface}
              selectedWall={selectedWall}
              onSelectWall={selectWall}
              selectedOpening={selectedOpening}
              onSelectOpening={selectOpening}
              placementTemplate={placementTemplate}
              onArmPlacement={armPlacement}
              onAddOpening={addOpening}
              onUpdateOpening={changeOpening}
              onUpdate={(patch) => {
                updateRoom(patch);
                setShowStartHint(false);
                setActivePreset(null);
                setLocalFile(null);
                setLocalUrl(null);
              }}
              onHeight={(height) => {
                if (!Number.isFinite(height) || height < 2.4 || height > 3) {
                  setNotice("Таазны өндөр 240–300 см байна.");
                  return;
                }
                const issue = applyRoomShape({
                  width: current.width,
                  depth: current.depth,
                  height,
                });
                if (issue) setNotice(issue);
              }}
              onNotice={setNotice}
              beginEdit={beginEdit}
              endEdit={endEdit}
            />
          </>
        )}
        <div hidden={environmentTab !== "room"}>
          <div className="border-b border-[#293C32]/10 p-4">
            <p className="label mb-2">Загвар</p>
            <input
              aria-label="Загварын нэр"
              value={current.name}
              onFocus={beginEdit}
              onBlur={endEdit}
              onChange={(e) => updateRoom({ name: e.target.value })}
              className="input !py-2"
            />
            <div className="mt-3 flex items-center gap-2">
              <input
                aria-label="Хадгалах загварын нэр"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Дараах нэрээр хадгалах…"
                className="input !py-2"
              />
              <button
                onClick={save}
                aria-label="Загвар хадгалах"
                className="btn-primary !py-2.5 !px-4"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="planner-storage-note">
              Ажлын явц энэ төхөөрөмж дээр автоматаар үлдэнэ. Хадгалсан
              хувилбараа доороос нээнэ.
            </p>
          </div>

          <div className="border-b border-[#293C32]/10 p-4">
            <section className="planner-rooms" aria-label="Өрөөнүүд">
              <p className="label mb-3">
                Өрөөнүүд · {current.rooms?.length ?? 1}
              </p>
              <label className="planner-number">
                <span>Тохируулах өрөө</span>
                <select
                  value={current.activeRoomId ?? ""}
                  onChange={(event) => selectRoom(event.target.value)}
                >
                  {current.rooms?.map((room) => (
                    <option value={room.id} key={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="planner-number">
                <span>Өрөөний нэр</span>
                <input
                  value={current.roomName ?? ""}
                  onFocus={beginEdit}
                  onBlur={endEdit}
                  onChange={(event) =>
                    updateRoom({ roomName: event.target.value })
                  }
                />
              </label>
              <label className="planner-number">
                <span>Өрөөний төрөл</span>
                <select
                  value={current.roomType ?? "living"}
                  onChange={(event) =>
                    updateRoom({ roomType: event.target.value as RoomType })
                  }
                >
                  {Object.entries(ROOM_TYPES).map(([type, option]) => (
                    <option key={type} value={type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="planner-add-room">
                <label className="planner-number">
                  <span>Нэмэх өрөө</span>
                  <select
                    value={newRoomType}
                    onChange={(event) =>
                      setNewRoomType(event.target.value as RoomType)
                    }
                  >
                    {Object.entries(ROOM_TYPES).map(([type, option]) => (
                      <option key={type} value={type}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    addRoom(newRoomType);
                    setLeftOpen(false);
                    setRightOpen(false);
                    setShowRoomGeometry(true);
                  }}
                >
                  <Plus size={16} /> Нэмэх
                </button>
              </div>
              <p className="room-shape-help">
                Өрөө бүрийн хэмжээ, хана, өнгө, тавилга тусдаа хадгалагдана. Нэг
                төрлийн хэд хэдэн өрөө нэмж болно.
              </p>
              {current.roomType === "kitchen" && (
                <Link className="planner-kitchen-link" href="/kitchen">
                  Гарнитур төлөвлөх <ArrowRight size={15} />
                </Link>
              )}
            </section>
            <button
              type="button"
              className="room-geometry-trigger"
              aria-haspopup="dialog"
              onClick={() => setShowRoomGeometry(true)}
            >
              <Ruler size={20} />
              <span>
                <strong>Өрөөний бодит хэмжээ, хэлбэр</strong>
                <small>
                  {Math.round(current.width * 1000)} ×{" "}
                  {Math.round(current.depth * 1000)} мм ·{" "}
                  {geometry.area.toFixed(2)} м²
                </small>
                <small>
                  Ханын хэсэг {current.wallFeatures?.length ?? 0} · Багана{" "}
                  {current.columns?.length ?? 0}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button
              className="room-secondary-action mt-4"
              onClick={() => setEnvironmentTab("surfaces")}
            >
              <Paintbrush size={16} /> Шал, хана, таазны материал
            </button>
          </div>

          {selectedPiece && selectedDetails ? (
            <div className="border-b border-[#293C32]/10 p-4">
              <p className="label mb-3">Сонгосон</p>

              <div className="flex gap-3">
                {selectedProduct ? (
                  <Image
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    width={56}
                    height={56}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : selectedDbModel?.thumbnailFile ? (
                  <Image
                    src={`/api/models/files/${selectedDbModel.fileModelId ?? selectedDbModel.id}/${selectedDbModel.thumbnailFile}`}
                    alt={selectedDbModel.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg bg-[#EEEEE7]">
                    <Sparkles className="h-5 w-5 text-[#AD6547]/50" />
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium">{selectedDetails.name}</p>
                  <p className="mt-1 text-xs">
                    {selectedPiece.kitchen
                      ? "Өөрийн гарнитур"
                      : stockLabel(selectedProduct ?? selectedDbModel ?? {})}
                  </p>
                  <p className="font-mono text-xs text-[#6C726B]">
                    {selectedDetails.basePrice > 0
                      ? formatPrice(getPiecePrice(selectedPiece))
                      : "Үнэ тогтоогдоогүй"}
                  </p>
                </div>
              </div>
              {showDimensions && measurements.length > 0 && (
                <section
                  className="planner-measure-details"
                  aria-label="Сонгосон тавилгын хэмжээс"
                >
                  <h3>Хэмжээ ба зай · см</h3>
                  <dl>
                    {measurements.map((item) => (
                      <div key={item.id}>
                        <dt>{item.label}</dt>
                        <dd>{formatMeasurement(item.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    Ханын зайг тавилгын гадна хүрээнээс хэмжинэ. Багана урд нь
                    байвал багана хүртэлх зай гарна.
                  </p>
                </section>
              )}
              <div className="planner-transform">
                <p className="label">Байрлал · өрөөний төвөөс</p>
                <div className="planner-fields">
                  <NumberControl
                    label="X · метр"
                    value={selectedPiece.x}
                    min={geometry.bounds.minX}
                    max={geometry.bounds.maxX}
                    step={0.1}
                    onCommit={(x) => transformSelected({ x })}
                  />
                  <NumberControl
                    label="Z · метр"
                    value={selectedPiece.z}
                    min={geometry.bounds.minZ}
                    max={geometry.bounds.maxZ}
                    step={0.1}
                    onCommit={(z) => transformSelected({ z })}
                  />
                </div>
                <NumberControl
                  label="Эргэлт · градус"
                  value={
                    Math.round(
                      ((selectedPiece.rotation * 180) / Math.PI) * 100,
                    ) / 100
                  }
                  min={0}
                  max={360}
                  step={15}
                  onCommit={(degrees) =>
                    transformSelected({
                      rotation: ((degrees % 360) * Math.PI) / 180,
                    })
                  }
                />
                <div className="planner-nudge" aria-label="10 см шилжүүлэх">
                  <button
                    aria-label="Зүүн тийш 10 см"
                    onClick={() => nudge(-0.1, 0)}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    aria-label="Хойш 10 см"
                    onClick={() => nudge(0, -0.1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <span>10 см</span>
                  <button
                    aria-label="Урагш 10 см"
                    onClick={() => nudge(0, 0.1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    aria-label="Баруун тийш 10 см"
                    onClick={() => nudge(0.1, 0)}
                  >
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="planner-fields">
                  <button
                    className="btn-ghost !px-2 !py-2"
                    onClick={duplicateSelected}
                  >
                    <Copy size={15} /> Хуулах
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-2 text-red-700"
                    onClick={removeSelected}
                  >
                    <Trash2 size={15} /> Устгах
                  </button>
                </div>
              </div>
              {selectedPiece.kitchen ? (
                <p className="mt-4 text-xs leading-5">
                  Бодит хэмжээгээр байрласан гарнитур.{" "}
                  <Link
                    className="underline"
                    href={`/kitchen?design=${selectedPiece.kitchen.id}`}
                  >
                    Гарнитурын тохиргоог нээх →
                  </Link>
                  <br />
                  Зассан хувилбарыг хадгалж, Өөрийн загвараас дахин оруулна.
                </p>
              ) : (
                <>
                  <p className="label mb-2 mt-4">Өнгө</p>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetails.colors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        aria-label={color.name}
                        aria-pressed={selectedPiece.color === color.id}
                        onClick={() =>
                          updatePieces(
                            current.pieces.map((piece) =>
                              piece.instanceId === selectedPiece.instanceId
                                ? { ...piece, color: color.id }
                                : piece,
                            ),
                          )
                        }
                        style={{ background: color.hex }}
                        className={cn(
                          "h-7 w-7 rounded-full border-2",
                          selectedPiece.color === color.id
                            ? "border-[#293C32]"
                            : "border-white",
                        )}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <p className="label mb-2 mt-4">Материал</p>

                  <div className="flex flex-wrap gap-2">
                    {selectedDetails.materials.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() =>
                          updatePieces(
                            current.pieces.map((piece) =>
                              piece.instanceId === selectedPiece.instanceId
                                ? { ...piece, material: material.id }
                                : piece,
                            ),
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          selectedPiece.material === material.id
                            ? "border-[#293C32] bg-[#293C32] text-white"
                            : "border-[#293C32]/15 bg-white text-[#6C726B] hover:border-[#293C32]/40",
                        )}
                      >
                        {material.name}
                        {material.priceDelta > 0 &&
                          ` (+${formatPrice(material.priceDelta)})`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="border-b border-[#293C32]/10 p-4 text-xs text-[#737D6C]">
              Тавилга дээр дарж тохиргоог нь өөрчилнө үү.
            </div>
          )}

          <section className="planner-object-list">
            <p className="label">
              <Layers size={15} /> Өрөөн дэх тавилга · {current.pieces.length}
            </p>
            {!current.pieces.length && (
              <p className="planner-empty">Одоогоор тавилга нэмээгүй байна.</p>
            )}
            {current.pieces.map((piece, index) => (
              <button
                key={piece.instanceId}
                aria-pressed={selected === piece.instanceId}
                onClick={() => {
                  setSelected(piece.instanceId);
                  setRightOpen(true);
                }}
              >
                <span className="planner-object-number">{index + 1}</span>
                <span>
                  <strong>
                    {piece.kitchen?.name ??
                      getProduct(piece.productId)?.name ??
                      getDbPieceModel(piece)?.name ??
                      "Тавилга"}
                  </strong>
                  <small>
                    {piece.kitchen
                      ? "Өөрийн гарнитур · бодит хэмжээ"
                      : formatPrice(getPiecePrice(piece))}
                  </small>
                </span>
                <Move size={14} />
              </button>
            ))}
          </section>
          <details className="planner-advanced">
            <summary>Нэмэлт · 3D файл оруулах</summary>
            <div className="planner-advanced-fields">
              <select
                value={
                  ROOM_DIMENSIONS[current.size].w === current.width &&
                  ROOM_DIMENSIONS[current.size].d === current.depth
                    ? current.size
                    : "custom"
                }
                onChange={(e) => resizeRoom(e.target.value as RoomSize)}
                className="rounded-full border border-[#293C32]/10 bg-white/90 px-3 py-2 text-xs font-medium backdrop-blur"
              >
                <option value="custom" disabled>
                  Өөрийн хэмжээ · {current.width} × {current.depth} м
                </option>
                {ROOM_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {allPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => togglePreset(preset)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition",
                    activePreset?.id === preset.id
                      ? "border-[#AD6547] bg-[#AD6547] text-[#FFFFFF]"
                      : "border-[#293C32]/10 bg-white/90 text-[#6C726B]",
                  )}
                  title="GLB загварыг ачаалах"
                >
                  <Sparkles className="h-3 w-3" />
                  {activePreset?.id === preset.id ? "Идэвхтэй" : preset.label}
                </button>
              ))}
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition",
                  localFile
                    ? "border-[#AD6547] bg-[#AD6547] text-[#FFFFFF]"
                    : "border-[#293C32]/10 bg-white/90 text-[#6C726B]",
                )}
                title="Компьютероосоо GLB файл сонгож турших"
              >
                <Upload className="h-3 w-3" />
                <span className="max-w-[110px] truncate">
                  {localFile ? localFile.name : "Локал GLB турших"}
                </span>
                <input
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="hidden"
                  onChange={(e) =>
                    handleLocalGlbSelect(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              {localFile && (
                <>
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={localScale}
                    onChange={(e) =>
                      setLocalScale(
                        Math.min(
                          1000,
                          Math.max(0.001, parseFloat(e.target.value) || 0.001),
                        ),
                      )
                    }
                    title="Масштаб (scale)"
                    className="w-16 rounded-full border border-[#293C32]/10 bg-white/90 px-2 py-2 text-center text-xs font-mono backdrop-blur"
                  />
                  <button
                    onClick={() => handleLocalGlbSelect(null)}
                    title="Локал файлыг цуцлах"
                    className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-50 px-2 py-2 text-xs font-medium text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
            <p>Оруулсан GLB файл зөвхөн энэ удаагийн харагдацад ашиглагдана.</p>
          </details>
          <details className="planner-advanced">
            <summary>Гарын товчлол</summary>
            <p>
              Ctrl / ⌘ + Z — буцаах
              <br />
              Ctrl / ⌘ + Shift + Z — дахин хийх
              <br />
              Ctrl / ⌘ + D — тавилга хуулах
              <br />
              Ctrl / ⌘ + S — хадгалах
              <br />
              Сумнууд — 10 см шилжүүлэх
              <br />R — 90° эргүүлэх · Delete — устгах
              <br />
              Esc — сонголт цуцлах
            </p>
          </details>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="label">Хадгалсан загвар · {designs.length}</p>
              {designs.length >= 2 && (
                <button
                  onClick={() => setShowCompare(true)}
                  disabled={
                    designs.filter((design) => compareIds.includes(design.id))
                      .length < 2
                  }
                  title="Доороос 2–4 загвар сонгож харьцуулна"
                  className="text-xs font-medium text-[#AD6547] hover:underline"
                >
                  <Layers className="mr-1 inline h-3 w-3" /> Харьцуулах
                </button>
              )}
            </div>
            {designs.length === 0 && (
              <p className="rounded-lg bg-[#293C32]/5 p-4 text-xs text-[#6C726B]">
                Анхны загвараа хадгалснаар хэд хэдэн байрлалыг харьцуулах
                боломжтой.
              </p>
            )}
            <div className="space-y-2">
              {designs.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    "rounded-lg border bg-white p-3",
                    current.id === d.id
                      ? "border-[#AD6547]"
                      : "border-[#293C32]/10 hover:border-[#293C32]/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-[#6C726B]">
                        {d.rooms?.length ?? 1} өрөө ·{" "}
                        {d.roomName ?? "Зочны өрөө"} ·{" "}
                        {getRoomGeometry(d).area.toFixed(1)} м²
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => loadDesign(d.id)}
                        className="rounded-md p-1.5 hover:bg-[#293C32]/5"
                        title="Нээх"
                      >
                        <Maximize className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => duplicateDesign(d.id)}
                        className="rounded-md p-1.5 hover:bg-[#293C32]/5"
                        title="Хуулах"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteDesign(d.id)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        title="Устгах"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`${d.name} загварыг харьцуулах`}
                      checked={compareIds.includes(d.id)}
                      onChange={(e) =>
                        setCompareIds(
                          e.target.checked
                            ? [...compareIds, d.id].slice(-4)
                            : compareIds.filter((id) => id !== d.id),
                        )
                      }
                      className="accent-[#AD6547]"
                    />
                    <span className="text-xs text-[#6C726B]">
                      Харьцуулахаар сонгох
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#293C32]/10 p-4">
            <button
              onClick={() => {
                createNew("80", "Шинэ загвар", "living");
                setLeftOpen(false);
                setRightOpen(false);
                setShowRoomGeometry(true);
              }}
              className="btn-ghost w-full"
            >
              <Plus className="h-4 w-4" /> Шинэ загвар үүсгэх
            </button>
          </div>
        </div>
      </Drawer>

      {showRoomGeometry && (
        <RoomGeometryModal
          key={`${current.id}:${current.activeRoomId}`}
          room={current}
          onApply={applyRoomShape}
          onClose={() => setShowRoomGeometry(false)}
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      )}
      {showCompare && (
        <CompareModal
          designs={designs.filter((d) => compareIds.includes(d.id))}
          onClose={() => setShowCompare(false)}
          onLoad={(id) => {
            loadDesign(id);
            setShowCompare(false);
          }}
        />
      )}
    </div>
  );
}

/** Sidebar that's a static column on desktop, slide-over drawer on mobile. */

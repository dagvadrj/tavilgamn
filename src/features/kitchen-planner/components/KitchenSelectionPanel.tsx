"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ArrowLeft, ArrowLeftRight, Box, Check, ChevronRight, Copy, DoorOpen,
  Move, Paintbrush, Pencil, RotateCw, Search, Trash2, X, ZoomIn,
} from "lucide-react";
import { cabinetLabel, type CabinetPose, type ModularCabinet } from "@/lib/kitchenCabinets";
import { similarKitchenVariants, type KitchenCatalogModule, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { getKitchenGlbAssembly, resolveKitchenPartOption } from "@/lib/kitchenGlbAssembly";
import { prefetchModel } from "@/lib/modelPrefetch";
import "./kitchen-selection.css";

type PanelMode = "overview" | "modify" | "replace" | "position";
type PanelView = PanelMode | "style";

export type KitchenSelectionPanelProps = {
  cabinet: ModularCabinet;
  variant?: KitchenCatalogVariant;
  modules: KitchenCatalogModule[];
  onChangeSelections: (selections: Record<string, string>) => void;
  onReplace: (module: KitchenCatalogModule, variant: KitchenCatalogVariant) => void;
  onPositionChange: (position: CabinetPose) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onZoom: () => void;
  onToggleOpen: () => void;
  isOpen?: boolean;
  disabled?: boolean;
  initialMode?: PanelMode;
};

function ProductImage({ url, name, size = "small" }: { url?: string | null; name: string; size?: "small" | "large" }) {
  const [failed, setFailed] = useState(false);
  return <span className={`ksp-image ksp-image--${size}`}>
    {url && !failed
      ? <Image src={url} alt={name} fill sizes={size === "large" ? "150px" : "56px"} unoptimized onError={() => setFailed(true)} />
      : <Box size={size === "large" ? 32 : 22} aria-hidden="true" />}
  </span>;
}

function Action({ icon: Icon, label, title, onClick, active, disabled, danger }: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string; title: string; onClick: () => void; active?: boolean; disabled?: boolean; danger?: boolean;
}) {
  return <button type="button" className={`ksp-action${danger ? " ksp-action--danger" : ""}`}
    title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick}>
    <Icon size={18} aria-hidden={true} /><span>{label}</span>
  </button>;
}

function PositionField({ label, value, unit, onCommit, disabled, min }: {
  label: string; value: number; unit: string; onCommit: (value: number) => void; disabled: boolean; min?: number;
}) {
  return <label className="ksp-position-field"><span>{label}</span><span className="ksp-input-unit">
    <input type="number" defaultValue={Math.round(value * 10) / 10} min={min} step={1} disabled={disabled}
      onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next) && (min === undefined || next >= min) && next !== value) onCommit(next);
        event.currentTarget.value = String(Math.round(value * 10) / 10);
      }} /><span>{unit}</span>
  </span></label>;
}

/** A product action bar sits above the left detail drawer. */
export function KitchenSelectionPanel({
  cabinet, variant, modules, onChangeSelections, onReplace, onPositionChange,
  onClose, onDuplicate, onRemove, onZoom, onToggleOpen,
  isOpen = false, disabled = false, initialMode = "overview",
}: KitchenSelectionPanelProps) {
  const [view, setView] = useState<PanelView>(initialMode);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const assembly = useMemo(() => getKitchenGlbAssembly(variant?.configuration), [variant?.configuration]);
  const slots = assembly?.slots ?? [];
  const selectedSlot = slots.find(slot => slot.id === slotId);
  const selections = cabinet.partSelections ?? {};
  const name = variant?.modelName || cabinetLabel(cabinet);
  const hasMotion = slots.some(slot => Boolean(slot.motion)) || Boolean(assembly?.openAnimation) ||
    (typeof variant?.configuration.openAnimation === "string" && Boolean(variant.configuration.openAnimation.trim()));
  const alternatives = useMemo(() => similarKitchenVariants(modules, cabinet, Number.MAX_SAFE_INTEGER), [modules, cabinet]);
  const exactAlternatives = alternatives.filter(({ module, variant: item }) =>
    module.widthMm === cabinet.width && module.heightMm === cabinet.height && module.depthMm === cabinet.depth &&
    item.opening === (cabinet.opening ?? "doors"));
  const modelChoices = view === "replace" ? alternatives : exactAlternatives;
  const queryLower = query.trim().toLocaleLowerCase();
  const filteredModels = modelChoices.filter(({ module, variant: item }) =>
    `${module.name} ${module.code} ${item.modelName} ${item.variantCode}`.toLocaleLowerCase().includes(queryLower));
  const filteredOptions = selectedSlot?.options.filter(option =>
    `${option.label} ${option.style ?? ""} ${option.color ?? ""}`.toLocaleLowerCase().includes(queryLower)) ?? [];

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [view, slotId]);

  function navigate(next: PanelView, nextSlot: string | null = null) {
    setQuery("");
    setSlotId(nextSlot);
    setView(next);
  }
  function back() {
    if (view === "style") navigate("modify");
    else if (view !== "overview") navigate("overview");
    else onClose();
  }
  function choosePart(optionId: string) {
    if (selectedSlot) onChangeSelections({ ...selections, [selectedSlot.id]: optionId });
  }
  function prefetch(url?: string | null) { if (url) void prefetchModel(url); }

  const viewTitle = view === "style" ? "Загвар / Өнгө" : view === "replace" ? "Тавилга солих" :
    view === "position" ? "Байрлал" : view === "modify" ? "Тавилга өөрчлөх" : "Сонгосон тавилга";
  const openTitle = hasMotion ? (isOpen ? "Хаалга, шургуулгыг хаах" : "Хаалга, шургуулгыг нээх") :
    "Энэ загвар нээх хөдөлгөөнгүй";

  return <section className="kitchen-selection-panel" data-view={view} aria-label="Тавилгын удирдлага"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); back(); } }}>
    <div className="ksp-controller">
      <header className="ksp-controller-heading">
        <strong>{variant?.variantCode || cabinetLabel(cabinet)}</strong>
        <button type="button" className="ksp-icon-button" onClick={onClose} aria-label="Тавилгын удирдлагыг хаах" title="Хаах"><X size={16} /></button>
      </header>
      <div className="ksp-product">
        <ProductImage key={variant?.thumbnailUrl} url={variant?.thumbnailUrl} name={name} />
        <div><span className="ksp-product-code">{variant?.variantCode || cabinetLabel(cabinet)}</span><h3>{name}</h3>
          <p>{cabinet.width} × {cabinet.depth} × {cabinet.height} мм <span>Ө × Г × Өн</span></p>
        </div>
      </div>
      <div className="ksp-actions" role="group" aria-label="Тавилгын үйлдлүүд">
        <Action icon={Pencil} label="Өөрчлөх" title="Тавилгын хэсэг, загвар, өнгийг өөрчлөх" active={view === "modify"} disabled={disabled} onClick={() => navigate("modify")} />
        <Action icon={ArrowLeftRight} label="Солих" title="Өөр тавилгаар солих" disabled={disabled} onClick={() => navigate("replace")} />
        <Action icon={DoorOpen} label={isOpen ? "Хаах" : "Нээх"} title={openTitle} disabled={disabled || !hasMotion} active={isOpen} onClick={onToggleOpen} />
        <Action icon={ZoomIn} label="Ойртуулах" title="Сонгосон тавилга руу ойртуулах" onClick={onZoom} />
        <Action icon={Move} label="Байрлал" title="Байрлал, эргэлтийг өөрчлөх" active={view === "position"} disabled={disabled} onClick={() => navigate("position")} />
        <Action icon={Copy} label="Хувилах" title="Тавилгыг хувилах" disabled={disabled} onClick={onDuplicate} />
        <Action icon={Trash2} label="Хасах" title="Тавилгыг хасах" disabled={disabled} danger onClick={onRemove} />
      </div>
    </div>

    <header className="ksp-header">
      {view !== "overview" && <button type="button" className="ksp-icon-button" onClick={back} aria-label="Буцах" title="Буцах"><ArrowLeft size={17} /></button>}
      <h2 ref={headingRef} tabIndex={-1}>{viewTitle}</h2>
    </header>

    <div className="ksp-scroll">
      {!hasMotion && view === "overview" && <p className="ksp-action-hint">Энэ загвар нээх хөдөлгөөнгүй.</p>}
      {(view === "overview" || view === "modify") && <>
        <div className="ksp-section-heading"><h3>{view === "modify" ? "Хэсэг бүрийг өөрчлөх" : "Тавилгын хэсгүүд"}</h3>{slots.length > 0 && <span>{slots.length}</span>}</div>
        <div className="ksp-option-list">
          <button type="button" className="ksp-option ksp-option--whole" disabled={disabled} onClick={() => navigate("style")}>
            <span className="ksp-option-icon"><Paintbrush size={20} /></span>
            <span className="ksp-option-info"><strong>Загвар / Өнгө</strong><span>Тавилгын бэлэн хувилбар</span></span><ChevronRight size={16} />
          </button>
          {slots.map(slot => {
            const choice = resolveKitchenPartOption(slot, selections);
            return <div className="ksp-part-row" key={slot.id}>
              <button type="button" className="ksp-option" disabled={disabled} onClick={() => navigate("style", slot.id)}>
                <ProductImage key={choice?.thumbnailUrl} url={choice?.thumbnailUrl} name={choice?.label || slot.label} />
                <span className="ksp-option-info"><strong>{slot.label}</strong><span>{choice?.label || "Сонгоогүй"}</span>
                  {choice && (choice.style || choice.color) && <small>{[choice.style, choice.color].filter(Boolean).join(" · ")}</small>}
                </span><ChevronRight size={15} />
              </button>
              {slot.optional && choice && <button type="button" className="ksp-part-remove" title={`${slot.label} хасах`} aria-label={`${slot.label} хасах`} disabled={disabled}
                onClick={() => onChangeSelections({ ...selections, [slot.id]: "" })}><Trash2 size={15} /></button>}
            </div>;
          })}
        </div>
        {!slots.length && <p className="ksp-note">Энэ тавилгын хэсгүүдийг тусад нь солих боломжгүй. Загвар / Өнгө сонголтоос бэлэн хувилбар сонгоорой.</p>}
        {view === "overview" && <button type="button" className="ksp-primary" disabled={disabled} onClick={() => navigate("modify")}><Pencil size={16} />Тавилга өөрчлөх</button>}
        <div className="ksp-dimensions"><h3>Хэмжээ</h3><dl><div><dt>Өргөн</dt><dd>{cabinet.width} мм</dd></div><div><dt>Гүн</dt><dd>{cabinet.depth} мм</dd></div><div><dt>Өндөр</dt><dd>{cabinet.height} мм</dd></div></dl></div>
      </>}

      {(view === "style" || view === "replace") && <>
        <div className="ksp-choice-intro"><p>{view === "replace" ? "Шинэ тавилга сонгоно уу" : selectedSlot?.label || "Тавилгын бэлэн хувилбар"}</p>
          {view === "replace" && <small>Сонгосон тавилгын хэмжээ шинэ загварт таарна.</small>}
        </div>
        <label className="ksp-search"><Search size={18} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Нэр, загвар, өнгөөр хайх…" aria-label="Тавилга эсвэл хэсгийн загвар хайх" />
          {query && <button type="button" aria-label="Хайлтыг цэвэрлэх" onClick={() => setQuery("")}><X size={16} /></button>}
        </label>
        <div className="ksp-result-count" role="status">{selectedSlot ? filteredOptions.length : filteredModels.length} сонголт</div>
        <div className="ksp-choice-list" aria-label={selectedSlot?.label || viewTitle}>
          {selectedSlot?.optional && !query && <button type="button" className="ksp-none-choice" aria-pressed={!resolveKitchenPartOption(selectedSlot, selections)} disabled={disabled} onClick={() => choosePart("")}>
            <span>Энэ хэсэггүй</span>{!resolveKitchenPartOption(selectedSlot, selections) && <Check size={18} />}
          </button>}
          {selectedSlot ? filteredOptions.map(option => {
            const selected = resolveKitchenPartOption(selectedSlot, selections)?.id === option.id;
            const available = Boolean(option.glbFile || option.glbUrl);
            return <button type="button" className="ksp-choice" key={option.id} aria-pressed={selected} disabled={disabled || !available}
              title={!available ? "Энэ загвар одоогоор бэлэн биш" : undefined}
              onClick={() => choosePart(option.id)} onPointerEnter={() => prefetch(option.glbUrl)} onFocus={() => prefetch(option.glbUrl)}>
              <ProductImage key={option.thumbnailUrl} url={option.thumbnailUrl} name={option.label} size="large" />
              <span className="ksp-choice-info"><strong>{option.label}</strong>{option.style && <span>{option.style}</span>}{option.color && <span>{option.color}</span>}
                {!available && <small>Түр боломжгүй</small>}{selected && <small className="ksp-selected-label">Сонгосон</small>}
              </span>{selected && <span className="ksp-check"><Check size={15} /></span>}
            </button>;
          }) : filteredModels.map(({ module, variant: item }) => {
            const selected = item.furnitureModelId === cabinet.variantId;
            return <button type="button" className="ksp-choice" key={item.furnitureModelId} aria-pressed={selected} disabled={disabled}
              onClick={() => { onReplace(module, item); if (view === "replace") navigate("overview"); }}
              onPointerEnter={() => prefetch(item.previewGlbUrl || item.glbUrl)} onFocus={() => prefetch(item.previewGlbUrl || item.glbUrl)}>
              <ProductImage key={item.thumbnailUrl} url={item.thumbnailUrl} name={item.modelName || module.name} size="large" />
              <span className="ksp-choice-info"><strong>{item.modelName || module.name}</strong><span>{item.variantCode}</span><small>{module.widthMm} × {module.depthMm} × {module.heightMm} мм</small>
                {selected && <small className="ksp-selected-label">Сонгосон</small>}
              </span>{selected && <span className="ksp-check"><Check size={15} /></span>}
            </button>;
          })}
        </div>
        {(selectedSlot ? !filteredOptions.length : !filteredModels.length) && <div className="ksp-empty"><Box size={28} /><p>{query ? "Хайлтад тохирох сонголт алга." : "Одоогоор сонгох бэлэн загвар алга."}</p>
          {query && <button type="button" onClick={() => setQuery("")}>Хайлтыг цэвэрлэх</button>}
        </div>}
      </>}

      {view === "position" && <>
        <div className="ksp-section-heading"><h3>Өрөөн дэх байрлал</h3></div>
        <p className="ksp-note">Тавилгыг зураг дээр чирж эсвэл доорх хэмжээгээр байрлуулаарай.</p>
        <div className="ksp-position-grid">
          <PositionField key={`x-${cabinet.position.x}`} label="Зүүнээс (X)" value={cabinet.position.x} unit="мм" disabled={disabled} onCommit={x => onPositionChange({ ...cabinet.position, x })} />
          <PositionField key={`z-${cabinet.position.z}`} label="Хойноос (Z)" value={cabinet.position.z} unit="мм" disabled={disabled} onCommit={z => onPositionChange({ ...cabinet.position, z })} />
          {cabinet.type === "wall" && <PositionField key={`y-${cabinet.position.y}`} label="Шалнаас" value={cabinet.position.y} unit="мм" min={0} disabled={disabled} onCommit={y => onPositionChange({ ...cabinet.position, y })} />}
          <PositionField key={`rotation-${cabinet.position.rotation}`} label="Эргэлт" value={cabinet.position.rotation * 180 / Math.PI} unit="°" disabled={disabled} onCommit={degrees => onPositionChange({ ...cabinet.position, rotation: degrees * Math.PI / 180 })} />
        </div>
        <button type="button" className="ksp-secondary" disabled={disabled} onClick={() => onPositionChange({ ...cabinet.position, rotation: cabinet.position.rotation + Math.PI / 2 })}><RotateCw size={17} />90° эргүүлэх</button>
      </>}
    </div>
  </section>;
}

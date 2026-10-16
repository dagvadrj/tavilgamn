"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { RoomBuilder } from "./RoomBuilder";
import { createRoomBuilderDraft } from "@/lib/roomBuilderDraft";
import { KitchenSuggestionWizard } from "@/components/KitchenSuggestionWizard";
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ChefHat,
  House,
  Monitor,
  PencilRuler,
  Ruler,
  Shapes,
} from "lucide-react";
import { RoomMeasureUnit, useRoomMeasureUnit } from "./RoomMeasureUnit";
import { OpeningQuickEditor } from "./OpeningQuickEditor";
import { RoomPlanPreview } from "@/components/RoomPlanPreview";
import { createOpening, validateRoomOpenings } from "@/lib/roomOpenings";
import type { RoomOpening, WallFeature, RoomShape } from "@/lib/types";
import type { RoomType } from "@/lib/types";
import { ROOM_TYPES, getRoomGeometry } from "@/lib/roomGeometry";
import {
  ROOM_SIZE_SUGGESTIONS,
  suggestedRoomIndex,
  validateRoomSetup,
  roomSetupNumber,
  type RoomSetupDimensions,
} from "@/lib/roomSetup";
import "./room-planner-start.css";
import { RoomFurnishingPicker } from "@/components/RoomFurnishingPicker";
import type { AddRoomOptions } from "@/lib/addRoomOptions";

const ROOM_CHOICES = [
  {
    type: "living",
    Icon: Armchair,
    description: "Буйдан, ширээ, зурагтын хэсэг",
    tone: "sand",
  },
  {
    type: "bedroom",
    Icon: BedDouble,
    description: "Ор, хувцасны шүүгээ, амрах орчин",
    tone: "rose",
  },
  {
    type: "kitchen",
    Icon: ChefHat,
    description: "Гарнитур, хоол хийх ба идэх хэсэг",
    tone: "sage",
  },
  {
    type: "office",
    Icon: Monitor,
    description: "Ажлын ширээ, сандал, номын тавиур",
    tone: "blue",
  },
  {
    type: "bathroom",
    Icon: Bath,
    description: "Угаалгын өрөөний зайгаа төлөвлөх",
    tone: "aqua",
  },
  {
    type: "other",
    Icon: Shapes,
    description: "Өөр зориулалттай өрөөг тохижуулах",
    tone: "lilac",
  },
] as const;

export function RoomPlannerStart({
  onStart,
  draft,
  onResume,
  designs = [],
  onOpen,
  onDelete,
}: {
  onStart: (
    type: RoomType,
    dimensions: RoomSetupDimensions,
    options?: AddRoomOptions,
  ) => void;
  draft?: {
    id: string;
    name: string;
    roomName?: string;
    width: number;
    depth: number;
    previewImage?: string;
    outline?: RoomShape["outline"];
    wallFeatures?: WallFeature[];
  } | null;
  onResume: () => void;
  designs?: { id: string; name: string; width: number; depth: number }[];
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteControl = (id: string, name: string) => onDelete && (deleteId === id
    ? <div className="room-start-delete-confirm"><span>Энэ өрөөг устгах уу?</span><button type="button" onClick={() => { onDelete(id); setDeleteId(null); }}>Тийм, устгах</button><button type="button" onClick={() => setDeleteId(null)}>Болих</button></div>
    : <button type="button" className="room-start-delete" aria-label={`${name} өрөөг устгах`} onClick={() => setDeleteId(id)}>Устгах</button>);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [openings, setOpenings] = useState<RoomOpening[]>([]);
  const unit = useRoomMeasureUnit(state => state.unit);
  const factor = unit === "мм" ? 10 : 1;
  const [roomType, setRoomType] = useState<RoomType>("living");
  const [choice, setChoice] = useState<number | "custom">(
    suggestedRoomIndex("living"),
  );
  const [width, setWidth] = useState("500");
  const [depth, setDepth] = useState("400");
  const [height, setHeight] = useState("270");
  const [error, setError] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [kitchenSetup, setKitchenSetup] = useState(false);
  const [setup, setSetup] = useState({
    furnishing: "empty" as AddRoomOptions["furnishing"],
    furnitureIds: [] as string[],
    door: true,
    window: false,
  });
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [step]);

  const presets = ROOM_SIZE_SUGGESTIONS[roomType];
  const selectedSize =
    choice === "custom"
      ? { width: Number(width) / 100, depth: Number(depth) / 100 }
      : presets[choice];
  const dimensions = { ...selectedSize, height: Number(height) / 100 };
  const wallFeatures: WallFeature[] = [];
  const previewRoom = { ...dimensions, wallFeatures, openings };
  const valid = !validateRoomSetup(dimensions);
  const openingIssue = valid ? validateRoomOpenings(previewRoom) : null;
  const changeOpening = (opening: RoomOpening) => {
    const next = openings.map(o => o.id === opening.id ? opening : o);
    const issue = validateRoomOpenings({ ...previewRoom, openings: next });
    setError(issue ?? "");
    if (!issue) setOpenings(next);
  };
  const addOpening = (kind: "door" | "window") => {
    const opening = createOpening(kind === "door" ? "door-single" : "window-fixed", kind === "door" ? "south" : "east");
    for (const position of [0.5, 0.25, 0.75, 0.15, 0.85]) {
      const next = [...openings, { ...opening, position }];
      if (!validateRoomOpenings({ ...previewRoom, openings: next })) { setOpenings(next); setError(""); return; }
    }
    setError("Энэ хананд зай хүрэхгүй байна. Одоо байгаа нээлхийн хана, байрлалыг өөрчилнө үү.");
  };
  const room = ROOM_TYPES[roomType];
  function chooseType(type: RoomType) {
    const next = ROOM_TYPES[type];
    setRoomType(type);
    setChoice(suggestedRoomIndex(type));
    setWidth(String(next.width * 100));
    setDepth(String(next.depth * 100));
    setHeight("270");
    setError("");
    setStep(2);
    if (type !== "kitchen") setBuilderOpen(true);
  }
  if (builderOpen) return <RoomBuilder initial={createRoomBuilderDraft(dimensions)} onCancel={() => { setBuilderOpen(false); setStep(1); }} onComplete={draft => { try { onStart(roomType, draft, { ...draft, name:room.label, door:false, window:false, doorWall:"south", windowWall:"north", furnishing:"empty" }); return null; } catch(reason) { return (reason as Error).message; } }} />;
  if (kitchenSetup)
    return (
      <KitchenSuggestionWizard
        roomDimensions={dimensions}
        onBack={() => setKitchenSetup(false)}
      />
    );
  return (
    <section className="room-start" aria-label="Өрөөний төлөвлөгчийг эхлүүлэх">
      <header className="room-start-header">
        <Link href="/" className="room-start-brand">
          <House size={22} /> tavilga.mn
        </Link>
        <span>3D өрөөний төлөвлөгч</span>
        <Link href="/">
          Нүүр рүү буцах <ArrowRight size={16} />
        </Link>
      </header>
      <div className="room-start-body">
        {step !== 1 && <ol className="room-start-progress" aria-label="Эхлэх алхмууд">
          {(roomType === "kitchen" ? ["Гал тогоо", "Хэмжээ", "Төхөөрөмж", "2D план", "Өөрөө тохижуулах", "5 санал", "Дуусгах"] : ["Төрөл, хэлбэр", "Хэмжээ", "Хаалга, цонх", "Тавилга"]).map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{label}</li>)}
        </ol>}
        {step === 1 ? (
          <>
            {onOpen && designs.filter(design => design.id !== draft?.id).length > 0 && <details className="room-start-saved"><summary>Бусад өрөөнүүд ({designs.filter(design => design.id !== draft?.id).length})</summary>{designs.filter(design => design.id !== draft?.id).map(design => <div key={design.id} className="room-start-saved-row"><button type="button" onClick={() => onOpen(design.id)}>{design.name} · {roomSetupNumber(design.width * design.depth)} м² <ArrowRight size={16}/></button>{deleteControl(design.id, design.name)}</div>)}</details>}
            <div className="room-start-heading">
              <p>ӨӨРИЙНХӨӨ ОРЧНЫГ БҮТЭЭЕ</p>
              <h1 ref={title} tabIndex={-1}>
                Ямар өрөө тохижуулах вэ?
              </h1>
              <span>
                Өрөөний төрлөө сонгоод хэлбэр, хэмжээ болон дотор заслаа дарааллаар нь тохируулаарай.
              </span>
            </div>
            <div className="room-type-grid">
              {ROOM_CHOICES.map(({ type, Icon, description, tone }) => (
                <button
                  type="button"
                  key={type}
                  className="room-type-card"
                  onClick={() => chooseType(type)}
                >
                  <span className={`room-type-visual room-tone-${tone}`}>
                    <Icon size={46} strokeWidth={1.4} />
                    <span className="room-type-floor" />
                  </span>
                  <span className="room-type-copy">
                    <strong>{ROOM_TYPES[type].label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            {draft && (
              <article
                className="room-start-draft"
                style={{
                  display: "block",
                  width: "min(360px,100%)",
                  padding: 0,
                  overflow: "hidden",
                  marginInline: "auto",
                }}
              >
                {draft.previewImage ? (
                  <Image
                    unoptimized
                    width={768}
                    height={480}
                    src={draft.previewImage}
                    alt="Өмнөх ажлын бүх өрөөний 3D зураг"
                    style={{
                      width: "100%",
                      height: 190,
                      objectFit: "contain",
                      background: "#252c38",
                    }}
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gray-100 text-sm text-gray-500">
                    Өмнөх өрөөний загвар
                  </div>
                )}
                <div className="p-4">
                  <strong>Өмнөх ажлаа үргэлжлүүлэх</strong>
                  <p>
                    {draft.name} · {draft.roomName ?? "Өрөө"} ·{" "}
                    {roomSetupNumber(getRoomGeometry(draft).area)} м²
                  </p>
                  <button
                    type="button"
                    onClick={onResume}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      marginTop: 12,
                    }}
                  >
                    Үргэлжлүүлэх <ArrowRight size={17} />
                  </button>
                  {deleteControl(draft.id, draft.name)}
                </div>
              </article>
            )}
          </>
        ) : (
          <>
            <div className="room-start-heading">
              <p>{room.label}</p>
              <h1 ref={title} tabIndex={-1}>
                {step === 2 ? "Өрөөний хэмжээгээ сонгоорой" : step === 3 ? "Хаалга, цонхоо байрлуулаарай" : "Тавилгаа сонгоорой"}
              </h1>
              <span>
                {step === 2 ? "Жишээ хэмжээнээс сонгох эсвэл бодит хэмжээгээ өөрөө оруулж болно." : step === 3 ? "Хаалга, цонхны хэмжээ, байрлалыг тохируулаарай." : "Хоосон өрөөнөөс эхлэх эсвэл тавилга сонгоорой."}
              </span>
            </div>
            <form
              noValidate
              className="room-size-form"
              onSubmit={(event) => {
                event.preventDefault();
                const kitchenSizeIssue =
                  roomType === "kitchen" &&
                  [dimensions.width, dimensions.depth].some(
                    (value) => value < 2 || value > 8,
                  )
                    ? "Гарнитурын төлөвлөгчид өргөн, урт тус бүр 200–800 см байна."
                    : null;
                const issue = validateRoomSetup(dimensions) ?? kitchenSizeIssue;
                setError(issue ?? "");
                if (issue) return;
                if (step === 2) { if (roomType === "kitchen") setKitchenSetup(true); else setStep(3); return; }
                if (openingIssue) { setError(openingIssue); return; }
                if (step === 3) { setStep(4); return; }
                if (!issue) {
                  try {
                    onStart(roomType, dimensions, {
                      ...dimensions,
                      ...setup,
                      openings,
                      wallFeatures,
                      name: room.label,
                      doorWall: "south",
                      windowWall: "north",
                    });
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Өрөө үүсгэж чадсангүй.",
                    );
                  }
                }
              }}
            >
              <div className="room-size-layout">
                <div>
                  <div hidden={step !== 2}>
                  <RoomMeasureUnit />
                  <div
                    className="room-size-grid"
                    role="group"
                    aria-label="Өрөөний жишээ хэмжээ"
                  >
                    {presets.map((size, index) => (
                      <button
                        type="button"
                        key={index}
                        className="room-size-card"
                        aria-pressed={choice === index}
                        onClick={() => {
                          setChoice(index);
                          setWidth(String(size.width * 100));
                          setDepth(String(size.depth * 100));
                          setError("");
                        }}
                      >
                        <span className="room-size-card-top">
                          <Ruler size={18} />
                          {index === suggestedRoomIndex(roomType) && (
                            <small>Санал болгох</small>
                          )}
                          <span className="room-size-check">
                            {choice === index && <Check size={14} />}
                          </span>
                        </span>
                        <strong>
                          {roomSetupNumber(size.width * size.depth)}{" "}
                          <span>м²</span>
                        </strong>
                        <span>
                          {roomSetupNumber(size.width)} ×{" "}
                          {roomSetupNumber(size.depth)} м
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="room-size-custom"
                    aria-pressed={choice === "custom"}
                    aria-expanded={choice === "custom"}
                    onClick={() => {
                      setChoice("custom");
                      setError("");
                    }}
                  >
                    <PencilRuler size={23} />
                    <span>
                      <strong>Өөрийн хэмжээ оруулах</strong>
                      <small>Өргөн, урт, таазны өндрөө тохируулах</small>
                    </span>
                    <span className="room-size-check">
                      {choice === "custom" && <Check size={14} />}
                    </span>
                  </button>
                  {choice === "custom" && (
                    <div className="room-size-fields">
                      <label>
                        <span>Өргөн · {unit}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={100 * factor}
                          max={2000 * factor}
                          step={1}
                          value={width === "" ? "" : Number(width) * factor}
                          onChange={(event) => {
                            setWidth(event.target.value === "" ? "" : String(Number(event.target.value) / factor));
                            setError("");
                          }}
                          placeholder="Жишээ: 400"
                        />
                      </label>
                      <label>
                        <span>Урт · {unit}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={100 * factor}
                          max={2000 * factor}
                          step={1}
                          value={depth === "" ? "" : Number(depth) * factor}
                          onChange={(event) => {
                            setDepth(event.target.value === "" ? "" : String(Number(event.target.value) / factor));
                            setError("");
                          }}
                          placeholder="Жишээ: 300"
                        />
                      </label>
                      <label>
                        <span>Таазны өндөр · {unit}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={240 * factor}
                          max={300 * factor}
                          step={1}
                          value={height === "" ? "" : Number(height) * factor}
                          onChange={(event) => {
                            setHeight(event.target.value === "" ? "" : String(Number(event.target.value) / factor));
                            setError("");
                          }}
                        />
                      </label>
                      <p>Өргөн, урт 100–2000 см · Таазны өндөр 240–300 см</p>
                    </div>
                  )}
                  </div>
                  {step === 3 && <section aria-label="Хаалга цонх байрлуулах">
                    <p>Хана, хэмжээг сонгоод булангаас ирмэг хүртэлх зайг оруулна уу. Ханын эхлэл, төгсгөл нь планын A → B → C → D дарааллаар явна.</p>
                    <div className="room-start-shapes"><button type="button" onClick={() => addOpening("door")}>+ Хаалга нэмэх</button><button type="button" onClick={() => addOpening("window")}>+ Цонх нэмэх</button></div>
                    {!openings.length && <p>Хаалга, цонх нэмэх эсвэл хоосон хэвээр үргэлжлүүлж болно.</p>}
                    {openings.map(opening => <OpeningQuickEditor key={opening.id} room={previewRoom} opening={opening} onChange={changeOpening} onRemove={() => setOpenings(openings.filter(o => o.id !== opening.id))} beginEdit={() => {}} endEdit={() => {}} />)}
                    {openingIssue && <p role="alert">{openingIssue}</p>}
                  </section>}
                  <div hidden={step !== 4}>
                  <RoomFurnishingPicker
                    value={setup}
                    onChange={(patch) => setSetup({ ...setup, ...patch })}
                  />
                  </div>
                  <p className="room-size-example-note">
                    Эдгээр нь төлөвлөж эхлэх жишээ хэмжээ. Дараа нь өрөөний
                    хэмжээ, хэлбэрийг өөрчилж болно.
                  </p>
                </div>
                <aside
                  className="room-size-preview"
                  aria-label="Сонгосон өрөөний хэмжээ"
                >
                  <span>Таны өрөө</span>
                  <h2>{room.label}</h2>
                  {valid ? <RoomPlanPreview room={previewRoom} /> : <RoomSizePreview width={dimensions.width} depth={dimensions.depth} valid={false} />}
                  <strong>
                    {valid
                      ? `${roomSetupNumber(getRoomGeometry(previewRoom).area)} м²`
                      : "Хэмжээгээ оруулна уу"}
                  </strong>
                  <p>
                    {valid
                      ? `${roomSetupNumber(dimensions.width)} × ${roomSetupNumber(dimensions.depth)} м · ${roomSetupNumber(dimensions.height)} м өндөр`
                      : "Бодит хэмжээг сантиметрээр оруулаарай."}
                  </p>
                </aside>
              </div>
              {error && (
                <p className="room-size-error" role="alert">
                  {error}
                </p>
              )}
              <footer className="room-start-footer">
                <button
                  type="button"
                  className="room-start-back"
                  onClick={() => {
                    setError("");
                    setStep((step - 1) as 1 | 2 | 3);
                  }}
                >
                  <ArrowLeft size={17} /> Буцах
                </button>
                <button type="submit" className="room-start-submit">
                  {step === 4 ? "3D өрөөгөө нээх" : "Үргэлжлүүлэх"} <ArrowRight size={19} />
                </button>
              </footer>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function RoomSizePreview({
  width,
  depth,
  valid,
}: {
  width: number;
  depth: number;
  valid: boolean;
}) {
  const scale = valid ? Math.min(170 / width, 132 / depth) : 30;
  const w = valid ? width * scale : 140,
    d = valid ? depth * scale : 105;
  const x = (260 - w) / 2,
    y = (210 - d) / 2;
  return (
    <svg viewBox="0 0 260 230" className="room-size-diagram" aria-hidden="true">
      <rect
        x={x}
        y={y}
        width={w}
        height={d}
        rx={2}
        fill="#eee5d6"
        stroke="#7f8f93"
        strokeWidth={5}
      />
      <path
        d={`M${x} ${y + d + 16}H${x + w} M${x} ${y + d + 11}v10 M${x + w} ${y + d + 11}v10`}
        stroke="#94a3b8"
        fill="none"
      />
      <text x={130} y={y + d + 36} textAnchor="middle">
        {valid ? `${roomSetupNumber(width)} м` : "Өргөн"}
      </text>
      <text
        x={x - 12}
        y={y + d / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${x - 12} ${y + d / 2})`}
      >
        {valid ? `${roomSetupNumber(depth)} м` : "Урт"}
      </text>
    </svg>
  );
}

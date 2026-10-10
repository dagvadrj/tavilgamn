"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KitchenSuggestionWizard } from "@/components/KitchenSuggestionWizard";
import { Armchair, ArrowLeft, ArrowRight, Bath, BedDouble, Check, ChefHat, House, Monitor, PencilRuler, Ruler, Shapes } from "lucide-react";
import type { RoomType } from "@/lib/types";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { ROOM_SIZE_SUGGESTIONS, suggestedRoomIndex, validateRoomSetup, roomSetupNumber, type RoomSetupDimensions } from "@/lib/roomSetup";
import "./room-planner-start.css";

const ROOM_CHOICES = [
  { type: "living", Icon: Armchair, description: "Буйдан, ширээ, зурагтын хэсэг", tone: "sand" },
  { type: "bedroom", Icon: BedDouble, description: "Ор, хувцасны шүүгээ, амрах орчин", tone: "rose" },
  { type: "kitchen", Icon: ChefHat, description: "Гарнитур, хоол хийх ба идэх хэсэг", tone: "sage" },
  { type: "office", Icon: Monitor, description: "Ажлын ширээ, сандал, номын тавиур", tone: "blue" },
  { type: "bathroom", Icon: Bath, description: "Угаалгын өрөөний зайгаа төлөвлөх", tone: "aqua" },
  { type: "other", Icon: Shapes, description: "Өөр зориулалттай өрөөг тохижуулах", tone: "lilac" },
] as const;

export function RoomPlannerStart({ onStart, draft, onResume }: {
  onStart: (type: RoomType, dimensions: RoomSetupDimensions) => void;
  draft?: { name: string; roomName?: string; width: number; depth: number } | null;
  onResume: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [roomType, setRoomType] = useState<RoomType>("living");
  const [choice, setChoice] = useState<number | "custom">(suggestedRoomIndex("living"));
  const [width, setWidth] = useState("500");
  const [depth, setDepth] = useState("400");
  const [height, setHeight] = useState("270");
  const [error, setError] = useState("");
  const [kitchenSetup, setKitchenSetup] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [step]);

  const presets = ROOM_SIZE_SUGGESTIONS[roomType];
  const selectedSize = choice === "custom"
    ? { width: Number(width) / 100, depth: Number(depth) / 100 }
    : presets[choice];
  const dimensions = { ...selectedSize, height: Number(height) / 100 };
  const valid = !validateRoomSetup(dimensions);
  const room = ROOM_TYPES[roomType];
  function chooseType(type: RoomType) {
    const next = ROOM_TYPES[type];
    setRoomType(type); setChoice(suggestedRoomIndex(type));
    setWidth(String(next.width * 100)); setDepth(String(next.depth * 100));
    setHeight("270"); setError(""); setStep(2);
  }
  if (kitchenSetup) return <KitchenSuggestionWizard roomDimensions={dimensions} onBack={() => setKitchenSetup(false)}/>;
  return <section className="room-start" aria-label="Өрөөний төлөвлөгчийг эхлүүлэх">
    <header className="room-start-header">
      <Link href="/" className="room-start-brand"><House size={22}/> tavilga.mn</Link>
      <span>3D өрөөний төлөвлөгч</span>
      <Link href="/">Нүүр рүү буцах <ArrowRight size={16}/></Link>
    </header>
    <div className="room-start-body">
      <ol className="room-start-progress" aria-label="Эхлэх алхмууд">
        <li aria-current={step === 1 ? "step" : undefined}><span>{step === 2 ? <Check size={15}/> : "1"}</span> Өрөөний төрөл</li>
        <li aria-current={step === 2 ? "step" : undefined}><span>2</span> Өрөөний хэмжээ</li>
      </ol>
      {step === 1 ? <>
        <div className="room-start-heading"><p>ӨӨРИЙНХӨӨ ОРЧНЫГ БҮТЭЭЕ</p><h1 ref={title} tabIndex={-1}>Ямар өрөө тохижуулах вэ?</h1><span>Өрөөгөө сонгоод, дараагийн алхамд хэмжээгээ тохируулаарай.</span></div>
        <div className="room-type-grid">
          {ROOM_CHOICES.map(({ type, Icon, description, tone }) => <button type="button" key={type} className="room-type-card" onClick={() => chooseType(type)}>
            <span className={`room-type-visual room-tone-${tone}`}><Icon size={46} strokeWidth={1.4}/><span className="room-type-floor"/></span>
            <span className="room-type-copy"><strong>{ROOM_TYPES[type].label}</strong><small>{description}</small></span><ArrowRight size={18}/>
          </button>)}
        </div>
        {draft && <div className="room-start-draft"><div><strong>Өмнөх ажлаа үргэлжлүүлэх үү?</strong><p>{draft.name} · {draft.roomName ?? "Өрөө"} · {roomSetupNumber(draft.width * draft.depth)} м²</p></div><button type="button" onClick={onResume}>Үргэлжлүүлэх <ArrowRight size={17}/></button></div>}
      </> : <>
        <div className="room-start-heading"><p>{room.label}</p><h1 ref={title} tabIndex={-1}>Өрөөний хэмжээгээ сонгоорой</h1><span>Жишээ хэмжээнээс сонгох эсвэл бодит хэмжээгээ өөрөө оруулж болно.</span></div>
        <form noValidate className="room-size-form" onSubmit={event => {
          event.preventDefault();
          const kitchenSizeIssue = roomType === "kitchen" && [dimensions.width, dimensions.depth].some(value => value < 2 || value > 8)
            ? "Гарнитурын төлөвлөгчид өргөн, урт тус бүр 200–800 см байна." : null;
          const issue = validateRoomSetup(dimensions) ?? kitchenSizeIssue;
          setError(issue ?? "");
          if (!issue) { if (roomType === "kitchen") setKitchenSetup(true); else onStart(roomType, dimensions); }
        }}>
          <div className="room-size-layout">
            <div>
              <div className="room-size-grid" role="group" aria-label="Өрөөний жишээ хэмжээ">
                {presets.map((size, index) => <button type="button" key={index} className="room-size-card" aria-pressed={choice === index} onClick={() => { setChoice(index); setWidth(String(size.width * 100)); setDepth(String(size.depth * 100)); setError(""); }}>
                  <span className="room-size-card-top"><Ruler size={18}/>{index === suggestedRoomIndex(roomType) && <small>Санал болгох</small>}<span className="room-size-check">{choice === index && <Check size={14}/>}</span></span>
                  <strong>{roomSetupNumber(size.width * size.depth)} <span>м²</span></strong><span>{roomSetupNumber(size.width)} × {roomSetupNumber(size.depth)} м</span>
                </button>)}
              </div>
              <button type="button" className="room-size-custom" aria-pressed={choice === "custom"} aria-expanded={choice === "custom"} onClick={() => { setChoice("custom"); setError(""); }}><PencilRuler size={23}/><span><strong>Өөрийн хэмжээ оруулах</strong><small>Өргөн, урт, таазны өндрөө тохируулах</small></span><span className="room-size-check">{choice === "custom" && <Check size={14}/>}</span></button>
              {choice === "custom" && <div className="room-size-fields">
                <label><span>Өргөн · см</span><input type="number" inputMode="decimal" min={100} max={2000} step={1} value={width} onChange={event => { setWidth(event.target.value); setError(""); }} placeholder="Жишээ: 400"/></label>
                <label><span>Урт · см</span><input type="number" inputMode="decimal" min={100} max={2000} step={1} value={depth} onChange={event => { setDepth(event.target.value); setError(""); }} placeholder="Жишээ: 300"/></label>
                <label><span>Таазны өндөр · см</span><input type="number" inputMode="decimal" min={240} max={300} step={1} value={height} onChange={event => { setHeight(event.target.value); setError(""); }}/></label>
                <p>Өргөн, урт 100–2000 см · Таазны өндөр 240–300 см</p>
              </div>}
              <p className="room-size-example-note">Эдгээр нь төлөвлөж эхлэх жишээ хэмжээ. Дараа нь өрөөний хэмжээ, хэлбэрийг өөрчилж болно.</p>
            </div>
            <aside className="room-size-preview" aria-label="Сонгосон өрөөний хэмжээ">
              <span>Таны өрөө</span><h2>{room.label}</h2>
              <RoomSizePreview width={dimensions.width} depth={dimensions.depth} valid={valid}/>
              <strong>{valid ? `${roomSetupNumber(dimensions.width * dimensions.depth)} м²` : "Хэмжээгээ оруулна уу"}</strong>
              <p>{valid ? `${roomSetupNumber(dimensions.width)} × ${roomSetupNumber(dimensions.depth)} м · ${roomSetupNumber(dimensions.height)} м өндөр` : "Бодит хэмжээг сантиметрээр оруулаарай."}</p>
            </aside>
          </div>
          {error && <p className="room-size-error" role="alert">{error}</p>}
          <footer className="room-start-footer"><button type="button" className="room-start-back" onClick={() => { setError(""); setStep(1); }}><ArrowLeft size={17}/> Өрөөний төрөл солих</button><button type="submit" className="room-start-submit">{roomType === "kitchen" ? "Гарнитур сонгох" : "3D өрөөгөө нээх"} <ArrowRight size={19}/></button></footer>
        </form>
      </>}
    </div>
  </section>;
}

function RoomSizePreview({ width, depth, valid }: { width: number; depth: number; valid: boolean }) {
  const scale = valid ? Math.min(170 / width, 132 / depth) : 30;
  const w = valid ? width * scale : 140, d = valid ? depth * scale : 105;
  const x = (260 - w) / 2, y = (210 - d) / 2;
  return <svg viewBox="0 0 260 230" className="room-size-diagram" aria-hidden="true">
    <rect x={x} y={y} width={w} height={d} rx={2} fill="#eee5d6" stroke="#7f8f93" strokeWidth={5}/>
    <path d={`M${x} ${y + d + 16}H${x + w} M${x} ${y + d + 11}v10 M${x + w} ${y + d + 11}v10`} stroke="#94a3b8" fill="none"/>
    <text x={130} y={y + d + 36} textAnchor="middle">{valid ? `${roomSetupNumber(width)} м` : "Өргөн"}</text>
    <text x={x - 12} y={y + d / 2} textAnchor="middle" transform={`rotate(-90 ${x - 12} ${y + d / 2})`}>{valid ? `${roomSetupNumber(depth)} м` : "Урт"}</text>
  </svg>;
}

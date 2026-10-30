"use client";
import { startPlannerNavigation } from "@/lib/plannerNavigation";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Droplets,
  Info,
  Sparkles,
  Wind,
} from "lucide-react";
import { KITCHEN_FLOW_STAGES, KITCHEN_FLOW_LABELS, saveKitchenFlowDraft, type KitchenFlowStage } from "@/lib/kitchenFlow";
import { useAuth } from "@/store/auth";
import type { RoomSetupDimensions } from "@/lib/roomSetup";
import type { KitchenRoom } from "@/lib/kitchenCabinets";
import "./kitchen-planner.css";
import "./kitchen-wizard.css";
import { placementIssues } from "@/lib/kitchenPlacement";
import { parseKitchen } from "@/lib/kitchenAssembly";
import {
  createSuggestedKitchen,
  DEFAULT_KITCHEN_SUGGESTION,
  type KitchenSuggestionPreferences,
  type SuggestionLayout,
} from "@/lib/kitchenSuggestions";

type PreferenceKey = keyof KitchenSuggestionPreferences;
type Choice = {
  value: string;
  title: string;
  description: string;
  /** Rendered with the planner itself: the real cabinets, straight from the front. */
  image: string;
};
type Question = {
  key: PreferenceKey;
  title: string;
  description: string;
  choices: Choice[];
};

const photo = (name: string) => `/kitchen-wizard/${name}.webp`;
const QUESTIONS: Question[] = [
  {
    key: "oven",
    title: "Зуухаа хаана байрлуулах вэ?",
    description: "Дараа нь тухайн шүүгээг сонгоод загвар, хэмжээг нь сольж болно.",
    choices: [
      { value: "under-worktop", title: "Тавцангийн доор", description: "Плитканы доорх 600 мм шүүгээнд", image: photo("oven-low") },
      { value: "high-cabinet", title: "Өндөр шүүгээнд", description: "Бэлхүүсний түвшинд, бөхийхгүй ашиглана", image: photo("oven-high") },
    ],
  },
  {
    key: "hood",
    title: "Утаа сорогч хэрэгтэй юу?",
    description: "Плитканы дээр, агааржуулалтын цэг рүү ойртуулж байрлуулна.",
    choices: [
      { value: "integrated", title: "Шүүгээнд суурилуулсан", description: "Дээд шүүгээний доор далд байрлана", image: photo("hood-integrated") },
      { value: "wall", title: "Хананд ил", description: "Яндантай, тусдаа харагдах сорогч", image: photo("hood-wall") },
      { value: "none", title: "Одоохондоо хэрэггүй", description: "Дараа нь planner дотроос нэмж болно", image: photo("hood-none") },
    ],
  },
  {
    key: "refrigerator",
    title: "Хөргөгчөө хэрхэн байрлуулах вэ?",
    description: "Хөргөгч гарнитурын захад, плиткагаас зайтай орно.",
    choices: [
      { value: "integrated", title: "Шүүгээнд суурилуулсан", description: "Фасадтай нэг өнгө, нэг шугамтай", image: photo("fridge-integrated") },
      { value: "freestanding", title: "Тусдаа хөргөгч", description: "Шүүгээнээс тусдаа бие даасан хөргөгч", image: photo("fridge-free") },
      { value: "none", title: "Одоохондоо хэрэггүй", description: "Дараа нь planner дотроос нэмж болно", image: photo("fridge-none") },
    ],
  },
  {
    key: "layout",
    title: "Гал тогооны хэлбэрээ сонгоно уу",
    description: "Таны өрөөнд багтах эсэхийг шалгаж тэмдэглэв.",
    choices: [
      { value: "straight", title: "I хэлбэр", description: "Нэг ханын дагуу шулуун", image: photo("layout-i") },
      { value: "l-right", title: "L хэлбэр", description: "Хоёр залгаа ханын дагуу", image: photo("layout-l") },
      { value: "u", title: "U хэлбэр", description: "Гурван ханын дагуу", image: photo("layout-u") },
      { value: "double-side", title: "Хоёр талт", description: "Эсрэг хоёр ханын дагуу", image: photo("layout-double") },
    ],
  },
];

const LABELS: Record<PreferenceKey, string> = {
  oven: "Зуух",
  hood: "Утаа сорогч",
  refrigerator: "Хөргөгч",
  layout: "Хэлбэр",
};

function choiceFor(key: PreferenceKey, value: string) {
  return QUESTIONS.find((question) => question.key === key)?.choices.find(
    (choice) => choice.value === value,
  );
}

/** Short shape advice from the room's proportions; only a hint, every option stays selectable. */
function recommendedLayout(width: number, depth: number): SuggestionLayout {
  const long = Math.max(width, depth), short = Math.min(width, depth);
  if (short < 2.2) return "straight";
  if (long / short >= 1.6 && short >= 2.4) return "double-side";
  if (short >= 3 && long >= 3.2) return "u";
  return "l-right";
}

export function KitchenSuggestionWizard({ roomDimensions, room, onBack, onSkip, initialPreferences, onPreferencesChange, onComplete, onSetupStage, disabled = false }: { roomDimensions?: RoomSetupDimensions; /** The surveyed room: water and vent points steer sink and hood. */ room?: KitchenRoom; onBack?: () => void; onSkip?: () => void; initialPreferences?: KitchenSuggestionPreferences; onPreferencesChange?: (preferences: KitchenSuggestionPreferences) => void; onComplete?: (preferences: KitchenSuggestionPreferences) => boolean | void; onSetupStage?: (stage: "room" | "size") => void; disabled?: boolean } = {}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [step]);
  const [preferences, setPreferences] = useState<KitchenSuggestionPreferences>(
    initialPreferences ?? DEFAULT_KITCHEN_SUGGESTION,
  );
  useEffect(() => { onPreferencesChange?.(preferences); }, [preferences, onPreferencesChange]);
  const summary = step === QUESTIONS.length;
  const question = QUESTIONS[step];
  // Parents pass a fresh size object every render; plan only when the size changes.
  const dimsKey = roomDimensions ? [roomDimensions.width, roomDimensions.depth, roomDimensions.height].join("x") : "";
  const dims = useMemo<RoomSetupDimensions | undefined>(() => {
    if (!dimsKey) return undefined;
    const [width, depth, height] = dimsKey.split("x").map(Number);
    return { width, depth, height };
  }, [dimsKey]);
  const surveyed = useMemo(() => room ? { ...room, items: room.items ?? [] } : undefined, [room]);
  const design = useMemo(() => createSuggestedKitchen(preferences, dims, { room: surveyed }), [preferences, dims, surveyed]);
  const needsAdjustment = placementIssues(design).some(issue => issue.severity === "error");
  // Which shapes fit this room with the other three answers as they are.
  const fits = useMemo(() => Object.fromEntries(QUESTIONS[3].choices.map(choice => {
    if (!dims) return [choice.value, true];
    const candidate = createSuggestedKitchen({ ...preferences, layout: choice.value as SuggestionLayout }, dims, { room: surveyed });
    return [choice.value, !placementIssues(candidate).some(issue => issue.severity === "error")];
  })) as Record<string, boolean>, [preferences, dims, surveyed]);
  const recommended = roomDimensions ? recommendedLayout(roomDimensions.width, roomDimensions.depth) : null;
  const water = room?.items?.some(item => item.kind === "water");
  const vent = room?.items?.some(item => item.kind === "vent");
  const hint = question?.key === "hood"
    ? (vent ? { icon: <Wind size={16} />, text: "Агааржуулалтын цэг тэмдэглэсэн тул плитка, сорогчийг түүн рүү ойртуулж байрлуулна." }
      : { icon: <Info size={16} />, text: "Агааржуулалтын цэг тэмдэглээгүй: сорогч нүүрсэн шүүлтүүрээр ажиллана. Өрөөний алхамд цэгээ нэмбэл хоолойн уртыг тооцно." })
    : question?.key === "layout" || summary
      ? (water ? { icon: <Droplets size={16} />, text: "Угаалтуурыг усны цэгийн ойролцоо, плиткаг угаалтуураас 40+ см тавцангийн зайтай байрлуулна." }
        : { icon: <Info size={16} />, text: "Усны цэг тэмдэглээгүй: угаалтуурыг стандарт байрлалд тавина. Өрөөний алхамд цэгээ нэмбэл түүн рүү ойртуулна." })
      : null;

  function continueToPlanner(stage: KitchenFlowStage = "design") {
    if (disabled) return;
    if (onComplete) { if (onComplete(preferences) === false) setError('Загвар үүсгэж чадсангүй. Доорх байрлалын мэдэгдлийг шалгаж сонголтоо өөрчилнө үү.'); return; }
    try { parseKitchen(design); } catch {
      setError("Энэ өрөөнд сонголтууд багтахгүй байна. Өөр байрлал сонгох эсвэл өрөөний хэмжээгээ өөрчлөөрэй.");
      return;
    }
    const draftId=crypto.randomUUID();
    let href = "";
    try {
      href = saveKitchenFlowDraft(localStorage, { userId: user?.id, draftId, design, preferences, stage });
    } catch {
      setError("Сонголтыг хадгалж чадсангүй. Хөтчийн хадгалах эрхийг шалгаад дахин оролдоорой.");
      return;
    }
    startPlannerNavigation(href);
    router.push(href);
  }

  const choose = (key: PreferenceKey, value: string) => setPreferences((current) => ({ ...current, [key]: value }));

  return (
    <main className="ks-wizard kwz">
      {!onComplete && <nav className="kwz-flow" aria-label="Гал тогооны алхмууд">
        {KITCHEN_FLOW_STAGES.map((stage, index) => <button type="button" key={stage} aria-current={stage === "equipment" ? "step" : undefined} onClick={() => { if (stage === "room" || stage === "size") { if (onSetupStage) onSetupStage(stage); else onBack?.(); } else if (stage === "equipment") setStep(0); else continueToPlanner(stage); }}>{KITCHEN_FLOW_LABELS[index]}</button>)}
      </nav>}
      <header className="kwz-top">
        <button
          type="button"
          className="kwz-back"
          onClick={() => (step > 0 ? setStep(step - 1) : onBack ? onBack() : router.push("/"))}
        >
          <ArrowLeft size={18} /> {step > 0 ? "Буцах" : onBack ? "Өрөө" : "Дэлгүүр"}
        </button>
        <ol className="kwz-steps" aria-label="Төхөөрөмжийн сонголт">
          {(Object.keys(LABELS) as PreferenceKey[]).map((key, index) => (
            <li key={key}>
              <button type="button" aria-current={step === index ? "step" : undefined} data-done={index < step || summary || undefined} onClick={() => setStep(index)}>
                <span>{index < step || summary ? <Check size={13} /> : index + 1}</span>
                <b>{LABELS[key]}<small>{choiceFor(key, preferences[key])?.title}</small></b>
              </button>
            </li>
          ))}
          <li>
            <button type="button" aria-current={summary ? "step" : undefined} onClick={() => setStep(QUESTIONS.length)}>
              <span><Sparkles size={13} /></span><b>Тойм<small>Загвар үүсгэх</small></b>
            </button>
          </li>
        </ol>
        {onSkip
          ? <button type="button" className="kwz-skip" onClick={onSkip}>Өөрөө угсрах <ArrowRight size={16} /></button>
          : <span className="kwz-count">{summary ? "Тойм" : `${step + 1} / ${QUESTIONS.length}`}</span>}
      </header>

      {!summary ? (
        <section className="kwz-body" key={question.key}>
          <div className="kwz-heading">
            <p>{onSkip ? "Ухаалаг санал" : "Гарнитураа сонгоё"} · {step + 1} / {QUESTIONS.length}</p>
            <h1 ref={title} tabIndex={-1}>{question.title}</h1>
            <span>{question.description}</span>
          </div>
          <div className={`kwz-choices is-${question.choices.length}`} role="radiogroup" aria-label={question.title}>
            {question.choices.map((choice) => {
              const selected = preferences[question.key] === choice.value;
              const layout = question.key === "layout";
              const tight = layout && fits[choice.value] === false;
              return (
                <button
                  type="button"
                  role="radio"
                  key={choice.value}
                  className={selected ? "is-selected" : ""}
                  aria-checked={selected}
                  onClick={() => choose(question.key, choice.value)}
                  onDoubleClick={() => { choose(question.key, choice.value); setStep(step + 1); }}
                >
                  <span className="kwz-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static planner renders */}
                    <img src={choice.image} alt="" loading={step === 0 ? "eager" : "lazy"} width={720} height={540} />
                    {layout && recommended === choice.value && <em className="kwz-badge">Таны өрөөнд тохиромжтой</em>}
                    {tight && <em className="kwz-badge is-warning">Зарим шүүгээ багтахгүй</em>}
                    <i className="kwz-check" aria-hidden="true"><Check size={16} /></i>
                  </span>
                  <span className="kwz-copy">
                    <strong>{choice.title}</strong>
                    <small>{choice.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {hint && <p className="kwz-hint" role="note">{hint.icon}<span>{hint.text}</span></p>}
          <div className="kwz-actions">
            {step > 0 && <button type="button" className="kwz-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Буцах</button>}
            <button
              type="button"
              className="kwz-next"
              onClick={() => setStep(step + 1)}
            >
              {step === QUESTIONS.length - 1 ? "Тойм харах" : "Үргэлжлүүлэх"} <ArrowRight size={18} />
            </button>
          </div>
        </section>
      ) : (
        <section className="kwz-body kwz-summary">
          <div className="kwz-heading">
            <p>{onSkip ? "Ухаалаг санал · тойм" : "Алхам 3 · Тоног төхөөрөмж"}</p>
            <h1 ref={title} tabIndex={-1}>Таны гарнитурын сонголт</h1>
            <span>Сонголтоо шалгаад, хүсвэл аль нэгийг нь дарж өөрчилнө үү.</span>
          </div>
          <div className="kwz-summary-grid">
            {(Object.keys(LABELS) as PreferenceKey[]).map((key, index) => {
              const choice = choiceFor(key, preferences[key]);
              return (
                <button type="button" key={key} onClick={() => setStep(index)} aria-label={`${LABELS[key]}: ${choice?.title}. Өөрчлөх`}>
                  <span className="kwz-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static planner renders */}
                    <img src={choice?.image} alt="" width={720} height={540} />
                  </span>
                  <span className="kwz-copy">
                    <small>{LABELS[key]}</small>
                    <strong>{choice?.title}</strong>
                    <u>Өөрчлөх</u>
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="kwz-facts">
            {roomDimensions && <li>Өрөө: {roomDimensions.width} × {roomDimensions.depth} м · {Math.round(roomDimensions.width * roomDimensions.depth * 10) / 10} м²</li>}
            <li>{water ? "Угаалтуур усны цэгийн ойролцоо байрлана" : "Усны цэг тэмдэглээгүй"}</li>
            <li>{preferences.hood === "none" ? "Сорогчгүй" : vent ? "Сорогч агааржуулалтын цэг рүү ойртоно" : "Сорогч шүүлтүүрээр ажиллана"}</li>
            <li>Плитаны 32А тусгай залгуур, тавцангийн залгуурууд автоматаар тооцогдоно</li>
          </ul>
          {needsAdjustment && <p className="kwz-hint is-warning" role="status"><Info size={16} /><span>Энэ сонголтын зарим шүүгээ өрөөнд багтахгүй байна. Хэлбэрээ өөрчлөх эсвэл 3D загвар дээр илүүдэл шүүгээг хасаарай.</span></p>}
          <div className="kwz-actions">
            <button type="button" className="kwz-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Буцах</button>
            <button type="button" className="kwz-next" disabled={disabled} onClick={() => continueToPlanner()}>
              {disabled ? 'Загварын санг ачаалж байна…' : 'Гал тогооны загвар үүсгэх'} <ArrowRight size={18} />
            </button>
          </div>
          {error && <p role="alert" className="kwz-hint is-warning"><Info size={16} /><span>{error}</span></p>}
        </section>
      )}
    </main>
  );
}

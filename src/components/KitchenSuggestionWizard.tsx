"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CookingPot,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import type { RoomSetupDimensions } from "@/lib/roomSetup";
import "./kitchen-planner.css";
import { placementIssues } from "@/lib/kitchenPlacement";
import { parseKitchen } from "@/lib/kitchenAssembly";
import {
  createSuggestedKitchen,
  DEFAULT_KITCHEN_SUGGESTION,
  type KitchenSuggestionPreferences,
} from "@/lib/kitchenSuggestions";

type PreferenceKey = keyof KitchenSuggestionPreferences;
type Choice = {
  value: string;
  title: string;
  description: string;
  diagram: string;
};
type Question = {
  key: PreferenceKey;
  eyebrow: string;
  title: string;
  description: string;
  choices: Choice[];
};

const QUESTIONS: Question[] = [
  {
    key: "oven",
    eyebrow: "1 / 4",
    title: "Зуухаа хаана байрлуулах вэ?",
    description:
      "Дараа нь тухайн шүүгээг сонгоод загвар, хэмжээг нь сольж болно.",
    choices: [
      {
        value: "under-worktop",
        title: "Тавцангийн доор",
        description: "Плитканы доорх 600 мм шүүгээнд",
        diagram: "oven-low",
      },
      {
        value: "high-cabinet",
        title: "Өндөр шүүгээнд",
        description: "Бэлхүүсний түвшинд ашиглахад эвтэйхэн",
        diagram: "oven-high",
      },
    ],
  },
  {
    key: "hood",
    eyebrow: "2 / 4",
    title: "Утаа сорогч хэрэгтэй юу?",
    description: "Плитканы дээр автоматаар тааруулж байрлуулна.",
    choices: [
      {
        value: "integrated",
        title: "Шүүгээнд суурилуулсан",
        description: "Дээд шүүгээний доор далд байрлана",
        diagram: "hood-integrated",
      },
      {
        value: "wall",
        title: "Хананд ил",
        description: "Тусдаа утаа сорогч харагдана",
        diagram: "hood-wall",
      },
      {
        value: "none",
        title: "Одоохондоо хэрэггүй",
        description: "Дараа нь planner дотроос нэмж болно",
        diagram: "none",
      },
    ],
  },
  {
    key: "refrigerator",
    eyebrow: "3 / 4",
    title: "Хөргөгчөө хэрхэн байрлуулах вэ?",
    description: "Сонголт гарнитурын захад автоматаар орно.",
    choices: [
      {
        value: "integrated",
        title: "Шүүгээнд суурилуулсан",
        description: "Фасадтай нэг өнгө, нэг шугамтай",
        diagram: "fridge-integrated",
      },
      {
        value: "freestanding",
        title: "Тусдаа хөргөгч",
        description: "Side-by-side төрлийн бие даасан хөргөгч",
        diagram: "fridge-free",
      },
      {
        value: "none",
        title: "Одоохондоо хэрэггүй",
        description: "Дараа нь planner дотроос нэмж болно",
        diagram: "none",
      },
    ],
  },
  {
    key: "layout",
    eyebrow: "4 / 4",
    title: "Гал тогооны үндсэн хэлбэрээ сонгоно уу",
    description: "Өрөөний хэмжээг planner дотор нарийвчлан өөрчилнө.",
    choices: [
      {
        value: "straight",
        title: "I хэлбэр",
        description: "Нэг ханын дагуу шулуун",
        diagram: "layout-i",
      },
      {
        value: "l-right",
        title: "L хэлбэр",
        description: "Хоёр залгаа ханын дагуу",
        diagram: "layout-l",
      },
      {
        value: "u",
        title: "U хэлбэр",
        description: "Гурван ханын дагуу",
        diagram: "layout-u",
      },
      {
        value: "double-side",
        title: "Хоёр талт",
        description: "Эсрэг хоёр ханын дагуу",
        diagram: "layout-double",
      },
    ],
  },
];

const LABELS: Record<PreferenceKey, string> = {
  oven: "Зуух",
  hood: "Утаа сорогч",
  refrigerator: "Хөргөгч",
  layout: "Байрлал",
};

function choiceFor(key: PreferenceKey, value: string) {
  return QUESTIONS.find((question) => question.key === key)?.choices.find(
    (choice) => choice.value === value,
  );
}

function SuggestionDiagram({ kind }: { kind: string }) {
  const layout = kind.startsWith("layout-");
  const tall = kind === "oven-high" || kind.startsWith("fridge-");
  const cabinet = (x: number, y: number, w: number, h: number) => <g key={`${x}-${y}`}><rect x={x} y={y} width={w} height={h} fill="#fafaf7" stroke="#a0a8a0" strokeWidth="2"/><rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} fill="none" stroke="#d6d9d1"/><path d={`M${x + w - 10} ${y + h / 2 - 6}v12`} stroke="#707970" strokeWidth="3"/></g>;
  return (
    <svg className="ks-choice-illustration" viewBox="0 0 320 230" aria-hidden="true">
      <rect width="320" height="230" fill="#eef0eb"/>
      {layout ? <g fill="#fff" stroke="#394b40" strokeWidth="3">
        {kind === "layout-i" && <rect x="55" y="75" width="210" height="45"/>}
        {kind === "layout-l" && <path d="M65 55h190v45H110v80H65Z"/>}
        {kind === "layout-u" && <path d="M55 55h210v125h-45v-80H100v80H55Z"/>}
        {kind === "layout-double" && <><rect x="60" y="50" width="45" height="135"/><rect x="215" y="50" width="45" height="135"/></>}
        <rect x="137" y="142" width="45" height="40" fill="none" stroke="#b5beb6" strokeDasharray="3 4" strokeWidth="1"/>
      </g> : kind === "none" ? <g stroke="#839487" strokeWidth="3"><circle cx="160" cy="108" r="40" fill="none"/><path d="m132 136 56-56"/></g> : <>
        <path d="M0 193h320v37H0Z" fill="#d9c4a2"/>
        {cabinet(35, 126, 75, 67)}{cabinet(110, 126, 75, 67)}{cabinet(185, 126, 95, 67)}
        <rect x="30" y="119" width="255" height="8" fill="#bca17b"/>
        <rect x="125" y="115" width="49" height="5" rx="2" fill="#27332e"/>
        {!tall && kind !== "hood-wall" && <>{cabinet(35, 30, 75, 62)}{cabinet(110, 30, 75, 62)}{cabinet(185, 30, 95, 62)}</>}
        {kind.startsWith("oven-") && <>
          {tall && cabinet(185, 20, 85, 173)}
          <rect x={tall ? 194 : 120} y={tall ? 79 : 134} width="65" height="48" rx="3" fill="#343b38"/>
          <rect x={tall ? 201 : 127} y={tall ? 91 : 146} width="51" height="28" fill="#67746e"/>
          <path d={tall ? "M202 87h49" : "M128 142h49"} stroke="#d9ddda" strokeWidth="3"/>
        </>}
        {kind === "hood-integrated" && <rect x="114" y="93" width="67" height="9" fill="#737c76"/>}
        {kind === "hood-wall" && <g fill="#919b95"><rect x="138" y="28" width="25" height="49"/><path d="m138 77-33 28h91l-33-28Z"/></g>}
        {kind.startsWith("fridge-") && <>
          {cabinet(185, 20, 85, 173)}
          <rect x="189" y="24" width="77" height="165" fill={kind === "fridge-free" ? "#78817d" : "#fafaf7"} stroke="#a0a8a0"/>
          <path d="M190 139h75M255 75v23M255 151v20" stroke={kind === "fridge-free" ? "#ccd1cd" : "#9ca69f"} strokeWidth="3"/>
        </>}
      </>}
    </svg>
  );
}

export function KitchenSuggestionWizard({ roomDimensions, onBack }: { roomDimensions?: RoomSetupDimensions; onBack?: () => void } = {}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [step]);
  const [preferences, setPreferences] = useState<KitchenSuggestionPreferences>(
    DEFAULT_KITCHEN_SUGGESTION,
  );
  const summary = step === QUESTIONS.length;
  const question = QUESTIONS[step];
  const design = useMemo(() => createSuggestedKitchen(preferences, roomDimensions), [preferences, roomDimensions]);
  const needsAdjustment = placementIssues(design).some(issue => issue.severity === "error");

  function continueToPlanner() {
    try { parseKitchen(design); } catch {
      setError("Энэ өрөөнд сонголтууд багтахгүй байна. Өөр байрлал сонгох эсвэл өрөөний хэмжээгээ өөрчлөөрэй.");
      return;
    }
    const draftId=crypto.randomUUID();
    const draftKey = `tavilga-kitchen-draft-${user?.id ?? "guest"}-${draftId}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ id: "", name: "Миний гал тогоо", design }),
      );
    } catch {
      setError("Сонголтыг хадгалж чадсангүй. Хөтчийн хадгалах эрхийг шалгаад дахин оролдоорой.");
      return;
    }
    router.replace(`/kitchen?editor=1&space=1&draft=${draftId}`);
  }

  return (
    <main className="ks-wizard">
      <header className="ks-header">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : onBack ? onBack() : router.push("/"))}
        >
          <ArrowLeft size={19} /> {step > 0 ? "Буцах" : onBack ? "Өрөөний хэмжээ" : "Дэлгүүр"}
        </button>
        <strong>
          <CookingPot size={21} /> tavilga.mn kitchen
        </strong>
        <span>{summary ? "Тойм" : question.eyebrow}</span>
      </header>

      {!summary ? (
        <section className="ks-question" key={question.key}>
          <p className="ks-eyebrow">ГАРНИТУРАА СОНГОЁ · {question.eyebrow}</p>
          <h1 ref={title} tabIndex={-1}>{question.title}</h1>
          <p className="ks-intro">{question.description}</p>
          <div
            className={`ks-choices ${question.choices.length >= 3 ? "has-three" : ""}`}
          >
            {question.choices.map((choice) => {
              const selected = preferences[question.key] === choice.value;
              return (
                <button
                  type="button"
                  key={choice.value}
                  className={selected ? "is-selected" : ""}
                  aria-pressed={selected}
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      [question.key]: choice.value,
                    }))
                  }
                >
                  <SuggestionDiagram kind={choice.diagram} />
                  <span className="ks-choice-copy">
                    <strong>{choice.title}</strong>
                    <small>{choice.description}</small>
                  </span>
                  <span className="ks-check">
                    <Check size={16} />
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="ks-next"
            onClick={() => setStep(step + 1)}
          >
            Үргэлжлүүлэх <ArrowRight size={18} />
          </button>
        </section>
      ) : (
        <section className="ks-summary">
          <p className="ks-eyebrow">БАРАГ БОЛЛОО</p>
          <h1 ref={title} tabIndex={-1}>Таны гарнитурын сонголт</h1>
          <p className="ks-intro">
            Сонголтоо шалгаад, хүсвэл аль нэгийг нь буцаж өөрчилнө үү.
          </p>
          <div className="ks-summary-grid">
            {(Object.keys(LABELS) as PreferenceKey[]).map((key, index) => {
              const choice = choiceFor(key, preferences[key]);
              return (
                <article key={key}>
                  <div className="ks-summary-visual">
                    <SuggestionDiagram kind={choice?.diagram ?? "none"} />
                  </div>
                  <p>{LABELS[key]}</p>
                  <h2>{choice?.title}</h2>
                  <button type="button" onClick={() => setStep(index)}>
                    Өөрчлөх
                  </button>
                </article>
              );
            })}
          </div>
          {roomDimensions && <p className="ks-intro">Өрөө: {roomDimensions.width} × {roomDimensions.depth} м · {roomDimensions.width * roomDimensions.depth} м²</p>}
          {needsAdjustment && <p className="ks-intro" role="status">Энэ сонголтын зарим шүүгээ өрөөнд багтахгүй байна. Байрлалаа өөрчилж сонгох эсвэл 3D загвар дээр илүүдэл шүүгээг хасаарай.</p>}
          <button type="button" className="ks-next" onClick={continueToPlanner}>
            3D загвараа нээх <ArrowRight size={18} />
          </button>
          {error && <p role="alert" className="ks-intro">{error}</p>}
        </section>
      )}
    </main>
  );
}

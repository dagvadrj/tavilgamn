"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CookingPot,
  Refrigerator,
  Rows3,
  Wind,
} from "lucide-react";
import { useAuth } from "@/store/auth";
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
  return (
    <span className={`ks-diagram ks-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function KitchenSuggestionWizard() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<KitchenSuggestionPreferences>(
    DEFAULT_KITCHEN_SUGGESTION,
  );
  const summary = step === QUESTIONS.length;
  const question = QUESTIONS[step];

  function continueToPlanner() {
    const design = createSuggestedKitchen(preferences);
    const draftKey = `tavilga-kitchen-draft-${user?.id ?? "guest"}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ id: "", name: "Миний гал тогоо", design }),
      );
    } catch {
      // The editor still opens with its safe default if storage is unavailable.
    }
    router.replace(`/kitchen?editor=1&draft=${crypto.randomUUID()}`);
  }

  return (
    <main className="ks-wizard">
      <header className="ks-header">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : router.push("/"))}
        >
          <ArrowLeft size={19} /> {step > 0 ? "Буцах" : "Дэлгүүр"}
        </button>
        <strong>
          <CookingPot size={21} /> tavilga.mn kitchen
        </strong>
        <span>{summary ? "Тойм" : question.eyebrow}</span>
      </header>

      {!summary ? (
        <section className="ks-question" key={question.key}>
          <p className="ks-eyebrow">KITCHEN SUGGESTION · {question.eyebrow}</p>
          <h1>{question.title}</h1>
          <p className="ks-intro">{question.description}</p>
          <div
            className={`ks-choices ${question.choices.length === 3 ? "has-three" : ""}`}
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
          <h1>Таны гал тогооны санал</h1>
          <p className="ks-intro">
            Сонголтоо шалгаад, хүсвэл аль нэгийг нь буцаж өөрчилнө үү.
          </p>
          <div className="ks-summary-grid">
            {(Object.keys(LABELS) as PreferenceKey[]).map((key, index) => {
              const choice = choiceFor(key, preferences[key]);
              const Icon =
                key === "oven"
                  ? CookingPot
                  : key === "hood"
                    ? Wind
                    : key === "refrigerator"
                      ? Refrigerator
                      : Rows3;
              return (
                <article key={key}>
                  <div className="ks-summary-visual">
                    <Icon size={32} />
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
          <button type="button" className="ks-next" onClick={continueToPlanner}>
            Planner-аа нээх <ArrowRight size={18} />
          </button>
        </section>
      )}
    </main>
  );
}

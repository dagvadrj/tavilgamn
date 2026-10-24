"use client";

import { useId, useState } from "react";
import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { TourPreview } from "@/features/planner/components/PlannerTourPreview";
import {
  plannerTourSteps,
  type PlannerTourKind,
} from "@/features/planner/components/plannerTourSteps";
import { useDemoPlayback } from "@/features/motion/useMotionActivity";

export function HomepageTour() {
  const [kind, setKind] = useState<PlannerTourKind>("room");
  const id = useId();
  return (
    <section
      className="home-tour home-motion-wrap"
      aria-labelledby="home-tour-title"
      id="how-it-works"
    >
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">ХЭРХЭН АШИГЛАХ ВЭ?</p>
          <h2 id="home-tour-title">Хэдхэн алхам. Өөрийн шийдэл.</h2>
        </div>
        <p>Сонгоод, туршаад, өөртөө тааруулаарай.</p>
      </div>
      <div
        className="home-tour-tabs"
        role="tablist"
        aria-label="Төлөвлөгчийн заавар"
      >
        {(["room", "kitchen"] as const).map((value) => (
          <button
            key={value}
            id={`${id}-${value}`}
            role="tab"
            type="button"
            aria-selected={kind === value}
            aria-controls={`${id}-panel`}
            tabIndex={kind === value ? 0 : -1}
            onClick={() => setKind(value)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "room"
                    : event.key === "End"
                      ? "kitchen"
                      : kind === "room"
                        ? "kitchen"
                        : "room";
                setKind(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }
            }}
          >
            {value === "room" ? "Өрөө төлөвлөх" : "Гал тогоо төлөвлөх"}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${kind}`}>
        <TourPlayback key={kind} kind={kind} />
      </div>
    </section>
  );
}

function TourPlayback({ kind }: { kind: PlannerTourKind }) {
  const steps = plannerTourSteps[kind];
  const [ready, setReady] = useState(false);
  const demo = useDemoPlayback(steps.length, 5400, ready);
  const step = steps[demo.step];
  return (
    <div ref={demo.ref} className="home-tour-player">
      <div className="home-tour-visual">
        <TourPreview
          kind={kind}
          scene={step.illustration}
          paused={!demo.active || !demo.playing}
          onReady={setReady}
        />
        <div className="home-tour-playback">
          <span>
            Үйлдлийн жишээ · {demo.step + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={demo.toggle}
            aria-label={
              demo.playing ? "Зааврыг түр зогсоох" : "Зааврыг тоглуулах"
            }
          >
            {demo.playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            type="button"
            onClick={demo.replay}
            aria-label="Зааврыг эхнээс тоглуулах"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      <div className="home-tour-instructions">
        <ol>
          {steps.map((item, i) => (
            <li key={item.target}>
              <button
                type="button"
                aria-current={demo.step === i ? "step" : undefined}
                onClick={() => demo.choose(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{item.title}</b>
              </button>
            </li>
          ))}
        </ol>
        <div
          className="home-tour-explanation"
          aria-live={demo.playing ? "off" : "polite"}
        >
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </div>
        <Link
          href={kind === "room" ? "/planner" : "/kitchen"}
          className="home-button"
        >
          Өөрөө турших <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

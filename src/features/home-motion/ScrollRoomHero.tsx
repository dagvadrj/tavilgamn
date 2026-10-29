"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Pause, Play, X } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import type { Product } from "@/lib/types";
import {
  DEFAULT_HOMEPAGE_HERO,
  type HomepageHero,
} from "@/lib/homepagePresentation";
import {
  ROOM_LABELS,
  ROOM_ITEMS,
  ROOM_FINISHES,
  type RoomFurniture,
} from "./scrollRoomStory";
import { useScrollRoom } from "./useScrollRoom";
import { HybridBackdrop } from "./HybridBackdrop";
import { HYBRID_ROOMS } from "./hybridRooms";

/**
 * The hero tucks under the sticky header by its height, which useScrollRoom
 * measures after hydration. On slow phones that was seconds after the first
 * paint, so the whole hero jumped up by the header height (CLS ≈ 0.96). This
 * runs while the HTML is parsed, before the first paint, and only adds a head
 * style so React-owned elements keep their server attributes. Streamed content
 * is still hidden while it is parsed (height 0), so it measures in
 * requestAnimationFrame, which runs before the paint that reveals it. It does
 * not check the header is sticky: this page's stylesheet (which makes it
 * sticky via :has(.scroll-room)) may still be loading at that moment.
 */
const HEADER_OFFSET_SCRIPT = `(function(){var n=0;(function f(){var h=document.querySelector(".store-header");if(h&&h.offsetHeight){var s=document.createElement("style");s.textContent=".scroll-room{--room-header-height:"+h.offsetHeight+"px}";document.head.appendChild(s);return}if(++n<600)requestAnimationFrame(f)})()})()`;
import "./scroll-room.css";
import "./room-hero-layout.css";
const Scene = dynamic(() => import("./HybridRoomScene"), { ssr: false });
const CHAPTERS = [
  {
    text: "Өөрийн орон зайдаа тохирсон чанартай тавилгыг хялбархан олоорой.",
    href: "/catalog",
    cta: "Тавилга үзэх",
  },
  {
    text: "Өдөр бүрийн амралтыг илүү тав тухтай, дулаахан болгох тавилга.",
    href: "/catalog/bed",
    cta: "Ор үзэх",
  },
  {
    text: "Өдөр тутмын бүтээмжийг нэмэгдүүлэх тав тухтай, загварлаг шийдлүүд.",
    href: "/catalog/office",
    cta: "Тавилга үзэх",
  },
];
/** Letters resolve from blur one by one; the parent key restarts it per room. */
function BlurTitle({ text }: { text: string }) {
  let index = 0;
  return (
    <>
      {text.split(" ").map((word) => (
        <span key={word} className="room-hero-title-line" aria-hidden="true">
          {[...word].map((letter, i) => (
            <span key={i} style={{ animationDelay: `${100 + index++ * 45}ms` }}>
              {letter}
            </span>
          ))}
        </span>
      ))}
      <span className="room-hero-sr">{text}</span>
    </>
  );
}

export function ScrollRoomHero({
  sofa,
  bed,
  wardrobe,
  hero,
  loading,
}: {
  sofa?: Product;
  bed?: Product;
  wardrobe?: Product;
  hero: HomepageHero;
  loading: boolean;
}) {
  const tour = useScrollRoom();
  const [selected, setSelected] = useState<RoomFurniture | null>(null);
  const [colors, setColors] = useState<Partial<Record<RoomFurniture, string>>>(
    {},
  );
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [sofaStatus, setSofaStatus] = useState("preview"),
    [bedStatus, setBedStatus] = useState("preview"),
    [wardrobeStatus, setWardrobeStatus] = useState("preview");
  const returnFocus = useRef<HTMLElement | null>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const onReady = useCallback(() => setReady(true), []);
  const [imageReady, setImageReady] = useState<Record<number, boolean>>({});
  const onImageReady = useCallback(
    (phase: number) =>
      setImageReady((previous) =>
        previous[phase] ? previous : { ...previous, [phase]: true },
      ),
    [],
  );
  useEffect(() => {
    if (!tour.mounted) setReady(false);
  }, [tour.mounted]);
  const onError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const select = useCallback((item: RoomFurniture) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setSelected(item);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() =>
      returnFocus.current?.focus({ preventScroll: true }),
    );
  }, []);
  useEffect(() => {
    if (!selected) return;
    closeButton.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, close]);
  useEffect(() => {
    if (selected && ROOM_ITEMS[selected].room !== tour.phase) setSelected(null);
  }, [tour.phase, selected]);
  const products: Partial<Record<RoomFurniture, Product | undefined>> = {
    sofa,
    bed,
    wardrobe,
  };
  const statuses: Partial<Record<RoomFurniture, string>> = {
    sofa: sofaStatus,
    bed: bedStatus,
    wardrobe: wardrobeStatus,
  };
  const product = selected ? products[selected] : undefined;
  const chapter = CHAPTERS[tour.phase];
  const description =
    tour.phase === 0 && hero.description !== DEFAULT_HOMEPAGE_HERO.description
      ? hero.description
      : chapter.text;
  const activeItem: RoomFurniture =
    tour.phase === 0 ? "sofa" : tour.phase === 1 ? "bed" : "desk";
  const finish = selected ? ROOM_ITEMS[selected].finish : "fabric";
  const playing = !tour.paused && !tour.reduced && !selected;
  const displayReady =
    tour.mounted &&
    ready &&
    Boolean(imageReady[tour.phase]) &&
    (tour.phase !== 0 ||
      !sofa?.model ||
      sofaStatus === "ready" ||
      sofaStatus === "error");
  return (
    <section
      ref={tour.root}
      className="scroll-room"
      data-reduced={tour.reduced}
      data-phase={tour.phase}
      data-detail={!!selected}
      data-sofa-status={sofaStatus}
      data-ready={displayReady}
      data-playing={playing}
      aria-label="Өрөөгөөр аялах 3D үзүүлбэр"
    >
      <script dangerouslySetInnerHTML={{ __html: HEADER_OFFSET_SCRIPT }} />
      <div ref={tour.stage} className="scroll-room-stage">
        <div
          className="scroll-room-scene"
          aria-label="Зочны, унтлагын болон ажлын өрөөний 3D үзүүлбэр"
        >
          <HybridBackdrop
            phase={tour.phase}
            poster={!displayReady}
            scene={tour.mounted && !failed}
            customPoster={hero.image || undefined}
            onImageReady={onImageReady}
          />
          {tour.mounted && !failed && (
            <Scene
              key={attempt}
              motion={tour.motion}
              reduced={tour.reduced}
              phase={tour.phase}
              selected={selected}
              sofa={sofa}
              bed={bed}
              wardrobe={wardrobe}
              colors={colors}
              onSelect={select}
              onReady={onReady}
              onError={onError}
              onSofaStatus={setSofaStatus}
              onBedStatus={setBedStatus}
              onWardrobeStatus={setWardrobeStatus}
            />
          )}
        </div>
        <div className="scroll-room-shade" aria-hidden="true" />
        <div className="room-hero-intro">
          <h1 id="home-motion-title" data-homepage-field="title">
            {hero.title}
          </h1>
          <Link className="room-hero-arrow" href="/planner">
            Өрөөгөө төлөвлөх <ArrowRight size={18} />
          </Link>
        </div>
        <div className="room-hero-aside">
          <p data-homepage-field="description">{description}</p>
          <Link
            href={tour.phase === 0 ? hero.primaryHref : chapter.href}
            data-homepage-field={tour.phase === 0 ? "primaryLabel" : undefined}
          >
            {tour.phase === 0 ? hero.primaryLabel : chapter.cta}
          </Link>
        </div>
        <div className="room-hero-bottom">
          <div className="room-hero-meta">
            <nav aria-label="Өрөөний аяллын үе шат">
              {ROOM_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-current={tour.phase === i ? "step" : undefined}
                  aria-label={`${label} — ${i + 1}/${ROOM_LABELS.length}`}
                  onClick={() => {
                    close();
                    tour.choose(i);
                  }}
                >
                  0{i + 1}
                  <i aria-hidden="true" />
                </button>
              ))}
              <span aria-hidden="true">/ 0{ROOM_LABELS.length}</span>
            </nav>
            <button type="button" onClick={() => select(activeItem)}>
              {ROOM_ITEMS[activeItem].label} · Материал харах
            </button>
          </div>
          <h2 className="room-hero-title" key={tour.phase}>
            <BlurTitle text={ROOM_LABELS[tour.phase]} />
          </h2>
        </div>
        <div className="room-hero-controls">
          {!tour.reduced && (
            <button
              type="button"
              className="room-hero-tool"
              onClick={tour.toggle}
              aria-label={
                tour.paused ? "Аяллыг үргэлжлүүлэх" : "Аяллыг түр зогсоох"
              }
              aria-pressed={tour.paused}
            >
              {tour.paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <button
            type="button"
            className="room-hero-badge"
            onClick={tour.skip}
            aria-label="Аяллыг алгасах"
          >
            <svg
              className="room-hero-ring"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <path
                id="room-hero-badge-path"
                d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0"
                fill="none"
              />
              <text>
                <textPath href="#room-hero-badge-path">
                  ДООШ ГҮЙЛГЭХ • ДООШ ГҮЙЛГЭХ •
                </textPath>
              </text>
            </svg>
            <ArrowDown size={18} />
          </button>
        </div>
        {selected && (
          <aside
            className="scroll-room-details"
            role="dialog"
            aria-modal="false"
            aria-labelledby="scroll-room-product-title"
            data-finish={finish}
            data-color={colors[selected] || "original"}
          >
            <button
              ref={closeButton}
              className="scroll-room-close"
              onClick={close}
              aria-label="Мэдээллийг хаах"
            >
              <X size={18} />
            </button>
            <h2 id="scroll-room-product-title">
              {ROOM_ITEMS[selected].label}
              {product && product.basePrice > 0 ? (
                <span> · {product.basePrice.toLocaleString("mn-MN")}₮</span>
              ) : null}
            </h2>
            <p>{product ? product.name : "Интерьерийн жишиг загвар"}</p>
            {(failed || statuses[selected] === "error") && (
              <p role="status">
                3D загвар түр боломжгүй. Бүтээгдэхүүний холбоосоор дэлгэрэнгүй
                үзээрэй.
              </p>
            )}
            <fieldset className="scroll-room-swatches" disabled={failed}>
              <legend>Өнгөний урьдчилсан дүрслэл</legend>
              {ROOM_FINISHES[finish].map((option) => (
                <button
                  key={option.color}
                  type="button"
                  aria-label={option.name}
                  title={option.name}
                  aria-pressed={colors[selected] === option.color}
                  style={{
                    backgroundColor: option.color,
                    backgroundImage: `url(/interior/premium/${finish === "wood" ? "walnut" : "linen"}-color.webp)`,
                  }}
                  onClick={() =>
                    setColors((prev) => ({ ...prev, [selected]: option.color }))
                  }
                />
              ))}
            </fieldset>
            <div className="scroll-room-detail-actions">
              <button
                onClick={() =>
                  setColors((prev) => ({ ...prev, [selected]: undefined }))
                }
              >
                Эх өнгө
              </button>
              <Link
                href={
                  product
                    ? `/product/${product.id}`
                    : `/catalog/${ROOM_ITEMS[selected].category}`
                }
              >
                {product ? "Бүтээгдэхүүн үзэх" : "Сонголтууд үзэх"}{" "}
                <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        )}
        <div className="scroll-room-footer">
          {!selected && (
            <div
              className="hybrid-item-links"
              data-fallback={failed || !displayReady}
              aria-label="Өрөөний тавилга"
            >
              {HYBRID_ROOMS[tour.phase].furniture.map((item) => (
                <button key={item.id} onClick={() => select(item.id)}>
                  {ROOM_ITEMS[item.id].label}
                </button>
              ))}
            </div>
          )}
          <div className="scroll-room-status" role="status">
            {failed ? (
              <>
                <span>3D түр боломжгүй. Зургаар үзэж байна.</span>
                <button
                  onClick={() => {
                    setFailed(false);
                    setReady(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Дахин ачаалах
                </button>
              </>
            ) : !displayReady ? (
              "3D өрөөг бэлдэж байна…"
            ) : loading ? (
              "Бүтээгдэхүүнүүдийг ачаалж байна…"
            ) : tour.reduced ? (
              "Хөдөлгөөн багасгасан · Өрөөг товчоор сонгоорой"
            ) : tour.paused ? (
              "Аялал түр зогссон"
            ) : (
              "Доош гүйлгэж өрөөг солиорой"
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

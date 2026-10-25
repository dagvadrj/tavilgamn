"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import type { Product } from "@/lib/types";
import {
  DEFAULT_HOMEPAGE_HERO,
  type HomepageHero,
} from "@/lib/homepagePresentation";
import { ROOM_LABELS, type RoomFurniture } from "./scrollRoomStory";
import { useScrollRoom } from "./useScrollRoom";
import "./scroll-room.css";
const Scene = dynamic(() => import("./ScrollRoomScene"), { ssr: false });
const CHAPTERS = [
  {
    title: "Ухаалаг интерьер шийдэл",
    text: "Өрөөг өөрийн хурдаар нээгээрэй. Доош гүйлгэж буйдангийн детальд ойртоорой.",
  },
  {
    title: "Нэг хаалганы цаана.\nӨөр нэг орон зай.",
    text: "Камерын хамт зочны өрөөнөөс унтлагын өрөө рүү алхаарай.",
  },
  {
    title: "Тайван амрах\nтаны орон зай.",
    text: "Доош гүйлгэхэд ор ханын голд бууж, өрөөний зохион байгуулалт бүрдэнэ.",
  },
  {
    title: "Зүйл бүр\nбайрандаа.",
    text: "Шкаф хананд байрлана. Одоо өөрийн гэрийн зохион байгуулалтыг туршаарай.",
  },
];
const ITEM_LABELS = { sofa: "Буйдан", bed: "Ор", wardrobe: "Шкаф" };
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
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [sofaStatus, setSofaStatus] = useState("preview"),
    [bedStatus, setBedStatus] = useState("preview"),
    [wardrobeStatus, setWardrobeStatus] = useState("preview");
  const returnFocus = useRef<HTMLElement | null>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const select = useCallback((next: RoomFurniture) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setSelected(next);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    returnFocus.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!selected) return;
    closeButton.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, close]);
  const products = { sofa, bed, wardrobe },
    statuses = { sofa: sofaStatus, bed: bedStatus, wardrobe: wardrobeStatus };
  const product =
    selected && statuses[selected] === "ready" ? products[selected] : undefined;
  const chapter = CHAPTERS[tour.phase];
  const title =
    tour.phase === 0 && hero.title !== DEFAULT_HOMEPAGE_HERO.title
      ? hero.title
      : chapter.title;
  const description =
    tour.phase === 0 && hero.description !== DEFAULT_HOMEPAGE_HERO.description
      ? hero.description
      : chapter.text;
  const activeItem: RoomFurniture | null =
    tour.phase === 0
      ? "sofa"
      : tour.phase === 2
        ? "bed"
        : tour.phase === 3
          ? "wardrobe"
          : null;
  return (
    <section
      ref={tour.root}
      className="scroll-room"
      data-reduced={tour.reduced}
      data-phase={tour.phase}
      aria-label="Өрөөгөөр аялах 3D үзүүлбэр"
    >
      <div ref={tour.stage} className="scroll-room-stage">
        <div
          className="scroll-room-scene"
          aria-label="Өрөө хооронд аялах интерактив 3D орон зай"
        >
          {!ready && (
            <Image
              src={hero.image || "/rooms/living-room.webp"}
              alt="Зочны өрөөний интерьер"
              fill
              priority
              sizes="100vw"
              className="scroll-room-poster"
              data-homepage-field="image"
            />
          )}
          {tour.mounted && !failed && (
            <Scene
              key={attempt}
              motion={tour.motion}
              reduced={tour.reduced}
              phase={tour.phase}
              sofa={sofa}
              bed={bed}
              wardrobe={wardrobe}
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
        <div className="scroll-room-tools">
          <button onClick={tour.skip}>
            Аяллыг алгасах <ArrowDown size={15} />
          </button>
          {!tour.reduced && (
            <button
              onClick={tour.toggle}
              aria-label={
                tour.paused ? "Аяллыг үргэлжлүүлэх" : "Аяллыг түр зогсоох"
              }
              aria-pressed={tour.paused}
            >
              {tour.paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
          )}
          <button
            onClick={() => tour.choose(-1)}
            aria-label="Аяллыг эхнээс үзэх"
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="scroll-room-copy">
          <h1
            id="home-motion-title"
            data-homepage-field={tour.phase === 0 ? "title" : undefined}
          >
            {title}
          </h1>
          <p data-homepage-field={tour.phase === 0 ? "description" : undefined}>
            {description}
          </p>
          {tour.phase === 0 && (
            <div className="scroll-room-actions">
              <button className="home-button" onClick={() => tour.choose(0)}>
                Ойроос харах <ArrowRight size={17} />
              </button>
              <Link
                className="home-button home-button-secondary"
                href={hero.primaryHref}
                data-homepage-field="primaryLabel"
              >
                {hero.primaryLabel}
              </Link>
            </div>
          )}
          {tour.phase === 3 && (
            <div className="scroll-room-actions">
              <Link className="home-button" href="/planner">
                Туршиж үзэх <ArrowRight size={17} />
              </Link>
              <Link
                className="home-button home-button-secondary"
                href={hero.secondaryHref}
                data-homepage-field="secondaryLabel"
              >
                {hero.secondaryLabel}
              </Link>
            </div>
          )}
          {activeItem && (
            <button
              className="scroll-room-product-link"
              onClick={() => select(activeItem)}
            >
              {ITEM_LABELS[activeItem]} · Дэлгэрэнгүй <ArrowRight size={15} />
            </button>
          )}
        </div>
        {selected && (
          <aside
            className="scroll-room-details"
            role="dialog"
            aria-modal="false"
            aria-labelledby="scroll-room-product-title"
          >
            <button
              ref={closeButton}
              className="scroll-room-close"
              onClick={close}
              aria-label="Мэдээллийг хаах"
            >
              <X size={20} />
            </button>
            <span>{ITEM_LABELS[selected]}</span>
            <h2 id="scroll-room-product-title">
              {product?.name || "Интерьерийн жишиг загвар"}
            </h2>
            {product ? (
              <>
                <p>{product.description}</p>
                <dl>
                  <dt>Хэмжээ · Ө × Г × Өн</dt>
                  <dd>
                    {[
                      product.dimensions.w,
                      product.dimensions.d,
                      product.dimensions.h,
                    ]
                      .map((n) => Math.round(n * 100))
                      .join(" × ")}{" "}
                    см
                  </dd>
                  <dt>Материал</dt>
                  <dd>
                    {product.materials.map((m) => m.name).join(", ") ||
                      "Бүтээгдэхүүний дэлгэрэнгүйгээс үзнэ үү"}
                  </dd>
                  <dt>Үнэ</dt>
                  <dd>
                    {product.basePrice > 0
                      ? `${product.basePrice.toLocaleString("mn-MN")} ₮-өөс`
                      : "Үнийн мэдээллийг дэлгэрэнгүйгээс үзнэ үү"}
                  </dd>
                </dl>
                <Link className="home-button" href={`/product/${product.id}`}>
                  Дэлгэрэнгүй үзэх <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <p>
                  Өрөөний зохион байгуулалтыг харуулах жишээ. Бодит
                  бүтээгдэхүүний сонголтыг каталогоос үзээрэй.
                </p>
                <Link className="home-button" href={`/catalog/${selected}`}>
                  Каталог үзэх <ArrowRight size={16} />
                </Link>
              </>
            )}
          </aside>
        )}
        <div className="scroll-room-footer">
          <nav aria-label="Өрөөний аяллын үе шат">
            {ROOM_LABELS.map((label, i) => (
              <button
                key={label}
                aria-current={tour.phase === i ? "step" : undefined}
                onClick={() => {
                  close();
                  tour.choose(i);
                }}
              >
                <span>0{i + 1}</span>
                {label}
              </button>
            ))}
          </nav>
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
            ) : !ready ? (
              "3D өрөөг бэлдэж байна…"
            ) : loading ? (
              "Бүтээгдэхүүнүүдийг ачаалж байна…"
            ) : tour.reduced ? (
              "Хөдөлгөөн багасгасан · Үе шатыг товчоор сонгоорой"
            ) : tour.paused ? (
              "Аялал түр зогссон"
            ) : (
              "Доош гүйлгэж үргэлжлүүлээрэй"
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

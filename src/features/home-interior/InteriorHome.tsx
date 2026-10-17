"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  MoveUpRight,
  Pause,
  Play,
} from "lucide-react";
import type { PageData } from "@/lib/pageData";
import { FeaturedMerchants } from "@/components/FeaturedMerchants";
import {
  HOME_PRODUCT_IDS,
  INTERIOR_STYLES,
  clamp01,
  storyPose,
  type StoryMotion,
} from "./homeStory";
import "./interior-home.css";

const InteriorScene = dynamic(() => import("./InteriorScene"), { ssr: false });
const CHAPTERS = [
  {
    label: "01 / ТӨСӨӨЛ",
    title: "Гэр гэдэг\nтаны мэдрэмж.",
    text: "Танд таалагдсан тавилга. Таны төсөөлсөн орон зай. Хоёрыг хамтдаа бүтээе.",
  },
  {
    label: "02 / ӨӨР ОРЧИН",
    title: "Өөр өрөө.\nӨөр боломж.",
    text: "Тавилга орчноо хэрхэн өөрчилдгийг хараарай.",
  },
  {
    label: "03 / БАЙРЛУУЛ",
    title: "Яг энд.\nЯг тохирно.",
    text: "Өнгө, хэмжээ, мэдрэмжийг нэг дороос төсөөл.",
  },
  {
    label: "04 / ӨӨРИЙНХӨӨРӨӨ",
    title: "Таны гэрийн\nшинэ эхлэл.",
    text: "Доороос загвараа сонгоод энэ өрөөнд байрлуулж үзээрэй.",
  },
];
const PROJECTS = [
  {
    title: "Өдөр бүрийн амгалан",
    type: "Зочны өрөө",
    image: "/rooms/living-room.webp",
    href: "/catalog?room=living",
  },
  {
    title: "Амрах өөрийн орон зай",
    type: "Унтлагын өрөө",
    image: "/rooms/bedroom.webp",
    href: "/catalog?room=bedroom",
  },
  {
    title: "Хамтдаа байх мөч",
    type: "Хоолны өрөө",
    image: "/rooms/dining.webp",
    href: "/catalog?room=dining",
  },
];

export function InteriorHome({
  catalog,
  stores,
  homepageProductIds,
  dataError = false,
}: PageData["home"] & { dataError?: boolean }) {
  const experience = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const designs = useRef<HTMLDivElement>(null);
  const motion = useRef<StoryMotion>({
    progress: 0,
    pointer: { x: 0, y: 0 },
    swap: -1,
    visible: true,
  });
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState(0);
  const [applied, setApplied] = useState(0);
  const [busy, setBusy] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("loading");
  const [request, setRequest] = useState<{
    index: number;
    revision: number;
  } | null>(null);
  const reportStatus = useCallback((next: string) => setStatus(next), []);
  const reduced = systemReduced || paused;
  const theme = INTERIOR_STYLES[applied];
  const ids = homepageProductIds ?? HOME_PRODUCT_IDS;
  const sofas = ids.map((id) => catalog.find((product) => product.id === id));
  const product = sofas[theme.product];

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".store-header");
    if (!header) return;
    const measure = () => {
      const pinned = ["sticky", "fixed"].includes(
        getComputedStyle(header).position,
      );
      experience.current?.style.setProperty(
        "--home-header-height",
        `${pinned ? header.offsetHeight : 0}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = experience.current;
      if (!node) return;
      const height = stage.current?.clientHeight || window.innerHeight;
      const headerHeight =
        parseFloat(node.style.getPropertyValue("--home-header-height")) || 0;
      const progress = clamp01(
        (headerHeight - node.getBoundingClientRect().top) / (height * 1.4),
      );
      // The journey follows the scroll in both directions; below it the sofa rests.
      motion.current.progress = reduced ? 1 : progress;
      if (!reduced && progress < 0.98 && motion.current.swap >= 0) {
        setRequest(null);
        setBusy(false);
        motion.current.swap = -1;
      }
      setPhase(storyPose(motion.current.progress).phase);
      motion.current.invalidate?.();
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      motion.current.visible = entry.isIntersecting;
      if (entry.isIntersecting) queue();
    });
    if (stage.current) observer.observe(stage.current);
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [reduced]);
  useEffect(() => {
    if (!request) return;
    const state = motion.current;
    let frame = 0;
    const start = performance.now();
    let changed = false;
    setBusy(true);
    const animate = (now: number) => {
      const progress = reduced ? 1 : clamp01((now - start) / 1800);
      motion.current.swap = progress;
      if (progress >= 0.5 && !changed) {
        changed = true;
        setApplied(request.index);
      }
      motion.current.invalidate?.();
      if (progress < 1) frame = requestAnimationFrame(animate);
      else {
        motion.current.swap = -1;
        setBusy(false);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      state.swap = -1;
    };
  }, [request, reduced]);
  const skip = () => {
    motion.current.progress = 1;
    motion.current.snap = true;
    setPhase(3);
    motion.current.invalidate?.();
    designs.current?.scrollIntoView({ behavior: "instant", block: "start" });
    designs.current?.focus({ preventScroll: true });
  };
  const chapter = CHAPTERS[phase];
  const unavailable =
    dataError || status === "error" || status === "unsupported";

  return (
    <div className={`interior-home${reduced ? " interior-reduced" : ""}`}>
      <section
        className="interior-experience"
        ref={experience}
        aria-label="Тавилга, хоёр өрөөний 3D аялал"
      >
        <div
          className="interior-sticky"
          ref={stage}
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse" || reduced || phase === 3) return;
            const rect = event.currentTarget.getBoundingClientRect();
            motion.current.pointer = {
              x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
              y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
            };
            motion.current.invalidate?.();
          }}
          onPointerLeave={() => {
            motion.current.pointer = { x: 0, y: 0 };
            motion.current.invalidate?.();
          }}
        >
          <div className="interior-scene-backup">
            <Image
              src="/rooms/living-room.webp"
              alt="Буйдан, хивс, гэрэлтүүлэгтэй тохижуулсан зочны өрөө"
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="interior-canvas" aria-label="Өрөөний тавилгатай танилцах 3D харагдац">
            <InteriorScene
              motion={motion}
              theme={theme}
              product={product}
              reduced={reduced}
              onStatus={reportStatus}
            />
          </div>
          <div className="interior-stage-shade" />
          <div
            className={`interior-chapter${phase === 3 ? " is-landed" : ""}`}
            key={phase}
          >
            <span className="interior-eyebrow">{chapter.label}</span>
            <h1>{chapter.title}</h1>
            <p>{chapter.text}</p>
            {phase === 0 && (
              <div className="interior-hero-actions">
                <Link className="interior-button" href="/catalog">
                  Тавилга үзэх <ArrowUpRight size={17} />
                </Link>
                <button
                  className="interior-text-button"
                  type="button"
                  onClick={skip}
                >
                  Өрөөнд байрлуулах <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="interior-stage-top">
            <span>ТАВИЛГА / ОРОН ЗАЙ / МЭДРЭМЖ</span>
            <button
              type="button"
              aria-pressed={paused}
              aria-label={
                paused
                  ? "Хөдөлгөөн үргэлжлүүлэх"
                  : "Хөдөлгөөн зогсоож өрөөг харах"
              }
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
          <div className="interior-stage-bottom">
            <button
              type="button"
              onClick={skip}
              className="interior-scroll-hint"
            >
              <ArrowDown size={17} />{" "}
              {phase === 3 ? "Загвараа сонгох" : "Доош гүйлгээд төсөөл"}
            </button>
            <span className="interior-model-caption">
              {`${theme.name} зочны өрөө`}
              <small>
                {product && !unavailable && status === "ready"
                  ? `${product.name}${product.basePrice > 0 ? ` · ${product.basePrice.toLocaleString("mn-MN")} ₮-өөс` : ""}`
                  : "Интерьерийн санаа · Өөрийн тавилгаа сонгоорой"}
              </small>
              <Link href={product ? `/product/${product.id}` : "/catalog?room=living"}>
                {product ? "Онцлох буйданг үзэх" : "Зочны өрөөний тавилга"} <ArrowUpRight size={12} />
              </Link>
            </span>
            <div
              className="interior-chapter-dots"
              aria-label={`${phase + 1} / 4 үе шат`}
            >
              {CHAPTERS.map((_, i) => (
                <span className={i === phase ? "active" : ""} key={i} />
              ))}
            </div>
          </div>
        </div>
        <div className="interior-runway" aria-hidden="true" />
        <div
          className="interior-designs"
          id="home-designs"
          ref={designs}
          tabIndex={-1}
        >
          <div className="interior-design-panel">
            <span className="interior-eyebrow">ТАНЫ ӨРӨӨ. ТАНЫ ӨНГӨ.</span>
            <h2>
              Нэг өрөө.
              <br />
              Дөрвөн мэдрэмж.
            </h2>
            <p>Өөрт ойр хэв маягаа сонго. Бусдыг нь хамтдаа төсөөлъе.</p>
            <div
              className="interior-style-grid"
              role="group"
              aria-label="Интерьерийн хэв маяг"
            >
              {INTERIOR_STYLES.map((style, index) => (
                <button
                  key={style.id}
                  type="button"
                  className={`interior-style-card${selected === index ? " is-selected" : ""}`}
                  aria-pressed={selected === index}
                  disabled={busy}
                  onClick={() => setSelected(index)}
                >
                  <span
                    className="interior-mini-room"
                    style={{ background: style.wall }}
                    aria-hidden="true"
                  >
                    <i style={{ background: style.floor }} />
                    <b style={{ background: style.sofa }} />
                    <em style={{ background: style.rug }} />
                  </span>
                  <span className="interior-style-title">
                    {style.name}
                    {selected === index && <Check size={14} />}
                  </span>
                  <span className="interior-swatches" aria-hidden="true">
                    {[style.wall, style.floor, style.rug, style.accent].map(
                      (color) => (
                        <i key={color} style={{ background: color }} />
                      ),
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="interior-selection-note">
              {INTERIOR_STYLES[selected].note}
            </p>
            <button
              type="button"
              className="interior-button interior-place-button"
              disabled={busy}
              onClick={() => {
                motion.current.progress = 1;
                setPhase(3);
                if (
                  window.matchMedia("(max-width: 767px)").matches &&
                  experience.current &&
                  stage.current
                ) {
                  window.scrollTo({
                    top:
                      window.scrollY +
                      experience.current.getBoundingClientRect().top +
                      stage.current.clientHeight * (reduced ? 0 : 1.4),
                    behavior: reduced ? "instant" : "smooth",
                  });
                }
                setRequest((value) => ({
                  index: selected,
                  revision: (value?.revision ?? 0) + 1,
                }));
              }}
            >
              {busy ? "Өрөөг шинэчилж байна…" : "Өрөөнд байрлуулах"}
              <MoveUpRight size={18} />
            </button>
            <span className="interior-live-status" role="status">
              {busy
                ? ""
                : `${theme.name} загвар${product ? ` · ${product.name}` : ""}`}
            </span>
            <Link href="/planner" className="interior-text-button">
              Өөрийн өрөөг төлөвлөх <ArrowUpRight size={16} />
            </Link>
            {product && (
              <Link
                href={`/product/${product.id}`}
                className="interior-product-link"
              >
                Буйдангийн үнэ, дэлгэрэнгүй <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </section>
      <div className="interior-editorial">
        <section
          className="interior-advert interior-wrap"
          aria-label="Сурталчилгааны байршил"
        >
          <div>
            <span className="interior-eyebrow">БРЭНДЭД ЗОРИУЛСАН ОРОН ЗАЙ</span>
            <h2>
              Таны тавилга.
              <br />
              Дараагийн гэрийн сонголт.
            </h2>
            <p>
              Тавилга хайж буй хүмүүст бүтээгдэхүүн, интерьерийн санаагаа
              хүргээрэй.
            </p>
            <Link className="interior-text-button" href="/merchant">
              Сурталчилгаа байрлуулах <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="interior-advert-art" aria-hidden="true">
            <span>
              YOUR
              <br />
              NEXT
              <br />
              <i>space.</i>
            </span>
            <b>ОНЦЛОХ БАЙРШИЛ / 01</b>
          </div>
        </section>
        {stores.length > 0 && (
          <div className="interior-wrap interior-merchants">
            <FeaturedMerchants stores={stores} products={catalog} />
          </div>
        )}
        <section
          className="interior-about interior-wrap"
          aria-labelledby="interior-about-title"
        >
          <span className="interior-eyebrow">БИДНИЙ ТУХАЙ / ТАВИЛГА.MN</span>
          <div>
            <h2 id="interior-about-title">
              Зүгээр нэг тавилга биш.
              <br />
              <em>Таны амьдрах орон зай.</em>
            </h2>
            <div className="interior-about-copy">
              <p>
                Гэрийнхээ тухай итгэлтэй, удаан хадгалагдах шийдвэр гаргахад
                тань тусална.
              </p>
              <p>
                Хэмжээ нь таарах эсэх, өнгө нь зохицох эсэхийг төсөөлөхөд хэцүү.
                Бид тавилгыг өрөөндөө урьдчилан байрлуулж, бодит сонголтоо
                харьцуулах боломжийг нэг дор бүрдүүлж байна.
              </p>
              <Link href="/about" className="interior-text-button">
                Бидэнтэй танилцах <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <section
          className="interior-projects interior-wrap"
          aria-labelledby="interior-projects-title"
        >
          <div className="interior-section-heading">
            <div>
              <span className="interior-eyebrow">ОРОН ЗАЙН ТҮҮХҮҮД</span>
              <h2 id="interior-projects-title">Бидний төслүүд</h2>
            </div>
            <Link href="/catalog" className="interior-text-button">
              Бүх сонголт <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="interior-project-grid">
            {PROJECTS.map((project, index) => (
              <Link
                href={project.href}
                key={project.title}
                className="interior-project"
              >
                <div className="interior-project-image">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(max-width: 767px) 90vw, 32vw"
                  />
                  <span>
                    0{index + 1} / {project.type}
                  </span>
                  <b>
                    <ArrowUpRight size={21} />
                  </b>
                </div>
                <h3>{project.title}</h3>
                <p>Тохижуулалтын санаа · {project.type}</p>
              </Link>
            ))}
          </div>
        </section>
        <section
          className="interior-stats interior-wrap"
          aria-labelledby="interior-stats-title"
        >
          <div>
            <span className="interior-eyebrow">ХАМТДАА БҮТЭЭСЭН</span>
            <h2 id="interior-stats-title">
              Долоон жилийн
              <br />
              туршлага.
            </h2>
          </div>
          <div className="interior-stats-grid">
            {[
              ["240+", "каталогт буй тавилга"],
              ["62 мянга", "төлөвлөсөн өрөө"],
              ["4 хот", "дэлгүүртэй"],
              ["98%", "дахин худалдан авна"],
            ].map(([number, label]) => (
              <div key={label}>
                <strong>{number}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="interior-merchant-cta">
          <div className="interior-wrap">
            <span className="interior-eyebrow">ДАРААГИЙН БҮЛГИЙГ ХАМТДАА</span>
            <h2>
              Сайн тавилгыг
              <br />
              <em>сайхан гэртэй холбоё.</em>
            </h2>
            <p>Үйлдвэр, гар урлаач, тавилгын дэлгүүрүүдэд нээлттэй.</p>
            <Link href="/merchant" className="interior-button">
              Дэлгүүрээ нээх <ArrowUpRight size={18} />
            </Link>
            <Link href="/stores" className="interior-text-button">
              Дэлгүүрүүдтэй танилцах <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import type { PageData } from "@/lib/pageData";
import type { Product } from "@/lib/types";
import { FeaturedMerchants } from "@/components/FeaturedMerchants";
import {
  HOME_PRODUCT_IDS,
  INTERIOR_STYLES,
  clamp01,
  storyPose,
  type StoryMotion,
  STORY_SCROLL_SCREENS,
} from "./homeStory";
import "./interior-home.css";

const InteriorScene = dynamic(() => import("./InteriorScene"), { ssr: false });
export function resolveJourneyProduct(
  catalog: Product[],
  category: string,
  id?: string | null,
) {
  return id
    ? catalog.find(
        (item) => item.model && item.category === category && item.id === id,
      )
    : undefined;
}
const CHAPTERS = [
  {
    label: "01 / ТӨСӨӨЛ",
    title: "Гэр гэдэг\nтаны мэдрэмж.",
    text: "Танд таалагдсан тавилга. Таны төсөөлсөн орон зай. Хоёрыг хамтдаа бүтээе.",
  },
  {
    label: "02 / ӨРӨӨНӨӨС ӨРӨӨНД",
    title: "Гэр дотуур\nхамтдаа алхъя.",
    text: "Нэг хаалганы цаана таны амрах орон зай хүлээж байна.",
  },
  {
    label: "03 / АМРАХ ОРОН ЗАЙ",
    title: "Тайван өглөө\nэндээс эхэлнэ.",
    text: "Ор байрандаа бууж, унтлагын өрөө таны өмнө бүрдэнэ.",
  },
  {
    label: "04 / БҮХ ЗҮЙЛ БАЙРАНДАА",
    title: "Зай бүр\nөөрийн учиртай.",
    text: "Шкаф байрандаа тогтоно. Харин сонголт таных.",
  },
];
const ROOM_IDEAS = [
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
  homepageJourneyProducts,
  dataError = false,
}: PageData["home"] & { dataError?: boolean }) {
  const experience = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const motion = useRef<StoryMotion>({
    progress: 0,
    pointer: { x: 0, y: 0 },
    swap: -1,
    visible: true,
  });
  const [phase, setPhase] = useState(0);
  const [systemReduced, setSystemReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("loading");
  const [bedStatus, setBedStatus] = useState("preview");
  const [wardrobeStatus, setWardrobeStatus] = useState("preview");
  const reportStatus = useCallback((next: string) => setStatus(next), []);
  const reduced = systemReduced;
  const theme = INTERIOR_STYLES[0];
  const ids = homepageProductIds ?? HOME_PRODUCT_IDS;
  const sofas = ids.map((id) => catalog.find((product) => product.id === id));
  const sofaProduct = sofas.find((product) => product?.model);
  // A catalog category alone is not a curated showcase selection.
  const bedProduct = resolveJourneyProduct(
    catalog,
    "bed",
    homepageJourneyProducts?.bedProductId,
  );
  const wardrobeProduct = resolveJourneyProduct(
    catalog,
    "wardrobe",
    homepageJourneyProducts?.wardrobeProductId,
  );
  const product =
    phase < 2 ? sofaProduct : phase === 2 ? bedProduct : wardrobeProduct;
  const activeStatus =
    phase < 2 ? status : phase === 2 ? bedStatus : wardrobeStatus;

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
      if (paused) return;
      const node = experience.current;
      if (!node) return;
      const height = stage.current?.clientHeight || window.innerHeight;
      const headerHeight =
        parseFloat(node.style.getPropertyValue("--home-header-height")) || 0;
      const progress = clamp01(
        (headerHeight - node.getBoundingClientRect().top) /
          (height * STORY_SCROLL_SCREENS),
      );
      // The journey follows the scroll in both directions; below it the sofa rests.
      motion.current.progress = reduced ? 1 : progress;
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
  }, [reduced, paused]);
  const advance = () => {
    if (!experience.current || !stage.current) return;
    const next = [0.3, 0.55, 0.86, 1][phase];
    const header =
      parseFloat(
        experience.current.style.getPropertyValue("--home-header-height"),
      ) || 0;
    const top =
      window.scrollY + experience.current.getBoundingClientRect().top - header;
    window.scrollTo({
      top:
        top +
        stage.current.clientHeight *
          (reduced ? 1 : STORY_SCROLL_SCREENS * next + (phase === 3 ? 1 : 0)),
      behavior: reduced ? "instant" : "smooth",
    });
  };
  const chapter = CHAPTERS[phase];
  const unavailable =
    dataError || status === "error" || status === "unsupported";

  return (
    <div className={`interior-home${reduced ? " interior-reduced" : ""}`}>
      <section
        className="interior-experience"
        ref={experience}
        aria-label="Зочны өрөө, унтлагын өрөөний холбоотой 3D аялал"
      >
        <div
          className={`interior-sticky${phase > 0 ? " is-travelling" : ""}`}
          ref={stage}
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
          <div
            className="interior-canvas"
            data-scene-status={activeStatus}
            aria-label="Өрөөний тавилгатай танилцах 3D харагдац"
          >
            <InteriorScene
              motion={motion}
              theme={theme}
              product={sofaProduct}
              bedProduct={bedProduct}
              wardrobeProduct={wardrobeProduct}
              ready={{
                sofa: status === "ready",
                bed: bedStatus === "ready",
                wardrobe: wardrobeStatus === "ready",
              }}
              reduced={reduced}
              onStatus={reportStatus}
              onBedStatus={setBedStatus}
              onWardrobeStatus={setWardrobeStatus}
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
                  onClick={advance}
                >
                  3D аялал эхлүүлэх <ArrowRight size={16} />
                </button>
                <Link className="interior-text-button" href="/planner">
                  Өөрийн өрөөг төлөвлөх <ArrowUpRight size={16} />
                </Link>
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
              onClick={() => {
                motion.current.paused = !paused;
                setPaused(!paused);
                motion.current.invalidate?.();
              }}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
          <div className="interior-stage-bottom">
            <button
              type="button"
              onClick={advance}
              className="interior-scroll-hint"
            >
              <ArrowDown size={17} />{" "}
              {phase === 3 ? "Цааш үзэх" : "Доош гүйлгээд төсөөл"}
            </button>
            <span className="interior-model-caption">
              {phase < 2
                ? `${theme.name} зочны өрөө`
                : phase === 2
                  ? "Унтлагын өрөө"
                  : "Хувцасны хэсэг"}
              <small>
                {product && !unavailable && activeStatus === "ready"
                  ? `${product.name}${product.basePrice > 0 ? ` · ${product.basePrice.toLocaleString("mn-MN")} ₮-өөс` : ""}`
                  : "Интерьерийн санаа · Өөрийн тавилгаа сонгоорой"}
              </small>
              <Link
                href={
                  product && activeStatus === "ready"
                    ? `/product/${product.id}`
                    : `/catalog?room=${phase < 2 ? "living" : "bedroom"}`
                }
              >
                {product && activeStatus === "ready"
                  ? "Бүтээгдэхүүнийг үзэх"
                  : "Тавилга сонгох"}{" "}
                <ArrowUpRight size={12} />
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
            <Link
              className="interior-text-button"
              href="/?topic=advertising#contact"
            >
              Сурталчилгааны талаар холбогдох <ArrowUpRight size={16} />
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
              <Link href="/#about" className="interior-text-button">
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
              <span className="interior-eyebrow">ӨРӨӨНДӨӨ ТОХИРОХ СОНГОЛТ</span>
              <h2 id="interior-projects-title">Тохижуулалтын санаа</h2>
            </div>
            <Link href="/catalog" className="interior-text-button">
              Бүх сонголт <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="interior-project-grid">
            {ROOM_IDEAS.map((project, index) => (
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
                <p>{project.type} · Тавилга үзэх</p>
              </Link>
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
            <Link href="/?topic=merchant#contact" className="interior-button">
              Дэлгүүр бүртгүүлэх хүсэлт <ArrowUpRight size={18} />
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

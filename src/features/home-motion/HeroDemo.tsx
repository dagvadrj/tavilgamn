"use client";

import { AnimatePresence, m as motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Layers,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { useDemoPlayback } from "@/features/motion/useMotionActivity";
import { MotionCursor } from "@/features/motion/MotionCursor";
import { ModelDemo } from "@/features/motion/ModelDemo";
import { marketingProduct } from "@/lib/marketingModel";

const STEPS = [
  "Бараагаа сонгох",
  "Өнгө, хэмжээг шалгах",
  "Үйлдвэртэй холбогдох",
];

export function HeroDemo({
  product,
  image,
  loading = false,
}: {
  product?: Product;
  image?: string;
  loading?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const demo = useDemoPlayback(3, 3800, ready);
  const dimensions = product?.dimensions;
  const colors = product?.colors?.slice(0, 4) ?? [];
  return (
    <div ref={demo.ref} className="home-hero-demo" data-demo-step={demo.step}>
      <div className="home-demo-top">
        <span>
          <Layers size={15} /> tavilga.mn
        </span>
        <small>БОЛОМЖИЙН ҮЗҮҮЛБЭР</small>
      </div>
      <div className="home-demo-body">
        <div className="home-demo-product">
          <span className="home-demo-tag">
            {demo.step === 0
              ? "ТАНЫ СОНГОЛТ"
              : demo.step === 1
                ? "ТАНД ТОХИРУУЛСАН"
                : "ДАРААГИЙН АЛХАМ"}
          </span>
          <ModelDemo
            priority
            model={marketingProduct(product)}
            scene={(["catalog", "material", "save"] as const)[demo.step]}
            paused={!demo.active || !demo.playing}
            poster={image || product?.image}
            onReady={setReady}
            showCursor={false}
            resolveModel={false}
            loading={loading}
          />
          <motion.span
            className="home-demo-dimension"
            animate={{ opacity: demo.step > 0 ? 1 : 0 }}
            transition={{ duration: demo.reduced ? 0 : 0.45 }}
          >
            <Maximize2 size={13} />{" "}
            {dimensions
              ? `${Math.round(dimensions.w * 100)} × ${Math.round(dimensions.d * 100)} × ${Math.round(dimensions.h * 100)} см`
              : "Хэмжээгээ шалгаарай"}
          </motion.span>
        </div>
        <div className="home-demo-details">
          <small>СОНГО. ТААРУУЛ. ХОЛБОГД.</small>
          <strong>{product?.name || "Таны дараагийн тавилга"}</strong>
          <p>
            {product
              ? "Каталогийн бодит бүтээгдэхүүн · Үйлдлийн жишээ"
              : "Платформын ажиллагааны жишээ"}
          </p>
          <div className="home-demo-option">
            <span>Өнгө, материал</span>
            <div className="home-demo-swatches">
              {(colors.length
                ? colors
                : [
                    { id: "demo-1", hex: "#afbdca" },
                    { id: "demo-2", hex: "#d7c4ac" },
                    { id: "demo-3", hex: "#566b7b" },
                  ]
              ).map((color, i) => (
                <span
                  key={color.id}
                  style={{ backgroundColor: color.hex }}
                  data-selected={demo.step > 0 && i === 0}
                >
                  {demo.step > 0 && i === 0 && <Check size={13} />}
                </span>
              ))}
            </div>
          </div>
          <div className="home-demo-summary">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={demo.step}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: demo.reduced ? 0 : 0.35 }}
              >
                {demo.step < 2 ? (
                  <>
                    <span>Төсөөллөө бодит сонголт болгоё</span>
                    <b>
                      {demo.step === 0
                        ? "Өөрт тохирохыг олоорой"
                        : "Өрөөндөө туршиж хараарай"}
                    </b>
                  </>
                ) : (
                  <>
                    <span>
                      <Check size={14} /> Хүсэлтийн хураангуй
                    </span>
                    <b>Загвар + хэмжээ + материал</b>
                    <small>Хэмжилтийн дараа үнэ баталгаажна.</small>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <span className="home-demo-faux-button">
            {STEPS[demo.step]} <ArrowRight size={15} />
          </span>
        </div>
        <MotionCursor
          key={demo.run}
          scene={(["catalog", "material", "save"] as const)[demo.step]}
          paused={!demo.active || !demo.playing}
        />
      </div>
      <div className="home-demo-controls">
        <div role="group" aria-label="Hero үзүүлбэрийн алхмууд">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={`${i + 1}. ${label}`}
              aria-pressed={demo.step === i}
              onClick={() => demo.choose(i)}
            >
              <span>{i + 1}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        <div>
          <button
            type="button"
            aria-label={
              demo.playing
                ? "Hero үзүүлбэрийг түр зогсоох"
                : "Hero үзүүлбэрийг тоглуулах"
            }
            onClick={demo.toggle}
          >
            {demo.playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            aria-label="Hero үзүүлбэрийг дахин тоглуулах"
            onClick={demo.replay}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

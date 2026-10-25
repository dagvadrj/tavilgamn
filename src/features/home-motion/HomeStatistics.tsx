"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { Box, Layers, Star, Store } from "lucide-react";
import type { HomepageStatistics } from "@/lib/homepagePresentation";
import { useMotionActivity } from "@/features/motion/useMotionActivity";

export function HomeCount({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const activity = useMotionActivity<HTMLSpanElement>();
  const display = useRef<HTMLSpanElement>(null);
  const current = useRef(0);
  const format = (number: number) =>
    number.toLocaleString("mn-MN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  const label = format(value);
  useEffect(() => {
    const node = display.current;
    if (!node) return;
    if (activity.reduced) {
      node.textContent = label;
      current.current = value;
      return;
    }
    if (!activity.active) return;
    const controls = animate(current.current, value, {
      duration: 1.15,
      ease: "easeOut",
      onUpdate: (number) => {
        current.current = number;
        node.textContent = number.toLocaleString("mn-MN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      },
    });
    return () => controls.stop();
  }, [activity.active, activity.reduced, value, label, decimals]);
  return (
    <span ref={activity.ref} className="home-count" aria-label={label}>
      <span className="home-count-reserve" aria-hidden="true">
        {label}
      </span>
      <span ref={display} aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

export function HomeStatistics({
  stats,
  loading,
}: {
  stats?: HomepageStatistics;
  loading: boolean;
}) {
  const items = [
    { label: "Нэгдсэн дэлгүүр", value: stats?.stores, icon: Store },
    { label: "Каталогийн тавилга", value: stats?.products, icon: Box },
    { label: "Материалын сонголт", value: stats?.materials, icon: Layers },
    stats?.rating != null
      ? {
          label: `Барааны үнэлгээ · ${stats.reviews.toLocaleString("mn-MN")} сэтгэгдэл`,
          value: stats.rating,
          icon: Star,
          rating: true,
        }
      : { label: "3D загвартай тавилга", value: stats?.models, icon: Box },
  ];
  return (
    <section
      className="home-numbers home-motion-wrap"
      aria-label="Платформын бодит үзүүлэлтүүд"
      aria-busy={loading}
    >
      {items.map((item) => (
        <div key={item.label}>
          <item.icon size={18} aria-hidden="true" />
          <strong>
            {item.value != null ? (
              <>
                <HomeCount value={item.value} decimals={item.rating ? 1 : 0} />
                {item.rating && <small>/5</small>}
              </>
            ) : loading ? (
              <span className="home-stat-skeleton" aria-label="Ачаалж байна" />
            ) : (
              <span aria-label="Мэдээлэл түр боломжгүй">—</span>
            )}
          </strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}

"use client";
import { STORES } from "@/lib/stores";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PartnerMarquee() {
  // Гулгах эффектийг тасралтгүй харагдуулахын тулд жагсаалтыг давхарлана
  const items = [...STORES, ...STORES];

  return (
    <div className="relative overflow-hidden p-1">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10" />

        <div className="animate-marquee flex w-max items-center gap-8">
          {items.map((s, i) => (
            <div
              key={`${s.id}-${i}`}
              className="flex shrink-0 items-center gap-2"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-bone text-[10px] font-medium text-bone">
                {initials(s.name)}
              </div>
              <span className="whitespace-nowrap text-sm text-bone">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

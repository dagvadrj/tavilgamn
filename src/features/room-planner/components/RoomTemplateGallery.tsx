"use client";
import { useState } from "react";
import { ArrowRight, ChefHat, PencilRuler } from "lucide-react";
import type { RoomDesign, RoomType } from "@/lib/types";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { RoomTemplateShowcase } from "./RoomTemplateShowcase";
import "./room-templates.css";

export function RoomTemplateGallery({
  onBuild,
  onKitchen,
  onTemplate,
}: {
  onBuild: (type: RoomType) => void;
  onKitchen: () => void;
  onTemplate: (design: RoomDesign) => void;
}) {
  const [type, setType] = useState<RoomType>("living");
  return (
    <div className="room-template-library">
      <div className="room-planner-entry-choices">
      <article className="room-custom-card">
        <div className="room-custom-visual" aria-hidden="true">
          <span>Өөрийн хэмжээгээр</span>
          <svg viewBox="0 0 380 230">
            <defs>
              <pattern
                id="custom-room-oak"
                patternUnits="userSpaceOnUse"
                width="150"
                height="120"
              >
                <image
                  href="/textures/room/oak-natural-v1-color.webp"
                  width="150"
                  height="120"
                />
              </pattern>
            </defs>
            <path
              d="M38 134 190 76 340 134 190 210Z"
              fill="url(#custom-room-oak)"
            />
            <path d="M38 134V50L190 9V76Z" fill="#e1ded6" />
            <path d="M190 9 340 50V134L190 76Z" fill="#c3bfb7" />
            <path
              d="M38 50 190 9 340 50"
              fill="none"
              stroke="#fff"
              strokeWidth="7"
            />
            <path
              d="M38 134 190 76 340 134"
              fill="none"
              stroke="#f5f4ee"
              strokeWidth="4"
            />
            <path
              d="M76 64 119 53V116L76 132Z"
              fill="#f7f8f6"
              stroke="#fff"
              strokeWidth="5"
            />
            <path
              d="M91 60V125M106 56V120M76 87 119 75"
              stroke="#cbd4d7"
              strokeWidth="3"
            />
            <path
              d="M256 49 288 58V98L256 87Z"
              fill="#e4edef"
              stroke="#f9f9f5"
              strokeWidth="5"
            />
          </svg>
          <PencilRuler size={21} />
        </div>
        <div className="room-custom-copy">
          <h2>Өрөөгөө өөрийн хэмжээгээр байгуулъя</h2>
          <p>Хэлбэрээ зурж, хэмжээ, хаалга, цонх болон заслаа тохируулаарай.</p>
          <label>
            Өрөөний зориулалт
            <select
              value={type}
              onChange={(event) => setType(event.target.value as RoomType)}
            >
              {Object.entries(ROOM_TYPES).filter(([key]) => key !== "kitchen").map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"

            onClick={() => onBuild(type)}
          >
            Өрөө байгуулах <ArrowRight size={18} />
          </button>
        </div>
      </article>
      <article className="room-custom-card room-kitchen-card">
        <div className="room-custom-visual" aria-hidden="true">
          <span>Гал тогооны төлөвлөгч</span>
          <svg viewBox="0 0 380 230">
            <path d="M38 134 190 76 340 134 190 210Z" fill="url(#custom-room-oak)" />
            <path d="M38 134V50L190 9V76Z" fill="#e1ded6" />
            <path d="M190 9 340 50V134L190 76Z" fill="#c3bfb7" />
            <path d="M38 50 190 9 340 50" fill="none" stroke="#fff" strokeWidth="7" />
            <path d="M54 117 177 70 205 82 82 130Z" fill="#faf9f5" />
            <path d="M54 117V156L82 171V130Z" fill="#c4b8a4" />
            <path d="M82 130 205 82V123L82 171Z" fill="#e8e1d4" />
            <path d="M121 115V156M163 99V140" stroke="#b4aa99" strokeWidth="2" />
            <path d="M205 82 315 121 287 135 177 95Z" fill="#faf9f5" />
            <path d="M177 95 287 135V174L177 134Z" fill="#ded4c3" />
            <path d="M213 108V147M250 121V161" stroke="#b4aa99" strokeWidth="2" />
            <path d="M92 103 120 92 141 100 113 111Z" fill="#a4adb0" />
            <path d="M232 100 266 112 247 122 213 109Z" fill="#30383c" />
            <path d="M72 67 158 35V65L72 98Z" fill="#f5f3ee" />
            <path d="M114 51V82" stroke="#c4beb2" strokeWidth="2" />
            <path d="M220 43 275 61V82L220 64Z" fill="#e8e5dc" />
          </svg>
          <ChefHat size={21} />
        </div>
        <div className="room-custom-copy">
          <h2>Гал тогоогоо төлөвлөе</h2>
          <p>Өрөөгөө хэмжиж, тавилгаа сонгоод урьдчилсан үнэ, хэмжилтийн дараагийн алхмаа хараарай.</p>
          <span className="room-kitchen-steps">Хэмжих → Байрлуулах → Дуусгах</span>
          <button type="button" onClick={onKitchen}>
            Гал тогоо төлөвлөх <ArrowRight size={18} />
          </button>
        </div>
      </article>
      </div>
      <RoomTemplateShowcase onTemplate={onTemplate} />
    </div>
  );
}

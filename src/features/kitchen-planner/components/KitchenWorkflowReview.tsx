"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import Image from "next/image";
import type { KitchenBom } from "@/lib/kitchenBom";

export function KitchenWorkflowReview({
  measurement,
  name,
  bom,
  itemCount,
  image,
  issueMessages,
  plan,
  report,
  quoteRequest,
  saveActions,
  exports,
  onEdit,
  onEstimate,
  onMeasurement,
}: {
  measurement: boolean;
  name: string;
  bom: KitchenBom;
  itemCount: number;
  issueMessages: string[];
  plan: ReactNode;
  report: ReactNode;
  quoteRequest: ReactNode;
  saveActions: ReactNode;
  exports: ReactNode;
  image?: string | null;
  onEdit: () => void;
  onEstimate: () => void;
  onMeasurement: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [measurement]);
  const billable = bom.items.filter((item) => !item.included);
  return (
    <section
      className="kitchen-workflow-review"
      aria-labelledby="kitchen-review-title"
    >
      <div className="kitchen-review-container">
        <header className="kitchen-review-intro">
          <button
            type="button"
            className="kitchen-text-action"
            onClick={measurement ? onEstimate : onEdit}
          >
            <ArrowLeft size={16} />
            {measurement ? "Үнийн задаргаа" : "Тохижуулалт руу буцах"}
          </button>
          <span className="kitchen-review-eyebrow">
            {measurement ? "ДАРААГИЙН АЛХАМ" : "ТАНЫ ГАЛ ТОГОО"}
          </span>
          <h1 ref={heading} tabIndex={-1} id="kitchen-review-title">
            {measurement
              ? "Хэмжээгээ мэргэжилтнээр баталгаажуулъя."
              : "Сонголт тань нэг дор."}
          </h1>
          <p>
            {measurement
              ? "Үйлдвэрийн дизайнер таны төлөвлөгөөг хянаж, биечлэн хэмжсэний дараа эцсийн загвар, үнийг батална."
              : name +
                " · " +
                itemCount +
                " тавилга. Энэ нь таны сонголтод суурилсан урьдчилсан тооцоо."}
          </p>
        </header>
        <div className="kitchen-review-columns">
          <div className="kitchen-review-content">
            {measurement ? (
              <>
                <section
                  className="kitchen-review-card kitchen-measurement-steps"
                  aria-label="Хэмжилтээс үйлдвэрлэл хүртэл"
                >
                  {[
                    {
                      icon: ClipboardCheck,
                      title: "Төлөвлөгөөгөө илгээх",
                      text: "Сонголт, өрөөний хэмжээ, хүсэлтээ үйлдвэрт хүргэнэ.",
                    },
                    {
                      icon: CalendarDays,
                      title: "Хэмжилтийн цагаа тохирох",
                      text: "Үйлдвэрийн ажилтантай тохирч, биечлэн хэмжүүлнэ.",
                    },
                    {
                      icon: CheckCircle2,
                      title: "Эцсийн загвар, үнийг батлах",
                      text: "Бодит хэмжээнд зассан хувилбарыг зөвшөөрсний дараа үйлдвэрлэлд шилжинэ.",
                    },
                  ].map(({ icon: Icon, title, text }, index) => (
                    <div key={title}>
                      <span>
                        <Icon size={21} />
                      </span>
                      <div>
                        <small>{index + 1} / 3</small>
                        <h2>{title}</h2>
                        <p>{text}</p>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="kitchen-review-card kitchen-measurement-request">
                  <h2>Үйлдвэртэй холбогдох</h2>
                  {quoteRequest || (
                    <>
                      <p>
                        Үнийн хүсэлт илгээхийн тулд үйлдвэрийн нийтэлсэн гал
                        тогооны загварыг сонгож өөрчилнө. Одоогийн төлөвлөгөөгөө
                        хадгалж, үйлдвэрийн загваруудыг үзээрэй.
                      </p>
                      {saveActions}
                      <Link
                        href="/kitchens"
                        className="kitchen-review-secondary"
                      >
                        Үйлдвэрийн загварууд үзэх <ArrowRight size={16} />
                      </Link>
                    </>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="kitchen-review-card kitchen-estimate-plan">
                  <h2>Таны төлөвлөгөө</h2>
                  {image && (
                    <Image
                      unoptimized
                      src={image}
                      width={1200}
                      height={750}
                      alt="Таны гал тогооны 3D харагдац"
                      className="kitchen-workflow-preview"
                    />
                  )}
                  {plan}
                  <button
                    type="button"
                    className="kitchen-text-action"
                    onClick={onEdit}
                  >
                    3D дээр үргэлжлүүлж засах <ArrowRight size={16} />
                  </button>
                </section>
                <section className="kitchen-review-card kitchen-estimate-items">
                  <h2>
                    Сонгосон тавилга, материал{" "}
                    <small>{billable.length} мөр</small>
                  </h2>
                  {!billable.length && (
                    <p>Тохижуулах хэсгээс тавилгаа сонгоорой.</p>
                  )}
                  {billable.map((item) => (
                    <div className="kitchen-estimate-row" key={item.id}>
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {item.dimensions} · {item.quantity} {item.unit}
                        </small>
                      </div>
                      <span>
                        {item.unitPrice === null
                          ? "Үнэ тодруулна"
                          : (item.unitPrice * item.quantity).toLocaleString(
                              "mn-MN",
                            ) + " ₮"}
                      </span>
                    </div>
                  ))}
                </section>
                <details className="kitchen-review-card kitchen-review-downloads">
                  <summary>Жагсаалт, зураг татах</summary>
                  {report}
                  <div className="kitchen-review-export-actions">{exports}</div>
                </details>
              </>
            )}
          </div>
          <aside className="kitchen-review-side">
            <section className="kitchen-review-card kitchen-estimate-total">
              <small>
                {bom.unpricedCount ? "ҮНЭТЭЙ МӨРИЙН ДЭД ДҮН" : "УРЬДЧИЛСАН ДҮН"}
              </small>
              <strong>
                {!itemCount ? (
                  "Сонголт алга"
                ) : bom.unpricedCount > 0 && bom.knownSubtotal === 0 ? (
                  "Үнэ тодруулна"
                ) : (
                  <>
                    {bom.knownSubtotal.toLocaleString("mn-MN")} <span>₮</span>
                  </>
                )}
              </strong>
              <p>
                {bom.unpricedCount
                  ? bom.unpricedCount +
                    " мөрийн үнэ дутуу. Үйлдвэрээс тодруулсны дараа нийт дүн гарна."
                  : "Хэмжилт болон үйлдвэрлэгчийн баталгааны дараа эцсийн үнэ гарна."}
              </p>
              {!measurement && (
                <button
                  type="button"
                  className="kitchen-review-primary"
                  disabled={!itemCount}
                  onClick={onMeasurement}
                >
                  Хэмжилт хүсэх <ArrowRight size={17} />
                </button>
              )}
            </section>
            <section className="kitchen-review-card kitchen-measurement-notice">
              <ShieldCheck size={23} />
              <h2>Үйлдвэрлэхээс өмнө заавал хэмжинэ</h2>
              <p>
                Хана, булан, хоолой болон холболтуудыг газар дээр нь шалгана.
                Бодит хэмжилтээр загвар, үнэ нэмэгдэх эсвэл хасагдах боломжтой.
              </p>
            </section>
            {issueMessages.length > 0 && (
              <section className="kitchen-review-card kitchen-review-warnings">
                <Ruler size={20} />
                <h2>Шалгах зүйлс</h2>
                {issueMessages.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </section>
            )}
            {!measurement && (
              <div className="kitchen-review-save-actions">{saveActions}</div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { financingProviders } from "@/lib/financingProviders";
import { formatPrice } from "@/lib/format";
import "./product-financing.css";

export function ProductFinancingOptions({ total }: { total: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const provider = selected === null ? null : financingProviders[selected];

  useEffect(() => {
    if (provider && !dialog.current?.open) dialog.current?.showModal();
  }, [provider]);

  const close = () => {
    dialog.current?.close();
    setSelected(null);
  };

  return (
    <div className="pdp-financing-options">
      <div className="pdp-financing-options-heading">
        <span>Хувааж төлөх</span>
        <a href="#product-financing">
          Тооцоолох <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      </div>
      <div
        className="pdp-provider-icons"
        role="group"
        aria-label="Санхүүгийн байгууллагын нөхцөл"
      >
        {financingProviders.map((item, index) => (
          <button
            type="button"
            key={item.name}
            onClick={() => setSelected(index)}
            aria-haspopup="dialog"
            aria-label={`${item.name} — нөхцөл харах`}
          >
            <span
              className={`finance-monogram finance-${item.tone}`}
              aria-hidden="true"
            >
              {item.monogram}
            </span>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="pdp-provider-dialog"
        aria-labelledby="provider-dialog-title"
        aria-describedby="provider-dialog-note"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              close();
          }
        }}
      >
        {provider && (
          <>
            <header>
              <span
                className={`finance-monogram finance-${provider.tone}`}
                aria-hidden="true"
              >
                {provider.monogram}
              </span>
              <div>
                <h2 id="provider-dialog-title">{provider.name}</h2>
                <p>{provider.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Нөхцөлийн цонх хаах"
              >
                <X size={18} />
              </button>
            </header>
            <div className="pdp-provider-amount">
              <span>Барааны нийт үнэ</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <dl>
              {provider.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="pdp-provider-note" id="provider-dialog-note">
              {provider.note}
            </p>
            <p className="pdp-provider-disclosure">
              Үргэлжлүүлэхэд байгууллагын албан сайт шинэ цонхонд нээгдэнэ.
              Зээлийн эрх, эцсийн нөхцөлийг тэнд шалгана.
            </p>
            <a
              className="pdp-provider-continue"
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Үргэлжлүүлэх <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </>
        )}
      </dialog>
    </div>
  );
}

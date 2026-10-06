"use client";
import { useState } from "react";
import { installmentAmounts } from "@/lib/productExperience";
import { marketplacePrice } from "@/lib/homeMarketplace";

export function ProductInstallments({ total }: { total: number }) {
  const [provider, setProvider] = useState("StorePay");
  const amounts = installmentAmounts(total);
  if (!amounts.length) return null;
  const equal = amounts.every(amount => amount === amounts[0]);
  return <div className="pdp-installments">
    <div className="pdp-installment-heading"><span>Хувааж төлөх тооцоолуур</span><span className="pdp-estimate-tag">Жишиг тооцоо</span></div>
    <div className="pdp-provider-pills" role="group" aria-label="Хувааж төлөх үйлчилгээ">
      {["StorePay", "Pocket"].map(name => <button type="button" key={name} onClick={() => setProvider(name)} aria-pressed={provider === name}>{name}</button>)}
    </div>
    <p className="pdp-installment-price" aria-live="polite">{provider}: <strong>{equal ? `${marketplacePrice(amounts[0])} × 4` : `${marketplacePrice(amounts[amounts.length - 1])}–${marketplacePrice(amounts[0])} · 4 төлөлт`}</strong>{!equal && <small>Төгрөгийн зөрүүг төлөлтүүдэд хуваарилсан</small>}</p>
    <details><summary>4 төлөлтийн задаргаа · нийт {marketplacePrice(total)}</summary><ol>{amounts.map((amount, i) => <li key={i}><span>{i + 1}-р төлөлт</span><strong>{marketplacePrice(amount)}</strong></li>)}</ol></details>
    <p className="pdp-installment-note">Хугацаа, эрх, шимтгэлийн нөхцөлийг үйлчилгээний апп болон дэлгүүрээс баталгаажуулна. Энэ сайтаар хувааж төлөх үйлчилгээ хараахан холбогдоогүй.</p>
    <a href={provider === "StorePay" ? "https://storepay.mn/" : "https://pocket.mn/"} target="_blank" rel="noopener noreferrer">{provider}-ийн нөхцөл үзэх ↗</a>
  </div>;
}

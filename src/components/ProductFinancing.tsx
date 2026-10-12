"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { financingEstimate } from "@/lib/financing";
import { formatPrice } from "@/lib/format";
import "./product-financing.css";

export function ProductFinancing({ total }: { total: number }) {
  const [mode, setMode] = useState<"split" | "loan">("split");
  const [down, setDown] = useState(0);
  const [months, setMonths] = useState(12);
  const [rate, setRate] = useState("1.8");
  const [fee, setFee] = useState("0");
  const isLoan = mode === "loan";
  const estimate = financingEstimate(
    total,
    isLoan ? down : 0,
    isLoan ? months : 4,
    isLoan ? (rate.trim() === "" ? NaN : Number(rate)) : 0,
    isLoan ? (fee.trim() === "" ? NaN : Number(fee)) : 0,
  );

  return (
    <section
      id="product-financing"
      className="pdp-financing"
      aria-labelledby="financing-heading"
    >
      <header className="finance-heading">
        <h2 id="financing-heading">Хувааж төлөх боломж</h2>
        <span>Жишиг тооцоо</span>
      </header>
      <div className="finance-calculator">
        <div className="finance-compact-top">
          <div
            className="finance-mode"
            role="group"
            aria-label="Төлөлтийн төрөл"
          >
            <button
              type="button"
              aria-pressed={!isLoan}
              onClick={() => setMode("split")}
            >
              4 хуваах
            </button>
            <button
              type="button"
              aria-pressed={isLoan}
              onClick={() => setMode("loan")}
            >
              Сарын төлөлт
            </button>
          </div>
          <p className="finance-base-price">
            Барааны үнэ <strong>{formatPrice(total)}</strong>
          </p>
        </div>
        <div className="finance-compact-body">
          <div className="finance-controls">
            {isLoan ? (
              <>
                <div className="finance-compact-inputs">
                  <label>
                    Урьдчилгаа
                    <select
                      value={down}
                      onChange={(event) => setDown(Number(event.target.value))}
                    >
                      {[0, 10, 20, 30, 50].map((value) => (
                        <option key={value} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Хугацаа
                    <select
                      value={months}
                      onChange={(event) =>
                        setMonths(Number(event.target.value))
                      }
                    >
                      {[3, 6, 12, 18, 24, 30, 36].map((value) => (
                        <option key={value} value={value}>
                          {value} сар
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Сарын хүү (%)
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                    />
                  </label>
                  <label>
                    Шимтгэл (%)
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={fee}
                      onChange={(event) => setFee(event.target.value)}
                    />
                  </label>
                </div>
                <p className="finance-note">
                  1.8% нь жишээ хүү. Өөрийн саналын нөхцөлөөр өөрчилнө.
                </p>
              </>
            ) : (
              <p className="finance-compact-hint">
                <Calculator size={19} aria-hidden="true" />
                <span>
                  Хүүгүй, 4 тэнцүү хэсэгт хуваасан жишээ.
                  <small>
                    Төлөх хугацаа, эрхийг үйлчилгээний апп-аас шалгана.
                  </small>
                </span>
              </p>
            )}
          </div>
          <div className="finance-result" aria-live="polite" aria-atomic="true">
            {estimate ? (
              <>
                <span className="finance-result-label">
                  {isLoan ? "Сард" : "Нэг төлөлт"}
                </span>
                <strong className="finance-result-price">
                  {formatPrice(estimate.rows[0].payment)}{" "}
                  <small>× {estimate.rows.length}</small>
                </strong>
                <p className="finance-result-total">
                  Нийт төлөх{" "}
                  <strong>{formatPrice(estimate.totalPayment)}</strong>
                </p>
              </>
            ) : (
              <p role="alert">Хүү, шимтгэлийг 0–10% хооронд оруулна уу.</p>
            )}
          </div>
        </div>
        {estimate && (
          <details id="financing-schedule" className="finance-schedule">
            <summary>
              Төлөлтийн задаргаа <span>{estimate.rows.length} төлөлт</span>
            </summary>
            {isLoan && (
              <p className="finance-note">
                Урьдчилгаа: {formatPrice(estimate.downPayment)} · Эхэнд төлөх
                шимтгэл: {formatPrice(estimate.fee)} · Нийт хүү:{" "}
                {formatPrice(estimate.totalInterest)}
              </p>
            )}
            <div
              className="finance-table-scroll"
              role="region"
              aria-label="Төлөлтийн хуваарь"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">{isLoan ? "Сар" : "Төлөлт"}</th>
                    <th scope="col">Төлөх дүн</th>
                    <th scope="col">Үлдэгдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.rows.map((row) => (
                    <tr key={row.period}>
                      <th scope="row">{row.period}</th>
                      <td>{formatPrice(row.payment)}</td>
                      <td>{formatPrice(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="finance-note">
              {isLoan ? "Буурах үлдэгдлээс хүү тооцсон. " : ""}Бүхэл төгрөгт
              тоймлосон тул сүүлийн төлөлт бага зэрэг зөрж болно.
            </p>
          </details>
        )}
      </div>
      <p className="finance-note">
        Урьдчилсан тооцоо; зээлийн эрхийн баталгаа биш. Даатгал, бусад төлбөр
        ороогүй. Зээлийн хүсэлт илгээх үйлчилгээ холбогдоогүй.
      </p>
    </section>
  );
}

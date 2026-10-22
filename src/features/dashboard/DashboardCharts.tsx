"use client";

import { useId, useState } from "react";
import { ChartCircle, ChartPath, ChartRect } from "./ChartMotion";

export type ChartDatum = {
  label: string;
  primary: number;
  secondary?: number;
  primaryDisplay?: string;
  secondaryDisplay?: string;
};
const safe = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const compact = (value: number) =>
  new Intl.NumberFormat("mn-MN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** Optional display strings preserve monetary integer precision in tooltips. */
export function DashboardBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  formatValue = (value: number) => value.toLocaleString("mn-MN"),
  mode = "bar",
}: {
  data: ChartDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  formatValue?: (value: number) => string;
  mode?: "bar" | "line";
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((item) => ({
    ...item,
    primary: safe(item.primary),
    secondary: safe(item.secondary ?? 0),
  }));
  const maximum = Math.max(
    1,
    ...values.map((item) => item.primary + item.secondary),
  );
  const step = 480 / Math.max(1, values.length);
  const x = (index: number) => 60 + step * (index + 0.5);
  const height = (value: number) => (value / maximum) * 164;
  const selected = active === null ? null : values[active];
  const line = values
    .map(
      (item, index) =>
        `${index ? "L" : "M"}${x(index)},${190 - height(item.primary)}`,
    )
    .join(" ");
  return (
    <div className="v14-chart">
      {!values.length ||
      !values.some((item) => item.primary + item.secondary > 0) ? (
        <div className="v14-chart-empty">
          Энэ хугацаанд мэдээлэл бүртгэгдээгүй байна.
        </div>
      ) : (
        <>
          <div className="v14-chart-tooltip" aria-live="polite">
            {selected ? (
              <>
                <strong>{selected.label}</strong>
                <span>
                  {primaryLabel}:{" "}
                  {selected.primaryDisplay ?? formatValue(selected.primary)}
                </span>
                {secondaryLabel && (
                  <span>
                    {secondaryLabel}:{" "}
                    {selected.secondaryDisplay ??
                      formatValue(selected.secondary)}
                  </span>
                )}
              </>
            ) : (
              <span>Баганыг сонгож дүнг хараарай</span>
            )}
          </div>
          <svg
            viewBox="0 0 560 230"
            role="group"
            aria-label={`${primaryLabel}${secondaryLabel ? `, ${secondaryLabel}` : ""}`}
          >
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((tick) => (
              <g key={tick} className="v14-chart-grid">
                <line
                  x1="55"
                  x2="545"
                  y1={190 - tick * 164}
                  y2={190 - tick * 164}
                />
                <text x="45" y={194 - tick * 164} textAnchor="end">
                  {compact(maximum * tick)}
                </text>
              </g>
            ))}
            {mode === "line" && (
              <>
                <ChartPath
                  className="v14-chart-area"
                  d={`${line} L${x(values.length - 1)},190 L${x(0)},190 Z`}
                  fill={`url(#${id}-fill)`}
                />
                <ChartPath className="v14-chart-line" d={line} />
                {secondaryLabel && (
                  <ChartPath
                    className="v14-chart-line v14-chart-line-secondary"
                    d={values
                      .map(
                        (item, index) =>
                          `${index ? "L" : "M"}${x(index)},${190 - height(item.secondary)}`,
                      )
                      .join(" ")}
                  />
                )}
              </>
            )}
            {values.map((item, index) => {
              const description = `${item.label}: ${primaryLabel} ${item.primaryDisplay ?? formatValue(item.primary)}${secondaryLabel ? `, ${secondaryLabel} ${item.secondaryDisplay ?? formatValue(item.secondary)}` : ""}`;
              return (
                <g
                  key={`${item.label}-${index}`}
                  role="button"
                  tabIndex={0}
                  aria-label={description}
                  aria-pressed={active === index}
                  className={`v14-chart-point${active === index ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(index);
                    }
                    if (event.key === "Escape") setActive(null);
                  }}
                >
                  <title>{description}</title>
                  <rect
                    x={x(index) - step * 0.42}
                    y="16"
                    width={step * 0.84}
                    height="180"
                    fill="transparent"
                  />
                  {mode === "bar" ? (
                    <>
                      <ChartRect
                        entranceDelay={index * 55}
                        className="v14-bar-primary"
                        x={x(index) - Math.min(18, step * 0.28)}
                        y={190 - height(item.primary)}
                        width={Math.min(36, step * 0.56)}
                        height={height(item.primary)}
                        rx="5"
                      />
                      {item.secondary > 0 && (
                        <ChartRect
                          entranceDelay={index * 55}
                          className="v14-bar-secondary"
                          x={x(index) - Math.min(18, step * 0.28)}
                          y={190 - height(item.primary + item.secondary)}
                          width={Math.min(36, step * 0.56)}
                          height={height(item.secondary)}
                          rx="4"
                        />
                      )}
                    </>
                  ) : (
                    <circle
                      cx={x(index)}
                      cy={190 - height(item.primary)}
                      r={active === index ? 6 : 4}
                      className="v14-line-dot"
                    />
                  )}
                  {(index % Math.ceil(values.length / 7) === 0 ||
                    index === values.length - 1) && (
                    <text
                      className="v14-chart-label"
                      x={x(index)}
                      y="217"
                      textAnchor="middle"
                    >
                      {item.label.length > 13
                        ? `${item.label.slice(0, 12)}…`
                        : item.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </>
      )}
      <div className="v14-chart-legend">
        <span>
          <i className="v14-legend-primary" />
          {primaryLabel}
        </span>
        {secondaryLabel && (
          <span>
            <i className="v14-legend-secondary" />
            {secondaryLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function DashboardDonut({
  segments,
  center,
  caption,
}: {
  segments: { label: string; value: number; display: string }[];
  center: string;
  caption: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const values = segments.map((segment) => safe(segment.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return (
    <div className="v14-donut-layout">
      <div className="v14-donut-visual">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={segments
            .map((segment) => `${segment.label}: ${segment.display}`)
            .join(", ")}
        >
          <circle cx="100" cy="100" r="78" className="v14-donut-track" />
          {segments.map((segment, index) => {
            const fraction = total > 0 ? values[index] / total : 0;
            const start = cursor;
            cursor += fraction * 100;
            return (
              <ChartCircle
                key={segment.label}
                cx="100"
                cy="100"
                r="78"
                pathLength="100"
                strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`}
                strokeDashoffset={-start}
                className={`v14-donut-segment v14-segment-${index % 4}${selected === index ? " is-active" : ""}`}
              >
                <title>{`${segment.label}: ${segment.display}`}</title>
              </ChartCircle>
            );
          })}
        </svg>
        <div className="v14-donut-center">
          <strong>
            {selected === null || !segments[selected]
              ? center
              : total > 0
                ? `${((values[selected] / total) * 100).toFixed(1)}%`
                : "0%"}
          </strong>
          <small>
            {selected === null || !segments[selected]
              ? caption
              : segments[selected].label}
          </small>
        </div>
      </div>
      <ul className="v14-donut-legend">
        {segments.map((segment, index) => (
          <li key={segment.label}>
            <button
              type="button"
              aria-pressed={selected === index}
              onClick={() => setSelected(selected === index ? null : index)}
            >
              <span>
                <i className={`v14-segment-${index % 4}`} />
                {segment.label}
              </span>
              <strong>{segment.display}</strong>
            </button>
          </li>
        ))}
      </ul>
      {total === 0 && (
        <p className="v14-chart-note">Мэдээлэл хараахан бүртгэгдээгүй.</p>
      )}
    </div>
  );
}

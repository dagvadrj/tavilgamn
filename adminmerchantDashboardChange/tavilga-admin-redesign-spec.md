# Тавилга.mn Admin — "Minimal Monochrome" Redesign Spec

> **For Claude Code.** Redesign the existing admin dashboard at `/admin` (Next.js app, runs on `localhost:3000`) to match this spec on desktop **and** mobile, in **dark and light** mode.
> Reference images (attach alongside this file):
> - `tavilga-admin-mono-dark.png` — desktop, dark
> - `tavilga-admin-mono-light.png` — desktop, light
> - `tavilga-admin-mono-mobile.png` — mobile, dark + light
>
> All UI copy is Mongolian (Cyrillic) — use the exact strings in this doc. Numbers in the mockups are sample data; wire everything to the real data sources the current admin already uses.

---

## 0. Ground rules

1. **Explore first.** Before editing, read the current `/admin` route, its layout, components, data fetching, and styling setup (Tailwind / CSS modules / shadcn, etc.). Reuse the existing stack — do not add a new UI library unless nothing suitable exists.
2. **Don't break logic.** Keep all existing data fetching, API calls, auth guards and server actions. This is a presentation-layer rewrite.
3. **Keep every existing page reachable.** The current sidebar has ~11 icon-only entries (some duplicated icons). Map each to a labeled item in the new nav (§3). If a page doesn't fit a listed item, add it to the closest group — never drop one.
4. **Remove the old look entirely:** navy gradient background, glow, glassy blue cards, the duplicated page header/tabs ("Ерөнхий тойм" tab + "Ерөнхий тойм" title), and the two competing range filters (Өдөр/Долоо хоног/Сар **and** 7/30/90 хоног).
5. Mongolian everywhere — replace English labels (GMV, Merchant net, Platform fee, Featured, marketplace) with the Mongolian terms below.
6. Work in small commits: tokens → shell (sidebar/topbar) → overview page → mobile → polish.

---

## 1. Design principles

- **Monochrome + one accent.** Black/white/grays only. A single accent marks "now" and "needs attention" — nothing else.
- **No shadows, no gradients, no glass** (except the mobile bottom tab bar blur). Structure comes from **1px borders** and spacing.
- **Numbers are the hero.** Big, tight, tabular figures; small muted units.
- **Status by shape, not color:** filled dot = done/paid, hollow ring = pending, gray dot = neutral.
- **Dense but calm.** 13px base text, generous gutters.

---

## 2. Design tokens

Implement as CSS variables on `:root` (dark is the default) and `[data-theme="light"]`. If the project uses Tailwind, expose them via `theme.extend.colors` (e.g. `bg`, `panel`, `fg`, `fg-muted`, `fg-subtle`, `line`, `line-strong`, `hover`, `accent`, `accent-fg`, `bar`, `bar-hover`).

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0A0A0A` | `#FFFFFF` | page background |
| `--panel` | `#0F0F0F` | `#FAFAFA` | sidebar background |
| `--t1` | `#EDEDED` | `#0A0A0A` | primary text |
| `--t2` | `#A1A1A1` | `#5F5F5F` | secondary text / labels |
| `--t3` | `#666666` | `#9A9A9A` | muted text, axis, units |
| `--line` | `#1F1F1F` | `#EAEAEA` | borders, dividers |
| `--line2` | `#2A2A2A` | `#E0E0E0` | control borders (buttons, inputs) |
| `--hover` | `#161616` | `#F4F4F4` | hover / active nav / selected segment |
| `--acc` | `#D4FF3A` (lime) | `#0A0A0A` (black) | the **only** accent |
| `--accT` | `#0A0A0A` | `#FFFFFF` | text on accent |
| `--bar` | `#2E2E2E` | `#E4E4E4` | chart bars (default) |
| `--bar2` | `#4A4A4A` | `#C9C9C9` | chart bar hover |

**Typography**
- Font: **Inter** (body) + **Inter Display** (big numbers) — both support Cyrillic. Load via `next/font` (`Inter` from `next/font/google`; Inter Display can fall back to Inter at weight 600 with `letter-spacing:-0.03em`).
- Enable `font-feature-settings: "tnum", "cv11"` globally (tabular numbers).
- Scale: base 13px · labels 12px · section titles 13.5px/600 · page title 22px/600 (`-0.02em`) · KPI number 32px/600 (`-0.03em`) desktop, 24px mobile · units 15px/500 `--t3`.

**Shape & spacing**
- Radius: containers 10px (mobile 12px) · buttons/inputs 7–8px · chips 4px.
- Page padding 24px desktop / 16px mobile. Gap between sections 20px desktop / 14px mobile.
- Section header row: 14px 18px padding, bottom border `--line`.

---

## 3. App shell — desktop (≥1024px)

### Sidebar (224px, `--panel`, right border `--line`)
Top to bottom:
1. **Workspace switcher:** 24px black/white square with "т", "Тавилга.mn", chevron ⌄.
2. **Search field:** "Хайх" + `⌘K` kbd hint. Opens a command palette (if one exists; otherwise a simple search modal — or leave as a stub with a TODO).
3. Nav items (16px stroke icons, 1.6 stroke, label, right-aligned count in `--t3`):

| Group | Item | Count/badge |
|---|---|---|
| — | Тойм (active) | — |
| — | Захиалга | total orders |
| — | Бүтээгдэхүүн | total products |
| — | 3D загвар | **accent badge** = pending 3D requests |
| Худалдаа | Дэлгүүрүүд | active merchants |
| Худалдаа | Төлбөр, тооцоо | — |
| Худалдаа | Сурталчилгаа | — |
| Худалдаа | Ангилал | — |
| Систем | Хэрэглэгчид | — |
| Систем | Мессеж | unread |
| Систем | Тохиргоо | — |

   Group labels: 11px, `--t3`. Active item: `--hover` background, `--t1` text. Others `--t2`.
4. **User block** pinned to the bottom (top border): avatar circle with initial, name, email in `--t3`.

### Top bar (52px, bottom border)
- Left: breadcrumb `Тавилга.mn / **Тойм**`.
- Right: segmented range control `7х | 30х | 90х | Жил` (single source of truth for the date range on the page) · button "Өмнөх үетэй харьцуулах" (toggle) · button "Экспорт" (CSV of current view) · primary button "+ Шинэ" (inverted: `--t1` bg, `--bg` text).
- Theme toggle: add a small icon button (sun/moon) here or in the user menu. Persist choice in `localStorage` and respect `prefers-color-scheme` on first load; set `data-theme` on `<html>` before paint to avoid flash.

---

## 4. Overview page (`/admin`) — desktop layout

```
Тойм  9-р сарын 29 – 10-р сарын 29, 2026        (title + muted date range)

┌ KPI strip: 4 equal columns in ONE bordered container, vertical dividers ┐

┌ Өдрийн борлуулалт (bar chart) ─────────────┐ ┌ Анхаарах зүйлс (360px) ┐
└────────────────────────────────────────────┘ └────────────────────────┘

┌ Сүүлийн захиалгууд (table) ──────────────────────────────────────────┐
```

### 4.1 KPI strip
Each cell: label (left, `--t2`) + delta (right) · big number + unit · one-line context · 24-bar micro chart (22px tall, last bar = `--acc`, rest `--bar`).

| Label | Value | Unit | Context line | Data |
|---|---|---|---|---|
| Нийт борлуулалт | sum of paid orders | сая ₮ | **{n}** төлөгдсөн захиалга | (was "Нийт GMV") |
| Платформын орлого | platform commission | сая ₮ | Шимтгэл **{rate}%** | |
| Дэлгүүрт олгох | merchant net payout | сая ₮ | **{n}** идэвхтэй дэлгүүр | |
| Дундаж захиалга | avg order value | мян ₮ | Хөрвүүлэлт **{x}%** (hide if no data) | |

- Delta = % change vs previous equal period. Positive → `--t1` with "+"; negative → `--t3` with "−" (no red/green).
- Format: ≥1,000,000 → `48.6` + "сая ₮"; ≥1,000 → `227` + "мян ₮"; use a shared `formatMNT()` helper.

### 4.2 Өдрийн борлуулалт (main chart)
- Header: title + muted "· сая ₮" + segmented toggle `Борлуулалт | Захиалга` (switches metric).
- Vertical bars, one per day of the selected range; 3 dashed horizontal gridlines (`--line`, dash 2/4) with left axis labels in `--t3`.
- Today's bar = `--acc`. Hovered bar = `--bar2` + tooltip (inverted colors: `--t1` bg, `--bg` text): "10.23 · Пүрэв" / "**2.31 сая ₮ · 11**" (amount · orders).
- X-axis: ~5 date labels `M.DD`.
- If "Өмнөх үетэй харьцуулах" is on, overlay previous period as thin outline bars or a dashed line in `--t3`.
- Use the chart lib already in the project (e.g. Recharts); otherwise plain SVG/CSS bars are fine.

### 4.3 Анхаарах зүйлс (action inbox) — replaces the donut
Header: title + count + "Бүгд →". Rows: dot · title (500) · sub-line (`--t3`) · relative time (`2м`, `1ц`, `1ө`).
Accent dot (with 3px soft ring) for items that need action now. Build from real data where available:
- 3D загвар батлах хүлээгдэж байна — pending 3D model requests
- Дэлгүүрийн тооцоо илгээх — merchant payouts due
- Шинэ дэлгүүр бүртгүүлэх хүсэлт — merchant applications
- Үлдэгдэл дуусаж байна — low stock
- Сурталчилгааны хугацаа дуусна — ads expiring soon

Each row links to the relevant page. If a source doesn't exist yet, omit that row type (don't fake it).

### 4.4 Сүүлийн захиалгууд (table)
Columns: Дугаар · Бүтээгдэхүүн · Дэлгүүр · Худалдан авагч · Төлөв · Дүн (right-aligned, tabular). Show latest 5. Row dividers `--line`, no zebra. Header "Бүгдийг харах →" links to Захиалга.
Status: `Төлөгдсөн` (accent filled dot) · `Хүлээгдэж буй` (hollow ring) · `Хүргэлтэд` (gray dot) · `Цуцлагдсан` (gray dot, text `--t3`).

### 4.5 Other blocks from the old page
- "Дэлгүүрүүдийн борлуулалт" → move to the Дэлгүүрүүд page (or a compact "Шилдэг дэлгүүрүүд" list under the inbox if space allows).
- "Худалдааны хяналт" / nested card-in-card sections → flatten into plain bordered sections, no nesting.

---

## 5. Mobile (<768px) — see `tavilga-admin-mono-mobile.png`

- **No sidebar.** Header row: workspace switcher (left) + 34px icon buttons for search and notifications (right).
- Title "Тойм" 24px + date range below in `--t3`.
- Range segmented control **full width** (4 equal segments).
- **KPI grid 2×2** inside one bordered container (dividers between cells). Short labels: Борлуулалт / Платформ / Дэлгүүрт / Дундаж. Number 24px. Drop the micro bar charts and context lines on mobile.
- Chart card: title + right "Өнөөдөр {amount}"; bars only (no axis labels), 110px tall; today's bar accent. Tap a bar = tooltip.
- Анхаарах зүйлс: show top 2 rows + "5 →".
- Сүүлийн захиалгууд: **list, not table** — product name (500) + "#10482 · Ekvl" muted on the left; amount + status dot/label on the right.
- **Bottom tab bar** (84px incl. safe area, `--bg` at 88% + `backdrop-filter: blur(16px)`, top border): Тойм · Захиалга · **[+]** (44px inverted rounded square — create menu) · 3D (accent count badge) · Цэс (opens a full-screen sheet with the complete nav from §3).
- Add `padding-bottom` so content isn't hidden behind the tab bar; respect `env(safe-area-inset-bottom)`.
- Tablet (768–1023px): collapse sidebar to a 64px icon rail with tooltips; KPI strip becomes 2×2.

---

## 6. States

- **Empty (no data in range):** keep the layout. KPI shows `0` + unit, delta hidden. Chart shows flat placeholder bars in `--bar` at 4px height with a single muted line: "Энэ хугацаанд захиалга алга." — never a huge empty box. Hide the inbox section if it has zero items, or show "Анхаарах зүйл алга ✓".
- **Loading:** skeleton blocks in `--hover`, same sizes as final content, subtle pulse.
- **Error:** inline row in the affected section, `--t2` text + "Дахин оролдох" button.

---

## 7. Interaction & accessibility

- Hover: rows/nav → `--hover` background; buttons → border `--t3`. Transitions 120ms, no bounce.
- Focus: visible 2px outline in `--t1` with 2px offset on all interactive elements.
- Contrast: body text must meet WCAG AA in both themes (the token set above does; don't use `--t3` for anything essential smaller than 12px).
- Touch targets ≥ 40px on mobile.
- Keyboard: `⌘K`/`Ctrl+K` opens search; range control is arrow-key navigable.

---

## 8. Acceptance checklist

- [ ] Dark and light match the reference PNGs; theme toggle persists and has no flash on reload.
- [ ] Only one date-range control on the page; every block responds to it.
- [ ] Sidebar items all have labels; no duplicate icons; every old admin page still reachable.
- [ ] No English labels left in the UI (except brand/merchant names).
- [ ] KPI strip is first content after the title.
- [ ] Mobile at 375–430px: no horizontal scroll, bottom tab bar works, table becomes list.
- [ ] Empty, loading and error states implemented.
- [ ] `npm run build` and lint pass; no data-fetching logic was removed.

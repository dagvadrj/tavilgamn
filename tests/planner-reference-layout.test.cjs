const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { House, Paintbrush } = require("lucide-react");
const { loadSource } = require("./helpers/load-source.cjs");

const { PlannerRail } = loadSource("src/features/planner/components/PlannerRail.tsx");
const source = file => fs.readFileSync(file, "utf8");

test("shared planner rail exposes accessible active and disabled tools without changing project state", () => {
  const html = renderToStaticMarkup(React.createElement(PlannerRail, { items: [
    { id: "room", label: "Өрөө", Icon: House, active: true, onClick() {} },
    { id: "materials", label: "Өнгө, материал", Icon: Paintbrush, active: false, disabled: true, onClick() {} },
  ] }));
  assert.match(html, /aria-label="Төлөвлөгчийн хэрэгслүүд"/);
  assert.match(html, /aria-label="Өрөө" aria-pressed="true"/);
  assert.match(html, /aria-pressed="false" disabled=""/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(source("src/features/planner/components/PlannerRail.tsx"), /useAuth|localStorage|commit\(/);
});

test("both planners retain lazy 3D scenes and only open room inspectors reserve space", () => {
  for (const file of ["src/components/RoomPlanner.tsx", "src/components/ModularKitchenPlanner.tsx"]) {
    const text = source(file);
    assert.match(text, /planner-reference/);
    assert.match(text, /planner-reference\.css/);
    assert.match(text, /ssr: false/);
  }
  const room = source("src/components/RoomPlanner.tsx");
  assert.match(source("src/components/ModularKitchenPlanner.tsx"), /<PlannerRail/);
  assert.match(room, /active=\{inspector === "catalog" && leftOpen\}/);
  assert.match(room, /active=\{inspector === "environment" && rightOpen\}/);
  assert.match(room, /aria-label="Тавилгын ангилал"/);
  assert.match(source("src/features/room-planner/components/PlannerPanels.tsx"), /if \(!active\) return null/);
});

test("kitchen opens without a wizard and keeps layout selection available in the mobile inspector", () => {
  const entry = source("src/components/KitchenPlanner.tsx");
  assert.doesNotMatch(entry, /KitchenSuggestionWizard|openEditor/);
  assert.match(entry, /<ModularKitchenPlanner/);
  assert.match(entry, /queryString=\{query\}/);
  const kitchen = source("src/components/ModularKitchenPlanner.tsx");
  assert.match(kitchen, /<span>Гарнитурын байрлал<\/span>/);
  assert.match(kitchen, /KITCHEN_LAYOUT_OPTIONS\.map/);
  assert.match(kitchen, /inspector === "selection" \|\| componentOverview/);
  assert.match(kitchen, /inspectorTab === "selection" && !selected \? "materials"/);
});

test("reference grid reserves a bounded canvas row and mobile inspectors collapse independently", () => {
  const css = source("src/features/planner/components/planner-reference.css");
  assert.match(css, /\.kp-layout[^}]*grid-template-rows: minmax\(0,1fr\)[^}]*align-items: stretch[^}]*gap: 0/);
  assert.match(css, /\.kp-settings[^}]*min-height: 0/);
  assert.match(css, /@media \(max-width:959px\)/);
  assert.match(css, /\.kp-settings\.is-open\s*\{\s*display: flex;\s*\}/);
  assert.match(css, /\.planner-drawer-backdrop/);
});

test("inactive room inspectors render no content or backdrop", () => {
  const { Drawer } = loadSource("src/features/room-planner/components/PlannerPanels.tsx");
  const props = { side: "right", open: true, title: "Тохиргоо", onClose() {}, children: "Сонголтууд" };
  assert.equal(renderToStaticMarkup(React.createElement(Drawer, { ...props, active: false })), "");
  const active = renderToStaticMarkup(React.createElement(Drawer, { ...props, active: true }));
  assert.match(active, /Сонголтууд/);
  assert.match(active, /planner-drawer-backdrop/);
  assert.match(active, /aria-label="Самбар хаах"/);
});

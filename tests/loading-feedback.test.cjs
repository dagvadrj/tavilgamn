const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("planner navigation targets only a different local planner destination", () => {
  const { plannerNavigationTarget: target } = loadSource(
    "src/lib/plannerNavigation.ts",
  );
  const current = "https://tavilga.mn/catalog";
  assert.deepEqual(target("/planner?design=saved", current), {
    from: "/catalog",
    target: "/planner?design=saved",
    kind: "room",
  });
  assert.equal(target("/kitchen?design=k1", current).kind, "kitchen");
  assert.equal(
    target("/planner?name=a+b", "https://tavilga.mn/planner?name=a%20b"),
    null,
  );
  assert.equal(
    target("/planner", "https://tavilga.mn/catalog?name=a%20b").from,
    "/catalog?name=a+b",
  );
  for (const href of [
    "https://other.test/planner",
    "/catalog",
    "/kitchens",
    "/planner/download",
    "javascript:alert(1)",
    "mailto:test@test.test",
  ])
    assert.equal(target(href, current), null, href);
  assert.equal(
    target(
      "/planner?design=saved#part",
      "https://tavilga.mn/planner?design=saved",
    ),
    null,
  );
});

test("stale navigation completions cannot dismiss a newer click; SSR and subscriptions are safe", () => {
  const original = global.window;
  const nav = loadSource("src/lib/plannerNavigation.ts");
  let updates = 0;
  const unsubscribe = nav.subscribePlannerNavigation(() => updates++);
  try {
    delete global.window;
    nav.startPlannerNavigation("/planner");
    assert.equal(nav.getPlannerNavigation(), null);
    global.window = { location: { href: "https://tavilga.mn/catalog" } };
    nav.startPlannerNavigation("/planner");
    const first = nav.getPlannerNavigation();
    nav.startPlannerNavigation("/kitchen?design=preserved");
    const second = nav.getPlannerNavigation();
    nav.finishPlannerNavigation(first.id);
    assert.equal(nav.getPlannerNavigation(), second);
    assert.equal(nav.getServerPlannerNavigation(), null);
    assert.equal(second.target, "/kitchen?design=preserved");
    nav.finishPlannerNavigation(second.id);
    assert.equal(nav.getPlannerNavigation(), null);
    assert.equal(updates, 3);
    unsubscribe();
    nav.startPlannerNavigation("/planner");
    assert.equal(updates, 3);
  } finally {
    global.window = original;
    unsubscribe();
  }
});

test("planner links preserve Next Link semantics and respect a parent's cancelled navigation", () => {
  const starts = [];
  const { PlannerLink } = loadSource("src/components/PlannerLink.tsx", {
    "next/link": { default: () => null },
    "@/lib/plannerNavigation": {
      startPlannerNavigation: (href) => starts.push(href),
    },
  });
  const click = () => {};
  const normal = PlannerLink({
    href: "/planner?design=existing",
    onClick: click,
    target: "_self",
    children: "Open",
  });
  assert.equal(normal.props.onClick, click);
  assert.equal(normal.props.href, "/planner?design=existing");
  normal.props.onNavigate({
    preventDefault() {
      throw Error("must not cancel normal navigation");
    },
  });
  assert.deepEqual(starts, ["/planner?design=existing"]);
  let cancelled = false;
  PlannerLink({
    href: "/kitchen",
    onNavigate: (event) => event.preventDefault(),
  }).props.onNavigate({
    preventDefault() {
      cancelled = true;
    },
  });
  assert.equal(cancelled, true);
  assert.equal(starts.length, 1);
});

test("loading fields match each form and remain non-interactive with one live announcement", () => {
  const { PageSkeleton } = loadSource("src/components/PageSkeleton.tsx");
  const { loadingForms } = loadSource("src/components/loading/loadingForms.ts");
  for (const [layout, form] of Object.entries(loadingForms)) {
    const html = renderToStaticMarkup(
      React.createElement(PageSkeleton, { layout }),
    );
    assert.equal(
      (html.match(/class="skeleton-form-field(?: |")/g) ?? []).length,
      form.fields.length,
      layout,
    );
    for (const field of form.fields)
      assert.ok(
        html.includes(typeof field === "string" ? field : field.label),
        `${layout}: ${field}`,
      );
    assert.equal((html.match(/role="status"/g) ?? []).length, 1);
    assert.ok(
      !/<(?:input|button|select|textarea)\b/.test(html),
      "placeholders must not be focusable",
    );
    assert.ok(!html.includes("page-skeleton-hero"));
  }
  assert.equal(loadingForms.login.fields.length, 2);
  assert.equal(loadingForms.register.fields.length, 3);
  for (const layout of [
    "cart",
    "order",
    "account",
    "rows",
    "list",
    "metrics",
    "document",
    "room-start",
    "kitchen-planner",
    "viewport",
    "status",
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(PageSkeleton, { layout }),
    );
    assert.ok(!html.includes("page-skeleton-hero"), layout);
    assert.ok(html.includes('aria-busy="true"'));
  }
  const fallback = renderToStaticMarkup(React.createElement(PageSkeleton));
  assert.ok(fallback.includes('data-loading-layout="status"'));
  assert.ok(
    !fallback.includes("skeleton-field"),
    "unknown destinations never guess a large form or hero",
  );
});

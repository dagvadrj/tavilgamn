const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const read = (file) => fs.readFileSync(file, "utf8");
// A closed native dialog is inaccessible in the browser, but SSR includes its
// dormant markup. Assert the desktop copy separately rather than double-count it.
const desktopMarkup = (html) => html.split("<dialog")[0];

function elements(node, predicate, found = []) {
  if (!React.isValidElement(node)) return found;
  if (predicate(node)) found.push(node);
  for (const child of React.Children.toArray(node.props.children))
    elements(child, predicate, found);
  return found;
}

test("admin and merchant keep public URLs but no longer inherit storefront chrome", () => {
  const layout = read("src/app/(admin)/layout.tsx");
  assert.doesNotMatch(layout, /<Header\b|<Footer\b|shop-shell/);
  assert.doesNotMatch(layout, /<main\b/);
  assert.match(
    read("src/components/MerchantShell.tsx"),
    /<main\s+id="main-content"/,
  );
  assert.match(read("src/app/(admin)/admin/page.tsx"), /id="main-content"/);
  assert.ok(fs.existsSync("src/app/(admin)/admin/page.tsx"));
  assert.ok(fs.existsSync("src/app/(admin)/merchant/page.tsx"));
  assert.equal(fs.existsSync("src/app/(shop)/merchant/page.tsx"), false);
  assert.match(
    read("src/app/(admin)/merchant/page.tsx"),
    /<MerchantDashboard\s*\/>/,
  );
  assert.match(read("src/app/(shop)/layout.tsx"), /<Header\b/);
  assert.match(read("src/app/(shop)/layout.tsx"), /<Footer\b/);
});

test("full admin sidebar preserves every operation and marks only the selected destination", () => {
  const { AdminSidebar, ADMIN_TABS } = loadSource(
    "src/components/AdminSidebar.tsx",
  );
  assert.deepEqual(
    ADMIN_TABS.map((tab) => tab.id),
    [
      "dashboard",
      "merchants",
      "furniture",
      "orders",
      "users",
      "messages",
      "models",
      "kitchens",
      "settings",
    ],
  );
  const html = desktopMarkup(
    renderToStaticMarkup(
      React.createElement(AdminSidebar, {
        active: "orders",
        onChange() {},
        userName: "Тест админ",
        email: "admin@example.com",
        open: false,
        onClose() {},
      }),
    ),
  );
  for (const tab of ADMIN_TABS)
    assert.ok(html.includes(tab.label), `Missing ${tab.label}`);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(html, /href="\/account"/);
  assert.match(html, /aria-label=/);
});

test("merchant sidebar keeps all operations and settings and disables private store operations before store creation", () => {
  const { MerchantSidebar, MERCHANT_TABS } = loadSource(
    "src/components/MerchantSidebar.tsx",
  );
  assert.deepEqual(
    MERCHANT_TABS.map((tab) => tab.id),
    ["overview", "products", "orders", "kitchens", "quotes", "store", "settings"],
  );
  const props = {
    active: "overview",
    onChange() {},
    hasStore: false,
    userName: "Тест худалдаачин",
    storeName: "Тест дэлгүүр",
    open: false,
    onClose() {},
  };
  const locked = desktopMarkup(
    renderToStaticMarkup(React.createElement(MerchantSidebar, props)),
  );
  for (const tab of MERCHANT_TABS)
    assert.ok(locked.includes(tab.label), `Missing ${tab.label}`);
  assert.equal((locked.match(/disabled=""/g) ?? []).length, 4);
  assert.equal((locked.match(/aria-current="page"/g) ?? []).length, 1);
  const unlocked = desktopMarkup(
    renderToStaticMarkup(
      React.createElement(MerchantSidebar, { ...props, hasStore: true }),
    ),
  );
  assert.equal((unlocked.match(/disabled=""/g) ?? []).length, 0);
});

test("redesign retains private workspace guards and merchant ownership checks", () => {
  const admin = read("src/app/(admin)/admin/page.tsx");
  const merchant = read("src/components/MerchantDashboard.tsx");
  assert.match(
    admin,
    /if\s*\(!initialized\s*\|\|\s*!user\s*\|\|\s*role !== "admin"\)/,
  );
  assert.match(admin, /router\.replace\("\/login\?next=\/admin"\)/);
  assert.match(merchant, /if\s*\(role !== "merchant"\)/);
  assert.match(
    merchant,
    /<MerchantWorkspace\s+key=\{user\.id\}\s+owner=\{user\.id\}/,
  );
  const merchantApi = read("src/features/merchant/merchantApi.ts");
  assert.match(merchantApi, /useAuth\.getState\(\)\.user\?\.id === owner/);
  assert.match(merchantApi, /useAuth\.getState\(\)\.role === "merchant"/);
});

test("headers do not advertise an inactive keyboard shortcut or a dummy message control", () => {
  const admin = read("src/components/AdminHeader.tsx");
  const merchant = read("src/components/MerchantHeader.tsx");
  assert.doesNotMatch(admin, /⌘\s*K|<kbd>/);
  assert.doesNotMatch(merchant, /⌘\s*K|<kbd>/);
  assert.doesNotMatch(admin, /admin-header-notification/);
  assert.match(merchant, /onQuotes/);
  assert.match(merchant, /<MerchantNotifications\b/);
});

test("merchant header actions are real callbacks, linked to the mobile dialog, and store-gated", () => {
  const calls = [];
  const { MerchantHeader } = loadSource("src/components/MerchantHeader.tsx");
  const tree = MerchantHeader({
    userName: "Тест",
    storeName: "Тест дэлгүүр",
    owner: "owner",
    activeLabel: "Ерөнхий тойм",
    hasStore: false,
    sidebarOpen: false,
    onProducts: () => calls.push("products"),
    onQuotes: () => calls.push("quotes"),
    onKitchens() {},
    onToggleSidebar: () => calls.push("menu"),
  });
  const buttons = elements(tree, (node) => node.type === "button");
  for (const button of buttons)
    assert.equal(typeof button.props.onClick, "function");
  const menu = buttons.find((button) => button.props["aria-controls"]);
  assert.equal(menu.props["aria-controls"], "merchant-dashboard-navigation");
  assert.equal(menu.props["aria-expanded"], false);
  const quotes = buttons.find(
    (button) => button.props["aria-label"] === "Үнийн хүсэлтүүд",
  );
  assert.equal(quotes.props.disabled, true);
  quotes.props.onClick();
  assert.deepEqual(calls, ["quotes"]);
});

test("admin header navigation has working callbacks and exposes matching dialog state", () => {
  const calls = [];
  const { AdminHeader } = loadSource("src/components/AdminHeader.tsx");
  const tree = AdminHeader({
    userName: "Тест админ",
    activeLabel: "Бүтээгдэхүүн",
    menuOpen: true,
    onProducts: () => calls.push("products"),
    onSettings: () => calls.push("settings"),
    onMessages: () => calls.push("messages"),
    onToggleMenu: () => calls.push("menu"),
  });
  const buttons = elements(tree, (node) => node.type === "button");
  for (const button of buttons)
    assert.equal(typeof button.props.onClick, "function");
  const menu = buttons.find((button) => button.props["aria-controls"]);
  assert.equal(menu.props["aria-controls"], "admin-navigation");
  assert.equal(menu.props["aria-expanded"], true);
  buttons
    .find((button) => button.props["aria-label"] === "Самбарын тохиргоо")
    .props.onClick();
  assert.deepEqual(calls, ["settings"]);
});

test("mobile sidebar uses native dialog behavior and restores scroll on close and desktop resize", () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const effects = [];
  let closeRequests = 0;
  const media = {
    matches: false,
    listener: null,
    addEventListener(kind, handler) {
      assert.equal(kind, "change");
      this.listener = handler;
    },
    removeEventListener(kind, handler) {
      assert.equal(kind, "change");
      assert.equal(this.listener, handler);
      this.listener = null;
    },
  };
  const dialog = {
    open: false,
    shows: 0,
    closes: 0,
    showModal() {
      this.open = true;
      this.shows++;
    },
    close() {
      this.open = false;
      this.closes++;
    },
  };
  global.window = {
    matchMedia(query) {
      assert.equal(query, "(min-width: 1024px)");
      return media;
    },
  };
  global.document = { body: { style: { overflow: "scroll" } } };
  try {
    const { DashboardSidebar } = loadSource(
      "src/features/dashboard/components/DashboardSidebar.tsx",
      {
        react: {
          ...React,
          useRef: () => ({ current: dialog }),
          useEffect: (effect) => effects.push(effect),
        },
      },
    );
    const tree = DashboardSidebar({
      children: React.createElement("nav", null, "Цэс"),
      open: true,
      onClose: () => closeRequests++,
      label: "Удирдлага",
      id: "test-menu",
    });
    const nativeDialog = elements(tree, (node) => node.type === "dialog")[0];
    assert.equal(nativeDialog.props.id, "test-menu");
    assert.equal(nativeDialog.props["aria-label"], "Удирдлага");
    const cleanup = effects[0]();
    assert.equal(dialog.shows, 1);
    assert.equal(global.document.body.style.overflow, "hidden");
    let prevented = false;
    nativeDialog.props.onCancel({
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
    assert.equal(closeRequests, 1);
    nativeDialog.props.onClick({ target: "child", currentTarget: "dialog" });
    assert.equal(closeRequests, 1);
    nativeDialog.props.onClick({ target: "dialog", currentTarget: "dialog" });
    assert.equal(closeRequests, 2);
    media.matches = true;
    media.listener();
    assert.equal(closeRequests, 3);
    cleanup();
    assert.equal(dialog.open, false);
    assert.equal(global.document.body.style.overflow, "scroll");
    assert.equal(media.listener, null);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test("dashboard styles provide local dark tokens, visible focus and reduced-motion/mobile behavior", () => {
  const css = read("src/features/dashboard/dashboard.css");
  assert.match(css, /--dashboard-bg:\s*#090a0c/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*1023px\)/);
  assert.doesNotMatch(
    css,
    /(^|})\s*(?:body|button|input|select|textarea|\.btn-primary|\.btn-ghost|\.input)\s*[{,]/,
  );
});

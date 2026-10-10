const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

const preferencesModule = loadSource("src/features/dashboard/preferences.ts");

test("dashboard preferences tolerate stale or corrupt browser storage", () => {
  const { parseDashboardPreferences, DEFAULT_DASHBOARD_PREFERENCES } = preferencesModule;
  for (const raw of [null, "broken", "null", "{}", '{"density":"other","textSize":"huge","overview":"private"}']) {
    assert.deepEqual(parseDashboardPreferences(raw), DEFAULT_DASHBOARD_PREFERENCES);
  }
  assert.deepEqual(parseDashboardPreferences('{"density":"compact","textSize":"large","overview":"inventory"}'), {
    density: "compact", textSize: "large", overview: "inventory",
  });
});

test("preference updates persist across remounts, merge current values, and remain isolated by account and role", () => {
  const originalWindow = global.window;
  const values = new Map();
  const events = [];
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  try {
    const { useDashboardPreferences } = loadSource("src/features/dashboard/useDashboardPreferences.ts", {
      react: {
        useCallback: (callback) => callback,
        useMemo: (callback) => callback(),
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      },
    });
    const first = useDashboardPreferences("owner-a", "merchant");
    assert.equal(first.updatePreferences({ density: "compact" }), true);
    // An older mounted consumer must merge against the latest stored settings.
    assert.equal(first.updatePreferences({ textSize: "large" }), true);
    assert.deepEqual(useDashboardPreferences("owner-a", "merchant").preferences, {
      density: "compact", textSize: "large", overview: "all",
    });
    for (const [owner, role] of [["owner-b", "merchant"], ["owner-a", "admin"]]) {
      assert.deepEqual(useDashboardPreferences(owner, role).preferences, preferencesModule.DEFAULT_DASHBOARD_PREFERENCES);
    }
    assert.equal(events.length, 2);
    global.window.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    assert.equal(first.updatePreferences({ overview: "sales" }), false);
    assert.equal(useDashboardPreferences("owner-a", "merchant").preferences.overview, "all");
  } finally {
    global.window = originalWindow;
  }
});

test("dashboard settings route each control to its real preference or store action", () => {
  const changes = [];
  let storeOpens = 0;
  const { DashboardSettings } = loadSource("src/features/dashboard/DashboardSettings.tsx", {
    react: { ...React, useState: (initial) => [initial, () => {}] },
    "@/store/auth": { useAuth: (selector) => selector({ user: { name: "Тест", email: "test@example.com" } }) },
  });
  function findAll(node, predicate, found = []) {
    if (!React.isValidElement(node)) return found;
    if (predicate(node)) found.push(node);
    for (const child of React.Children.toArray(node.props.children)) findAll(child, predicate, found);
    return found;
  }
  const tree = DashboardSettings({
    role: "merchant", preferences: preferencesModule.DEFAULT_DASHBOARD_PREFERENCES,
    onChange: (patch) => { changes.push(patch); return true; },
    onStore: () => storeOpens++,
  });
  const inputs = findAll(tree, (node) => node.type === "input");
  inputs.find((node) => node.props.value === "compact").props.onChange();
  inputs.find((node) => node.props.value === "large").props.onChange();
  findAll(tree, (node) => node.type === "select")[0].props.onChange({ target: { value: "inventory" } });
  const buttons = findAll(tree, (node) => node.type === "button");
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(changes, [{ density: "compact" }, { textSize: "large" }, { overview: "inventory" }, preferencesModule.DEFAULT_DASHBOARD_PREFERENCES]);
  assert.equal(storeOpens, 1);
  const admin = DashboardSettings({ role: "admin", preferences: preferencesModule.DEFAULT_DASHBOARD_PREFERENCES, onChange: () => true });
  assert.equal(findAll(admin, (node) => node.type === "select").length, 0);
});

test("merchant settings deep links survive navigation without retaining a kitchen target", () => {
  const { merchantLocationPath, readMerchantLocation } = loadSource("src/lib/merchantNavigation.ts");
  const path = merchantLocationPath("/merchant", "?campaign=test&design=22222222-2222-2222-2222-222222222222", "", "settings");
  assert.equal(path, "/merchant?campaign=test&tab=settings");
  assert.deepEqual(readMerchantLocation("?tab=settings"), { tab: "settings", designId: null });
});

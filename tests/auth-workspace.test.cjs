const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

function elements(node, predicate, found = []) {
  if (!React.isValidElement(node)) return found;
  if (predicate(node)) found.push(node);
  for (const child of React.Children.toArray(node.props.children)) elements(child, predicate, found);
  return found;
}

function browser(t, search = "") {
  const previous = { window: global.window, sessionStorage: global.sessionStorage };
  const memory = new Map();
  global.sessionStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  const redirects = [];
  global.window = { location: { origin: "https://shop.example", search, hash: "", assign: url => redirects.push(url) }, history: { state: null, replaceState() {} }, setTimeout() {} };
  t.after(() => { global.window = previous.window; global.sessionStorage = previous.sessionStorage; });
  return { memory, redirects };
}

test("role-aware sign-in defaults and profile links keep management accounts separate", t => {
  const { memory } = browser(t);
  const auth = loadSource("src/lib/authRedirect.ts");
  assert.equal(auth.accountPathForRole("merchant"), "/merchant?tab=profile");
  assert.equal(auth.accountPathForRole("admin"), "/admin?tab=profile");
  assert.equal(auth.accountPathForRole("customer"), "/account");
  assert.equal(auth.loginPathForDestination("/merchant?tab=profile"), "/login?next=%2Fmerchant%3Ftab%3Dprofile");
  assert.equal(auth.finishAuthDestination("merchant"), "/merchant");
  assert.equal(auth.finishAuthDestination("admin"), "/admin");
  assert.equal(auth.finishAuthDestination("customer"), "/account");
  auth.rememberAuthDestination("?next=/checkout");
  assert.equal(auth.finishAuthDestination("merchant"), "/checkout");
  auth.rememberAuthDestination("?next=/merchant?tab=profile");
  assert.equal(auth.rememberAuthDestination(""), "/merchant?tab=profile");
  assert.equal(auth.finishAuthDestination("merchant"), "/merchant?tab=profile");
  assert.equal(memory.size, 0);
  auth.rememberAuthDestination("?next=/checkout");
  assert.equal(auth.rememberAuthDestination("?next=/account"), "/account", "explicit destination replaces an abandoned checkout");
  for (const value of ["//evil.example", "/\\evil.example", "/merchant/../admin", "/merchant?tab=profile&next=https://evil.example", "/admin?tab=profile&tab=users", "/merchant?tab=profile#x", "/merchant?tab=profile&design=bad", "/admin?tab=unknown"]) {
    assert.equal(auth.safeAuthDestination(value), null, value);
  }
});

function authStore(mockAuth, enabled = true) {
  return loadSource("src/store/auth.ts", {
    "@/lib/supabase/client": { isSupabaseConfigured: true, isSocialProviderEnabled: async () => enabled, supabase: { auth: mockAuth, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "merchant" } }) }) }) }) } },
    "@/store/cart": { setCartOwner() {} }, "@/store/wishlist": { setWishlistOwner() {} },
    "@/store/designs": { setDesignOwner() {} }, "@/store/kitchens": { setKitchenOwner() {} },
  }).useAuth;
}

test("Google and Apple use the real OAuth API and carry only safe return destinations", async t => {
  const { redirects } = browser(t, "?next=/merchant?tab=profile");
  const calls = [];
  const auth = authStore({ signInWithOAuth: async args => { calls.push(args); return { data: { url: "https://provider.example/authorize" }, error: null }; } });
  for (const provider of ["google", "apple"]) {
    assert.equal((await auth.getState().signInWithProvider(provider)).error, null);
    assert.deepEqual(calls.at(-1), { provider, options: { redirectTo: "https://shop.example/auth/callback?next=%2Fmerchant%3Ftab%3Dprofile", skipBrowserRedirect: true } });
  }
  assert.equal(redirects.length, 2);
  global.window.location.search = "?next=https://evil.example";
  await auth.getState().signInWithProvider("google");
  assert.match(calls.at(-1).options.redirectTo, /next=%2Faccount$/);
});

test("disabled providers and provider failures show guidance without a broken external redirect", async t => {
  const { redirects } = browser(t);
  let calls = 0;
  const disabled = authStore({ signInWithOAuth: async () => { calls++; } }, false);
  for (const provider of ["google", "apple"]) assert.match((await disabled.getState().signInWithProvider(provider)).error, /идэвхгүй/);
  assert.equal(calls, 0);
  const failed = authStore({ signInWithOAuth: async () => ({ error: { status: 429, message: "private provider detail" } }) });
  assert.match((await failed.getState().signInWithProvider("google")).error, /Хэдэн минут/);
  const missing = authStore({ signInWithOAuth: async () => ({ data: { url: null }, error: null }) });
  assert.match((await missing.getState().signInWithProvider("apple")).error, /холбоос үүссэнгүй/);
  assert.equal(redirects.length, 0);
});

test("failed logout preserves the current session and lets the user retry", async t => {
  browser(t);
  let failure = { message: "Network unavailable" };
  const auth = authStore({ signOut: async () => ({ error: failure }) });
  auth.setState({ user: { id: "owner", name: "Merchant" }, role: "merchant", initialized: true });
  await assert.rejects(auth.getState().signOut(), error => error === failure);
  assert.equal(auth.getState().user.id, "owner");
  failure = null;
  await auth.getState().signOut();
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().role, null);
});

test("social session initialization uses provider names and DB roles; name updates cannot replace another account", async t => {
  browser(t);
  const user = { id: "merchant-1", email: "merchant@example.com", created_at: "2026-01-01", user_metadata: { full_name: "Google Merchant", role: "admin" } };
  let updated = user, calls = 0;
  const auth = authStore({ getSession: async () => ({ data: { session: { user } } }), onAuthStateChange() {}, updateUser: async args => { calls++; updated = { ...updated, user_metadata: { ...updated.user_metadata, ...args.data } }; return { data: { user: updated }, error: null }; } });
  await auth.getState().initialize();
  assert.equal(auth.getState().user.name, "Google Merchant");
  assert.equal(auth.getState().role, "merchant", "untrusted metadata never grants admin access");
  assert.match((await auth.getState().updateName(" ")).error, /2–100/);
  assert.equal(calls, 0);
  assert.equal((await auth.getState().updateName(" New Name ")).error, null);
  assert.equal(auth.getState().user.name, "New Name");
  updated = { ...updated, id: "different-account" };
  assert.match((await auth.getState().updateName("Another Name")).error, /Бүртгэл өөрчлөгдсөн/);
  assert.equal(auth.getState().user.id, "merchant-1");
});

function formHarness(state) {
  const values = [], refs = [], effects = [], routed = [];
  let cursor = 0, refCursor = 0;
  const hook = selector => selector(state);
  hook.getState = () => state;
  const { AuthForm } = loadSource("src/features/auth/AuthForm.tsx", {
    react: { ...React, useState: initial => { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === "function" ? value(values[i]) : value; }]; }, useRef: initial => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }), useEffect: effect => effects.push(effect) },
    "next/navigation": { useRouter: () => ({ replace: value => routed.push(value), refresh() {} }) },
    "@/store/auth": { useAuth: hook },
  });
  return { render: mode => { cursor = 0; refCursor = 0; return AuthForm({ mode }); }, values, effects, routed };
}

test("email and social actions share a synchronous pending guard and return merchant login to its workspace", async t => {
  browser(t);
  let signIns = 0, providers = 0, release;
  const h = formHarness({ role: "merchant", signIn: () => { signIns++; return new Promise(resolve => { release = resolve; }); }, signInWithProvider: async () => { providers++; return { error: "Provider temporarily disabled" }; } });
  let tree = h.render("login");
  const fields = elements(tree, node => node.type === "input");
  fields.find(node => node.props.name === "email").props.onChange({ target: { value: "merchant@example.com" } });
  fields.find(node => node.props.name === "password").props.onChange({ target: { value: "password" } });
  tree = h.render("login");
  const form = elements(tree, node => node.type === "form")[0];
  const event = { preventDefault() {} };
  const first = form.props.onSubmit(event);
  await form.props.onSubmit(event);
  await elements(tree, node => node.type?.name === "SocialButtons")[0].props.onSignIn("google");
  assert.equal(signIns, 1);
  assert.equal(providers, 0);
  release({ error: null });
  await first;
  assert.deepEqual(h.routed, ["/merchant"]);
});

test("registration confirmation replaces forms with clear email guidance and a preserved login destination", async t => {
  browser(t, "?next=/checkout");
  let signUps = 0;
  const h = formHarness({ role: null, signUp: async () => { signUps++; return { error: null, needsEmailConfirmation: true }; } });
  let tree = h.render("register");
  h.effects[0]();
  for (const field of elements(tree, node => node.type === "input")) field.props.onChange({ target: { value: field.props.name === "name" ? "Test Name" : field.props.name === "email" ? "test@example.com" : "password8" } });
  tree = h.render("register");
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  tree = h.render("register");
  assert.equal(signUps, 1);
  assert.equal(elements(tree, node => node.type === "form").length, 0);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /test@example.com/);
  assert.match(html, /href="\/login\?next=%2Fcheckout"/);
  assert.deepEqual(h.routed, []);
});

test("OAuth callback waits for auth initialization, preserves checkout, and handles cancellation before an old session", async t => {
  browser(t, "?next=/checkout");
  let auth = { user: null, role: null }, effects = [], routed = [], initialized = 0;
  const initialize = async () => { initialized++; auth = { ...auth, user: { id: "merchant" }, role: "merchant" }; };
  const { default: Callback } = loadSource("src/app/(auth)/auth/callback/page.tsx", {
    react: { ...React, useEffect: effect => effects.push(effect), useState: initial => [initial, () => {}] },
    "@/store/auth": { useAuth: { getState: () => ({ ...auth, initialize }) } },
    "next/navigation": { useRouter: () => ({ replace: value => routed.push(value), refresh() {} }) },
  });
  Callback(); effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initialized, 1);
  assert.deepEqual(routed, ["/checkout"]);
  global.window.location.search = "?next=/merchant&error=access_denied&error_description=private";
  effects = []; routed = [];
  Callback(); effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initialized, 1);
  assert.deepEqual(routed, []);
});

test("dashboard headers and settings use profile callbacks without storefront account links", () => {
  let opens = 0;
  for (const [file, component] of [["src/components/AdminHeader.tsx", "AdminHeader"], ["src/components/MerchantHeader.tsx", "MerchantHeader"]]) {
    const Header = loadSource(file)[component];
    const tree = Header({ userName: "Test", storeName: "Store", onProfile: () => opens++, onSettings() {}, onProducts() {}, onMessages() {}, onQuotes() {}, onToggleSidebar() {}, onToggleMenu() {} });
    const profile = elements(tree, node => node.type === "button" && node.props["aria-label"]?.includes("миний бүртгэл"))[0];
    assert.ok(profile);
    profile.props.onClick();
    assert.equal(elements(tree, node => node.props.href === "/account").length, 0);
  }
  assert.equal(opens, 2);
});

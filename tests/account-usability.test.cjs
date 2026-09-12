const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function accountPage(deleteDesign = () => {}) {
  const state = {
    user: { id: "test-user", name: "Тест хэрэглэгч", email: "test@example.com" },
    initialized: true, role: "customer", initialize: async () => {},
  };
  return loadSource("src/app/account/page.tsx", {
    react: { ...React, useEffect: () => {} },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/components/OrderHistory": { OrderHistory: () => null },
    "@/components/SavedKitchenList": { SavedKitchenList: () => null },
    "@/store/auth": { useAuth: selector => selector(state) },
    "@/store/wishlist": { useWishlist: selector => selector({ items: [] }) },
    "@/store/designs": { useDesigns: selector => selector({
      designs: [{ id: "saved-room", name: "Зочны өрөө", pieces: [], updatedAt: 0 }], deleteDesign,
    }) },
    "@/store/catalog": { useCatalog: () => ({ ready: true, loading: false }), getProduct: () => undefined },
  }).default;
}

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
}

test("profile navigation targets account details separately from wishlist", () => {
  const Page = accountPage();
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /href="#profile"/);
  const profile = html.match(/<section id="profile"[\s\S]*?<\/section>/)?.[0];
  assert.ok(profile?.includes("Тест хэрэглэгч") && profile.includes("test@example.com"));
  assert.ok(!profile.includes("Хүслийн жагсаалт"));
  assert.match(html, /<section id="wishlist"/);
  assert.match(html, /<section id="kitchen-garniture"/);
  assert.match(html, /href="#kitchen-garniture"/);
});

test("saved room deletion only runs after confirmation", t => {
  const previous = global.window;
  t.after(() => { global.window = previous; });
  const deleted = [], prompts = [];
  const Page = accountPage(id => deleted.push(id));
  const button = findElement(Page(), element => element.type === "button" && element.props["aria-label"] === "Зочны өрөө загварыг устгах");
  assert.ok(button);
  global.window = { confirm: message => { prompts.push(message); return false; } };
  button.props.onClick();
  assert.deepEqual(deleted, []);
  assert.match(prompts[0], /Зочны өрөө/);
  global.window.confirm = () => true;
  button.props.onClick();
  assert.deepEqual(deleted, ["saved-room"]);
});

test("auth codes, rate limits and network failures have Mongolian guidance", () => {
  const { authErrorMessage } = loadSource("src/lib/authErrors.ts");
  assert.match(authErrorMessage({ code: "invalid_credentials", message: "Internal provider text" }, "signIn"), /Имэйл эсвэл нууц үг буруу/);
  assert.match(authErrorMessage({ code: "email_not_confirmed" }, "signIn"), /баталгаажуулах холбоос/);
  assert.match(authErrorMessage({ code: "weak_password" }, "signUp"), /Нууц үг шаардлага/);
  assert.match(authErrorMessage({ status: 429 }, "signIn"), /Хэдэн минут/);
  assert.match(authErrorMessage(new TypeError("Failed to fetch"), "signUp"), /Интернэт холболтоо/);
  assert.match(authErrorMessage({ message: "Invalid login credentials" }, "signIn"), /Имэйл эсвэл нууц үг буруу/);
  for (const error of [null, new Error("private database error"), { code: "constructor" }]) {
    assert.match(authErrorMessage(error, "signUp"), /^Бүртгэл үүсгэж чадсангүй/);
  }
});

test("sign-in and sign-up return translated provider errors to their forms", async t => {
  const previous = global.window;
  global.window = { location: { origin: "http://localhost", search: "" }, sessionStorage: { getItem: () => null, setItem() {} } };
  t.after(() => { global.window = previous; });
  const { useAuth } = loadSource("src/store/auth.ts", {
    "@/lib/supabase/client": { supabase: { auth: {
      signInWithPassword: async () => ({ error: { code: "invalid_credentials", message: "Invalid login credentials" } }),
      signUp: async () => ({ error: { code: "user_already_exists", message: "User already registered" } }),
    } } },
    "@/store/cart": { setCartOwner() {} }, "@/store/wishlist": { setWishlistOwner() {} }, "@/store/designs": { setDesignOwner() {} },
  });
  assert.match((await useAuth.getState().signIn("test@example.com", "wrong-password")).error, /Имэйл эсвэл нууц үг буруу/);
  assert.match((await useAuth.getState().signUp("Тест", "test@example.com", "password")).error, /Энэ имэйлээр бүртгэл үүссэн/);
});

test("contact details use mail and phone links without placeholder email", () => {
  const { phoneHref } = loadSource("src/lib/siteContact.ts");
  assert.equal(phoneHref("+976 8844 2741"), "tel:+97688442741");
  const render = email => {
    const Page = loadSource("src/app/about/page.tsx", {
      "next/image": { default: () => null },
      "@/lib/siteContact": { SITE_CONTACT: { email, phone: "+976 8844 2741" }, phoneHref },
      "@/components/ContactForm": { ContactForm: () => null },
    }).default;
    return renderToStaticMarkup(React.createElement(Page));
  };
  assert.match(render("support@fixture.test"), /href="mailto:support@fixture.test"/);
  const html = render("");
  assert.ok(!html.includes("mailto:") && !html.includes("tavilga.mn@example.com"));
  assert.match(html, /href="tel:\+97688442741"/);
});

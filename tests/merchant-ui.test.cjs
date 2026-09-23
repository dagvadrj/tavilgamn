const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

function find(node, predicate) {
  if (!React.isValidElement(node)) return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

function harness(role = "merchant") {
  let stateValues = [],
    index = 0;
  const changes = [],
    requests = [];
  const auth = {
    user: { id: "owner", name: "Мөнх", email: "owner@example.com" },
    role,
    initialized: true,
    initialize: async () => {},
  };
  const useAuth = Object.assign((selector) => selector(auth), {
    getState: () => auth,
  });
  const mocks = {
    react: {
      ...React,
      useEffect() {},
      useState(initial) {
        const i = index++;
        return [
          i in stateValues
            ? stateValues[i]
            : typeof initial === "function"
              ? initial()
              : initial,
          (next) => changes.push({ index: i, next }),
        ];
      },
    },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/store/auth": { useAuth },
    "@/lib/authFetch": {
      authFetch: async (path, init, owner) => {
        requests.push({ path, init, owner });
        return { ok: true, json: async () => ({ ok: true, id: "product-id" }) };
      },
    },
    "@/store/catalog": {
      useCatalogStore: { getState: () => ({ refresh() {} }) },
    },
  };
  return {
    auth,
    mocks,
    requests,
    changes,
    reset(values = []) {
      stateValues = values;
      index = 0;
    },
  };
}

test("merchant portal guards customer and administrator before mounting private workspace", () => {
  for (const role of ["customer", "admin"]) {
    const h = harness(role);
    const { MerchantDashboard } = loadSource(
      "src/components/MerchantDashboard.tsx",
      h.mocks,
    );
    const html = renderToStaticMarkup(MerchantDashboard());
    assert.match(html, /merchant эрхээ идэвхжүүлнэ/);
    assert.equal(h.requests.length, 0);
  }
  const h = harness();
  const { MerchantDashboard } = loadSource(
    "src/components/MerchantDashboard.tsx",
    h.mocks,
  );
  assert.equal(MerchantDashboard().type.name, "MerchantWorkspace");
});

const order = (status, paymentStatus = "paid") => ({
  id: "12345678-1234-1234-1234-123456789abc",
  status,
  paymentStatus,
  currency: "MNT",
  subtotal: 200000,
  created_at: "2026-09-15T12:00:00Z",
  delivery: { name: "Хүлээн авагч", phone: "99000000", address: "Улаанбаатар" },
  items: [
    {
      productId: "owned-product",
      name: "Модон сандал",
      color: "oak",
      colorName: "Царс",
      material: "wood",
      materialName: "Мод",
      qty: 2,
      unitPrice: 100000,
      lineTotal: 200000,
    },
  ],
});

function renderOrder(h, value, onUpdated) {
  const { MerchantOrders } = loadSource(
    "src/components/MerchantOrders.tsx",
    h.mocks,
  );
  h.reset([0, 0, { orders: [value], hasMore: false }, false, null]);
  const list = MerchantOrders({ owner: "owner" });
  const card = find(
    list,
    (node) =>
      typeof node.type === "function" && node.type.name === "MerchantOrderCard",
  );
  assert.ok(card);
  h.reset();
  return card.type({ ...card.props, ...(onUpdated ? { onUpdated } : {}) });
}

test("merchant order actions advance only the next paid fulfillment step", async () => {
  for (const [current, next] of [
    ["pending", "processing"],
    ["processing", "shipped"],
    ["shipped", "delivered"],
  ]) {
    const h = harness();
    const tree = renderOrder(h, order(current));
    const action = find(tree, (node) => node.type === "button");
    assert.ok(action);
    await action.props.onClick();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].path, "/api/merchant/orders");
    assert.equal(h.requests[0].owner, "owner");
    assert.deepEqual(JSON.parse(h.requests[0].init.body), {
      id: order(current).id,
      status: next,
      expectedStatus: current,
    });
  }
});

test("unpaid, cancelled and completed merchant orders have no fulfillment or payment action", () => {
  for (const value of [
    order("pending", "pending_payment"),
    order("processing", "cancelled"),
    order("delivered"),
  ]) {
    const h = harness();
    const tree = renderOrder(h, value);
    assert.equal(
      find(tree, (node) => node.type === "button"),
      undefined,
    );
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Танай барааны дүн/);
    assert.match(html, /Хүлээн авагч/);
    assert.match(html, /Модон сандал/);
  }
});

test("a delayed order response cannot update UI after switching merchant accounts", async () => {
  const h = harness();
  let release;
  h.mocks["@/lib/authFetch"].authFetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const updates = [];
  const tree = renderOrder(h, order("pending"), (status) =>
    updates.push(status),
  );
  const pending = find(tree, (node) => node.type === "button").props.onClick();
  h.auth.user = { ...h.auth.user, id: "different-owner" };
  release({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.deepEqual(updates, []);
  assert.ok(
    !h.changes.some(
      (change) =>
        typeof change.next === "string" && change.next.includes("шинэчлэгдлээ"),
    ),
  );
});

test("a rejected order transition keeps current status and displays the server conflict", async () => {
  const h = harness();
  const conflict =
    "Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.";
  h.mocks["@/lib/authFetch"].authFetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: conflict }),
  });
  const updates = [];
  const tree = renderOrder(h, order("pending"), (status) =>
    updates.push(status),
  );
  await find(tree, (node) => node.type === "button").props.onClick();
  assert.deepEqual(updates, []);
  assert.ok(h.changes.some((change) => change.next === conflict));
});

test("admin role editor never exposes admin promotion and saves merchant only after explicit action", async () => {
  const h = harness("admin");
  const { AdminUsers } = loadSource("src/components/AdminUsers.tsx", h.mocks);
  const list = AdminUsers();
  const user = {
    id: "target",
    name: "Бат",
    email: "bat@example.com",
    orders: 0,
    joined: "2026-01-01",
    role: "customer",
    store: null,
  };
  h.reset(["", 1, 0, { page: 1, users: [user], hasMore: false }, false, null]);
  const tree = list.type(list.props);
  const editor = find(
    tree,
    (node) =>
      typeof node.type === "function" && node.type.name === "UserRoleEditor",
  );
  h.reset();
  const initial = editor.type(editor.props);
  assert.equal(
    find(initial, (node) => node.type === "button"),
    undefined,
  );
  assert.ok(!renderToStaticMarkup(initial).includes('value="admin"'));
  h.reset(["merchant", false, null]);
  const changed = editor.type(editor.props);
  await find(changed, (node) => node.type === "button").props.onClick();
  assert.deepEqual(JSON.parse(h.requests[0].init.body), {
    id: "target",
    role: "merchant",
  });
  assert.equal(h.requests[0].path, "/api/admin/users");
  h.reset();
  const adminRow = editor.type({
    ...editor.props,
    user: { ...user, role: "admin" },
  });
  assert.equal(
    find(adminRow, (node) => node.type === "select"),
    undefined,
  );
});

test("editing merchant product preserves all variants and stock version", async () => {
  const h = harness();
  const { MerchantDashboard } = loadSource(
    "src/components/MerchantDashboard.tsx",
    h.mocks,
  );
  const workspace = MerchantDashboard();
  h.reset([{ id: "store-1", name: "Дэлгүүр" }, true, null, 0, "products"]);
  const workspaceTree = workspace.type(workspace.props);
  const list = find(
    workspaceTree,
    (node) =>
      typeof node.type === "function" && node.type.name === "MerchantProducts",
  );
  const product = {
    id: "p-1",
    name: "Сандал",
    category: "office",
    description: "Тайлбар",
    image: "/product.jpg",
    images: ["/extra.jpg"],
    basePrice: 2000,
    rating: 0,
    reviewCount: 0,
    colors: [
      { id: "oak", name: "Царс", hex: "#cccccc", priceDelta: 200 },
      { id: "black", name: "Хар", hex: "#000000", priceDelta: 300 },
    ],
    materials: [
      { id: "wood", name: "Мод", priceDelta: 0 },
      { id: "metal", name: "Металл", priceDelta: 100 },
    ],
    defaultColor: "black",
    stockQuantity: 3,
    inStock: true,
    dimensions: { w: 0.6, d: 0.5, h: 0.8 },
  };
  h.reset([[], false, null, 0, "", { product, create: false }, false]);
  const editor = list.type(list.props);
  h.reset();
  const form = editor.type({ ...editor.props, onSave() {} });
  await form.props.onSubmit({ preventDefault() {} });
  const request = h.requests[0];
  assert.equal(request.path, "/api/merchant/products");
  assert.equal(request.init.method, "PUT");
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.colors, product.colors);
  assert.deepEqual(body.materials, product.materials);
  assert.equal(body.defaultColor, "black");
  assert.deepEqual(body.images, ["/extra.jpg"]);
  assert.equal(body.expectedStockQuantity, 3);
  assert.deepEqual(body.dimensions, product.dimensions);
});

function notificationQuery(result, calls) {
  const query = {
    select(columns, options) {
      calls.push(["select", columns, options]);
      return query;
    },
    update(value) {
      calls.push(["update", value]);
      return query;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    is(column, value) {
      calls.push(["is", column, value]);
      return query;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return query;
    },
    limit(value) {
      calls.push(["limit", value]);
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

test("merchant notification API reads and updates only the authenticated merchant rows", async () => {
  const owner = "11111111-1111-1111-1111-111111111111";
  const notificationId = "22222222-2222-2222-2222-222222222222";
  const calls = [];
  const results = [
    {
      data: [
        {
          id: notificationId,
          kind: "kitchen_review",
          title: "Зөвшөөрөгдлөө",
          body: "OK",
          href: "/merchant?tab=kitchens",
          entity_id: null,
          metadata: { action: "approved" },
          read_at: null,
          created_at: "2026-09-23T05:00:00.000Z",
        },
      ],
      error: null,
    },
    { count: 1, error: null },
  ];
  const db = {
    from(table) {
      calls.push(["from", table]);
      return notificationQuery(results.shift(), calls);
    },
  };
  const route = loadSource("src/app/api/merchant/notifications/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/supabase/requireMerchant": {
      requireMerchant: async () => ({ userId: owner, error: null }),
    },
  });
  const getResponse = await route.GET({});
  const getBody = await getResponse.json();
  assert.equal(getBody.unreadCount, 1);
  assert.equal(getBody.notifications[0].entityId, null);
  assert.ok(
    calls.some(
      (call) => call[0] === "eq" && call[1] === "user_id" && call[2] === owner,
    ),
  );

  calls.length = 0;
  db.from = (table) => {
    calls.push(["from", table]);
    return notificationQuery({ error: null }, calls);
  };
  const patchResponse = await route.PATCH({
    json: async () => ({ id: notificationId }),
  });
  assert.equal(patchResponse.status, 200);
  assert.ok(
    calls.some(
      (call) => call[0] === "eq" && call[1] === "user_id" && call[2] === owner,
    ),
  );
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "eq" && call[1] === "id" && call[2] === notificationId,
    ),
  );
});

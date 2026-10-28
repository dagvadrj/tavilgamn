const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

const rooms = loadSource("src/lib/merchantRooms.ts");
const templates = loadSource("src/lib/roomTemplates.ts");
const { syncDesignRooms } = loadSource("src/lib/roomDesign.ts");
const { roomTemplateOutline } = loadSource("src/lib/roomPolygon.ts");

const room = (patch = {}) => ({
  id: "r1", title: "Хаврын зочны өрөө", description: "", roomType: "living", area: 20, furnishing: "full",
  status: "draft", version: 7, publishedVersion: null, draftVersion: null, updatedAt: "2026-10-28T05:05:00Z",
  previewImage: "", pieceCount: 6, width: 5, depth: 4, missingModels: 0, ...patch,
});

test("merchant room state, version label and «•••» actions follow the room lifecycle", () => {
  assert.equal(rooms.merchantRoomVersion(room()), "Ноорог v7 · нийтлээгүй");
  assert.equal(rooms.merchantRoomVersion(room({ status: "published", version: 13, publishedVersion: 12, draftVersion: 13 })), "v12 нийтлэгдсэн · v13 ноорог");
  assert.equal(rooms.merchantRoomVersion(room({ status: "published", version: 12, publishedVersion: 12 })), "v12 нийтлэгдсэн");
  assert.equal(rooms.merchantRoomVersion(room({ status: "archived", version: 5, publishedVersion: 4 })), "v4 архивласан");
  assert.equal(rooms.merchantRoomVersion(room({ publishedVersion: 3, version: 5 })), "Ноорог v5");

  const attention = room({ missingModels: 1 });
  assert.equal(rooms.merchantRoomState(attention), "attention");
  const publish = rooms.merchantRoomActions(attention).find((item) => item.id === "publish");
  assert.equal(publish.disabled, true);
  assert.equal(publish.reason, "Editor-т ачаалагдаагүй загварыг засна уу.");
  assert.deepEqual(rooms.merchantRoomActions(room({ status: "published", publishedVersion: 7 })).map((item) => item.id),
    ["duplicate", "unpublish", "archive"], "a published room without edits has nothing to publish");
  assert.deepEqual(rooms.merchantRoomActions(room({ status: "published", publishedVersion: 6, draftVersion: 7 })).map((item) => item.id),
    ["duplicate", "publish", "unpublish", "archive"]);
  assert.deepEqual(rooms.merchantRoomActions(room({ status: "archived" })).map((item) => item.id), ["duplicate", "restore"]);

  const list = [room(), room({ id: "r2", status: "published", publishedVersion: 2 }), attention, room({ id: "r4", status: "archived" }), room({ id: "r5", title: "Ажлын өрөө" })];
  assert.deepEqual(rooms.countMerchantRooms(list), { active: 4, draft: 2, published: 1, attention: 1, archived: 1 });
  assert.deepEqual(rooms.filterMerchantRooms(list, "active", "ажлын").map((item) => item.id), ["r5"]);
});

test("updated time reads «Дөнгөж сая», «Өнөөдөр HH:MM», «Өчигдөр HH:MM»", () => {
  const now = new Date(2026, 9, 28, 15, 0);
  assert.equal(rooms.merchantRoomUpdated(new Date(2026, 9, 28, 14, 59, 30).toISOString(), now), "Дөнгөж сая");
  assert.equal(rooms.merchantRoomUpdated(new Date(2026, 9, 28, 14, 5).toISOString(), now), "Өнөөдөр 14:05");
  assert.equal(rooms.merchantRoomUpdated(new Date(2026, 9, 27, 18, 20).toISOString(), now), "Өчигдөр 18:20");
  assert.equal(rooms.merchantRoomUpdated(new Date(2026, 8, 3, 9, 0).toISOString(), now), "2026.09.03");
});

test("publish checklist blocks on failed or loading models, a missing name or cover; description is advisory", () => {
  const base = { title: "Хаврын зочны өрөө", roomTypeLabel: "Зочны өрөө", description: "", coverReady: true,
    pieces: [{ instanceId: "a", name: "Талст буйдан", state: "ready" }, { instanceId: "b", name: "Сар шалны гэрэл", state: "error" }] };
  const failed = rooms.publishChecklist(base);
  assert.equal(failed[0].title, "1 загвар ачаалагдсангүй");
  assert.equal(failed[0].note, "Сар шалны гэрэл — cover зураг үүсэхгүй.");
  assert.equal(failed[0].showInstanceId, "b", "«Харуулах» selects the failed piece");
  assert.equal(failed.find((check) => check.id === "description").blocking, false);
  const ready = rooms.publishChecklist({ ...base, pieces: [base.pieces[0]], description: "Нартай" });
  assert.ok(ready.every((check) => check.ok && !check.blocking));
  assert.equal(ready[0].title, "Бүх 3D загвар ачаалагдсан");
  const blank = rooms.publishChecklist({ ...base, title: " ", coverReady: false, pieces: [] });
  assert.deepEqual(blank.filter((check) => check.blocking).map((check) => check.id), ["name", "cover"]);
  assert.equal(rooms.publishChecklist({ ...base, pieces: [{ instanceId: "c", name: "x", state: "loading" }] })[0].title, "1 загвар ачаалж байна");
});

test("gallery filter is validated and groups put stores first and platform rooms last", () => {
  const read = (query) => templates.readGalleryFilter(new URLSearchParams(query));
  assert.deepEqual(read("store=merchant-1&type=living&furnishing=partial&offset=24"),
    { store: "merchant-1", type: "living", furnishing: "partial", offset: 24, limit: templates.GALLERY_PAGE_SIZE });
  for (const bad of ["type=garage", "furnishing=half", "offset=-1", "limit=500", "store=../x"]) assert.equal(read(bad), null, bad);

  const { groupTemplates, galleryQuery, templateMeta, furnishingLabel } = loadSource("src/features/room-planner/components/RoomTemplateShowcase.tsx", {
    "next/image": { default: "img" }, "next/link": { default: "a" },
  });
  const card = (id, storeId, extra = {}) => ({ id, storeId, title: id, roomType: "living", area: 20, width: 5, depth: 4, kind: "furnished", furnishing: "full", ...extra });
  const groups = groupTemplates([card("p1", null, { kind: "empty" }), card("a1", "s1"), card("b1", "s2"), card("a2", "s1")],
    [{ id: "s1", name: "Эрдэнэ Интерьер", image: "", roomCount: 2 }, { id: "s2", name: "Гэр Тавилга", image: "", roomCount: 1 }]);
  assert.deepEqual(groups.map((group) => group.key), ["s1", "s2", "platform"]);
  assert.deepEqual(groups[0].cards.map((item) => item.id), ["a1", "a2"]);
  assert.equal(furnishingLabel(groups[2].cards[0]), "Тавилгагүй");
  assert.equal(templateMeta(card("x", null)), "Зочны өрөө · 20 м² · 5 × 4 м");
  assert.equal(galleryQuery({ store: "platform", type: "", furnishing: "full" }, 24), "/api/room-templates?store=platform&furnishing=full&offset=24");
  assert.equal(galleryQuery({ store: "", type: "", furnishing: "" }, 0), "/api/room-templates");
});

const UUID = "b5e165bc-c8bd-4a53-b09e-fd9eb2e9bdaa";
const design = (pieces = []) => syncDesignRooms({ id: "source", activeRoomId: "room-source", name: "Natural", size: "80", roomType: "living", width: 5, depth: 4, height: 2.7,
  outline: roomTemplateOutline("rectangle", 5, 4), wallColor: "#eeeeee", floorColor: "#ccbbaa", floorMaterial: "parquet-oak", openings: [], pieces, createdAt: 1, updatedAt: 2 });
const piece = { instanceId: "sofa", productId: "catalog-sofa", modelId: UUID, x: 0, z: 0, rotation: 0, color: "#fff", material: "fabric" };

/** In-memory tables with the subset of the query builder the routes use. */
function memoryDb(tables) {
  let seq = 0;
  return {
    tables,
    from(table) {
      const filters = []; let op = "select", value, single = false;
      const rows = () => (tables[table] ??= []).filter((row) => filters.every((test) => test(row)));
      const run = () => {
        if (op === "insert") {
          const row = { id: `00000000-0000-4000-8000-00000000000${++seq}`, version: 1, created_at: "t", updated_at: "t", published_version: null, draft: null, draft_version: null, ...value };
          tables[table].push(row); return { data: row, error: null };
        }
        if (op === "update") {
          const matched = rows(); matched.forEach((row) => Object.assign(row, value));
          return { data: single ? (matched[0] ?? null) : matched, error: null };
        }
        return { data: single ? (rows()[0] ?? null) : rows(), error: null };
      };
      const q = {
        select() { return q; }, order() { return q; }, limit() { return q; },
        eq(k, v) { filters.push((row) => row[k] === v); return q; },
        is(k, v) { filters.push((row) => (row[k] ?? null) === v); return q; },
        in(k, list) { filters.push((row) => list.includes(row[k])); return q; },
        insert(v) { op = "insert"; value = v; return q; },
        update(v) { op = "update"; value = v; return q; },
        maybeSingle() { single = true; return Promise.resolve(run()); },
        single() { single = true; return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return q;
    },
  };
}
function merchantApi(db, userId = "owner-1") {
  return loadSource("src/app/api/merchant/room-templates/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/supabase/requireMerchant": { requireMerchant: async () => ({ userId, error: null }) },
  });
}
const call = (method, body, query = "") =>
  new NextRequest(`http://localhost/api/merchant/room-templates${query}`, body ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { method });
const save = (patch = {}) => ({ title: "Хаврын зочны өрөө", description: "", furnishing: "full", design: design([piece]), previewImage: "", ...patch });

test("merchant API: drafts of a published room leave the gallery version alone; stale saves are conflicts", async () => {
  const db = memoryDb({
    merchant_stores: [{ id: "store-1", owner_id: "owner-1", active: true }, { id: "store-2", owner_id: "owner-2", active: true }],
    furniture_models: [{ id: UUID, product_id: "catalog-sofa", glb_path: "sofa.glb", archived_at: null }],
    room_templates: [],
  });
  const api = merchantApi(db);
  let response = await api.PUT(call("PUT", save()));
  assert.equal(response.status, 200);
  let data = await response.json();
  const row = db.tables.room_templates[0];
  assert.equal(row.store_id, "store-1", "the store comes from the verified owner, never the request");
  assert.equal(data.room.status, "draft");

  // Publishing needs a cover: save one, then publish.
  response = await api.PUT(call("PUT", save({ id: row.id, version: 1, previewImage: "data:image/jpeg;base64,/9j/" })));
  data = await response.json();
  assert.equal(data.room.version, 2);
  response = await api.POST(call("POST", { id: row.id, version: 2, action: "publish" }));
  data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.room.status, "published");
  assert.equal(data.room.publishedVersion, 3);

  // An edit of the published room becomes a draft; shoppers keep the old title.
  response = await api.PUT(call("PUT", save({ id: row.id, version: 3, title: "Намрын зочны өрөө", previewImage: "data:image/jpeg;base64,/9j/" })));
  data = await response.json();
  assert.equal(row.title, "Хаврын зочны өрөө");
  assert.equal(row.draft.title, "Намрын зочны өрөө");
  assert.equal(data.room.title, "Намрын зочны өрөө", "the merchant sees their draft");
  assert.equal(rooms.merchantRoomVersion(data.room), "v3 нийтлэгдсэн · v4 ноорог");

  // Someone else saved v4 meanwhile: a save based on v3 is a conflict, not an overwrite.
  response = await api.PUT(call("PUT", save({ id: row.id, version: 3, title: "Миний хувилбар" })));
  assert.equal(response.status, 409);
  assert.deepEqual((await response.json()).conflict.version, 4);
  assert.equal(row.draft.title, "Намрын зочны өрөө");

  response = await api.POST(call("POST", { id: row.id, version: 4, action: "publish" }));
  assert.equal(response.status, 200);
  assert.equal(row.title, "Намрын зочны өрөө");
  assert.equal(row.draft, null);
  assert.equal(row.published_version, 5);

  // Another store cannot read or change this room.
  const other = merchantApi(db, "owner-2");
  assert.equal((await other.GET(call("GET", null, `?id=${row.id}`))).status, 404);
  assert.equal((await other.POST(call("POST", { id: row.id, version: 5, action: "archive" }))).status, 404);
});

test("merchant API: a room whose 3D models are missing cannot be published", async () => {
  const db = memoryDb({
    merchant_stores: [{ id: "store-1", owner_id: "owner-1", active: true }],
    furniture_models: [],
    room_templates: [],
  });
  const api = merchantApi(db);
  await api.PUT(call("PUT", save({ previewImage: "data:image/jpeg;base64,/9j/" })));
  const row = db.tables.room_templates[0];
  const list = await (await api.GET(call("GET"))).json();
  assert.equal(list.rooms[0].missingModels, 1);
  assert.equal(rooms.merchantRoomState(list.rooms[0]), "attention");
  const response = await api.POST(call("POST", { id: row.id, version: 1, action: "publish" }));
  assert.equal(response.status, 422);
  assert.equal(row.status, "draft");
});

test("merchant editor chrome: status pill, save chip, blocked publish with reason, conflict choices, no half-loaded cover", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const h = React.createElement;
  const status = { byInstance: { a: "ready", b: "error" } };
  const editorModule = loadSource("src/features/room-planner/components/MerchantRoomEditor.tsx", {
    "next/image": { default: (props) => h("img", { src: props.src, alt: props.alt }) },
    "next/link": { default: (props) => h("a", { href: props.href, className: props.className }, props.children) },
    "@/lib/authFetch": { authFetch: () => { throw Error("no network in render"); } },
    "@/store/auth": { useAuth: (select) => select({ user: { id: "u" }, role: "merchant" }) },
    "@/store/roomModelStatus": { useRoomModelStatus: (select) => select(status) },
  });
  const meta = { id: "r1", version: 8, status: "published", publishedVersion: 8, draftVersion: null, title: "Хаврын зочны өрөө", description: "", furnishing: "full", roomType: "living" };
  const editor = { meta, store: { id: "s1", name: "Эрдэнэ Интерьер" }, cover: "data:image/jpeg;base64,/9j/", saveState: "dirty", saveError: "",
    conflict: { version: 8, updatedAt: "2026-10-28T06:20:00Z" }, setMeta() {}, save() {}, publish() {}, unpublish() {}, resolve() {}, dismissConflict() {} };
  const header = renderToStaticMarkup(h(editorModule.MerchantRoomHeader, { editor, onPreview() {}, onPublish() {} }));
  assert.match(header, /href="\/merchant\?tab=rooms"/);
  assert.match(header, /Merchant editor · Эрдэнэ Интерьер/);
  assert.match(header, /Нийтэлсэн · v8/);
  assert.match(header, /Хадгалаагүй өөрчлөлт/);
  assert.match(header, /Нийтлэлээс авах/);
  assert.doesNotMatch(header, /Тойм|Өрөөний дүн|₮/, "no cart, totals or summary in the merchant editor");

  const rows = [{ instanceId: "a", name: "Талст буйдан", has3d: true }, { instanceId: "b", name: "Сар шалны гэрэл", has3d: true }];
  const publish = renderToStaticMarkup(h(editorModule.MerchantPublishDialog, { editor, rows, onShow() {}, onClose() {} }));
  assert.match(publish, /1 загвар ачаалагдсангүй/);
  assert.match(publish, /Харуулах/);
  assert.match(publish, /class="is-primary" disabled=""[^>]*>Хадгалаад нийтлэх/, "publish is disabled while blocked");
  assert.match(publish, /Нийтлэх боломжгүй: 1 загвар ачаалагдсангүй, Cover бэлэн биш/);

  const preview = renderToStaticMarkup(h(editorModule.MerchantRoomPreview, { editor, design: { width: 5, depth: 4 }, rows, onClose() {} }));
  assert.match(preview, /Cover бэлэн биш/);
  assert.doesNotMatch(preview, /<img/, "a failed model never shows the stored cover as if it were ready");

  const conflict = renderToStaticMarkup(h(editorModule.MerchantConflictDialog, { editor }));
  assert.match(conflict, /Өөр хүн шинэ хувилбар хадгалсан байна/);
  assert.match(conflict, /Миний өөрчлөлтийг шинэ ноорог болгох/);
  assert.match(conflict, /v8-ийг ачаалах \(миний өөрчлөлт устна\)/);
  assert.match(conflict, /Болих/);

  status.byInstance.b = "ready";
  const ready = renderToStaticMarkup(h(editorModule.MerchantRoomPreview, { editor, design: { width: 5, depth: 4 }, rows, onClose() {} }));
  assert.match(ready, /<img[^>]*src="data:image\/jpeg/);
  const camera = renderToStaticMarkup(h(editorModule.MerchantRoomCameraPanel, { design: { width: 5, depth: 4, height: 2.7 }, cover: null, rows, onCover() {}, onRoom() {} }));
  assert.match(camera, /Cover сонгоогүй/);
  assert.match(camera, /<button type="button" class="is-primary">[\s\S]*?Одоогийн харагдацыг cover болгох/, "every model ready: the cover can be taken");
  status.byInstance.b = "loading";
  const waiting = renderToStaticMarkup(h(editorModule.MerchantRoomCameraPanel, { design: { width: 5, depth: 4, height: 2.7 }, cover: null, rows, onCover() {}, onRoom() {} }));
  assert.match(waiting, /class="is-primary" disabled=""/);
  assert.match(waiting, /Загварууд ачаалж дуусахыг хүлээж байна/);
});

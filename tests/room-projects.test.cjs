const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NextRequest } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { roomDocument, parseRoomProject, parseRoomSave, roomSignature } =
  loadSource("src/lib/roomProjectValidation.ts");
const legacy = () => ({
  id: "d_legacy",
  name: "Миний гэр",
  size: "40",
  width: 5,
  depth: 4,
  wallColor: "#EFE6D6",
  floorColor: "#C9A37A",
  pieces: [],
  createdAt: 100,
  updatedAt: 100,
});
const actor = randomUUID(),
  id = randomUUID();
test("room cloud document explicitly migrates legacy rooms, detaches nested kitchen snapshots, and preserves mm/metre units", () => {
  const { createUnifiedKitchen } = loadSource("src/lib/kitchenAssembly.ts");
  const source = createUnifiedKitchen();
  const design = legacy();
  design.pieces = [
    {
      instanceId: "kitchen1",
      productId: "kitchen:legacy",
      x: 1,
      z: 0,
      rotation: Math.PI / 2,
      color: "#ddd8cc",
      material: "wood",
      kitchen: { id: "legacy", name: "Kitchen", design: source },
    },
  ];
  const doc = roomDocument(design),
    roundtrip = parseRoomProject(JSON.parse(JSON.stringify(doc)));
  assert.equal(roundtrip.design.rooms.length, 1);
  assert.equal(
    roundtrip.design.rooms[0].pieces[0].kitchen.design.room.width,
    source.room.width,
  );
  assert.equal(roundtrip.design.pieces[0].x, 1);
  assert.equal(roundtrip.design.pieces[0].rotation, Math.PI / 2);
  source.room.width += 100;
  assert.notEqual(
    doc.design.pieces[0].kitchen.design.room.width,
    source.room.width,
  );
  assert.equal(
    roomSignature(doc),
    roomSignature({ ...doc, design: { ...doc.design, updatedAt: 200 } }),
  );
});
test("room parser rejects unknown versions, invalid nested rooms/openings, duplicate IDs and oversized collections without mutating inputs", () => {
  const doc = roomDocument(legacy()),
    original = JSON.stringify(doc);
  for (const change of [
    (d) => (d.schemaVersion = 2),
    (d) => (d.design.width = 5000),
    (d) => (d.design.rooms[0].height = NaN),
    (d) => d.design.rooms.push({ ...d.design.rooms[0] }),
    (d) => (d.design.lighting.ambient = Infinity),
    (d) => (d.design.pieces = Array.from({ length: 201 }, () => ({}))),
    (d) => (d.design.name = "x".repeat(101)),
    (d) =>
      (d.design.wallFeatures = [
        {
          id: "f",
          wall: "north",
          kind: "inset",
          offset: 0,
          length: 6,
          depth: 1,
        },
      ]),
  ]) {
    const copy = structuredClone(doc);
    change(copy);
    assert.throws(() => parseRoomProject(copy));
  }
  assert.equal(JSON.stringify(doc), original);
  assert.throws(() =>
    parseRoomSave({
      id,
      operationId: randomUUID(),
      name: "Room",
      document: doc,
    }),
  );
});
test("room write API authenticates before reading body, forces actor, requires CAS and bounds streamed UTF-8 payload", async () => {
  const calls = [];
  const route = loadSource("src/app/api/room-projects/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ userId: actor, error: null }),
    },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async (n, args) => {
          calls.push([n, args]);
          return {
            data: { project: { id }, alreadyImported: false },
            error: null,
          };
        },
      }),
    },
  });
  const send = (body) =>
    route.PUT(
      new NextRequest("http://localhost/api/room-projects", {
        method: "PUT",
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  const body = {
    id,
    name: "Room",
    document: roomDocument(legacy()),
    operationId: randomUUID(),
    expectedRevision: 0,
    user_id: randomUUID(),
  };
  assert.equal(
    (await send({ ...body, expectedRevision: undefined })).status,
    400,
  );
  assert.equal((await send(body)).status, 200);
  assert.equal(calls[0][1].p_actor, actor);
  assert.equal(calls[0][1].p_expected_revision, 0);
  const oversized = '{"padding":"' + "а".repeat(600000) + '"}';
  assert.equal((await send(oversized)).status, 413);
  assert.equal(calls.length, 1);
  const unauthorized = loadSource("src/app/api/room-projects/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ error: new Response("", { status: 401 }) }),
    },
  });
  assert.equal(
    (
      await unauthorized.PUT(
        new NextRequest("http://localhost/api/room-projects", {
          method: "PUT",
          body: "invalid",
        }),
      )
    ).status,
    401,
  );
});
test("room write conflict and outages retain a private error envelope and do not leak SQL details", async () => {
  for (const [code, status] of [
    ["40001", 409],
    ["55000", 409],
    ["42703", 503],
  ]) {
    const route = loadSource("src/app/api/room-projects/route.ts", {
      "@/lib/supabase/requireUser": {
        requireUser: async () => ({ userId: actor, error: null }),
      },
      "@/lib/supabase/admin": {
        getSupabaseAdmin: () => ({
          rpc: async () => ({ error: { code, message: "SECRET_SQL" } }),
        }),
      },
    });
    const result = await route.PUT(
      new NextRequest("http://localhost/api/room-projects", {
        method: "PUT",
        body: JSON.stringify({
          id,
          name: "Room",
          document: roomDocument(legacy()),
          operationId: randomUUID(),
          expectedRevision: 1,
        }),
      }),
    );
    assert.equal(result.status, status);
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
    assert.doesNotMatch(await result.text(), /SECRET_SQL/);
  }
});
test("room read/version APIs scope every query to verified owner and project; list omits documents and rejects forged cursor", async () => {
  const filters = [],
    selects = [];
  let limit;
  const chain = {
    select: (s) => {
      selects.push(s);
      return chain;
    },
    eq: (...a) => {
      filters.push(a);
      return chain;
    },
    is: () => chain,
    not: () => chain,
    or: () => chain,
    order: () => chain,
    lt: () => chain,
    limit: (n) => {
      limit = n;
      return Promise.resolve({ data: [], error: null });
    },
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const mocks = {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ userId: actor, error: null }),
    },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ from: () => chain }) },
  };
  const list = loadSource("src/app/api/room-projects/route.ts", mocks);
  assert.equal(
    (await list.GET(new NextRequest("http://localhost/api/room-projects")))
      .status,
    200,
  );
  assert.equal(limit, 31);
  assert.ok(!selects[0].includes("document"));
  assert.ok(filters.some(([k, v]) => k === "user_id" && v === actor));
  assert.equal(
    (
      await list.GET(
        new NextRequest(
          "http://localhost/api/room-projects?cursor=%28forged%29",
        ),
      )
    ).status,
    400,
  );
  const detail = loadSource("src/app/api/room-projects/[id]/route.ts", mocks);
  assert.equal(
    (
      await detail.GET(
        new NextRequest(`http://localhost/api/room-projects/${id}`),
        { params: Promise.resolve({ id }) },
      )
    ).status,
    404,
  );
  const versions = loadSource(
    "src/app/api/room-projects/[id]/versions/route.ts",
    mocks,
  );
  await versions.GET(
    new NextRequest(
      `http://localhost/api/room-projects/${id}/versions?revision=1`,
    ),
    { params: Promise.resolve({ id }) },
  );
  assert.ok(filters.some(([k, v]) => k === "project_id" && v === id));
  assert.ok(filters.some(([k, v]) => k === "revision" && v === 1));
});

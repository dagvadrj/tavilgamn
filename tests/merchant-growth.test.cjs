const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { NextRequest, NextResponse } = require("next/server");
const growth = loadSource("src/lib/merchantGrowth.ts");
const files = loadSource("src/lib/merchantGrowthFiles.ts");
const key = "11111111-1111-4111-8111-111111111111";

test("merchant actions discard forged approvals and require safe wallet amounts", () => {
  assert.deepEqual(
    growth.parseGrowthAction({
      action: "bank",
      bankName: "Bank",
      account: "mn00 1234 5678",
      holder: "Owner",
      status: "approved",
      storeId: "other",
      actor: "admin",
    }),
    {
      action: "bank",
      data: { bankName: "Bank", account: "MN0012345678", holder: "Owner" },
    },
  );
  assert.throws(() =>
    growth.parseGrowthAction({ action: "verification", status: "approved" }),
  );
  for (const quantity of [
    0,
    -1,
    0.1,
    "100",
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() =>
      growth.parseWalletAction({
        kind: "withdrawal",
        quantity,
        requestKey: key,
      }),
    );
  assert.throws(() =>
    growth.parseWalletAction({
      kind: "credits",
      quantity: 1000001,
      requestKey: key,
    }),
  );
  assert.throws(() =>
    growth.parseAdminGrowthAction({
      action: "withdrawal",
      storeId: "s",
      id: key,
      status: "paid",
      reference: "bank-ref",
    }),
  );
  assert.equal(
    growth.parseAdminGrowthAction({
      action: "withdrawal",
      storeId: "s",
      id: key,
      status: "paid",
      reference: "bank-ref",
      transferConfirmed: true,
    }).data.reference,
    "bank-ref",
  );
});

test("onboarding needs approved identity and bank plus a published model", () => {
  const snapshot = {
    profile: { verification_status: "pending", bank_status: "rejected" },
    productCount: 1,
    modelCount: 0,
    modelSubmissions: [{ status: "pending" }],
  };
  assert.deepEqual(
    growth.onboardingSteps(snapshot, "-").map((x) => x.done),
    [false, false, false, false],
  );
  snapshot.profile.verification_status = "approved";
  snapshot.profile.bank_status = "approved";
  snapshot.modelCount = 1;
  assert.ok(
    growth
      .onboardingSteps(snapshot, "Ulaanbaatar showroom")
      .every((x) => x.done),
  );
  assert.equal(
    growth.growthMoney("9007199254740993").replace(/[^0-9]/g, ""),
    "9007199254740993",
  );
});

test("private upload validates bytes and self-contained glTF resources", () => {
  const bytes = (text) => new TextEncoder().encode(text);
  assert.equal(
    files.validateGrowthFile(
      bytes("%PDF-1.7\nhello"),
      "certificate.pdf",
      "certificate",
    ).contentType,
    "application/pdf",
  );
  assert.throws(() =>
    files.validateGrowthFile(
      bytes("<script>bad</script>"),
      "certificate.pdf",
      "certificate",
    ),
  );
  const model = {
    asset: { version: "2.0" },
    buffers: [{ uri: "data:application/octet-stream;base64,AAAA" }],
  };
  assert.equal(
    files.validateGrowthFile(
      bytes(JSON.stringify(model)),
      "chair.gltf",
      "model",
    ).extension,
    "gltf",
  );
  for (const buffers of [[{ uri: "https://example.com/buffer.bin" }], [null]])
    assert.throws(() =>
      files.validateGrowthFile(
        bytes(JSON.stringify({ ...model, buffers })),
        "chair.gltf",
        "model",
      ),
    );
  assert.throws(() =>
    files.validateGrowthFile(
      bytes(JSON.stringify({ ...model, images: [{ uri: "../secret.png" }] })),
      "chair.gltf",
      "model",
    ),
  );
  assert.throws(() =>
    files.validateGrowthFile(
      new Uint8Array(10 * 1024 * 1024 + 1),
      "large.pdf",
      "certificate",
    ),
  );
  const glb = new Uint8Array(20),
    view = new DataView(glb.buffer);
  glb.set(bytes("glTF"));
  view.setUint32(4, 2, true);
  view.setUint32(8, 20, true);
  assert.equal(
    files.validateGrowthFile(glb, "chair.glb", "model").extension,
    "glb",
  );
  view.setUint32(8, 24, true);
  assert.throws(() => files.validateGrowthFile(glb, "chair.glb", "model"));
});

test("multipart body limit also stops chunked uploads without Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(20));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("http://localhost/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=x" },
    body,
    duplex: "half",
  });
  await assert.rejects(files.readGrowthForm(req, 10));
  assert.equal(cancelled, true);
  const form = new FormData();
  form.set("kind", "certificate");
  assert.equal(
    (
      await files.readGrowthForm(
        new Request("http://localhost/upload", { method: "POST", body: form }),
      )
    ).get("kind"),
    "certificate",
  );
});

test("share origin ignores hostile request hosts and broken configuration", () => {
  const { storeShareOrigin } = loadSource("src/lib/merchantGrowthServer.ts");
  const original = process.env.APP_URL;
  try {
    delete process.env.APP_URL;
    assert.equal(
      storeShareOrigin("https://attacker.example/merchant"),
      "https://tavilga.mn",
    );
    assert.equal(
      storeShareOrigin("http://localhost:3000/merchant"),
      "http://localhost:3000",
    );
    process.env.APP_URL = "bad-url";
    assert.equal(
      storeShareOrigin("https://attacker.example"),
      "https://tavilga.mn",
    );
    process.env.APP_URL = "https://tavilga.mn/subpath";
    assert.equal(
      storeShareOrigin("https://attacker.example"),
      "https://tavilga.mn",
    );
  } finally {
    if (original === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original;
  }
});

test("wallet API authenticates before reading payload and derives actor only from auth", async () => {
  let allowed = false,
    readBody = 0,
    calls = [];
  const { POST } = loadSource("src/app/api/merchant/growth/wallet/route.ts", {
    "@/lib/supabase/requireMerchant": {
      requireMerchant: async () =>
        allowed
          ? { userId: "real-owner" }
          : {
              error: NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
              ),
            },
    },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { ok: true }, error: null };
        },
      }),
    },
  });
  const request = {
    json: async () => {
      readBody++;
      return {
        kind: "withdrawal",
        quantity: 100,
        requestKey: key,
        p_actor: "forged",
        storeId: "other",
      };
    },
  };
  assert.equal((await POST(request)).status, 401);
  assert.equal(readBody, 0);
  assert.equal(calls.length, 0);
  allowed = true;
  const response = await POST(request);
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], {
    name: "merchant_wallet_action",
    args: {
      p_actor: "real-owner",
      p_kind: "withdrawal",
      p_quantity: 100,
      p_request: key,
    },
  });
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("QR endpoint encodes server-resolved store URL and returns a downloadable PNG", async () => {
  let encoded;
  const { GET } = loadSource("src/app/api/merchant/growth/qr/route.ts", {
    "@/lib/supabase/requireMerchant": {
      requireMerchant: async () => ({ userId: "owner" }),
    },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async () => ({
          data: { storeId: "store-id", profile: { slug: "nqc" } },
          error: null,
        }),
      }),
    },
    qrcode: {
      default: {
        toBuffer: async (url) => {
          encoded = url;
          return Buffer.from([137, 80, 78, 71]);
        },
      },
    },
  });
  const response = await GET(
    new NextRequest(
      "http://localhost:3000/api/merchant/growth/qr?slug=attacker",
    ),
  );
  assert.match(encoded, /\/store\/nqc$/);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [137, 80, 78, 71],
  );
});

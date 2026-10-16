const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

test("development output cannot be overwritten by a production build", async () => {
  const { default: config } = await import("../next.config.mjs");
  const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require("next/constants");
  const previous = process.env.NEXT_DIST_DIR;
  try {
    delete process.env.NEXT_DIST_DIR;
    const dev = config(PHASE_DEVELOPMENT_SERVER).distDir;
    const build = config(PHASE_PRODUCTION_BUILD).distDir;
    assert.notEqual(dev, build);
    assert.equal(config(PHASE_PRODUCTION_SERVER).distDir, build);
    process.env.NEXT_DIST_DIR = ".next-explicit-check";
    assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, ".next-explicit-check");
    assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, ".next-explicit-check");
  } finally {
    if (previous === undefined) delete process.env.NEXT_DIST_DIR;
    else process.env.NEXT_DIST_DIR = previous;
  }
});

test("default dev startup uses an explicit port instead of silently starting a competing server", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", `file://${__filename.replaceAll("\\", "/")}`), "utf8"));
  assert.match(scripts.dev, /next dev --port 3000/);
});

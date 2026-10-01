const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const { loadSource } = require("./helpers/load-source.cjs");

test("extracted feature panels retain generated responsive layout utilities", async () => {
  const config = loadSource("tailwind.config.ts").default;
  // Use the real content scan, not a test-only raw class list or safelist.
  const result = await postcss([tailwind(config)]).process("@tailwind utilities;", {
    from: path.resolve("src/app/globals.css"),
  });
  function declaration(selector, property, expected, media) {
    let found = false;
    result.root.walkRules(selector, rule => {
      rule.walkDecls(property, decl => {
        if (decl.value !== expected) return;
        if (media && !(rule.parent.type === "atrule" && rule.parent.params === media)) return;
        found = true;
      });
    });
    assert.ok(found, `${selector}: ${property}=${expected} (${media ?? "base"}) missing`);
  }
  declaration(".w-\\[88vw\\]", "width", "88vw");
  declaration(".max-w-\\[340px\\]", "max-width", "340px");
  declaration(".xl\\:relative", "position", "relative", "(min-width: 1280px)");
  declaration(".xl\\:w-auto", "width", "auto", "(min-width: 1280px)");
  declaration(".xl\\:max-w-none", "max-width", "none", "(min-width: 1280px)");
  declaration(".xl\\:z-auto", "z-index", "auto", "(min-width: 1280px)");
  declaration(".xl\\:translate-x-0", "--tw-translate-x", "0px", "(min-width: 1280px)");
});

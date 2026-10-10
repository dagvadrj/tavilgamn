const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Follow eager runtime imports, ignoring erased types and lazy import() calls.
// Auth resets local designs synchronously, but must not load the 3D renderer.
function eagerPackages(entry) {
  const visited = new Set();
  const packages = new Set();
  function visit(filename) {
    if (visited.has(filename)) return;
    visited.add(filename);
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
        continue;
      if (
        !node.moduleSpecifier ||
        node.isTypeOnly ||
        node.importClause?.isTypeOnly
      )
        continue;
      const bindings = node.importClause?.namedBindings ?? node.exportClause;
      if (
        !node.importClause?.name &&
        bindings?.elements?.length &&
        bindings.elements.every((item) => item.isTypeOnly)
      )
        continue;
      const id = node.moduleSpecifier.text;
      const base = id.startsWith("@/")
        ? path.resolve("src", id.slice(2))
        : id.startsWith(".")
          ? path.resolve(path.dirname(filename), id)
          : null;
      if (!base) {
        packages.add(id);
        continue;
      }
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(
        (file) => fs.existsSync(file) && /\.tsx?$/.test(file),
      );
      if (resolved) visit(resolved);
    }
  }
  visit(path.resolve(entry));
  return packages;
}

test("auth and persisted design updates stay independent of eager 3D imports", () => {
  for (const entry of ["src/store/auth.ts", "src/store/designs.ts"]) {
    const packages = eagerPackages(entry);
    assert(
      ![...packages].some(
        (id) =>
          id === "three" ||
          id.startsWith("three/") ||
          id.startsWith("@react-three/"),
      ),
      `${entry} imports the 3D runtime`,
    );
  }
  assert(
    eagerPackages("src/three/furnitureFloorBand.ts").has("three"),
    "the geometry processor still uses the actual renderer",
  );
});

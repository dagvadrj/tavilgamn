const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
function loadSource(relativePath, mocks = {}) {
  const filename = path.resolve(root, relativePath);
  const cache = new Map();
  const resolve = (id, parent) => {
    const base = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(parent), id) : null;
    return base && [base, base + ".ts", base + ".tsx"].find(file => existsSync(file) && /\.tsx?$/.test(file));
  };
  const resolvedMocks = new Map(Object.entries(mocks).map(([id, value]) => [resolve(id, filename) ?? id, value]));
  function compile(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = new Module(file, module);
    cache.set(file, loaded);
    loaded.filename = file;
    loaded.paths = Module._nodeModulePaths(path.dirname(file));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = id => {
      const resolved = resolve(id, file) ?? id;
      if (resolvedMocks.has(resolved)) return resolvedMocks.get(resolved);
      if (id === "server-only") return {};
      return resolved !== id || /\.tsx?$/.test(resolved) ? compile(resolved) : originalRequire(id);
    };
    loaded._compile(ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, file);
    return loaded.exports;
  }
  return compile(filename);
}
module.exports = { loadSource };

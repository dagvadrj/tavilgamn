const fs = require("node:fs");
const path = require("node:path");
const postcss = require("postcss");

// Local CSS entry files are ordered manifests. Inline their imports for style
// validation and source contracts, following the same order as the bundler.
function readStylesheet(filename, ancestors = []) {
  const file = path.resolve(filename);
  if (ancestors.includes(file)) {
    throw new Error(`Circular CSS import: ${[...ancestors, file].join(" → ")}`);
  }
  const root = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
  for (const node of [...root.nodes]) {
    if (node.type !== "atrule" || node.name !== "import") continue;
    const local = node.params.match(/^["'](\.[^"']+)["']$/);
    if (!local) throw new Error(`${file}: expected a quoted local CSS import`);
    const imported = readStylesheet(
      path.resolve(path.dirname(file), local[1]),
      [...ancestors, file],
    );
    node.replaceWith(...imported.nodes);
  }
  return root;
}

module.exports = { readStylesheet };

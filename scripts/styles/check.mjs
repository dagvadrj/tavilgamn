import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

// Formatting never sorts selectors, declarations or media queries: order is CSS behavior.
export function formatCss(root) {
  function render(node, depth) {
    const indent = "  ".repeat(depth);
    if (node.type === "comment") return `${indent}/* ${node.text.trim()} */`;
    if (node.type === "decl") return `${indent}${node.prop}: ${node.value}${node.important ? " !important" : ""};`;
    const heading = node.type === "rule" ? node.selector : `@${node.name}${node.params ? ` ${node.params}` : ""}`;
    if (!node.nodes) return `${indent}${heading};`;
    return `${indent}${heading} {\n${node.nodes.map(child => render(child, depth + 1)).join("\n")}\n${indent}}`;
  }
  return `${root.nodes.map(node => render(node, 0)).join("\n\n")}\n`;
}

export function semantics(node) {
  return [node.type, node.selector, node.name, node.params, node.prop, node.value,
    Boolean(node.important), node.type === "comment" ? node.text.trim() : undefined,
    node.nodes?.map(semantics)];
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? cssFiles(path.join(directory, entry.name))
    : entry.name.endsWith(".css") ? [path.join(directory, entry.name)] : []));
  return files.flat().sort();
}

const write = process.argv.includes("--write");
let failed = false;
let count = 0;
for (const file of await cssFiles("src")) {
  try {
    const source = await readFile(file, "utf8");
    const root = postcss.parse(source, { from: file });
    root.walkRules(rule => selectorParser().astSync(rule.selector));
    const formatted = formatCss(root);
    assert.deepEqual(semantics(postcss.parse(formatted)), semantics(root), `${file}: formatting changed CSS semantics`);
    if (source !== formatted) {
      if (write) await writeFile(file, formatted);
      else { console.error(`${file}: run npm run styles:format`); failed = true; }
    }
    count++;
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    failed = true;
  }
}
console.log(`${count} CSS files checked (syntax, selectors, formatting and AST equivalence).`);
if (failed) process.exitCode = 1;

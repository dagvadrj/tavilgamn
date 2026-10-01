// Read-only audit: never modifies the provided source files.
const { readFileSync } = require("node:fs");
const { loadSource } = require("../../tests/helpers/load-source.cjs");
const { inspectGlb, validateCabinetGlb } = loadSource("src/lib/glbStandard.ts");
for (const file of process.argv.slice(2)) {
  try {
    const buffer = readFileSync(file);
    const report = inspectGlb(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    console.log(JSON.stringify({ file, ...report, errors: validateCabinetGlb(report, report.dimensions) }, null, 2));
  } catch (error) { console.log(JSON.stringify({ file, error: error.message })); process.exitCode = 1; }
}

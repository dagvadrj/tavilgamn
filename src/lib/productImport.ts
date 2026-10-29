/** Excel product import contract shared by the browser preview and the server parser. */

export const IMPORT_LIMIT = 500;
export const IMPORT_BYTES = 5 * 1024 * 1024;
/** Rows per commit request; each chunk is idempotent on its own request ID. */
export const IMPORT_CHUNK = 100;
export const IMPORT_COLUMNS = [
  ["name", "Нэр", true],
  ["category", "Ангилал", true],
  ["price", "Үнэ (₮)", true],
  ["stock", "Нөөц", true],
  ["width", "Өргөн (см)", true],
  ["depth", "Гүн (см)", true],
  ["height", "Өндөр (см)", true],
  ["material", "Материал", true],
  ["color", "Өнгө", false],
  ["hex", "Өнгөний код", false],
  ["image", "Зургийн URL", false],
  ["description", "Тайлбар", false],
] as const;
export type ImportField = (typeof IMPORT_COLUMNS)[number][0];
export type ImportValues = Record<ImportField, string>;
export const IMPORT_MATERIALS = ["Мод", "Металл", "Даавуу", "Арьс", "Хилэн"];

export type ImportPreviewRow = {
  row: number;
  values: ImportValues;
  /** Fields that caused an error, so the preview can highlight the exact cell. */
  fields: ImportField[];
  errors: string[];
  warnings: string[];
};

export type ImportCommitResult = {
  count: number;
  replayed?: boolean;
};

export const importRowStatus = (row: Pick<ImportPreviewRow, "errors" | "warnings">) =>
  row.errors.length ? "error" : row.warnings.length ? "warning" : "ok";

export const normalizeProductName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

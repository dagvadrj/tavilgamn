import "server-only";
import { styleSheet } from "./merchantWorkbookStyle";
import * as ExcelJS from "exceljs";
import { Unzip, UnzipInflate } from "fflate";
import { createHash } from "node:crypto";
import { CatalogInputError } from "./catalogValidation";
import { parseMerchantProduct } from "./merchantValidation";
import { CATEGORIES } from "./catalogCategories";
import {
  IMPORT_BYTES,
  IMPORT_COLUMNS,
  IMPORT_LIMIT,
  type ImportField,
  type ImportPreviewRow,
  type ImportValues,
} from "./productImport";
import type { Product } from "./types";

export { IMPORT_BYTES, IMPORT_COLUMNS, IMPORT_LIMIT };
const materials: Record<string, string> = {
  wood: "Мод",
  metal: "Металл",
  fabric: "Даавуу",
  leather: "Арьс",
  velvet: "Хилэн",
};
const XLSX_TYPES = [
  "",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const normalize = (s: string) => s.trim().toLowerCase().replace(/\*/g, "");
function fail(s: string): never {
  throw new CatalogInputError(s);
}

/** Server-side file gate: extension, browser MIME and size before any parsing. */
export function checkImportFile(file: unknown): asserts file is File {
  if (
    !(file instanceof File) ||
    !/\.xlsx$/i.test(file.name) ||
    !XLSX_TYPES.includes(file.type) ||
    file.size === 0 ||
    file.size > IMPORT_BYTES
  )
    fail("5 MB хүртэл .xlsx файл сонгоно уу. .xls/.csv файлаа .xlsx болгон хадгална уу.");
}

/** Bound actual inflated bytes before ExcelJS parses any XML. Never extracts files to disk. */
export function checkWorkbookArchive(bytes: Uint8Array) {
  if (bytes.length > IMPORT_BYTES || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    fail(
      "5 MB-аас бага .xlsx файл сонгоно уу. .xls файлаа .xlsx болгон хадгална уу.",
    );
  let total = 0,
    entries = 0;
  const names = new Set<string>();
  const archive = new Unzip((file) => {
    if (++entries > 500 || names.has(file.name))
      fail("Excel архивын бүтэц буруу байна.");
    names.add(file.name);
    if (/vbaProject|externalLinks|embeddings/i.test(file.name))
      fail("Макро, гаднын холбоос, хавсаргасан объекттой файл ашиглахгүй.");
    file.ondata = (error, chunk) => {
      if (error) fail("Excel архивыг задлаж чадсангүй.");
      total += chunk.length;
      if (total > 25 * 1024 * 1024)
        fail("Задалсан Excel файл 25 MB-аас том байна.");
    };
    file.start();
  });
  archive.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 4096)
      archive.push(
        bytes.subarray(offset, offset + 4096),
        offset + 4096 >= bytes.length,
      );
  } catch (error) {
    if (error instanceof CatalogInputError) throw error;
    fail("Excel архив гэмтсэн байна.");
  }
  if (!names.has("xl/workbook.xml")) fail("Зөв .xlsx файл сонгоно уу.");
}

export type ImportRow = ImportPreviewRow & { product?: Product };

const emptyValues = () =>
  Object.fromEntries(IMPORT_COLUMNS.map(([key]) => [key, ""])) as ImportValues;

/** Validates one row and reports every problem at once, not just the first. */
export function parseImportRow(
  input: Partial<Record<ImportField, unknown>>,
  rowNo: number,
  requestId: string,
): ImportRow {
  const values = emptyValues();
  for (const [key] of IMPORT_COLUMNS) {
    const value = input[key];
    values[key] =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim().slice(0, 10000)
        : "";
  }
  const result: ImportRow = {
    row: rowNo,
    values,
    fields: [],
    errors: [],
    warnings: [],
  };
  const error = (field: ImportField, message: string) => {
    if (!result.fields.includes(field)) result.fields.push(field);
    result.errors.push(message);
  };
  if (!values.name) error("name", "Нэр хоосон байна.");
  const cat = CATEGORIES.find(
    (c) =>
      c.id === values.category ||
      c.name.toLowerCase() === values.category.toLowerCase(),
  );
  if (!cat || cat.id === "kitchen-cabinet")
    error(
      "category",
      values.category
        ? `«${values.category.slice(0, 40)}» ангилал олдсонгүй. Жагсаалтаас сонгоно уу.`
        : "Ангилал сонгоно уу.",
    );
  const numeric = (
    key: ImportField,
    label: string,
    max: number,
    whole = false,
  ) => {
    const s = values[key];
    if (!/^(?:\d+|\d*\.\d+)$/.test(s)) {
      error(key, `${label} тоо байх ёстой (таслал, тэмдэггүй).`);
      return 0;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n > max || (whole && !Number.isSafeInteger(n)))
      error(
        key,
        whole
          ? `${label} бүхэл тоо, ${max.toLocaleString("en-US")}-аас ихгүй байна.`
          : `${label} ${max.toLocaleString("en-US")}-аас ихгүй байна.`,
      );
    return n;
  };
  const price = numeric("price", "Үнэ", Number.MAX_SAFE_INTEGER, true);
  const stock = numeric("stock", "Нөөц", 1_000_000, true);
  const width = numeric("width", "Өргөн", 10000);
  const depth = numeric("depth", "Гүн", 10000);
  const height = numeric("height", "Өндөр", 10000);
  const material = Object.entries(materials).find(
    ([id, label]) =>
      values.material.toLowerCase() === id ||
      values.material.toLowerCase() === label.toLowerCase(),
  );
  if (!material)
    error("material", "Материал: Мод, Металл, Даавуу, Арьс эсвэл Хилэн.");
  if (values.hex && !/^#[0-9a-f]{6}$/i.test(values.hex))
    error("hex", "Өнгөний код #RRGGBB хэлбэртэй байна. Ж: #8A9A83");
  if (!values.image)
    result.warnings.push("Зураг хоосон — хадгалсны дараа зураг нэмнэ.");
  if (result.errors.length || !cat || !material) return result;
  const hash = createHash("sha256")
    .update(`${requestId}:${rowNo}`)
    .digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  try {
    result.product = parseMerchantProduct(
      {
        name: values.name,
        category: cat.id,
        description: values.description,
        basePrice: price,
        stockQuantity: stock,
        dimensions: { w: width / 100, d: depth / 100, h: height / 100 },
        image: values.image || "/image.png",
        images: [],
        colors: [
          {
            id: "default",
            name: values.color || "Үндсэн өнгө",
            hex: values.hex || "#C9A37A",
            priceDelta: 0,
          },
        ],
        defaultColor: "default",
        materials: [{ id: material[0], name: material[1], priceDelta: 0 }],
      },
      id,
    );
  } catch (reason) {
    result.errors.push(
      reason instanceof CatalogInputError
        ? reason.message
        : "Мөрийн утгуудыг шалгана уу.",
    );
  }
  return result;
}

/** Flags rows that repeat an earlier row of the same import. */
function markDuplicates(rows: ImportRow[]) {
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.product) continue;
    const fingerprint = JSON.stringify({ ...row.product, id: "" });
    const first = seen.get(fingerprint);
    if (first === undefined) seen.set(fingerprint, row.row);
    else {
      row.errors.push(`${first}-р мөртэй яг ижил бараа давхар орсон байна.`);
      row.product = undefined;
    }
  }
  return rows;
}

export async function parseMerchantWorkbook(
  bytes: Uint8Array,
  requestId: string,
) {
  checkWorkbookArchive(bytes);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(new Uint8Array(bytes).buffer);
  } catch {
    fail("Excel файлыг уншиж чадсангүй.");
  }
  const sheet = book.getWorksheet("Бараа") ?? book.worksheets[0];
  if (!sheet || sheet.rowCount > IMPORT_LIMIT + 1 || sheet.columnCount > 40)
    fail("Бараа sheet-д нэг удаа 1–500 мөр, 40 хүртэл багана оруулна уу.");
  const mapped = new Map<ImportField, number>();
  const headerText = (cell: ExcelJS.Cell) =>
    typeof cell.value === "string" || typeof cell.value === "number"
      ? String(cell.value)
      : "";
  sheet.getRow(1).eachCell((cell, index) => {
    const text = normalize(headerText(cell));
    const field = IMPORT_COLUMNS.find(
      ([key, label]) => text === normalize(label) || text === key,
    );
    if (!field) {
      if (text)
        fail(
          `Танихгүй багана: «${headerText(cell).slice(0, 80)}». Загвар файлын толгойг өөрчлөхгүй ашиглана уу.`,
        );
      return;
    }
    if (mapped.has(field[0])) fail(`Давхардсан багана: ${field[1]}`);
    mapped.set(field[0], index);
  });
  const missing = IMPORT_COLUMNS.filter(
    ([key, , required]) => required && !mapped.has(key),
  ).map(([, label]) => label);
  if (missing.length)
    fail(`Шаардлагатай багана алга: ${missing.join(", ")}`);
  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const raw: Partial<Record<ImportField, unknown>> = {};
    let formula = false;
    for (const [key, index] of mapped) {
      const value = row.getCell(index).value;
      if (value != null && typeof value === "object") formula = true;
      else raw[key] = value;
    }
    if (
      !formula &&
      Object.values(raw).every((v) => v == null || String(v).trim() === "")
    )
      return;
    const parsed = parseImportRow(raw, rowNo, requestId);
    if (formula) {
      parsed.errors.unshift(
        "Томьёо, холбоос эсвэл зурагтай нүд байна. Excel-д Paste values хийнэ үү.",
      );
      parsed.product = undefined;
    }
    rows.push(parsed);
  });
  if (!rows.length)
    fail("Импортлох бараа алга. Загварын жишээг өөрийн бараагаар солино уу.");
  markDuplicates(rows);
  return {
    rows,
    valid: rows.every((row) => !row.errors.length),
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Re-validates rows edited in the browser preview; the server never trusts client results. */
export function parseImportRows(input: unknown, requestId: string) {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > IMPORT_LIMIT
  )
    fail("Нэг удаад 1–500 мөр илгээнэ үү.");
  const rows = markDuplicates(
    input.map((item) => {
      const row = item as { row?: unknown; values?: unknown };
      if (
        !row ||
        typeof row !== "object" ||
        !Number.isSafeInteger(row.row) ||
        Number(row.row) < 2 ||
        Number(row.row) > IMPORT_LIMIT + 1 ||
        !row.values ||
        typeof row.values !== "object" ||
        Array.isArray(row.values)
      )
        fail("Мөрийн мэдээлэл буруу байна.");
      return parseImportRow(
        row.values as Record<ImportField, unknown>,
        Number(row.row),
        requestId,
      );
    }),
  );
  if (new Set(rows.map((row) => row.row)).size !== rows.length)
    fail("Мөрийн дугаар давхардсан байна.");
  return {
    rows,
    hash: createHash("sha256")
      .update(JSON.stringify(rows.map(({ row, values }) => [row, values])))
      .digest("hex"),
  };
}

/** The user's own failed rows, with the reason beside each, ready to fix and re-import. */
export async function importErrorsWorkbook(rows: ImportRow[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Бараа");
  sheet.addRow([
    ...IMPORT_COLUMNS.map(([, label, required]) => label + (required ? "*" : "")),
  ]);
  for (const row of rows)
    sheet.addRow(IMPORT_COLUMNS.map(([key]) => row.values[key]));
  styleSheet(sheet);
  const reasons = book.addWorksheet("Алдаа");
  reasons.addRow(["Анхны мөр", "Нэр", "Алдаа"]);
  for (const row of rows)
    reasons.addRow([row.row, row.values.name, row.errors.join(" ")]);
  styleSheet(reasons);
  reasons.getColumn(3).width = 90;
  return book.xlsx.writeBuffer();
}

const column = (key: ImportField) =>
  IMPORT_COLUMNS.findIndex(([field]) => field === key) + 1;

export async function merchantImportTemplate() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Бараа");
  sheet.addRow(
    IMPORT_COLUMNS.map(([, label, required]) => label + (required ? "*" : "")),
  );
  sheet.addRow([
    "Жишээ буйдан — өөрийн бараагаар солино",
    "Буйдан",
    1599000,
    5,
    214,
    104,
    86,
    "Даавуу",
    "Ногоон",
    "#8A9A83",
    "",
    "Энэ мөрийг устгаад өөрийн бараагаа оруулна уу.",
  ]);
  styleSheet(sheet);
  // Required headers stay orange so the minimum to fill in is obvious at a glance.
  IMPORT_COLUMNS.forEach(([, , required], index) => {
    if (required)
      sheet.getRow(1).getCell(index + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC2410C" },
      };
  });
  const categorySheet = book.addWorksheet("Ангилал");
  categorySheet.addRow(["Ангиллын нэр", "Код"]);
  CATEGORIES.filter((c) => c.id !== "kitchen-cabinet").forEach((c) =>
    categorySheet.addRow([c.name, c.id]),
  );
  styleSheet(categorySheet);
  const help = book.addWorksheet("Заавар");
  help.addRow(["Талбар", "Тайлбар"]);
  [
    [
      "Алхам",
      "1) Улбар шар толгойтой баганыг заавал бөглөнө. 2) Файлаа хадгална. 3) Самбар дээр чирж оруулаад шалгана. Алдаатай мөрийг тэнд нь засах эсвэл алгасаж болно.",
    ],
    [
      "Импорт",
      "Шинэ бараа нэмнэ. Ижил нэртэй бараа байвал алгасах эсвэл шинээр нэмэхийг импортын үед сонгоно.",
    ],
    [
      "Хязгаар",
      "Зөвхөн .xlsx, 5 MB, 500 мөр. Бараа sheet-ийн толгойн нэрийг өөрчлөхгүй.",
    ],
    [
      "Хэмжээ",
      "Өргөн/гүн/өндөр сантиметрээр. Ж: 214 см; аравтын бутархайг цэгээр бичнэ.",
    ],
    [
      "Үнэ / Нөөц",
      "Төгрөг / ширхэг. Таслалгүй бүхэл тоо. Томьёог Paste values хийнэ.",
    ],
    [
      "Материал",
      "Мод, Металл, Даавуу, Арьс, Хилэн (wood, metal, fabric, leather, velvet).",
    ],
    [
      "Зураг",
      "Хоосон байж болно. Хадгалсны дараа «Зураг дутуу» жагсаалт руу файлуудаа чирж оруулбал нэрээр нь автоматаар холбоно.",
    ],
    [
      "Өнгө",
      "Нэг үндсэн өнгө. Нэр болон #RRGGBB код. Дараа нь нэмэлт сонголтуудыг засаж болно.",
    ],
    ["Гал тогоо", "Гал тогооны модуль/GLB санг тусад нь ашиглана."],
  ].forEach((row) => help.addRow(row));
  styleSheet(help);
  help.getColumn(2).width = 100;
  help.eachRow((row, i) => {
    if (i > 1) row.height = 36;
  });
  const whole = (
    title: string,
    max: number,
  ): ExcelJS.DataValidation => ({
    type: "whole",
    operator: "between",
    allowBlank: false,
    formulae: [0, max],
    showErrorMessage: true,
    errorTitle: title,
    error: `${title}: 0-ээс ${max} хүртэл бүхэл тоо.`,
  });
  const size: ExcelJS.DataValidation = {
    type: "decimal",
    operator: "between",
    allowBlank: false,
    formulae: [0.1, 10000],
    showErrorMessage: true,
    errorTitle: "Хэмжээ",
    error: "Сантиметрээр, 0.1–10000.",
  };
  for (let row = 2; row <= IMPORT_LIMIT + 1; row++) {
    sheet.getCell(row, column("category")).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`'Ангилал'!$A$2:$A$${categorySheet.rowCount}`],
    };
    sheet.getCell(row, column("material")).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Мод,Металл,Даавуу,Арьс,Хилэн"'],
    };
    sheet.getCell(row, column("price")).dataValidation = whole(
      "Үнэ",
      Number.MAX_SAFE_INTEGER,
    );
    sheet.getCell(row, column("stock")).dataValidation = whole(
      "Нөөц",
      1_000_000,
    );
    for (const key of ["width", "depth", "height"] as const)
      sheet.getCell(row, column(key)).dataValidation = size;
  }
  // Validation-only cells intentionally span the supported import range.
  return book.xlsx.writeBuffer();
}

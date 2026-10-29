import "server-only";
import type { NextRequest } from "next/server";
import { CatalogInputError } from "./catalogValidation";
import { documentResponse, limitedBody } from "./merchantCommerceServer";
import {
  IMPORT_BYTES,
  checkImportFile,
  importErrorsWorkbook,
  parseImportRows,
  parseMerchantWorkbook,
  type ImportRow,
} from "./merchantExcel";
import type { ImportPreviewRow } from "./productImport";

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export const isImportUpload = (request: NextRequest) =>
  (request.headers.get("content-type") ?? "").startsWith("multipart/form-data");

/** Browser preview never receives the parsed product payload. */
export const previewRow = ({ row, values, fields, errors, warnings }: ImportRow) =>
  ({ row, values, fields, errors, warnings }) satisfies ImportPreviewRow;

export async function importPreview(request: NextRequest) {
  const bytes = await limitedBody(request, IMPORT_BYTES + 64000);
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new CatalogInputError("Excel файлаа дахин сонгоно уу.");
  }
  const file = form.get("file"),
    requestId = form.get("requestId");
  checkImportFile(file);
  if (typeof requestId !== "string" || !UUID.test(requestId))
    throw new CatalogInputError("Excel файлаа дахин сонгоно уу.");
  const parsed = await parseMerchantWorkbook(
    new Uint8Array(await file.arrayBuffer()),
    requestId,
  );
  return {
    valid: parsed.valid,
    rows: parsed.rows.map(previewRow),
    hash: parsed.hash,
  };
}

/** Commit or error-report request: edited rows are re-validated here, never trusted. */
export async function readImportJson(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await limitedBody(request, 2 * 1024 * 1024),
      ),
    );
  } catch (error) {
    if (error instanceof CatalogInputError) throw error;
    throw new CatalogInputError("JSON мэдээлэл буруу байна.");
  }
  const { mode, requestId, storeId } = body ?? {};
  if (
    (mode !== "commit" && mode !== "errors" && mode !== "validate") ||
    typeof requestId !== "string" ||
    !UUID.test(requestId) ||
    (storeId !== undefined &&
      (typeof storeId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(storeId)))
  )
    throw new CatalogInputError("Импортын хүсэлт буруу байна.");
  const parsed = parseImportRows(body.rows, requestId);
  return {
    mode,
    requestId,
    storeId: storeId as string | undefined,
    ...parsed,
  };
}

export function validProducts(rows: ImportRow[]) {
  if (rows.some((row) => !row.product))
    throw new CatalogInputError(
      "Алдаатай мөр байна. Засах эсвэл алгасаад дахин хадгална уу.",
    );
  return rows.map((row) => row.product!);
}

export async function importErrorsResponse(rows: ImportRow[]) {
  const failed = rows.filter((row) => row.errors.length);
  if (!failed.length)
    throw new CatalogInputError("Алдаатай мөр алга. Татах зүйл байхгүй.");
  return documentResponse(
    await importErrorsWorkbook(failed),
    "baraa-aldaatai-moruud",
    "xlsx",
  );
}

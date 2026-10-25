import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabase/admin";
import { merchantHeaders } from "./merchantServer";
import { CatalogInputError } from "./catalogValidation";
import { CONTRACT_BUCKET, contractFilename } from "./merchantContractFiles";
import type { ContractVersion } from "./merchantCommerce";

export async function contractFileResponse(contract: ContractVersion) {
  if (
    !contract.file_path ||
    !contract.file_name ||
    !contract.file_type ||
    !contract.file_sha256
  )
    throw new CatalogInputError("Гэрээний файл олдсонгүй.");
  const { data, error } = await getSupabaseAdmin()
    .storage.from(CONTRACT_BUCKET)
    .download(contract.file_path);
  if (error) throw error;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (
    bytes.length !== contract.file_size ||
    createHash("sha256").update(bytes).digest("hex") !== contract.file_sha256
  )
    throw new CatalogInputError("Гэрээний файлыг баталгаажуулж чадсангүй.");
  const name = contractFilename(contract.file_name);
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16),
  );
  return new NextResponse(bytes, {
    headers: {
      ...merchantHeaders,
      "Content-Type": contract.file_type,
      "Content-Disposition": `attachment; filename="contract-v${contract.version_no}.${contract.file_type === "application/pdf" ? "pdf" : "docx"}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

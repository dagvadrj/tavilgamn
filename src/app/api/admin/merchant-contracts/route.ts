import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { commerceJson, commerceError } from "@/lib/merchantCommerceServer";
import { merchantHeaders } from "@/lib/merchantServer";
import { merchantObject } from "@/lib/merchantValidation";
import { toJson } from "@/lib/supabase/json";
import type {
  AdminContractsData,
  ContractVersion,
} from "@/lib/merchantCommerce";
import { contractFileResponse } from "@/lib/merchantContractFileServer";
import {
  CONTRACT_BUCKET,
  CONTRACT_FILE_LIMIT,
  contractFilename,
  contractStoreId,
  validateContractFile,
} from "@/lib/merchantContractFiles";
import { readGrowthForm } from "@/lib/merchantGrowthFiles";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const page = Number(request.nextUrl.searchParams.get("page") ?? 0);
    const storeId = contractStoreId(
      request.nextUrl.searchParams.get("storeId"),
      false,
    );
    const file = request.nextUrl.searchParams.get("file");
    if (file && !/^[a-f0-9-]{36}$/i.test(file))
      throw new CatalogInputError("Гэрээний дугаар буруу байна.");
    if (file && !storeId)
      throw new CatalogInputError("Merchant-ээ сонгоно уу.");
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_merchant_contracts",
      {
        p_actor: auth.userId,
        p_action: file ? "file" : "read",
        p_data: toJson({ page, storeId, id: file }),
      },
    );
    if (error) throw error;
    if (file)
      return contractFileResponse(
        (data as unknown as { contract: ContractVersion }).contract,
      );
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээний мэдээллийг ачаалж чадсангүй.");
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    let file: File | undefined;
    let input: unknown;
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      const form = await readGrowthForm(
        request,
        CONTRACT_FILE_LIMIT + 64 * 1024,
      );
      try {
        input = JSON.parse(String(form.get("metadata")));
      } catch {
        throw new CatalogInputError("Гэрээний мэдээлэл буруу байна.");
      }
      const uploaded = form.get("file");
      if (uploaded !== null) {
        if (!(uploaded instanceof File))
          throw new CatalogInputError("Файлаа сонгоно уу.");
        file = uploaded;
      }
    } else input = await commerceJson(request);
    const raw = merchantObject(input);
    const storeId = contractStoreId(raw.storeId);
    if (!["save", "publish"].includes(String(raw.action)))
      throw new CatalogInputError("Үйлдэл буруу байна.");
    if (
      raw.action === "save" &&
      (typeof raw.title !== "string" ||
        !raw.title.trim() ||
        raw.title.length > 200 ||
        typeof raw.platformName !== "string" ||
        !raw.platformName.trim() ||
        raw.platformName.length > 300)
    )
      throw new CatalogInputError(
        "Гэрээний гарчиг, платформын хуулийн этгээдийн нэрийг бүрэн оруулна уу.",
      );
    if (
      raw.id != null &&
      (typeof raw.id !== "string" || !/^[a-f0-9-]{36}$/i.test(raw.id))
    )
      throw new CatalogInputError("Гэрээний дугаар буруу байна.");
    if (
      raw.id != null &&
      (!Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0)
    )
      throw new CatalogInputError("Гэрээг дахин ачаална уу.");
    const page = Number(raw.page ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    const db = getSupabaseAdmin();
    const payload: Record<string, unknown> = {
      storeId,
      page,
      id: raw.id,
      revision: raw.revision,
      title: raw.title,
      platformName: raw.platformName,
    };
    let uploadedPath: string | undefined;
    if (file) {
      if (raw.action !== "save")
        throw new CatalogInputError("Файлыг эхлээд ноорогт хадгална уу.");
      if (!file.size || file.size > CONTRACT_FILE_LIMIT)
        throw new CatalogInputError("Гэрээний файл 10 MB хүртэл байна.");
      const scoped = await db.rpc("admin_merchant_contracts", {
        p_actor: auth.userId,
        p_data: toJson({ storeId }),
      });
      if (scoped.error) throw scoped.error;
      if (
        !(scoped.data as unknown as AdminContractsData).merchants?.some(
          (m) => m.id === storeId && m.active,
        )
      )
        throw new CatalogInputError("Идэвхтэй merchant сонгоно уу.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validated = validateContractFile(bytes, file.name);
      uploadedPath = `contracts/${randomUUID()}/${randomUUID()}.${validated.extension}`;
      const upload = await db.storage
        .from(CONTRACT_BUCKET)
        .upload(uploadedPath, bytes, {
          contentType: validated.contentType,
          upsert: false,
        });
      if (upload.error) throw upload.error;
      payload.file = {
        path: uploadedPath,
        name: contractFilename(file.name),
        type: validated.contentType,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }
    const { data, error } = await db.rpc("admin_merchant_contracts", {
      p_actor: auth.userId,
      p_action: String(raw.action),
      p_data: toJson(payload),
    });
    if (error) {
      // A definitive rollback can discard only this request's new object.
      // Keep it on ambiguous network errors, where the transaction may have committed.
      if (
        uploadedPath &&
        ["22023", "23505", "23514", "42501", "P0003"].includes(error.code)
      )
        await db.storage.from(CONTRACT_BUCKET).remove([uploadedPath]);
      throw error;
    }
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээг хадгалж чадсангүй.");
  }
}

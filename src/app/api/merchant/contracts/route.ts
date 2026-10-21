import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import type { MerchantContractsData } from "@/lib/merchantCommerce";
import {
  documentResponse,
  commerceJson,
  commerceError,
} from "@/lib/merchantCommerceServer";
import { merchantHeaders } from "@/lib/merchantServer";
import { merchantObject } from "@/lib/merchantValidation";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().rpc("merchant_contracts", {
      p_actor: auth.userId,
    });
    if (error) throw error;
    const result = data as unknown as MerchantContractsData;
    const format = request.nextUrl.searchParams.get("format");
    if (format && format !== "pdf")
      throw new CatalogInputError("Зөвхөн PDF татна.");
    if (format === "pdf") {
      const id = request.nextUrl.searchParams.get("acceptance");
      const signed = id
        ? result.acceptances.find((item) => item.acceptance.id === id)
        : result.acceptances.find(
            (item) => item.contract.id === result.current?.id,
          );
      const contract = signed?.contract ?? (!id ? result.current : null);
      if (!contract)
        return apiErrorResponse(
          { error: "Гэрээ олдсонгүй." },
          { status: 404, headers: merchantHeaders },
        );
      return documentResponse(
        await (
          await import("@/lib/merchantPdf")
        ).merchantContractPdf(contract, signed?.acceptance),
        `merchant-contract-v${contract.version_no}`,
        "pdf",
      );
    }
    return NextResponse.json(result, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээг ачаалж чадсангүй.");
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const raw = merchantObject(await commerceJson(request));
    if (
      typeof raw.contractId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(raw.contractId) ||
      typeof raw.signerName !== "string" ||
      raw.signerName.trim().length < 2 ||
      raw.signerName.length > 200 ||
      raw.consent !== true
    )
      throw new CatalogInputError(
        "Гэрээг уншиж зөвшөөрөөд төлөөлөгчийн нэрээ оруулна уу.",
      );
    const { data, error } = await getSupabaseAdmin().rpc("merchant_contracts", {
      p_actor: auth.userId,
      p_action: "accept",
      p_data: toJson({
        contractId: raw.contractId,
        signerName: raw.signerName.trim(),
        consent: true,
      }),
    });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээний зөвшөөрлийг хадгалж чадсангүй.");
  }
}

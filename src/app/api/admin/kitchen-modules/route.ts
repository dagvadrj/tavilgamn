import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  KitchenModuleInputError,
  parseKitchenModelDelete,
  parseKitchenVariantInput,
  parseVariantState,
} from "@/lib/kitchenModuleCatalog";
import {
  readKitchenModelCandidates,
  readKitchenModuleCatalog,
} from "@/lib/kitchenModuleCatalogServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import {
  getKitchenGlbAssembly,
  kitchenPartKind,
} from "@/lib/kitchenGlbAssembly";
import { toJson } from "@/lib/supabase/json";
import { normalizeKitchenMaterials } from "@/lib/kitchenMaterials";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: unknown, fallback: string) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const databaseMessage =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const invalidVariant =
    databaseMessage === "Variant does not fit module"
      ? "Хаалга, шургуулгын хийц тухайн module-д тохирохгүй байна. Хийцийн preset-ээ шалгана уу."
      : databaseMessage === "Model dimensions do not match module"
        ? "GLB-ийн хэмжээ сонгосон module-тэй таарахгүй байна."
        : databaseMessage === "Ready kitchen GLB required"
          ? "Бэлэн болсон kitchen GLB сонгоно уу."
          : databaseMessage === "Model belongs to a different module"
            ? "Энэ model өөр module-д холбогдсон байна. BASE болон CORNER-BASE-ийг сольж холбохгүй."
            : databaseMessage.includes("Canonical")
              ? "Module, variant эсвэл хийцийн canonical code буруу байна."
              : "GLB-ийн хэмжээ module-тэй таарахгүй эсвэл variant тохирохгүй байна.";
  const message =
    error instanceof KitchenModuleInputError
      ? error.message
      : code === "42501"
        ? "Admin эрх шаардлагатай."
        : code === "P0002"
          ? "Module эсвэл model олдсонгүй."
          : code === "23505"
            ? "Энэ module-д ижил variant code бүртгэгдсэн байна. Хийцийн ялгах code нэмнэ үү."
            : code === "22023"
              ? invalidVariant
              : fallback;
  return apiErrorResponse(
    { error: message },
    {
      status:
        error instanceof KitchenModuleInputError || code === "22023"
          ? 400
          : code === "23505"
            ? 409
            : code === "42501"
              ? 403
              : code === "P0002"
                ? 404
                : 503,
      headers,
    },
  );
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const db = getSupabaseAdmin();
    const [modules, models] = await Promise.all([
      readKitchenModuleCatalog({ admin: true }, db),
      readKitchenModelCandidates(db),
    ]);
    const materials = await db
      .from("material_definitions")
      .select(
        "id,name,surface_kind,base_color,roughness,metalness,texture_paths",
      )
      .eq("active", true)
      .order("name");
    if (materials.error) throw materials.error;
    return NextResponse.json(
      { modules, models, materials: normalizeKitchenMaterials(materials.data) },
      { headers },
    );
  } catch (error) {
    return fail(error, "Kitchen module catalog ачаалж чадсангүй.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const input = parseKitchenVariantInput(
      await request.json().catch(() => null),
    );
    const db = getSupabaseAdmin();
    const assembly = getKitchenGlbAssembly(input.payload.configuration);
    if (assembly?.slots.length) {
      const materialIds = [
        ...new Set(
          assembly.slots.flatMap((slot) =>
            slot.options.flatMap((option) =>
              option.materialId ? [option.materialId] : [],
            ),
          ),
        ),
      ];
      if (materialIds.length) {
        const materials = await db
          .from("material_definitions")
          .select("id,surface_kind")
          .in("id", materialIds)
          .eq("active", true);
        if (materials.error) throw materials.error;
        for (const slot of assembly.slots)
          for (const option of slot.options) {
            if (!option.materialId) continue;
            const material = materials.data?.find(
              (item) => item.id === option.materialId,
            );
            const surface = ["door", "drawer-front"].includes(slot.kind)
              ? "front"
              : slot.kind === "handle"
                ? "handle"
                : slot.kind === "countertop"
                  ? "countertop"
                  : slot.kind === "appliance"
                    ? "appliance"
                    : "carcass";
            if (
              !material ||
              !["general", surface].includes(material.surface_kind)
            )
              throw new KitchenModuleInputError(
                `${slot.label}: тохирох зориулалттай, идэвхтэй материал сонгоно уу.`,
              );
          }
      }
      const ids = [
        ...new Set(
          assembly.slots.flatMap((slot) =>
            slot.options.map((option) => option.modelId),
          ),
        ),
      ];
      if (ids.includes(input.modelId))
        throw new KitchenModuleInputError(
          "Үндсэн шүүгээг өөрийнх нь эд ангиар сонгохгүй.",
        );
      const { data: parts, error: partsError } = await db
        .from("kitchen_models")
        .select(
          "id,glb_path,processing_status,archived_at,specifications,dimensions_w,dimensions_h,dimensions_d,glb_validation",
        )
        .in("id", [...ids, input.modelId]);
      if (partsError) throw partsError;
      for (const slot of assembly.slots) {
        if (!slot.anchorNode) continue;
        const parent = assembly.slots.find(
          (parent) => parent.id === slot.parentSlotId,
        );
        const parents = parent
          ? parent.options.map((option) => option.modelId)
          : [input.modelId];
        for (const parentId of parents) {
          const report = parts?.find(
            (part) => part.id === parentId,
          )?.glb_validation;
          if (
            !report ||
            typeof report !== "object" ||
            Array.isArray(report) ||
            !Array.isArray(report.nodeNames) ||
            !report.nodeNames.includes(slot.anchorNode)
          )
            throw new KitchenModuleInputError(
              `${slot.label}: ${slot.anchorNode} холбох цэг parent GLB-д олдсонгүй. GLB-г нэртэй anchor-тай дахин оруулна уу эсвэл мм байрлал ашиглана уу.`,
            );
        }
        if (slot.hideNodes.includes(slot.anchorNode))
          throw new KitchenModuleInputError(
            `${slot.label}: бэхэлгээний цэгээ нуухгүй байна.`,
          );
      }
      for (const slot of assembly.slots)
        for (const option of slot.options) {
          const part = parts?.find((part) => part.id === option.modelId);
          if (
            !part ||
            part.archived_at ||
            part.processing_status !== "ready" ||
            !part.glb_path
          )
            throw new KitchenModuleInputError(
              `${slot.label}: бэлэн, идэвхтэй GLB сонгоно уу.`,
            );
          const kind = kitchenPartKind(part.specifications);
          if (kind && kind !== slot.kind && !(slot.kind === "drawer-front" && kind === "drawer"))
            throw new KitchenModuleInputError(
              `${slot.label}: эд ангийн төрөл таарахгүй байна.`,
            );
          if (
            option.sizeMm &&
            [
              Math.abs(option.sizeMm.width - Number(part.dimensions_w) * 1000),
              Math.abs(option.sizeMm.height - Number(part.dimensions_h) * 1000),
              Math.abs(option.sizeMm.depth - Number(part.dimensions_d) * 1000),
            ].some((delta) => delta > 5)
          )
            throw new KitchenModuleInputError(
              `${slot.label}: GLB-ийн бодит хэмжээ тохирохгүй байна.`,
            );
        }
    }
    const { error } = await db.rpc("save_kitchen_module_variant", {
      p_actor: auth.userId,
      p_model: input.modelId,
      p_module: input.moduleId,
      p_payload: toJson(input.payload),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201, headers });
  } catch (error) {
    return fail(error, "Variant хадгалж чадсангүй.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const input = parseVariantState(await request.json().catch(() => null));
    const { error } = await getSupabaseAdmin().rpc(
      "set_kitchen_module_variant_active",
      {
        p_actor: auth.userId,
        p_model: input.modelId,
        p_active: input.active,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return fail(error, "Variant төлөвийг өөрчилж чадсангүй.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const { modelId } = parseKitchenModelDelete(
      await request.json().catch(() => null),
    );
    const db = getSupabaseAdmin();
    const { data: model, error: modelError } = await db
      .from("kitchen_models")
      .select(
        "id,category,glb_path,source_glb_path,preview_glb_path,standard_glb_path,thumbnail_path",
      )
      .eq("id", modelId)
      .maybeSingle();
    if (modelError) throw modelError;
    if (!model)
      return apiErrorResponse(
        { error: "Kitchen GLB олдсонгүй." },
        { status: 404, headers },
      );
    if (model.category !== "kitchen-cabinet")
      throw new KitchenModuleInputError("Зөвхөн kitchen GLB устгаж болно.");

    const { error } = await db.rpc("set_kitchen_model_archived", {
      p_actor: auth.userId,
      p_model: modelId,
      p_archived: true,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, archived: true }, { headers });
  } catch (error) {
    return fail(error, "Kitchen GLB устгаж чадсангүй.");
  }
}

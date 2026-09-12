import { readModelBundle, uploadModelBundle, ModelBundleError } from "@/lib/modelUploadBundle";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  R2ModelError,
  removeStoredModelFiles,
} from "@/lib/r2Models";

export const runtime = "nodejs";
export const maxDuration = 180;

const headers = {
  "Cache-Control": "private, no-store",
};

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) return auth.error;

    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(params.id)) {
      return fail("3D загварын ID буруу байна.", 400);
    }

    const form = await request.formData();
    const file = form.get("glb");
    const expected = form.get("expectedFile");

    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".glb") ||
      file.size < 12 ||
      file.size > 50 * 1024 * 1024 ||
      typeof expected !== "string" ||
      /[/\\]/.test(expected)
    ) {
      return fail("50 MB-аас ихгүй GLB файл сонгоно уу.", 400);
    }

    const header = new DataView(
      await file.slice(0, 12).arrayBuffer(),
    );

    if (
      header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 ||
      header.getUint32(8, true) !== file.size
    ) {
      return fail("Хүчинтэй GLB 2.0 файл сонгоно уу.", 400);
    }

    const db = getSupabaseAdmin();

    const { data: model, error: readError } = await db
      .from("furniture_models")
      .select("id,glb_path,scale")
      .eq("product_id", params.id)
      .maybeSingle();

    if (readError) throw readError;

    if (!model) {
      return fail("3D загвар олдсонгүй.", 404);
    }

    if ((model.glb_path?.split("/").pop() ?? "") !== expected) {
      return fail(
        "GLB өөрчлөгдсөн байна. Хуудсаа шинэчлээд дахин оролдоно уу.",
        409,
      );
    }

    const bundle = await readModelBundle(form, file);
    const uploadedPath = await uploadModelBundle(bundle, model.id, db);
    const fileName = uploadedPath.split("/").pop()!;

    const { data: changed, error } = await db.rpc(
      "replace_furniture_glb",
      {
        p_id: model.id,
        p_expected_file: expected,
        p_new: uploadedPath,
      },
    );

    if (error) {
      // DB хадгалалт баталгаажаагүй үед шинэ файлыг устгахгүй.
      console.error(
        "[replace-glb/database]",
        error.code,
        uploadedPath,
      );

      return fail(
        "GLB холбоос хадгалах хариу баталгаажаагүй. Хуудсаа шинэчлээд шалгана уу.",
        503,
      );
    }

    if (changed !== true) {
      try {
        await removeStoredModelFiles(db, [uploadedPath]);
      } catch {
        console.error(
          "[replace-glb/unused-upload]",
          uploadedPath,
        );
      }

      return fail(
        "GLB өөрчлөгдсөн байна. Хуудсаа шинэчлээд дахин оролдоно уу.",
        409,
      );
    }

    return NextResponse.json(
      { model: { id: model.id, file: fileName, scale: Number(model.scale) } },
      { headers },
    );
  } catch (error) {
    if (error instanceof ModelBundleError) return fail(error.message, 400);
    return fail(
      error instanceof R2ModelError
        ? error.message
        : "GLB солиход алдаа гарлаа.",
      503,
    );
  }
}

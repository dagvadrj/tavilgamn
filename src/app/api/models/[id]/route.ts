import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { removeStoredModelFiles } from "@/lib/r2Models";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminAuth = await requireAdmin(request);

  if (adminAuth.error) {
    return adminAuth.error;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: model, error: findError } = await supabase
    .from("furniture_models")
    .select("glb_path, thumbnail_path")
  .eq("id", params.id)
.maybeSingle();
if (findError) throw findError;
if (!model) { 
  return NextResponse.json({ error: "Загвар олдсонгүй" }, { status: 404 },);
}
const {error: deleteError} = await supabase
.from("furniture_models")
.delete()
.eq("id", params.id);

if (deleteError?.code === "P0007") return NextResponse.json({error:"Захиалгад орсон барааг устгах боломжгүй. Барааны үлдэгдлийг шинэчилнэ үү."},{status:409});
if (deleteError) throw deleteError;

const storagePaths = [
  model.glb_path,
  model.thumbnail_path,
].filter((path): path is string => !!path);
if (storagePaths.length > 0) {
  try {
    await removeStoredModelFiles(supabase, storagePaths);
  } catch (cleanupError) {
    console.error("[models/delete/files]", cleanupError, storagePaths);
    return NextResponse.json({
      success: true,
      warning: "Загвар устсан боловч зарим файл цэвэрлэгдсэнгүй. Серверийн логийг шалгана уу.",
    });
  }
}
return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[models/delete]", error);
    return NextResponse.json(
      { error: "Загвар устгахад алдаа гарлаа" },
      { status: 500 },
    );
  }
}
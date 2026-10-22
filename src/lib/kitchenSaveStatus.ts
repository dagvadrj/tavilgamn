import { parseKitchen, type SavedKitchen } from "./kitchenAssembly";
import type { ModularKitchen } from "./kitchenCabinets";
import { plannerContentKey } from "./plannerContentKey";

export function kitchenContentKey(name: string, design: ModularKitchen): string {
  return plannerContentKey({ name: name.trim(), design: parseKitchen(design, { allowEmpty: true }) });
}

export type KitchenSaveStatus = { kind: "loading" | "saving" | "saved" | "modified" | "local" | "error"; label: string; detail: string };
export function kitchenSaveStatus({ name, design, saved, signedIn, saving, localSaved, loading, saveError }: {
  name: string; design: ModularKitchen; saved?: SavedKitchen; signedIn: boolean;
  saving: boolean; localSaved: boolean | undefined; loading: boolean; saveError?: string;
}): KitchenSaveStatus {
  if (saving) return { kind: "saving", label: "Бүртгэлд хадгалж байна…", detail: "Хадгалалт дуусахыг хүлээнэ үү." };
  if (saveError) return { kind: "error", label: "Бүртгэлд хадгалж чадсангүй", detail: saveError };
  if (saved) {
    try {
      if (kitchenContentKey(name, design) === kitchenContentKey(saved.name, saved.design)) {
        return { kind: "saved", label: "Бүртгэлд хадгалагдсан", detail: localSaved === false
          ? "Бүртгэл дэх хувилбар хадгалагдсан. Энэ төхөөрөмжийн түр хадгалалт ажиллахгүй байна."
          : "Миний гарнитур хэсгээс дахин нээж, өрөөндөө байрлуулна." };
      }
    } catch { /* An incomplete edit must be saved explicitly after it becomes valid. */ }
  }
  if (localSaved === false) return { kind: "error", label: "Түр хадгалалт ажиллахгүй байна", detail: "Browser-ийн хадгалах зай, зөвшөөрлийг шалгана уу. Хуудаснаас гарахаасаа өмнө бүртгэлдээ хадгалаарай." };
  if (loading) return { kind: "loading", label: "Хадгалсан хувилбарыг шалгаж байна…", detail: "Таны гарнитурын санг ачаалж байна." };
  if (localSaved === undefined) return { kind: "loading", label: "Ажлын явцыг хадгалж байна…", detail: "Энэ төхөөрөмжийн түр хадгалалтыг шалгаж байна." };
  return signedIn ? { kind: "modified", label: "Бүртгэлд хадгалаагүй өөрчлөлт", detail: "Ажлын явц энэ төхөөрөмж дээр үлдсэн. «Хадгалах» дарж бүртгэл дэх гарнитураа шинэчилнэ." }
    : { kind: "local", label: "Зөвхөн энэ төхөөрөмж дээр", detail: "Ажлын явц энэ browser-д үлдсэн. Нэвтэрч хадгалбал «Миний гарнитур»-т нэмнэ." };
}

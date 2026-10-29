export type PlannerTourKind = "room" | "kitchen";
export type TourIllustration =
  "size" | "catalog" | "place" | "view" | "material" | "save";

export interface PlannerTourStep {
  title: string;
  description: string;
  detail: string;
  target: string;
  illustration: TourIllustration;
}

// Quoted names must match the visible button and tab labels exactly, so the
// visitor can find each control the step points to.
export const plannerTourSteps: Record<PlannerTourKind, PlannerTourStep[]> = {
  room: [
    {
      title: "Өрөө бэлэн боллоо",
      description:
        "Хэмжээ, хэлбэр, хана, шалаа дараа нь доод талын «Өрөө ба материал» товчоор өөрчилнө.",
      detail:
        "Хаалга, цонхоо зөв байрлуулбал тавилга багтах эсэх илүү үнэн гарна.",
      target: "room-size",
      illustration: "size",
    },
    {
      title: "Тавилга нэмэх",
      description:
        "Зүүн самбарын «Тавилга» табаас сонгоод «Өрөөнд нэмэх» дарна.",
      detail:
        "Нэмсэн тавилга «Өрөөнд» табд, худалдан авах бараа «Сагс» табд харагдана. Өрөөнд нэмэх нь сагсанд нэмэхгүй.",
      target: "room-catalog",
      illustration: "catalog",
    },
    {
      title: "Чирж байрлуулах",
      description:
        "Тавилгаа дарж сонгоод чирнэ. Сонгоход эргүүлэх, солих товч гарна.",
      detail:
        "Хананаас халих байрлалыг хориглоно. Алдвал «Буцаах» эсвэл Ctrl+Z.",
      target: "room-stage",
      illustration: "place",
    },
    {
      title: "Өнцөг солих",
      description:
        "Доод талын «Гаднаас», «Дээрээс», «Хажуугаас», «Дотроос» товчоор харна.",
      detail:
        "Баруун талын +, − товчоор ойртуулж, холдуулна. Голын товч өрөөг бүтнээр нь харуулна.",
      target: "room-view",
      illustration: "view",
    },
    {
      title: "Хадгалах",
      description:
        "Дээд талын «Хадгалах» дарна. «Тойм»-оос нийт үнээ шалгана.",
      detail:
        "Загвар энэ төхөөрөмж дээр хадгалагдана. «Нэвтрэх» дарвал бүртгэлдээ хадгална. «?» товч энэ зааврыг дахин нээнэ.",
      target: "room-save",
      illustration: "save",
    },
  ],
  kitchen: [
    {
      title: "Хэмжээ бэлэн боллоо",
      description:
        "Өрөөний хэмжээ, хаалга, цонхоо засах бол дээд талын «Өрөө» алхам руу буцна.",
      detail: "Бодит хэмжээгээ ашиглавал шүүгээ зөв багтана.",
      target: "kitchen-space",
      illustration: "size",
    },
    {
      title: "Шүүгээ нэмэх",
      description:
        "«Каталог» табын «Шүүгээ», «Төхөөрөмж» хэсгээс сонгоод «+» дарна.",
      detail:
        "Хоолны ширээ, сандлыг «Хоолны хэсэг»-ээс нэмнэ. Хэмжээсийг карт бүр дээр харуулна.",
      target: "kitchen-catalog",
      illustration: "catalog",
    },
    {
      title: "Хэлбэр сонгох",
      description:
        "Дээд талын «•••» цэсний «Байрлал»-аас шулуун, L, U эсвэл хоёр талт хэлбэрийг сонгоно.",
      detail:
        "Хэлбэр солисны дараа 2D план дээр хаалга, цонхтой давхцаагүйг шалгаарай.",
      target: "kitchen-layout",
      illustration: "place",
    },
    {
      title: "2D, 3D харах",
      description:
        "Доод талын «2D», «3D дээрээс», «Дотоод», «Ханын зураг» товчоор харна.",
      detail:
        "«Ханын зураг» нь шүүгээний өндөр, эгнээг шалгахад тусална.",
      target: "kitchen-view",
      illustration: "view",
    },
    {
      title: "Өнгө, загвар солих",
      description:
        "Шүүгээгээ дарж сонгоод «Материал» табаас нүүр, тавцангийн өнгийг солино.",
      detail:
        "Сонголт нь тухайн шүүгээнд байгаа хувилбаруудаас хамаарна.",
      target: "kitchen-stage",
      illustration: "material",
    },
    {
      title: "Үнээ шалгах",
      description:
        "«Дараах» дарж «Урьдчилсан үнэ» алхамд бүрдэл, үнээ шалгана.",
      detail:
        "«Нэвтэрч хадгалах» дарвал загвар бүртгэлд хадгалагдаж, өрөөний төлөвлөгчид байрлуулах боломжтой болно. «?» товч энэ зааврыг дахин нээнэ.",
      target: "kitchen-finish",
      illustration: "save",
    },
  ],
};

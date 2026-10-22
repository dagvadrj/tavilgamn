/** Field names live here so route and lazy-component fallbacks cannot drift apart. */
export const loadingForms = {
  form: { title: "Мэдээлэл", fields: ["Нэр", "Тайлбар"] },
  login: {
    title: "Бүртгэлдээ нэвтрэх",
    fields: ["Имэйл хаяг", "Нууц үг"],
    social: true,
  },
  register: {
    title: "Бүртгэл үүсгэх",
    fields: ["Бүтэн нэр", "Имэйл хаяг", "Нууц үг"],
    social: true,
  },
  checkout: {
    title: "Захиалга баталгаажуулах",
    fields: [
      "Хүлээн авагчийн нэр",
      "Утас",
      { label: "Хүргэлтийн хаяг", kind: "textarea" },
      "Давхар",
      "Лифт",
      { label: "Гэрт угсруулах шаардлагатай", kind: "checkbox" },
    ],
    columns: 1,
  },
  "store-profile": {
    title: "Дэлгүүрийн мэдээлэл",
    fields: [
      "Дэлгүүрийн нэр",
      "Дэлгүүрийн төрөл",
      "Хот",
      "Дүүрэг",
      "Хаяг",
      "Утас",
      { label: "Тайлбар", kind: "textarea" },
      "Зураг",
    ],
    columns: 2,
  },
  "assistant-form": {
    title: "AI туслахын тохиргоо",
    fields: ["Туслахын нэр", "Мэндчилгээ", "Түгээмэл асуулт", "Хариулт"],
    columns: 2,
  },
  "report-form": {
    title: "Тайлан",
    fields: ["Эхлэх огноо", "Дуусах огноо"],
    columns: 2,
  },
  "contract-form": {
    title: "Merchant гэрээ",
    fields: [
      "Гэрээний нэр",
      "Платформын хуулийн этгээдийн нэр",
      { label: "Баталсан гэрээний эх", kind: "textarea" },
    ],
  },
  "kitchen-model-form": {
    title: "Гал тогооны GLB",
    fields: ["Ангилал", "Модулийн төрөл", "Өргөн", "Өндөр", "Гүн", "GLB файл"],
    columns: 2,
  },
} as const;
export type LoadingForm = keyof typeof loadingForms;

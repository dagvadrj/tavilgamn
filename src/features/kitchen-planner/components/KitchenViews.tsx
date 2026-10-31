"use client";

export type KitchenWorkspaceView = "2d" | "3d" | "interior" | "elevation";

/**
 * K5 views. Each says what it is drawn from: the plan and the wall drawing
 * are the saved data, both 3D views are the live Three.js scene.
 */
export const KITCHEN_VIEWS: {
  id: KitchenWorkspaceView;
  label: string;
  title: string;
  tag: string;
  body: string;
}[] = [
  { id: "2d", label: "2D", title: "2D төлөвлөгөө", tag: "Бодит өгөгдөл", body: "Масштабтай план, 600 мм grid, хэмжээсийн шугам." },
  { id: "3d", label: "3D дээрээс", title: "3D · дээрээс", tag: "Three.js", body: "Тааз, ойрын ханыг нээж бүх шүүгээг харуулна." },
  { id: "interior", label: "Дотоод", title: "Дотоод харагдац", tag: "Three.js", body: "Нүдний түвшнээс өрөөн дотор эргэж харна." },
  { id: "elevation", label: "Хажуугаас", title: "Ханын зураг · 2.5D", tag: "Бодит өгөгдөл", body: "4 ханын аль нэгийг хажуугаас 2.5D-ээр: модуль, нүх хэмжээтэйгээ." },
];

export function KitchenViewDock({
  current,
  onView,
}: {
  current: KitchenWorkspaceView;
  onView: (view: KitchenWorkspaceView) => void;
}) {
  return (
    <div className="kitchen-k-dock" role="group" aria-label="Харагдац">
      {KITCHEN_VIEWS.map((item) => (
        <button key={item.id} type="button" title={`${item.title} — ${item.body}`} aria-pressed={item.id === current} onClick={() => onView(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

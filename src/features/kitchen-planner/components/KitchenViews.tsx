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

const view = (id: KitchenWorkspaceView) => KITCHEN_VIEWS.find((item) => item.id === id)!;

export function KitchenViewLabel({ current }: { current: KitchenWorkspaceView }) {
  const item = view(current);
  return (
    <div className="kitchen-k-viewlabel">
      <span>{item.title}</span>
      <em data-tag={item.tag === "Three.js" ? "3d" : "data"}>{item.tag}</em>
    </div>
  );
}

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
        <button key={item.id} type="button" aria-pressed={item.id === current} onClick={() => onView(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function KitchenViewsPanel({
  current,
  onView,
  selectedName,
}: {
  current: KitchenWorkspaceView;
  onView: (view: KitchenWorkspaceView) => void;
  selectedName: string | null;
}) {
  return (
    <div className="kitchen-k-views">
      <p className="kitchen-k-muted">Нэг гал тогоо, нэг сонголт. Харагдац солиход сонгосон модуль бүх view-д ижил тодорно.</p>
      {KITCHEN_VIEWS.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === current} onClick={() => onView(item.id)}>
          <span>
            <strong>{item.title}</strong>
            <em data-tag={item.tag === "Three.js" ? "3d" : "data"}>{item.tag}</em>
          </span>
          <small>{item.body}</small>
        </button>
      ))}
      <div className="kitchen-k-selected">
        <small>Сонгосон</small>
        <strong>{selectedName ?? "Модуль сонгоогүй"}</strong>
      </div>
    </div>
  );
}

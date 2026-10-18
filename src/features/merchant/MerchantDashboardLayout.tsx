"use client";

import { useId, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, LayoutGrid, RotateCcw } from "lucide-react";
import { moveVisibleCards, type KpiId, type WidgetId } from "./dashboardLayout";
import { useMerchantDashboardLayout } from "./useMerchantDashboardLayout";
import "./merchant-dashboard-layout.css";

const LABELS: Record<KpiId | WidgetId, string> = {
  revenue: "Цэвэр орлого",
  orders: "Төлөгдсөн захиалга",
  "inventory-val": "Нөөцийн үнэлгээ",
  "stock-alert": "Нөөцийн анхааруулга",
  "inventory-control": "Бүтээгдэхүүн ба нөөцийн хяналт",
  "category-chart": "Ангиллын бүтэц",
  "order-progress": "Захиалгын явц",
};
type CardId = KpiId | WidgetId;

function SortableCard({
  id,
  editing,
  children,
}: {
  id: CardId;
  editing: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });
  return (
    <div
      ref={setNodeRef}
      data-card-id={id}
      className={`merchant-sortable-card merchant-card-${id}${editing ? " is-editing" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {editing && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="merchant-drag-handle"
          aria-label={`${LABELS[id]}: чирж байршил солих`}
          title="Чирэх, эсвэл Space дараад сумтай товчоор зөөх"
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      )}
      {children}
    </div>
  );
}

function SortableRegion<T extends CardId>({
  ids,
  cards,
  editing,
  className,
  label,
  onMove,
}: {
  ids: T[];
  cards: Partial<Record<T, ReactNode>>;
  editing: boolean;
  className: string;
  label: string;
  onMove: (active: string, over: string) => void;
}) {
  const contextId = useId();
  const [active, setActive] = useState<T | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function end(event: DragEndEvent) {
    setActive(null);
    if (editing && event.over)
      onMove(String(event.active.id), String(event.over.id));
  }
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActive(event.active.id as T)}
      onDragEnd={end}
      onDragCancel={() => setActive(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Space эсвэл Enter дарж картыг барина. Сумтай товчоор зөөж, дахин Space эсвэл Enter дарж байрлуулна. Escape дарж цуцална.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `${LABELS[active.id as CardId]} картыг зөөж байна.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${LABELS[active.id as CardId]}: ${ids.indexOf(over.id as T) + 1} / ${ids.length} байрлал.`
              : "Энэ бүс дотор байрлуулна уу.",
          onDragEnd: ({ active, over }) =>
            over
              ? `${LABELS[active.id as CardId]} картыг байрлууллаа.`
              : "Байршлыг өөрчлөөгүй.",
          onDragCancel: () => "Зөөх үйлдлийг цуцаллаа.",
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className} role="group" aria-label={label}>
          {ids.map((id) => (
            <SortableCard key={id} id={id} editing={editing}>
              {cards[id]}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
      <DragOverlay adjustScale={false} dropAnimation={null} zIndex={80}>
        {active && cards[active] ? (
          <div className="merchant-sortable-overlay" aria-hidden="true" inert>
            {cards[active]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function MerchantDashboardLayout({
  owner,
  storeId,
  kpis,
  widgets,
  editing,
  onEditingChange,
}: {
  owner: string;
  storeId: string;
  kpis: Partial<Record<KpiId, ReactNode>>;
  widgets: Partial<Record<WidgetId, ReactNode>>;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const { layout, ready, status, save, reset } = useMerchantDashboardLayout(
    owner,
    storeId,
  );
  const kpiIds = layout.kpis.filter((id) => kpis[id]);
  const widgetIds = layout.widgets.filter((id) => widgets[id]);
  const enabled = editing && ready;
  return (
    <>
      <div className="merchant-layout-toolbar">
        <p id="merchant-layout-help">
          {editing
            ? "Бариулаас чирж байрлалыг солино. KPI болон том виджетүүд тусдаа эрэмбэлэгдэнэ."
            : "Самбарын картуудыг өөрт тохирох дарааллаар байрлуулаарай."}
        </p>
        <div>
          {editing && (
            <button
              type="button"
              className="btn-ghost"
              disabled={!ready}
              onClick={reset}
            >
              <RotateCcw size={15} /> Анхны байршил
            </button>
          )}
          <button
            type="button"
            className={editing ? "btn-primary" : "btn-ghost"}
            disabled={!ready}
            aria-pressed={editing}
            aria-describedby="merchant-layout-help"
            onClick={() => onEditingChange(!editing)}
          >
            {editing ? <Check size={15} /> : <LayoutGrid size={15} />}
            {editing ? "Дуусгах" : "Байршил засах"}
          </button>
        </div>
      </div>
      <p
        className={`merchant-layout-status${status === "error" ? " is-error" : ""}`}
        role={status === "error" ? "alert" : "status"}
      >
        {status === "error" ? (
          <>
            Байрлалыг хадгалж чадсангүй. Өөрчлөлт зөвхөн энэ нээлттэй хуудсанд
            үлдэнэ.{" "}
            <button type="button" onClick={() => save(layout)}>
              Дахин хадгалах
            </button>
          </>
        ) : status === "saved" ? (
          "Байрлал энэ browser дээр таны бүртгэлээр хадгалагдлаа."
        ) : (
          "Байрлал энэ төхөөрөмжийн browser дээр хадгалагдана."
        )}
      </p>
      <SortableRegion
        key={`kpis-${enabled}-${[...kpiIds].sort().join()}`}
        ids={kpiIds}
        cards={kpis}
        editing={enabled}
        className={`reference-kpis${kpiIds.length <= 2 ? " reference-kpis-two" : ""}`}
        label="Үндсэн үзүүлэлтийн картууд"
        onMove={(active, over) => {
          const next = moveVisibleCards(layout.kpis, kpiIds, active, over);
          if (next !== layout.kpis) save({ ...layout, kpis: next });
        }}
      />
      <SortableRegion
        key={`widgets-${enabled}-${[...widgetIds].sort().join()}`}
        ids={widgetIds}
        cards={widgets}
        editing={enabled}
        className="merchant-dashboard-widgets"
        label="Самбарын виджетүүд"
        onMove={(active, over) => {
          const next = moveVisibleCards(
            layout.widgets,
            widgetIds,
            active,
            over,
          );
          if (next !== layout.widgets) save({ ...layout, widgets: next });
        }}
      />
    </>
  );
}

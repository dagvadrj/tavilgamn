"use client";
import { useId, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Hammer,
  MapPinCheck,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Users,
} from "lucide-react";
import {
  DELIVERY_NEXT,
  DELIVERY_STAGES,
  DELIVERY_STAGE_LABEL,
  canMoveDelivery,
  deliveryBlockReason,
  type DeliveryColumn,
  type DeliveryStage,
  type DeliveryStaff,
  type MerchantDeliveryOrder,
} from "@/lib/merchantDelivery";
import { formatPrice } from "@/lib/format";
import { DeliveryDialog, DeliveryStaffDialog } from "./DeliveryStaffDialog";
import { useMerchantDelivery } from "./useMerchantDelivery";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-delivery.css";

const ICONS = {
  incoming: Package,
  preparing: Hammer,
  prepared: PackageCheck,
  shipped: Truck,
  delivered: MapPinCheck,
  completed: CheckCircle2,
};
const STEP_HINT: Record<DeliveryStage, string> = {
  incoming: "Төлбөр төлөгдсөн захиалгыг бэлтгэж эхэлнэ.",
  preparing: "Үйлдвэрлэл, угсралт болон савлагааг дуусгана.",
  prepared: "Ачихад бэлэн тавилгыг хүргэлтэд гаргахдаа ажилтан холбоно.",
  shipped: "Хүргэлтийн ажилтан хүлээн авч замд гарсан.",
  delivered: "Хүлээн авагчид хүргэж өгсөн захиалга.",
  completed: "Хүргэлтийг дуусгаж хаасан захиалга.",
};
const ACTION: Partial<Record<DeliveryStage, string>> = {
  incoming: "Бэлтгэж эхлэх",
  preparing: "Бэлэн болсноор тэмдэглэх",
  prepared: "Ажилтан холбож хүргэлтэд гаргах",
  shipped: "Хүргэгдсэнээр тэмдэглэх",
  delivered: "Захиалга дуусгах",
};

/** Only the next stage is droppable. One arrow reaches it for keyboard users. */
export const deliveryKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context },
) => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code))
    return;
  const target = context.droppableContainers.getEnabled()[0];
  const rect = target && context.droppableRects.get(target.id);
  if (!rect || !context.collisionRect) return;
  event.preventDefault();
  return {
    x: rect.left + (rect.width - context.collisionRect.width) / 2,
    y: rect.top + (rect.height - context.collisionRect.height) / 2,
  };
};

function OrderDetails({ order }: { order: MerchantDeliveryOrder }) {
  return (
    <>
      <header>
        <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
        <time dateTime={order.createdAt}>
          {new Date(order.createdAt).toLocaleDateString("mn-MN", {
            timeZone: "Asia/Ulaanbaatar",
          })}
        </time>
      </header>
      <ul>
        {order.items.map((item) => (
          <li key={JSON.stringify([item.productId, item.color, item.material])}>
            <strong>
              {item.name} × {item.qty}
            </strong>
            <small>
              {item.colorName} · {item.materialName}
            </small>
          </li>
        ))}
      </ul>
      <div className="merchant-delivery-card-summary">
        <strong>{order.delivery.name}</strong>
        <span className="merchant-delivery-price">
          {formatPrice(order.subtotal)}
        </span>
      </div>
      <details className="merchant-delivery-customer">
        <summary>Хүргэлтийн мэдээлэл</summary>
        <a href={`tel:${order.delivery.phone.replace(/[^+\d]/g, "")}`}>
          {order.delivery.phone}
        </a>
        <p>{order.delivery.address}</p>
      </details>
      {order.driver && (
        <div className="merchant-delivery-driver">
          <Truck size={16} />
          <div>
            <strong>{order.driver.name}</strong>
            <span>{order.driver.vehicle || "Хүргэлтийн ажилтан"}</span>
            <a href={`tel:${order.driver.phone.replace(/[^+\d]/g, "")}`}>
              {order.driver.phone}
            </a>
          </div>
        </div>
      )}
      {order.stage === "completed" && order.completedAt && (
        <p className="merchant-delivery-completed">
          Дууссан:{" "}
          {new Date(order.completedAt).toLocaleString("mn-MN", {
            timeZone: "Asia/Ulaanbaatar",
          })}
        </p>
      )}
    </>
  );
}
function DeliveryCard({
  order,
  disabled,
  onNext,
}: {
  order: MerchantDeliveryOrder;
  disabled: boolean;
  onNext: () => void;
}) {
  const blocked = deliveryBlockReason(order);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: order.id, disabled: disabled || !!blocked });
  return (
    <article
      ref={setNodeRef}
      className={`merchant-delivery-card${isDragging ? " is-dragging" : ""}`}
    >
      {!blocked && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="merchant-delivery-grip"
          aria-label={`Захиалга ${order.id.slice(0, 8)}: дараагийн шат руу чирэх`}
        >
          <GripVertical size={18} />
        </button>
      )}
      <OrderDetails order={order} />
      {blocked ? (
        <p className="merchant-delivery-blocked">{blocked}</p>
      ) : (
        <button
          type="button"
          className="merchant-delivery-next"
          disabled={disabled}
          onClick={onNext}
        >
          {ACTION[order.stage]}
          <ArrowRight size={14} />
        </button>
      )}
    </article>
  );
}
function StageBox({
  stage,
  column,
  page,
  active,
  disabled,
  onPage,
  onNext,
  loading,
  error,
  onRetry,
}: {
  stage: DeliveryStage;
  column: DeliveryColumn;
  page: number;
  active: MerchantDeliveryOrder | null;
  disabled: boolean;
  onPage: (page: number) => void;
  onNext: (order: MerchantDeliveryOrder) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const allowed = !!active && canMoveDelivery(active, stage) && !disabled;
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage}`,
    disabled: !allowed,
  });
  const Icon = ICONS[stage];
  return (
    <section
      ref={setNodeRef}
      className={`merchant-delivery-stage stage-${stage}${allowed ? " can-drop" : ""}${isOver ? " is-over" : ""}`}
      aria-label={DELIVERY_STAGE_LABEL[stage]}
    >
      <header>
        <Icon size={20} />
        <div>
          <h2>
            {DELIVERY_STAGES.indexOf(stage) + 1}. {DELIVERY_STAGE_LABEL[stage]}
          </h2>
          <p>{STEP_HINT[stage]}</p>
        </div>
        <span>{column.total}</span>
      </header>
      <div
        className="merchant-delivery-cards"
        tabIndex={0}
        aria-label={`${DELIVERY_STAGE_LABEL[stage]} захиалгын жагсаалт`}
      >
        {loading && !column.orders.length && <StatSkeleton rows={4} />}
        {error && (
          <p role="alert" className="merchant-delivery-error">
            {error}
            <button type="button" onClick={onRetry}>
              Дахин оролдох
            </button>
          </p>
        )}
        {column.orders.map((order) => (
          <DeliveryCard
            key={order.id}
            order={order}
            disabled={disabled}
            onNext={() => onNext(order)}
          />
        ))}
        {!loading && !error && !column.orders.length && (
          <p className="merchant-delivery-empty">
            {allowed
              ? "Захиалгыг энд тавина уу"
              : page
                ? "Энэ хуудсанд захиалга алга"
                : "Энэ шатанд захиалга алга"}
          </p>
        )}
      </div>
      {(page > 0 || column.hasMore) && (
        <nav aria-label={`${DELIVERY_STAGE_LABEL[stage]}: хуудаслалт`}>
          <button
            type="button"
            disabled={disabled || page === 0}
            onClick={() => onPage(page - 1)}
            aria-label="Өмнөх хуудас"
          >
            <ChevronLeft size={16} />
          </button>
          <span>{page + 1}</span>
          <button
            type="button"
            disabled={disabled || !column.hasMore}
            onClick={() => onPage(page + 1)}
            aria-label="Дараах хуудас"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </section>
  );
}

function AssignDeliveryDialog({
  order,
  staff,
  busy,
  ready,
  error,
  onConfirm,
  onManage,
  onClose,
  onReload,
}: {
  order: MerchantDeliveryOrder;
  staff: DeliveryStaff[];
  busy: boolean;
  ready: boolean;
  error: string;
  onConfirm: (driverId: string) => Promise<void>;
  onManage: () => void;
  onClose: () => void;
  onReload: () => void;
}) {
  const [driverId, setDriverId] = useState("");
  const available = staff.filter((person) => person.active),
    selected = available.find((person) => person.id === driverId);
  return (
    <DeliveryDialog
      title="Хүргэлтийн ажилтан холбох"
      busy={busy}
      onClose={onClose}
    >
      <p>
        Захиалга #{order.id.slice(0, 8).toUpperCase()} · {order.delivery.name}
      </p>
      <p>{order.delivery.address}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (selected && ready) await onConfirm(selected.id);
        }}
      >
        <fieldset disabled={busy || !ready}>
          <label>
            Хүргэлтийн ажилтан
            <select
              className="input"
              required
              value={selected ? driverId : ""}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">Ажилтан сонгох</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.phone}
                  {person.vehicle ? ` · ${person.vehicle}` : ""}
                </option>
              ))}
            </select>
          </label>
          {!available.length && (
            <p>Идэвхтэй хүргэлтийн ажилтан алга. Эхлээд ажилтнаа нэмнэ үү.</p>
          )}
          {selected && (
            <div className="merchant-delivery-driver">
              <Truck size={18} />
              <div>
                <strong>{selected.name}</strong>
                <span>
                  {selected.phone} · {selected.vehicle || "Машин бүртгээгүй"}
                </span>
              </div>
            </div>
          )}
          <button type="button" className="btn-ghost" onClick={onManage}>
            <Plus size={16} />
            Ажилтан нэмэх / засах
          </button>
          <p>Баталгаажуулсны дараа захиалга “Хүргэлтэд гарсан” шатанд орно.</p>
          <div className="merchant-delivery-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Цуцлах
            </button>
            <button type="submit" className="btn-primary" disabled={!selected}>
              <Truck size={16} />
              {busy ? "Хадгалж байна…" : "Хүргэлтэд гаргах"}
            </button>
          </div>
        </fieldset>
      </form>
      {!ready && !busy && !error && (
        <p role="status">Хүргэлтийн мэдээллийг шинэчилж байна…</p>
      )}
      {error && (
        <p className="merchant-delivery-error" role="alert">
          {error}
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onReload}
          >
            Дахин шалгах
          </button>
        </p>
      )}
    </DeliveryDialog>
  );
}

export function MerchantDeliveryBoard({ owner, staffRole }: { owner: string; staffRole?: "driver" | "warehouse" }) {
  const board = useMerchantDelivery(owner, staffRole),
    contextId = useId();
  const [active, setActive] = useState<MerchantDeliveryOrder | null>(null);
  const [pending, setPending] = useState<MerchantDeliveryOrder | null>(null);
  const [showStaff, setShowStaff] = useState(false);
  const [hint, setHint] = useState("");
  const [query, setQuery] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: deliveryKeyboardCoordinates,
    }),
  );
  const disabled = board.busy || !board.ready;
  const visibleStages: readonly DeliveryStage[] = staffRole === "driver" ? ["shipped", "delivered", "completed"] : staffRole === "warehouse" ? ["incoming", "preparing", "prepared"] : DELIVERY_STAGES;
  const orders = DELIVERY_STAGES.flatMap(
    (stage) => board.columns[stage].orders,
  );
  const currentPending = pending
    ? orders.find((order) => order.id === pending.id)
    : undefined;
  async function requestMove(
    order: MerchantDeliveryOrder,
    target: DeliveryStage,
  ) {
    if (disabled || !canMoveDelivery(order, target)) {
      setHint("Захиалгыг зөвхөн дараагийн шат руу шилжүүлнэ.");
      return;
    }
    setHint("");
    if (target === "shipped") setPending(order);
    else await board.move(order, target);
  }
  const box = (stage: DeliveryStage) => (
    <StageBox
      key={stage}
      stage={stage}
      column={{
        ...board.columns[stage],
        orders: board.columns[stage].orders.filter((order) =>
          `${order.id} ${order.delivery.name} ${order.delivery.phone} ${order.items.map((item) => item.name).join(" ")}`
            .toLocaleLowerCase("mn-MN")
            .includes(query.trim().toLocaleLowerCase("mn-MN")),
        ),
      }}
      page={board.pages[stage]}
      active={active}
      disabled={disabled}
      onPage={(page) => board.setPage(stage, page)}
      loading={board.stageLoading?.[stage] ?? (!board.ready && board.loading)}
      error={board.stageErrors?.[stage]}
      onRetry={board.reload}
      onNext={(order) => {
        const next = DELIVERY_NEXT[order.stage];
        if (next) void requestMove(order, next);
      }}
    />
  );
  return (
    <section className="merchant-delivery-board">
      <div className="reference-heading">
        <div>
          <span className="reference-eyebrow">ЗАХИАЛГА БА ХҮРГЭЛТ</span>
          <h1>Хүргэлтийн самбар</h1>
          <p>
            Захиалга бүрийг хүлээн авахаас дуусгах хүртэл нэг самбараас
            удирдаарай.
          </p>
        </div>
        <div className="merchant-delivery-actions">
          {!staffRole && <button
            type="button"
            className="btn-ghost"
            disabled={disabled}
            onClick={() => setShowStaff(true)}
          >
            <Users size={16} />
            Хүргэлтийн ажилтнууд
          </button>}
          <button
            type="button"
            className="btn-ghost"
            disabled={board.busy || board.loading}
            onClick={board.reload}
          >
            <RefreshCw size={16} />
            Шинэчлэх
          </button>
        </div>
      </div>
      <div className="merchant-pipeline-toolbar">
        <label className="merchant-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            disabled={!!active}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Ачаалсан захиалгуудаас хайх"
            placeholder="Нэр, утас, захиалгын дугаар…"
          />
        </label>
        <div className="merchant-pipeline-totals">
          <span>
            Нийт{" "}
            <strong>
              {DELIVERY_STAGES.reduce(
                (sum, stage) => sum + board.columns[stage].total,
                0,
              )}
            </strong>
          </span>
          <span>
            <Truck size={15} /> Замд{" "}
            <strong>{board.columns.shipped.total}</strong>
          </span>
          <span>
            <CheckCircle2 size={15} /> Дууссан{" "}
            <strong>{board.columns.completed.total}</strong>
          </span>
        </div>
      </div>
      {query.trim() && (
        <p className="merchant-delivery-feedback" role="status">
          Багана бүрийн ачаалсан хуудсанд хайж байна. Баганын тоо нь бүх
          захиалгын тоо.
        </p>
      )}
      {board.loading && (
        <p role="status">
          {board.busy
            ? "Төлөвийг хадгалж байна…"
            : "Хүргэлтийн мэдээллийг шалгаж байна…"}
        </p>
      )}
      {(board.error || board.mutationError) && (
        <div className="merchant-delivery-error" role="alert">
          {board.error || board.mutationError}
          <button
            type="button"
            className="btn-ghost"
            disabled={board.busy || board.loading}
            onClick={board.reload}
          >
            Дахин шалгах
          </button>
        </div>
      )}
      <p role="status" className="merchant-delivery-feedback">
        {hint ||
          board.message ||
          "Зөвхөн дараагийн шатанд шилжинэ. Escape дарж чирэлтийг цуцална."}
      </p>
      <DndContext
        id={contextId}
        sensors={sensors}
        autoScroll={{ threshold: { x: 0.08, y: 0.12 }, acceleration: 5 }}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        collisionDetection={(args) =>
          args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)
        }
        onDragStart={(event) => {
          const order = orders.find((order) => order.id === event.active.id);
          if (order && !disabled && !deliveryBlockReason(order))
            setActive(order);
        }}
        onDragCancel={() => setActive(null)}
        onDragEnd={(event) => {
          setActive(null);
          const order = orders.find((item) => item.id === event.active.id),
            target = String(event.over?.id ?? "").replace(/^stage:/, "");
          if (order && DELIVERY_STAGES.includes(target as DeliveryStage))
            void requestMove(order, target as DeliveryStage);
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Space эсвэл Enter дарж захиалгыг барина. Сумтай товчоор дараагийн шатанд очно. Space эсвэл Enter дарж байрлуулна. Escape дарж цуцална.",
          },
          announcements: {
            onDragStart: () => "Захиалгыг дараагийн шатанд зөөж байна.",
            onDragOver: ({ over }) =>
              over
                ? "Дараагийн шатанд тавих боломжтой."
                : "Дараагийн шатны хайрцаг дээр очно уу.",
            onDragEnd: () => "Шилжүүлэх хүсэлтийг шалгаж байна.",
            onDragCancel: () => "Чирэлтийг цуцаллаа. Төлөв өөрчлөгдөөгүй.",
          },
        }}
      >
        <div
          className="merchant-delivery-pipeline"
          role="region"
          aria-label="Хүргэлтийн төлөвийн баганууд, хажуу тийш гүйлгэнэ"
          tabIndex={0}
        >
          {visibleStages.map(box)}
        </div>
        <DragOverlay adjustScale={false} dropAnimation={null} zIndex={85}>
          {active && (
            <article
              className="merchant-delivery-card merchant-delivery-overlay"
              aria-hidden="true"
              inert
            >
              <OrderDetails order={active} />
            </article>
          )}
        </DragOverlay>
      </DndContext>
      {showStaff && (
        <DeliveryStaffDialog
          staff={board.staff}
          busy={board.busy}
          ready={board.ready}
          error={board.mutationError || board.error || ""}
          onSave={board.saveStaff}
          onReload={board.reload}
          onClose={() => setShowStaff(false)}
        />
      )}
      {pending && !showStaff && (
        <AssignDeliveryDialog
          order={currentPending ?? pending}
          staff={board.staff}
          busy={board.busy}
          ready={
            board.ready &&
            !!currentPending &&
            currentPending.stage === "prepared"
          }
          error={
            board.mutationError ||
            board.error ||
            (currentPending?.stage !== "prepared" && !board.loading
              ? "Захиалгын төлөв өөрчлөгдсөн байна. Цонхыг хааж жагсаалтаа шалгана уу."
              : "")
          }
          onClose={() => setPending(null)}
          onManage={() => setShowStaff(true)}
          onReload={board.reload}
          onConfirm={async (driverId) => {
            if (
              currentPending &&
              (await board.move(currentPending, "shipped", driverId))
            )
              setPending(null);
          }}
        />
      )}
    </section>
  );
}

"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Plus,
  RefreshCw,
  MapPin,
  Users,
  MessageSquare,
  Bot,
  PackageSearch,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import {
  answerFaq,
  STAFF_LABEL,
  type Faq,
  type StaffRole,
} from "@/lib/merchantOperations";
import type { DeliveryStaff } from "@/lib/merchantDelivery";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-operations.css";
import {
  useMerchantResource,
  invalidateMerchantResources,
} from "./useMerchantResource";

export async function operationsRequest<T>(
  owner: string,
  action: string,
  data?: unknown,
  query = "",
  signal?: AbortSignal,
): Promise<T> {
  const response = await authFetch(
    `/api/merchant/operations${data === undefined ? `?action=${action}${query}` : ""}`,
    data === undefined
      ? { signal }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, data }),
          signal,
        },
    owner,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Мэдээлэл ачаалсангүй.");
  if (useAuth.getState().user?.id !== owner)
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна.");
  return result;
}
// Staff use the same server-authorized operations API; merchant-only reads keep their guard.
const operationsTransport = {
  isAuthorized: (owner: string) => useAuth.getState().user?.id === owner,
  request: async (path: string, owner: string, init: RequestInit) => {
    const response = await authFetch(path, init, owner);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Мэдээлэл ачаалсангүй.");
    return data;
  },
};
export function useOperations<T>(owner: string, action: string, query = "") {
  const resource = useMerchantResource<T>(
    owner,
    `/api/merchant/operations?action=${action}${query}`,
    true,
    0,
    operationsTransport,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState<string>();
  const pending = useRef(false);
  const reload = resource.refresh;
  async function save(action: string, data: unknown) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setMessage("");
    setSaveError(undefined);
    try {
      await operationsRequest(owner, action, data);
      if (useAuth.getState().user?.id !== owner) return false;
      setMessage("Хадгаллаа.");
      invalidateMerchantResources(owner);
      return true;
    } catch (e) {
      if (useAuth.getState().user?.id === owner)
        setSaveError(e instanceof Error ? e.message : "Хадгалсангүй.");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    data: resource.data ?? undefined,
    error: saveError ?? resource.error ?? undefined,
    busy,
    message,
    save,
    reload,
  };
}
function Frame({
  title,
  description,
  icon,
  resource,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  resource: {
    error?: string;
    message: string;
    busy: boolean;
    reload: () => void;
  };
  children: ReactNode;
}) {
  return (
    <section className="merchant-ops">
      <header className="reference-heading">
        <div>
          <span className="ops-eyebrow">{icon} ДЭЛГҮҮРИЙН УДИРДЛАГА</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={resource.busy}
          onClick={resource.reload}
        >
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </header>
      {resource.error && (
        <p className="merchant-error" role="alert">
          {resource.error}
        </p>
      )}
      {resource.message && (
        <p role="status" className="ops-success">
          {resource.message}
        </p>
      )}
      {children}
    </section>
  );
}
function Pager({
  page,
  more,
  onPage,
}: {
  page: number;
  more: boolean;
  onPage: (v: number) => void;
}) {
  return (
    <nav className="ops-pager" aria-label="Жагсаалтын хуудас">
      <button
        className="btn-ghost"
        disabled={!page}
        onClick={() => onPage(page - 1)}
      >
        Өмнөх
      </button>
      <span>{page + 1}</span>
      <button
        className="btn-ghost"
        disabled={!more}
        onClick={() => onPage(page + 1)}
      >
        Дараах
      </button>
    </nav>
  );
}
type Branch = {
  id: string;
  name: string;
  kind: "showroom" | "warehouse";
  address: string;
  active: boolean;
  version: number;
};
type StockProduct = {
  id: string;
  name: string;
  total: number | null;
  assigned: number;
  stock: Record<string, number>;
};
const blankBranch = {
  name: "",
  kind: "showroom" as const,
  address: "",
  active: true,
};
export function MerchantBranches({
  owner,
  staff = false,
}: {
  owner: string;
  staff?: boolean;
}) {
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const r = useOperations<{ branches: Branch[]; products: StockProduct[] }>(
    owner,
    "branches",
    `&page=${page}&search=${encodeURIComponent(term)}`,
  );
  const [editing, setEditing] = useState<Branch | typeof blankBranch | null>(
    null,
  );
  return (
    <Frame
      title="Салбар, агуулах"
      description="Нийт борлуулах нөөцөө салбаруудад хуваарилна. Нийт үлдэгдлийг бүтээгдэхүүний хэсгээс засна."
      icon={<MapPin size={16} />}
      resource={r}
    >
      <div className="ops-branch-list">
        {r.data?.branches.map((b) => (
          <article className="ops-card" key={b.id}>
            <span>
              {b.kind === "warehouse" ? "АГУУЛАХ" : "ШОУРУМ"} ·{" "}
              {b.active ? "Идэвхтэй" : "Идэвхгүй"}
            </span>
            <h2>{b.name}</h2>
            <p>{b.address || "Хаяг нэмээгүй"}</p>
            {!staff && (
              <button className="btn-ghost" onClick={() => setEditing(b)}>
                Засах
              </button>
            )}
          </article>
        ))}
        {!staff && (
          <button
            className="ops-add-card"
            onClick={() => setEditing({ ...blankBranch })}
          >
            <Plus size={20} />
            Салбар нэмэх
          </button>
        )}
      </div>
      {editing && (
        <form
          className="ops-card ops-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await r.save("branch", editing)) setEditing(null);
          }}
        >
          <h2>{"id" in editing ? "Салбар засах" : "Шинэ салбар"}</h2>
          <fieldset disabled={r.busy}>
            <label>
              Салбарын нэр
              <input
                className="input"
                required
                minLength={2}
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Төрөл
              <select
                className="input"
                value={editing.kind}
                onChange={(e) =>
                  setEditing({ ...editing, kind: e.target.value as "showroom" })
                }
              >
                <option value="showroom">Шоурум / Салбар</option>
                <option value="warehouse">Агуулах</option>
              </select>
            </label>
            <label>
              Хаяг
              <textarea
                className="input"
                maxLength={500}
                value={editing.address}
                onChange={(e) =>
                  setEditing({ ...editing, address: e.target.value })
                }
              />
            </label>
            {"id" in editing && (
              <label className="ops-check">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
                Идэвхтэй (нөөцтэй салбарыг эхлээд чөлөөлнө)
              </label>
            )}
            <div className="ops-actions">
              <button className="btn-primary">Хадгалах</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing(null)}
              >
                Болих
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="ops-card">
        <h2>Салбар тус бүрийн бэлэн нөөц</h2>
        <p>
          Хуваарилаагүй нөөц эхэлж захиалагдана. Хүрэлцэхгүй бол хамгийн өмнөх
          хуваарилалтаас хасагдана. Цуцлагдсан захиалгын нөөц хуваарилаагүй
          хэсэгт буцна.
        </p>
        <form
          className="ops-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setTerm(search);
          }}
        >
          <label>
            Бараа хайх
            <input
              className="input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
            />
          </label>
          <button className="btn-ghost">Хайх</button>
        </form>
        {!r.data && !r.error ? (
          <StatSkeleton />
        ) : !r.data?.products.length ? (
          <p>Бараа олдсонгүй.</p>
        ) : (
          <div className="ops-stock-list">
            {r.data.products.slice(0, 50).map((p) => (
              <StockRow
                key={`${p.id}:${JSON.stringify(p.stock)}:${p.total}`}
                product={p}
                branches={r.data!.branches.filter((b) => b.active)}
                busy={r.busy}
                save={r.save}
              />
            ))}
          </div>
        )}
        <Pager
          page={page}
          more={(r.data?.products.length ?? 0) > 50}
          onPage={setPage}
        />
      </div>
    </Frame>
  );
}
function StockRow({
  product: p,
  branches,
  busy,
  save,
}: {
  product: StockProduct;
  branches: Branch[];
  busy: boolean;
  save: (a: string, d: unknown) => Promise<boolean>;
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? ""),
    [quantity, setQuantity] = useState(String(p.stock[branches[0]?.id] ?? 0));
  return (
    <article className="ops-stock-row">
      <div>
        <h3>{p.name}</h3>
        <p>
          Нийт {p.total ?? "тоолоогүй"} · Хуваарилаагүй{" "}
          {Math.max(0, (p.total ?? 0) - Number(p.assigned))}
        </p>
        <div className="ops-stock-tags">
          {branches.map((b) => (
            <span key={b.id}>
              {b.name}: <b>{p.stock[b.id] ?? 0} ш</b>
            </span>
          ))}
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await save("allocate", {
            branchId: branch,
            productId: p.id,
            quantity: Number(quantity),
            expectedQuantity: p.stock[branch] ?? 0,
            expectedTotal: p.total,
          });
        }}
      >
        <fieldset disabled={busy || p.total === null || !branches.length}>
          <label>
            Салбар
            <select
              className="input"
              value={branch}
              required
              onChange={(e) => {
                setBranch(e.target.value);
                setQuantity(String(p.stock[e.target.value] ?? 0));
              }}
            >
              <option value="" disabled>
                Сонгох
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Бэлэн тоо
            <input
              className="input"
              type="number"
              inputMode="numeric"
              required
              min={0}
              max={p.total ?? 0}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button className="btn-ghost">Хуваарилах</button>
        </fieldset>
      </form>
    </article>
  );
}
type Member = {
  user_id?: string | null;
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  driver_id: string | null;
  active: boolean;
  version: number;
};
type MemberForm = {
  id?: string;
  name: string;
  email: string;
  role: StaffRole;
  driverId: string;
  active: boolean;
  version?: number;
};
const blankMember: MemberForm = {
  name: "",
  email: "",
  role: "sales",
  driverId: "",
  active: true,
};
export function MerchantStaff({ owner }: { owner: string }) {
  const r = useOperations<{ members: Member[]; drivers: DeliveryStaff[] }>(
    owner,
    "staff",
  );
  const [form, setForm] = useState<MemberForm | null>(null);
  return (
    <Frame
      title="Ажилтны эрх"
      description="Ажилтан өөрийн бүртгэлтэй имэйлээр нэвтэрч /merchant хэсэгт ажиллана. Эрхийг идэвхгүй болгоход дараагийн хүсэлтээс хаагдана."
      icon={<Users size={16} />}
      resource={r}
    >
      <div className="ops-permissions">
        {Object.entries(STAFF_LABEL).map(([role, label]) => (
          <article className="ops-card" key={role}>
            <h2>{label}</h2>
            <p>
              {role === "driver"
                ? "Зөвхөн өөрт хуваарилсан хүргэлт. Хүргэгдсэнийг батална."
                : role === "warehouse"
                  ? "Салбарын нөөц хуваарилах, захиалга бэлтгэх, бэлэн болгох."
                  : "Захиалга харах, сэтгэгдэлд хариулах, буцаалт/гомдол шийдэх."}
            </p>
          </article>
        ))}
      </div>
      <button
        className="btn-primary"
        onClick={() => setForm({ ...blankMember })}
      >
        <Plus size={16} />
        Ажилтан нэмэх
      </button>
      {form && (
        <form
          className="ops-card ops-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await r.save("member", form)) setForm(null);
          }}
        >
          <h2>{form.id ? "Эрх засах" : "Бүртгэлтэй хэрэглэгч холбох"}</h2>
          <fieldset disabled={r.busy}>
            <label>
              Нэр
              <input
                className="input"
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Бүртгэлтэй имэйл
              <input
                className="input"
                type="email"
                autoComplete="off"
                required
                disabled={!!form.id}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={254}
              />
            </label>
            <label>
              Үүрэг
              <select
                className="input"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as StaffRole })
                }
              >
                {Object.entries(STAFF_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.role === "driver" && (
              <label>
                Хүргэлтийн ажилтны бүртгэл
                <select
                  className="input"
                  required
                  value={form.driverId}
                  onChange={(e) =>
                    setForm({ ...form, driverId: e.target.value })
                  }
                >
                  <option value="">Сонгох</option>
                  {r.data?.drivers
                    .filter((d) => d.active)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.phone}
                      </option>
                    ))}
                </select>
                <small>
                  Хүргэлтийн самбар → Хүргэлтийн ажилтнууд хэсэгт эхлээд
                  бүртгэнэ.
                </small>
              </label>
            )}
            <label className="ops-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Нэвтрэх эрх идэвхтэй
            </label>
            <div className="ops-actions">
              <button className="btn-primary">Хадгалах</button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setForm(null)}
              >
                Болих
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!r.data && !r.error ? (
        <StatSkeleton />
      ) : (
        <div className="ops-card-list">
          {r.data?.members.map((m) => (
            <article className="ops-card" key={m.id}>
              <span>
                {m.active
                  ? m.user_id
                    ? "Идэвхтэй"
                    : "Анхны нэвтрэлт хүлээж байна"
                  : "Эрх хаасан"}
              </span>
              <h2>{m.name}</h2>
              <p>{m.email}</p>
              <p>{STAFF_LABEL[m.role]}</p>
              <button
                className="btn-ghost"
                onClick={() => setForm({ ...m, driverId: m.driver_id ?? "" })}
              >
                Эрх засах
              </button>
            </article>
          ))}
          {r.data?.members.length === 0 && <p>Ажилтан бүртгээгүй байна.</p>}
        </div>
      )}
    </Frame>
  );
}
type Feedback = {
  id: string;
  order_id: string;
  product_id?: string;
  customer?: string;
  rating?: number;
  body?: string;
  reason?: string;
  kind?: string;
  photos: string[];
  status: string;
  reply: string;
  version: number;
  created_at: string;
};
export const FEEDBACK_LABEL: Record<string, string> = {
  pending: "Батлах хүлээгдэж буй",
  approved: "Нийтэлсэн",
  rejected: "Татгалзсан",
  requested: "Шинэ хүсэлт",
  reviewing: "Шалгаж байгаа",
  returned: "Буцаагдсан",
  resolved: "Шийдвэрлэсэн",
};
export function MerchantFeedback({
  owner,
  cases = false,
}: {
  owner: string;
  cases?: boolean;
}) {
  const [page, setPage] = useState(0),
    [status, setStatus] = useState("pending");
  const r = useOperations<{ rows: Feedback[] }>(
    owner,
    cases ? "cases" : "reviews",
    `&page=${page}${cases ? "" : `&status=${status}`}`,
  );
  return (
    <Frame
      title={cases ? "Буцаалт, гомдол" : "Зурагтай сэтгэгдэл"}
      description={
        cases
          ? "Хүргэлтийн гэмтэл, буцаах хүсэлтийг бүртгэж шийдвэрлэнэ. Бараа буцаасан төлөв мөнгө буцаахгүй; санхүүгийн буцаалтыг тусад нь баталгаажуулна."
          : "Хүргэгдсэн барааны бодит худалдан авагчдын сэтгэгдлийг баталж, хариу бичнэ."
      }
      icon={<MessageSquare size={16} />}
      resource={r}
    >
      {!cases && (
        <label className="ops-filter">
          Төлөв
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Бүгд</option>
            {["pending", "approved", "rejected"].map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {!r.data && !r.error ? (
        <StatSkeleton />
      ) : (
        <div className="ops-card-list">
          {r.data?.rows.slice(0, 20).map((row) => (
            <FeedbackCard
              key={`${row.id}:${row.version}`}
              row={row}
              cases={cases}
              busy={r.busy}
              save={r.save}
            />
          ))}
          {r.data?.rows.length === 0 && (
            <div className="ops-empty">
              <PackageSearch size={28} />
              <h2>Одоогоор бүртгэл алга</h2>
              <p>
                {cases
                  ? "Хэрэглэгч захиалгын дэлгэрэнгүйгээс хүсэлт илгээнэ."
                  : "Хэрэглэгч хүргэгдсэн захиалгаасаа сэтгэгдэл үлдээнэ."}
              </p>
            </div>
          )}
        </div>
      )}
      <Pager
        page={page}
        more={(r.data?.rows.length ?? 0) > 20}
        onPage={setPage}
      />
    </Frame>
  );
}
function FeedbackCard({
  row,
  cases,
  busy,
  save,
}: {
  row: Feedback;
  cases: boolean;
  busy: boolean;
  save: (a: string, d: unknown) => Promise<boolean>;
}) {
  const [reply, setReply] = useState(row.reply),
    [status, setStatus] = useState(
      cases && row.status === "requested" ? "reviewing" : row.status,
    );
  const closed = cases && !["requested", "reviewing"].includes(row.status);
  return (
    <article className="ops-card">
      <span>
        {FEEDBACK_LABEL[row.status]} ·{" "}
        {new Date(row.created_at).toLocaleDateString("mn-MN")}
      </span>
      <h2>
        {cases
          ? row.kind === "return"
            ? "Буцаах хүсэлт"
            : "Гомдол / Гэмтэл"
          : `${row.rating} / 5 · ${row.customer || "Худалдан авагч"}`}
      </h2>
      <p className="ops-body">{row.body ?? row.reason}</p>
      <small>
        Захиалга #{row.order_id.slice(0, 8)}{" "}
        {row.product_id && `· ${row.product_id}`}
      </small>
      <div className="ops-photos">
        {row.photos.map((url, i) => (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            key={url}
            aria-label={`Зураг ${i + 1} томруулах`}
          >
            <Image
              src={url}
              alt={`Хэрэглэгчийн зураг ${i + 1}`}
              width={128}
              height={128}
              unoptimized
            />
          </a>
        ))}
      </div>
      <form
        className="ops-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await save(cases ? "case" : "review", {
            id: row.id,
            version: row.version,
            status,
            reply,
          });
        }}
      >
        <fieldset disabled={busy || closed}>
          <label>
            Хариу
            <textarea
              className="input"
              required={cases}
              minLength={cases ? 5 : undefined}
              maxLength={2000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <label>
            Төлөв
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {(closed
                ? [row.status]
                : cases
                  ? [
                      "reviewing",
                      ...(row.kind === "return" ? ["returned"] : []),
                      "resolved",
                      "rejected",
                    ]
                  : ["pending", "approved", "rejected"]
              ).map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary">Хадгалах</button>
        </fieldset>
      </form>
    </article>
  );
}
type AssistantSettings = {
  enabled: boolean;
  greeting: string;
  fallback: string;
  faqs: Faq[];
  version: number;
};
export function MerchantAssistant({ owner }: { owner: string }) {
  const r = useOperations<AssistantSettings>(owner, "assistant");
  return (
    <Frame
      title="AI туслах / FAQ"
      description="Одоогийн хувилбар таны баталсан FAQ-аас хариулна. AI үйлчилгээ холбосны дараа өргөжүүлнэ."
      icon={<Bot size={16} />}
      resource={r}
    >
      {r.data ? (
        <AssistantForm
          key={r.data.version}
          initial={r.data}
          busy={r.busy}
          save={r.save}
        />
      ) : (
        !r.error && <StatSkeleton />
      )}
    </Frame>
  );
}
function AssistantForm({
  initial,
  busy,
  save,
}: {
  initial: AssistantSettings;
  busy: boolean;
  save: (a: string, d: unknown) => Promise<boolean>;
}) {
  const [form, setForm] = useState(initial),
    [preview, setPreview] = useState("");
  return (
    <form
      className="ops-card ops-form ops-assistant-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await save("save_assistant", form);
      }}
    >
      <fieldset disabled={busy}>
        <label className="ops-check">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Дэлгүүрийн хуудсанд туслах харуулах
        </label>
        <label>
          Мэндчилгээ
          <input
            className="input"
            required
            maxLength={500}
            value={form.greeting}
            onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          />
        </label>
        <label>
          Тохирох хариултгүй үед
          <textarea
            className="input"
            required
            minLength={5}
            maxLength={500}
            value={form.fallback}
            onChange={(e) => setForm({ ...form, fallback: e.target.value })}
          />
        </label>
        <h2>Түгээмэл асуулт ({form.faqs.length} / 30)</h2>
        {form.faqs.map((faq, i) => (
          <div className="ops-faq" key={i}>
            <label>
              Асуулт {i + 1}
              <input
                className="input"
                required
                minLength={3}
                maxLength={300}
                value={faq.question}
                onChange={(e) =>
                  setForm({
                    ...form,
                    faqs: form.faqs.map((f, index) =>
                      index === i ? { ...f, question: e.target.value } : f,
                    ),
                  })
                }
              />
            </label>
            <label>
              Баталсан хариулт
              <textarea
                className="input"
                required
                minLength={3}
                maxLength={2000}
                value={faq.answer}
                onChange={(e) =>
                  setForm({
                    ...form,
                    faqs: form.faqs.map((f, index) =>
                      index === i ? { ...f, answer: e.target.value } : f,
                    ),
                  })
                }
              />
            </label>
            <button
              className="btn-ghost"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  faqs: form.faqs.filter((_, index) => index !== i),
                })
              }
            >
              Асуулт хасах
            </button>
          </div>
        ))}
        <button
          className="btn-ghost"
          type="button"
          disabled={form.faqs.length >= 30}
          onClick={() =>
            setForm({
              ...form,
              faqs: [...form.faqs, { question: "", answer: "" }],
            })
          }
        >
          <Plus size={16} />
          Асуулт нэмэх
        </button>
        <div className="ops-faq-preview">
          <label>
            Хариулт турших
            <input
              className="input"
              value={preview}
              maxLength={500}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Энэ буйдангийн хэмжээг өөрчилж болох уу?"
            />
          </label>
          <p aria-live="polite">
            {preview
              ? answerFaq(preview, form.faqs, form.fallback)
              : form.greeting}
          </p>
        </div>
        <button className="btn-primary">Тохиргоо хадгалах</button>
      </fieldset>
    </form>
  );
}
export function MerchantRiskSummary({
  owner,
  date,
}: {
  owner: string;
  date: string;
}) {
  const r = useOperations<{
    total: number;
    cancelled: number;
    returned: number;
    complaints: number;
  }>(owner, "risk", `&date=${date}`);
  useEffect(() => {
    const timer = setInterval(r.reload, 15000);
    window.addEventListener("merchant-data-changed", r.reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("merchant-data-changed", r.reload);
    };
  }, [r.reload]);
  return (
    <section
      className="merchant-ops ops-risk"
      aria-label="Цуцлалт ба буцаалтын хяналт"
    >
      <h3>Эрсдэлийн хяналт</h3>
      <p>Сонгосон өдөр үүссэн бүх захиалгад эзлэх хувь · {date}</p>
      {r.error ? (
        <p role="alert">
          {r.error}
          <button className="btn-ghost" onClick={r.reload}>
            Дахин шалгах
          </button>
        </p>
      ) : !r.data ? (
        <StatSkeleton rows={1} />
      ) : (
        <div>
          {(
            [
              ["cancelled", "Цуцлагдсан"],
              ["returned", "Буцаагдсан"],
              ["complaints", "Буцаалт / Гомдолтой"],
            ] as const
          ).map(([key, label]) => (
            <article key={key}>
              <span>{label}</span>
              <strong>
                {r.data![key]}{" "}
                <small>
                  (
                  {Math.round(
                    (r.data![key] / Math.max(1, r.data!.total)) * 100,
                  )}
                  %)
                </small>
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

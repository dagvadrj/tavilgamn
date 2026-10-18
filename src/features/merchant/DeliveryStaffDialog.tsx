"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus, UserRound, X } from "lucide-react";
import type { DeliveryStaff } from "@/lib/merchantDelivery";

export function DeliveryDialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="merchant-delivery-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          disabled={busy}
          aria-label="Хаах"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
const empty = () => ({ name: "", phone: "", vehicle: "", active: true });
export function DeliveryStaffDialog({
  staff,
  busy,
  ready,
  error,
  onSave,
  onClose,
  onReload,
}: {
  staff: DeliveryStaff[];
  busy: boolean;
  ready: boolean;
  error: string;
  onSave: (
    fields: ReturnType<typeof empty>,
    previous?: DeliveryStaff,
  ) => Promise<boolean>;
  onClose: () => void;
  onReload: () => void;
}) {
  const [fields, setFields] = useState(empty),
    [editing, setEditing] = useState<DeliveryStaff | undefined>();
  return (
    <DeliveryDialog title="Хүргэлтийн ажилтнууд" busy={busy} onClose={onClose}>
      <p>Ажилтны холбоо барих мэдээлэл болон хүргэлтийн машиныг бүртгэнэ.</p>
      <ul className="merchant-delivery-staff-list">
        {staff.map((person) => (
          <li key={person.id}>
            <UserRound size={18} />
            <div>
              <strong>
                {person.name}
                {!person.active && " · Идэвхгүй"}
              </strong>
              <span>
                {person.phone} · {person.vehicle || "Машин бүртгээгүй"}
              </span>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setEditing(person);
                setFields({
                  name: person.name,
                  phone: person.phone,
                  vehicle: person.vehicle,
                  active: person.active,
                });
              }}
            >
              Засах
            </button>
          </li>
        ))}
      </ul>
      {!staff.length && <p>Хүргэлтийн ажилтан бүртгэгдээгүй байна.</p>}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await onSave(fields, editing)) {
            setFields(empty());
            setEditing(undefined);
          }
        }}
      >
        <h3>{editing ? "Ажилтны мэдээлэл засах" : "Ажилтан нэмэх"}</h3>
        <fieldset disabled={busy || !ready}>
          <label>
            Нэр
            <input
              className="input"
              required
              minLength={2}
              maxLength={100}
              value={fields.name}
              onChange={(event) =>
                setFields({ ...fields, name: event.target.value })
              }
            />
          </label>
          <label>
            Утас
            <input
              className="input"
              type="tel"
              required
              minLength={8}
              maxLength={24}
              value={fields.phone}
              onChange={(event) =>
                setFields({ ...fields, phone: event.target.value })
              }
            />
          </label>
          <label>
            Машин, улсын дугаар
            <input
              className="input"
              maxLength={100}
              placeholder="Машины загвар, улсын дугаар"
              value={fields.vehicle}
              onChange={(event) =>
                setFields({ ...fields, vehicle: event.target.value })
              }
            />
          </label>
          <label className="merchant-delivery-checkbox">
            <input
              type="checkbox"
              checked={fields.active}
              onChange={(event) =>
                setFields({ ...fields, active: event.target.checked })
              }
            />{" "}
            Хүргэлтэд сонгох боломжтой
          </label>
          <div className="merchant-delivery-actions">
            <button type="submit" className="btn-primary">
              <Plus size={16} />
              {busy
                ? "Хадгалж байна…"
                : editing
                  ? "Өөрчлөлт хадгалах"
                  : "Ажилтан нэмэх"}
            </button>
            {editing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditing(undefined);
                  setFields(empty());
                }}
              >
                Шинэ ажилтан
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {!ready && !busy && !error && (
        <p role="status">Ажилтны мэдээллийг шинэчилж байна…</p>
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

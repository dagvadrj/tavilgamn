"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { MerchantNotification } from "@/lib/merchantNotifications";

const notificationDate = new Intl.DateTimeFormat("mn-MN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type NotificationResponse = {
  notifications: MerchantNotification[];
  unreadCount: number;
};

export function MerchantNotifications({
  owner,
  onKitchens,
}: {
  owner: string;
  onKitchens: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<MerchantNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await authFetch(
          "/api/merchant/notifications",
          { signal },
          owner,
        );
        const result = (await response.json().catch(() => null)) as
          | NotificationResponse
          | { error?: string }
          | null;

        if (!response.ok || !result || !("notifications" in result)) {
          throw new Error(
            result && "error" in result && result.error
              ? result.error
              : "Мэдэгдлүүдийг ачаалж чадсангүй.",
          );
        }

        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setError(null);
      } catch (reason) {
        if (signal?.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Мэдэгдлүүдийг ачаалж чадсангүй.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [owner],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(
      () => void load(controller.signal),
      60_000,
    );
    const refresh = () => void load(controller.signal);
    window.addEventListener("focus", refresh);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const markRead = async (id?: string) => {
    const readAt = new Date().toISOString();
    const wasUnread = id
      ? notifications.some(
          (notification) => notification.id === id && !notification.readAt,
        )
      : unreadCount > 0;

    if (id) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id && !notification.readAt
            ? { ...notification, readAt }
            : notification,
        ),
      );
      if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    } else {
      setNotifications((current) =>
        current.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt },
        ),
      );
      setUnreadCount(0);
    }

    try {
      const response = await authFetch(
        "/api/merchant/notifications",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id ? { id } : { all: true }),
        },
        owner,
      );

      if (!response.ok) void load();
    } catch {
      void load();
    }
  };

  const openNotification = (notification: MerchantNotification) => {
    if (!notification.readAt) void markRead(notification.id);
    setOpen(false);
    onKitchens();
  };

  return (
    <div className="merchant-notifications">
      <button
        type="button"
        className="merchant-header-icon"
        aria-label={
          unreadCount > 0 ? `Мэдэгдэл, ${unreadCount} уншаагүй` : "Мэдэгдэл"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} strokeWidth={1.7} />
        {unreadCount > 0 ? (
          <span className="merchant-notification-count" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          className="merchant-notification-panel"
          role="dialog"
          aria-label="Мэдэгдлүүд"
        >
          <div className="merchant-notification-heading">
            <div>
              <strong>Мэдэгдэл</strong>
              <span>{unreadCount} уншаагүй</span>
            </div>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markRead()}>
                <CheckCheck size={15} />
                Бүгдийг уншсан
              </button>
            ) : null}
          </div>

          <div className="merchant-notification-list">
            {loading ? (
              <p role="status">Мэдэгдлүүдийг ачаалж байна…</p>
            ) : error ? (
              <button type="button" onClick={() => void load()}>
                {error} Дахин оролдох
              </button>
            ) : notifications.length === 0 ? (
              <p>Одоогоор мэдэгдэл алга.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={notification.readAt ? "is-read" : "is-unread"}
                  onClick={() => openNotification(notification)}
                >
                  <span className="merchant-notification-item-title">
                    {notification.title}
                  </span>
                  {notification.body ? (
                    <small>{notification.body}</small>
                  ) : null}
                  <time dateTime={notification.createdAt}>
                    {notificationDate.format(new Date(notification.createdAt))}
                  </time>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

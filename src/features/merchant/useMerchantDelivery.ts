"use client";
import { useEffect, useRef, useState } from "react";
import {
  DELIVERY_STAGES,
  canMoveDelivery,
  type DeliveryColumn,
  type DeliveryStage,
  type DeliveryStaff,
  type MerchantDeliveryOrder,
} from "@/lib/merchantDelivery";
import { isOwner, merchantRequest } from "./merchantApi";

type Snapshot = {
  owner: string;
  columns: Record<DeliveryStage, DeliveryColumn>;
  staff: DeliveryStaff[];
  loading: boolean;
  error: string | null;
  stageLoading: Record<DeliveryStage, boolean>;
  stageErrors: Partial<Record<DeliveryStage, string>>;
};
const emptyColumns = () =>
  Object.fromEntries(
    DELIVERY_STAGES.map((stage) => [
      stage,
      { orders: [], total: 0, hasMore: false } as DeliveryColumn,
    ]),
  ) as Record<DeliveryStage, DeliveryColumn>;
export function useMerchantDelivery(owner: string) {
  const [pages, setPages] = useState(
    () =>
      Object.fromEntries(DELIVERY_STAGES.map((stage) => [stage, 0])) as Record<
        DeliveryStage,
        number
      >,
  );
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mutationError, setMutationError] = useState("");
  const mutating = useRef(false),
    alive = useRef(false);
  const mutationToken = useRef<symbol | null>(null);
  const pageKey = JSON.stringify(pages);
  useEffect(() => {
    alive.current = true;
    mutating.current = false;
    setBusy(false);
    setMessage("");
    setMutationError("");
    return () => {
      alive.current = false;
      mutationToken.current = null;
    };
  }, [owner]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const currentPages = JSON.parse(pageKey) as Record<DeliveryStage, number>;
    setSnapshot((previous) => ({
      owner,
      columns: previous?.owner === owner ? previous.columns : emptyColumns(),
      staff: previous?.owner === owner ? previous.staff : [],
      loading: true,
      error: null,
      stageLoading: Object.fromEntries(
        DELIVERY_STAGES.map((stage) => [stage, true]),
      ) as Record<DeliveryStage, boolean>,
      stageErrors: {},
    }));
    let remaining = 7;
    const update = (change: (previous: Snapshot) => Snapshot) => {
      if (active && isOwner(owner))
        setSnapshot((previous) =>
          previous?.owner === owner ? change(previous) : previous,
        );
    };
    for (const stage of DELIVERY_STAGES) {
      void merchantRequest<DeliveryColumn>(
        `/api/merchant/delivery?stage=${stage}&page=${currentPages[stage]}`,
        owner,
        { signal: controller.signal },
      )
        .then((column) =>
          update((previous) => ({
            ...previous,
            columns: { ...previous.columns, [stage]: column },
          })),
        )
        .catch((reason) =>
          update((previous) => ({
            ...previous,
            stageErrors: {
              ...previous.stageErrors,
              [stage]:
                reason instanceof Error ? reason.message : "Ачаалж чадсангүй.",
            },
            error:
              reason instanceof Error ? reason.message : "Ачаалж чадсангүй.",
          })),
        )
        .finally(() => {
          remaining--;
          update((previous) => ({
            ...previous,
            loading: remaining > 0,
            stageLoading: { ...previous.stageLoading, [stage]: false },
          }));
        });
    }
    void merchantRequest<{ staff: DeliveryStaff[] }>(
      "/api/merchant/delivery/staff",
      owner,
      { signal: controller.signal },
    )
      .then((result) =>
        update((previous) => ({ ...previous, staff: result.staff })),
      )
      .catch((reason) =>
        update((previous) => ({
          ...previous,
          error:
            reason instanceof Error
              ? reason.message
              : "Ажилтны мэдээллийг ачаалж чадсангүй.",
        })),
      )
      .finally(() => {
        remaining--;
        update((previous) => ({ ...previous, loading: remaining > 0 }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, pageKey, refresh]);
  const view = snapshot?.owner === owner ? snapshot : null;
  const ready = !!view && !view.loading && !view.error;
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    success: string,
  ): Promise<boolean> {
    if (mutating.current || !ready || !isOwner(owner)) return false;
    mutating.current = true;
    const token = Symbol("delivery-mutation");
    mutationToken.current = token;
    setBusy(true);
    setMutationError("");
    setMessage("");
    try {
      await merchantRequest(path, owner, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!alive.current || !isOwner(owner) || token !== mutationToken.current)
        return false;
      setMessage(success);
      return true;
    } catch (error) {
      if (alive.current && isOwner(owner) && token === mutationToken.current)
        setMutationError(
          error instanceof Error ? error.message : "Өөрчлөлт хадгалагдсангүй.",
        );
      return false;
    } finally {
      if (token === mutationToken.current) mutating.current = false;
      if (alive.current && isOwner(owner) && token === mutationToken.current) {
        setBusy(false);
        // Refresh on success, conflicts, and uncertain network failures. Never
        // display a local drag as if it were an acknowledged database write.
        setSnapshot((previous) =>
          previous?.owner === owner ? { ...previous, loading: true } : previous,
        );
        setRefresh((value) => value + 1);
      }
    }
  }
  return {
    columns: view?.columns ?? emptyColumns(),
    stageLoading: view?.stageLoading,
    stageErrors: view?.stageErrors ?? {},
    staff: view?.staff ?? [],
    ready,
    loading: !view || view.loading,
    busy,
    error: view?.error ?? null,
    mutationError,
    message,
    pages,
    reload: () => {
      setMutationError("");
      setRefresh((value) => value + 1);
    },
    setPage: (stage: DeliveryStage, page: number) =>
      setPages((previous) => ({ ...previous, [stage]: Math.max(0, page) })),
    move: (
      order: MerchantDeliveryOrder,
      stage: DeliveryStage,
      driverId?: string,
    ) => {
      if (!canMoveDelivery(order, stage)) return Promise.resolve(false);
      return mutate(
        "/api/merchant/delivery",
        "PATCH",
        {
          orderId: order.id,
          stage,
          expectedVersion: order.version,
          ...(driverId ? { driverId } : {}),
        },
        "Захиалгын шинэ төлөв хадгалагдлаа.",
      );
    },
    saveStaff: (
      fields: Pick<DeliveryStaff, "name" | "phone" | "vehicle" | "active">,
      previous?: DeliveryStaff,
    ) =>
      mutate(
        "/api/merchant/delivery/staff",
        previous ? "PUT" : "POST",
        {
          ...fields,
          ...(previous
            ? { id: previous.id, expectedVersion: previous.version }
            : {}),
        },
        "Хүргэлтийн ажилтны мэдээлэл хадгалагдлаа.",
      ),
  };
}

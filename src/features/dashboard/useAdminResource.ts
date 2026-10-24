"use client";

import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import {
  readMerchantResource,
  useMerchantResource,
} from "@/features/merchant/useMerchantResource";

const adminTransport = {
  isAuthorized: (owner: string) =>
    useAuth.getState().user?.id === owner &&
    useAuth.getState().role === "admin",
  request: async (path: string, owner: string, init: RequestInit) => {
    const response = await authFetch(path, init, owner);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Мэдээлэл ачаалсангүй.");
    return data;
  },
};
export function useAdminResource<T>(owner: string, path: string) {
  return useMerchantResource<T>(owner, path, true, 0, adminTransport);
}
export function readAdminResource<T>(
  owner: string,
  path: string,
  force = false,
) {
  return readMerchantResource<T>(owner, path, force, adminTransport);
}

"use client";

import type { ReactNode } from "react";
import { MerchantSidebar, type MerchantTab } from "./MerchantSidebar";
import { MerchantHeader } from "./MerchantHeader";

export function MerchantShell({
  active,
  onChange,
  userName,
  storeName,
  owner,
  hasStore,
  children,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  userName: string;
  storeName: string;
  owner: string;
  hasStore: boolean;
  children: ReactNode;
}) {
  return (
    <div className="merchant-app-shell">
      <MerchantSidebar
        active={active}
        onChange={onChange}
        hasStore={hasStore}
      />

      <div className="merchant-workspace">
        <MerchantHeader
          userName={userName}
          storeName={storeName}
          owner={owner}
          onProducts={() => onChange("products")}
          onKitchens={() => onChange("kitchens")}
        />

        <main className="merchant-content">{children}</main>
      </div>
    </div>
  );
}

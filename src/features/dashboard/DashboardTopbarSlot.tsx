"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The shell's top bar exposes one slot so a page can place its own controls there. */
export const TopbarSlotContext = createContext<HTMLElement | null>(null);

export function TopbarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopbarSlotContext);
  return slot ? createPortal(children, slot) : null;
}

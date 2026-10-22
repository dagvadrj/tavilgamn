"use client";
import { loginPathForDestination, safeAuthDestination } from "./authRedirect";
import { requestGuestCartTransfer } from "@/store/cart";
import { requestGuestWishlistTransfer } from "@/store/wishlist";

export function shopLoginHref(pathname: string, search = "", hash = "") {
  return loginPathForDestination(
    safeAuthDestination(pathname + search + hash) ??
      safeAuthDestination(pathname) ??
      "/account",
  );
}

export function prepareShopLogin() {
  const { pathname, search, hash } = window.location;
  if (pathname === "/cart" || pathname === "/checkout")
    requestGuestCartTransfer();
  requestGuestWishlistTransfer();
  return shopLoginHref(pathname, search, hash);
}

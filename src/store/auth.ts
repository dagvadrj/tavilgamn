"use client";

import { create } from "zustand";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/lib/types";
import {
  isSupabaseConfigured,
  isSocialProviderEnabled,
  supabase,
} from "@/lib/supabase/client";
import { setCartOwner } from "@/store/cart";
import { setWishlistOwner } from "@/store/wishlist";
import { setDesignOwner } from "@/store/designs";
import { setKitchenOwner } from "@/store/kitchens";

import { rememberAuthDestination } from "@/lib/authRedirect";
import { authErrorMessage } from "@/lib/authErrors";

export type AuthRole = "customer" | "merchant" | "admin";

interface AuthResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

interface AuthState {
  user: User | null;
  role: AuthRole | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password?: string) => Promise<AuthResult>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  signInWithProvider: (provider: "google" | "apple") => Promise<AuthResult>;
  updateName: (name: string) => Promise<AuthResult>;
}

let authListenerStarted = false;
let initialization: Promise<void> | null = null;

const toAppUser = (user: SupabaseUser): User => ({
  id: user.id,
  email: user.email ?? "",
  name:
    String(user.user_metadata?.name ?? "").trim() ||
    String(user.user_metadata?.full_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "Хэрэглэгч",
  joinedAt: Date.parse(user.created_at),
});
function setLocalDataOwner(user: SupabaseUser | null) {
  const userId = user?.id ?? null;

  setCartOwner(userId);
  setWishlistOwner(userId);
  setDesignOwner(userId);
  setKitchenOwner(userId);
}

async function resolveAuthUser(user: SupabaseUser | null) {
  setLocalDataOwner(user);

  if (!user) {
    return {
      user: null,
      role: null,
    };
  }

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: toAppUser(user),
    role:
      data?.role === "admin"
        ? ("admin" as const)
        : data?.role === "merchant"
          ? ("merchant" as const)
          : ("customer" as const),
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  initialized: false,

  initialize: () => {
    if (get().initialized && (authListenerStarted || !isSupabaseConfigured))
      return Promise.resolve();
    if (initialization) return initialization;
    initialization = (async () => {
      if (!isSupabaseConfigured) {
        setLocalDataOwner(null);
        set({ user: null, role: null, initialized: true });
        return;
      }
      const { data } = await supabase.auth.getSession();
      const resolved = await resolveAuthUser(data.session?.user ?? null);
      set({ ...resolved, initialized: true });

      if (!authListenerStarted) {
        authListenerStarted = true;
        supabase.auth.onAuthStateChange((_event, session) => {
          window.setTimeout(() => {
            void resolveAuthUser(session?.user ?? null).then((nextAuth) => {
              set({ ...nextAuth, initialized: true });
            });
          }, 0);
        });
      }
    })().finally(() => {
      initialization = null;
    });
    return initialization;
  },

  signIn: async (email, password = "") => {
    if (!password) {
      return {
        error: "Нууц үгээ оруулна уу.",
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: authErrorMessage(error, "signIn") };
    }

    const resolved = await resolveAuthUser(data.user);

    set({
      ...resolved,
      initialized: true,
    });

    return { error: null };
  },

  signUp: async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(rememberAuthDestination(window.location.search))}`,
      },
    });

    if (error) {
      return { error: authErrorMessage(error, "signUp") };
    }

    if (data.session && data.user) {
      const resolved = await resolveAuthUser(data.user);

      set({
        ...resolved,
        initialized: true,
      });
    }

    return {
      error: null,
      needsEmailConfirmation: !data.session,
    };
  },

  signInWithProvider: async (provider) => {
    try {
      if (!(await isSocialProviderEnabled(provider)))
        return {
          error: `${provider === "google" ? "Google" : "Apple"} нэвтрэлт одоогоор идэвхгүй байна. Имэйлээр нэвтрэх боломжтой.`,
        };
      const next = rememberAuthDestination(window.location.search);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { error: authErrorMessage(error, "signIn") };
      if (!data.url)
        return { error: "Нэвтрэх холбоос үүссэнгүй. Дахин оролдоно уу." };
      window.location.assign(data.url);
      return { error: null };
    } catch (error) {
      return { error: authErrorMessage(error, "signIn") };
    }
  },

  updateName: async (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100)
      return { error: "Нэрээ 2–100 тэмдэгтээр оруулна уу." };
    const owner = get().user?.id;
    if (!owner) return { error: "Дахин нэвтэрнэ үү." };
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { name: trimmed },
      });
      if (error || !data.user)
        return { error: "Нэрийг хадгалж чадсангүй. Дахин оролдоно уу." };
      if (get().user?.id !== owner || data.user.id !== owner)
        return { error: "Бүртгэл өөрчлөгдсөн байна. Дахин нэвтэрнэ үү." };
      set({ user: toAppUser(data.user) });
      return { error: null };
    } catch {
      return {
        error: "Нэрийг хадгалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
      };
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setLocalDataOwner(null);

    set({
      user: null,
      role: null,
      initialized: true,
    });
  },
}));

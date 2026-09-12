"use client";

import { create } from "zustand";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";
import { setCartOwner } from "@/store/cart";
import { setWishlistOwner } from "@/store/wishlist";
import { setDesignOwner } from "@/store/designs";
import { setKitchenOwner } from "@/store/kitchens";

import { rememberAuthDestination } from "@/lib/authRedirect";
import { authErrorMessage } from "@/lib/authErrors";

export type AuthRole = "customer" | "admin";

interface AuthResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

interface AuthState {
  user: User | null;
  role: AuthRole | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (
    email: string,
    password?: string,
  ) => Promise<AuthResult>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

let authListenerStarted = false;

const toAppUser = (user: SupabaseUser): User => ({
  id: user.id,
  email: user.email ?? "",
  name:
    String(user.user_metadata?.name ?? "").trim() ||
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
        : ("customer" as const),
  };
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  role: null,
  initialized: false,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    const resolved = await resolveAuthUser(
      data.session?.user ?? null,
    );

    set({
      ...resolved,
      initialized: true,
    });

    if (!authListenerStarted) {
      authListenerStarted = true;

      supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => {
          void resolveAuthUser(session?.user ?? null).then(
            (nextAuth) => {
              set({
                ...nextAuth,
                initialized: true,
              });
            },
          );
        }, 0);
      });
    }
  },

  signIn: async (email, password = "") => {
    if (!password) {
      return {
        error: "Нууц үгээ оруулна уу.",
      };
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
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

signOut: async () => {
  await supabase.auth.signOut();
  setLocalDataOwner(null);

  set({
    user: null,
    role: null,
    initialized: true,
  });
},
}));

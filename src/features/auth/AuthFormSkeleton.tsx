import { PageSkeleton } from "@/components/PageSkeleton";
import { AuthFrame } from "./AuthFrame";

/** Keeps the same shell and input count as AuthForm while its bundle loads. */
export function AuthFormSkeleton({ mode }: { mode: "login" | "register" }) {
  return (
    <AuthFrame>
      <PageSkeleton variant="form" layout={mode} compact />
    </AuthFrame>
  );
}

import type { Metadata } from "next";
import "./auth.css";

export const metadata: Metadata = {
  title: "Нэвтрэх · TAVILGA",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="site-ui auth-layout">{children}</div>;
}

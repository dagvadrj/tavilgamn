import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./auth.css";

const font = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-auth",
});
export const metadata: Metadata = {
  title: "Нэвтрэх · TAVILGA",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${font.variable} auth-layout`}>{children}</div>;
}

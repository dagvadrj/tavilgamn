import { Manrope } from "next/font/google";
import "@/features/dashboard/dashboard.css";

const dashboardFont = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-dashboard-body", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dashboardFont.variable} dashboard-layout min-w-0 flex-1`}>{children}</div>;
}

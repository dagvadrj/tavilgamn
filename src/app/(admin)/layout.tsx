import "@/features/dashboard/dashboard-tokens.css";
import "@/features/dashboard/dashboard.css";
import { DASHBOARD_THEME_SCRIPT } from "@/features/dashboard/preferences";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-ui dashboard-layout min-w-0 flex-1">
      {/* Runs before the workspace paints, so the saved theme never flashes. */}
      <script dangerouslySetInnerHTML={{ __html: DASHBOARD_THEME_SCRIPT }} />
      {children}
    </div>
  );
}

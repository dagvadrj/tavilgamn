import "@/features/dashboard/dashboard.css";


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="site-ui dashboard-layout min-w-0 flex-1">{children}</div>;
}

// Load editor styles with the route, before the lazy 3D components mount.
// This also keeps the canvas layout stable during development refreshes.
import "@/features/planner/components/planner-reference.css";
import "@/features/planner/components/planner-sidebar.css";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-tools.css";
import "@/features/planner/components/planner-usability.css";
import "@/features/planner/components/planner-geometry.css";
import "@/features/planner/components/planner-catalog-upgrades.css";
import "@/components/room-planner.css";
import "@/components/room-planner-enhancements.css";
import "@/features/room-planner/components/room-planner-simple.css";
import "@/features/room-planner/components/room-panel-theme.css";
import "@/features/room-planner/styles/studio-refresh.css";
import "@/components/kitchen-planner.css";
import "@/features/kitchen-planner/components/kitchen-editor.css";
import "@/features/kitchen-planner/components/kitchen-flow.css";
import "@/features/kitchen-planner/components/kitchen-stitch.css";
import "@/features/kitchen-planner/components/kitchen-glb-workspace.css";
import "@/features/kitchen-planner/components/kitchen-ikea-layout.css";
import "@/features/kitchen-planner/components/kitchen-selection.css";
import "@/features/kitchen-planner/styles/kitchen-studio-polish.css";
import "@/features/planner/components/planner-responsive.css";
import "@/features/planner/components/viewport-controls.css";
import "@/features/kitchen-planner/styles/kitchen-interaction-stability.css";
import "@/features/kitchen-planner/styles/kitchen-supplier-appliances.css";

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return <main id="main-content" className="min-h-dvh min-w-0 flex-1">{children}</main>;
}

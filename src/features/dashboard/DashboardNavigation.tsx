"use client";

export function DashboardNavigation<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: T; label: string; disabled?: boolean }[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <nav className="v14-navigation" aria-label="Самбарын үндсэн цэс">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

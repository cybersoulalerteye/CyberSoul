import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
};

export function Tabs({ items, activeId, onChange }: TabsProps) {
  const active = items.find((item) => item.id === activeId);
  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label="Content sections">
        {items.map((item) => (
          <button
            className={`tabs__tab ${item.id === activeId ? "is-active" : ""}`}
            id={`tab-${item.id}`}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === activeId}
            aria-controls={`panel-${item.id}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active && (
        <div
          className="tabs__panel"
          id={`panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}

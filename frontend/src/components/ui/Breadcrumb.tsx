import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
            {item.href && index < items.length - 1 ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current={index === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

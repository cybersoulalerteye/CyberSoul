import type { HTMLAttributes } from "react";

export type IncidentStatus =
  | "new"
  | "assigned"
  | "acknowledged"
  | "investigating"
  | "escalated"
  | "resolved"
  | "closed";
export type ReviewLabel = "genuine" | "false-positive" | "duplicate" | "uncertain";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: IncidentStatus | ReviewLabel;
};

const labels: Record<IncidentStatus | ReviewLabel, string> = {
  new: "New",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  genuine: "Genuine",
  "false-positive": "False positive",
  duplicate: "Duplicate",
  uncertain: "Uncertain",
};

export function Badge({ variant, children, className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant} ${className}`.trim()}
      {...props}
    >
      <span className="badge__dot" aria-hidden="true" />
      {children ?? labels[variant]}
    </span>
  );
}

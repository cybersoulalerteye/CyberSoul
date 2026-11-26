import type { IncidentSummary } from "./incidentsMock";

export type ReportRecord = IncidentSummary & {
  shift: "Day" | "Evening" | "Night";
  review_minutes: number | null;
  documented_action: boolean | null;
  closure_minutes: number | null;
  evidence_retrieval_minutes: number | null;
  stage_minutes: number;
};

// Synthetic timing fields make the prototype useful while the API contract is pending.
export const mockReportRecords: ReportRecord[] = (() => {
  const incidents: IncidentSummary[] = Array.from({ length: 55 }, (_, index) => {
    const sites = ["North Campus", "Harbor Site", "West Yard", "East Annex"];
    const statuses = ["new", "assigned", "acknowledged", "investigating", "escalated", "resolved", "closed"] as const;
    const labels = ["genuine", "false-positive", "duplicate", "uncertain", null] as const;
    const group = index % 11 < 3 ? `GRP-${Math.floor(index / 11)}` : undefined;
    return {
      id: `INC-${String(2100 - index).padStart(4, "0")}`,
      created_at: new Date(Date.now() - index * 46 * 60_000).toISOString(),
      site_name: sites[index % sites.length],
      source_name: ["North Gate · Cam 04", "Loading Bay · Cam 12", "Lobby · Cam 02", "Perimeter · Cam 08"][index % 4],
      type: ["After-hours access", "Unrecognized vehicle", "Restricted area entry", "Perimeter crossing"][index % 4],
      priority: (["high", "medium", "low"] as const)[index % 3],
      priority_reason: "Prototype report record",
      status: statuses[(index * 3) % statuses.length],
      review_label: group ? "duplicate" : labels[(index * 2) % labels.length],
      owner_name: index % 4 === 0 ? null : ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Kim"][index % 4],
      duplicate_group_id: group,
    };
  });
  return incidents.map((incident, index) => ({
    ...incident,
    shift: (["Day", "Evening", "Night"] as const)[index % 3],
    review_minutes: incident.review_label && index % 13 !== 0 ? 3 + (index * 7) % 24 : null,
    documented_action: incident.owner_name ? index % 9 !== 0 : null,
    closure_minutes: ["resolved", "closed"].includes(incident.status) && index % 8 !== 0 ? 25 + (index * 29) % 300 : null,
    evidence_retrieval_minutes: index % 10 === 0 ? null : 1 + (index * 5) % 15,
    stage_minutes: 4 + (index * 11) % 90,
  }));
})();

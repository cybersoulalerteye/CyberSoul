import type { IncidentStatus } from "../components/ui";

export type DashboardRange = "today" | "7d" | "30d";
export type DashboardSite = "all" | "North Campus" | "Harbor Site" | "West Yard";

export type IncidentSummary = {
  id: string;
  timestamp: string;
  site: Exclude<DashboardSite, "all">;
  type: string;
  status: IncidentStatus;
  priority: "Critical" | "High" | "Medium" | "Low";
  unassigned?: boolean;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  site: Exclude<DashboardSite, "all">;
};

export type DashboardSummary = {
  open_incidents: number;
  open_incidents_delta: number;
  avg_verification_min: number;
  avg_verification_delta: number;
  dismissed_pct: number;
  unassigned: number;
  latest_incidents: IncidentSummary[];
  status_breakdown: Record<IncidentStatus, number>;
  alert_quality: {
    genuine: number;
    false_positive: number;
    duplicate: number;
    uncertain: number;
  };
  activity: AuditEvent[];
};

const now = Date.now();
const atMinutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const incidents: IncidentSummary[] = [
  { id: "INC-2048", timestamp: atMinutesAgo(4), site: "North Campus", type: "After-hours access", status: "investigating", priority: "High" },
  { id: "INC-2047", timestamp: atMinutesAgo(18), site: "Harbor Site", type: "Unrecognized vehicle", status: "new", priority: "Medium", unassigned: true },
  { id: "INC-2046", timestamp: atMinutesAgo(37), site: "North Campus", type: "Restricted area entry", status: "acknowledged", priority: "High" },
  { id: "INC-2045", timestamp: atMinutesAgo(62), site: "West Yard", type: "Perimeter crossing", status: "assigned", priority: "Critical" },
  { id: "INC-2044", timestamp: atMinutesAgo(93), site: "Harbor Site", type: "Loitering detected", status: "investigating", priority: "Low" },
  { id: "INC-2043", timestamp: atMinutesAgo(128), site: "North Campus", type: "Door held open", status: "new", priority: "Medium" },
  { id: "INC-2042", timestamp: atMinutesAgo(171), site: "West Yard", type: "Vehicle in restricted zone", status: "escalated", priority: "High" },
  { id: "INC-2041", timestamp: atMinutesAgo(214), site: "Harbor Site", type: "Tailgating", status: "assigned", priority: "Medium" },
  { id: "INC-2040", timestamp: atMinutesAgo(258), site: "North Campus", type: "Unrecognized visitor", status: "resolved", priority: "Low" },
  { id: "INC-2039", timestamp: atMinutesAgo(302), site: "West Yard", type: "Perimeter crossing", status: "investigating", priority: "High" },
  { id: "INC-2038", timestamp: atMinutesAgo(346), site: "Harbor Site", type: "Loading bay access", status: "acknowledged", priority: "Medium" },
  { id: "INC-2037", timestamp: atMinutesAgo(389), site: "North Campus", type: "Door forced open", status: "assigned", priority: "Critical" },
  { id: "INC-2036", timestamp: atMinutesAgo(433), site: "West Yard", type: "Unrecognized vehicle", status: "new", priority: "Low", unassigned: true },
  { id: "INC-2035", timestamp: atMinutesAgo(477), site: "Harbor Site", type: "Restricted area entry", status: "resolved", priority: "High" },
  { id: "INC-2034", timestamp: atMinutesAgo(521), site: "North Campus", type: "Gate left open", status: "closed", priority: "Low" },
];

const activity: AuditEvent[] = [
  { id: "evt-01", timestamp: atMinutesAgo(3), actor: "Alex Morgan", action: "started investigating", target: "INC-2048 · After-hours access", site: "North Campus" },
  { id: "evt-02", timestamp: atMinutesAgo(16), actor: "System", action: "created incident", target: "INC-2047 · Unrecognized vehicle", site: "Harbor Site" },
  { id: "evt-03", timestamp: atMinutesAgo(34), actor: "Jordan Lee", action: "acknowledged incident", target: "INC-2046 · Restricted area entry", site: "North Campus" },
  { id: "evt-04", timestamp: atMinutesAgo(58), actor: "Sam Rivera", action: "assigned incident", target: "INC-2045 · Perimeter crossing", site: "West Yard" },
  { id: "evt-05", timestamp: atMinutesAgo(89), actor: "System", action: "created incident", target: "INC-2044 · Loitering detected", site: "Harbor Site" },
  { id: "evt-06", timestamp: atMinutesAgo(124), actor: "Alex Morgan", action: "added an evidence note", target: "INC-2043 · Door held open", site: "North Campus" },
  { id: "evt-07", timestamp: atMinutesAgo(166), actor: "Jordan Lee", action: "escalated incident", target: "INC-2042 · Vehicle in restricted zone", site: "West Yard" },
  { id: "evt-08", timestamp: atMinutesAgo(209), actor: "System", action: "created incident", target: "INC-2041 · Tailgating", site: "Harbor Site" },
  { id: "evt-09", timestamp: atMinutesAgo(253), actor: "Sam Rivera", action: "resolved incident", target: "INC-2040 · Unrecognized visitor", site: "North Campus" },
  { id: "evt-10", timestamp: atMinutesAgo(297), actor: "Alex Morgan", action: "updated review label", target: "INC-2039 · Perimeter crossing", site: "West Yard" },
];

const emptyStatusBreakdown = (): Record<IncidentStatus, number> => ({
  new: 0,
  assigned: 0,
  acknowledged: 0,
  investigating: 0,
  escalated: 0,
  resolved: 0,
  closed: 0,
});

export function getMockDashboardSummary(
  range: DashboardRange,
  site: DashboardSite,
): DashboardSummary {
  const rangeDuration = range === "today" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  const cutoff = now - rangeDuration * 60 * 60 * 1000;
  const inRange = (timestamp: string) => new Date(timestamp).getTime() >= cutoff;
  const filteredIncidents = incidents.filter(
    (incident) => inRange(incident.timestamp) && (site === "all" || incident.site === site),
  );
  const statusBreakdown = emptyStatusBreakdown();
  for (const incident of filteredIncidents) {
    statusBreakdown[incident.status] += 1;
  }
  const openIncidents = filteredIncidents.filter(
    ({ status }) => status !== "resolved" && status !== "closed",
  ).length;

  return {
    open_incidents: openIncidents,
    open_incidents_delta: -3,
    avg_verification_min: 4.2,
    avg_verification_delta: -0.8,
    dismissed_pct: 38.5,
    unassigned: filteredIncidents.filter((incident) => incident.unassigned).length,
    latest_incidents: filteredIncidents.slice(0, 8),
    status_breakdown: statusBreakdown,
    alert_quality: { genuine: 61, false_positive: 27, duplicate: 9, uncertain: 3 },
    activity: activity.filter(
      (event) => inRange(event.timestamp) && (site === "all" || event.site === site),
    ).slice(0, 10),
  };
}

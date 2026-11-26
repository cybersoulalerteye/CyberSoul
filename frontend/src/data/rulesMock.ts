export const approvedEventTypes = [
  "Person detection",
  "Vehicle detection",
  "Restricted-zone intrusion",
  "Loitering",
  "Crowd detection",
] as const;

export type RuleEventType = (typeof approvedEventTypes)[number];
export type RulePriority = "high" | "medium" | "low";
export type ZoneSensitivity = "restricted" | "standard";

export type RuleRecord = {
  id: string;
  name: string;
  description: string;
  site_id: string;
  event_type: RuleEventType;
  zone_json: string;
  zone_sensitivity: ZoneSensitivity;
  persistence_s: number;
  cooldown_s: number;
  time_window: {
    enabled: boolean;
    start: string;
    end: string;
  };
  priority: RulePriority;
  priority_reason: string;
  enabled: boolean;
  updated_at: string;
};

const samplePolygon = JSON.stringify({
  type: "Polygon",
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
});

export const initialRules: RuleRecord[] = [
  {
    id: "RULE-001",
    name: "North Gate restricted access",
    description: "Prioritise confirmed presence within the north restricted zone.",
    site_id: "SITE-0101",
    event_type: "Restricted-zone intrusion",
    zone_json: samplePolygon,
    zone_sensitivity: "restricted",
    persistence_s: 12,
    cooldown_s: 60,
    time_window: { enabled: true, start: "22:00", end: "06:00" },
    priority: "high",
    priority_reason: "High — restricted zone + after-hours (22:00–06:00) + persistence 12s.",
    enabled: true,
    updated_at: "2026-11-18T16:20:00.000Z",
  },
  {
    id: "RULE-002",
    name: "Harbor perimeter dwell",
    description: "Review extended presence near the harbor perimeter.",
    site_id: "SITE-0102",
    event_type: "Loitering",
    zone_json: "",
    zone_sensitivity: "restricted",
    persistence_s: 25,
    cooldown_s: 120,
    time_window: { enabled: false, start: "22:00", end: "06:00" },
    priority: "medium",
    priority_reason: "Medium — restricted zone + no time window + persistence 25s.",
    enabled: true,
    updated_at: "2026-11-16T13:05:00.000Z",
  },
  {
    id: "RULE-003",
    name: "Loading dock vehicle checks",
    description: "Low-priority review of vehicle events at all sites.",
    site_id: "all",
    event_type: "Vehicle detection",
    zone_json: "",
    zone_sensitivity: "standard",
    persistence_s: 3,
    cooldown_s: 30,
    time_window: { enabled: false, start: "22:00", end: "06:00" },
    priority: "low",
    priority_reason: "Low — standard zone + no time window + persistence 3s.",
    enabled: false,
    updated_at: "2026-11-14T09:30:00.000Z",
  },
];

import type { IncidentStatus, ReviewLabel } from "../components/ui";

export type IncidentPriority = "high" | "medium" | "low";
export type IncidentSort =
  | "id"
  | "created_at"
  | "site_name"
  | "source_name"
  | "type"
  | "priority"
  | "status"
  | "review_label"
  | "owner_name";

export type IncidentSummary = {
  id: string;
  created_at: string;
  updated_at?: string;
  site_name: string;
  source_name: string;
  type: string;
  priority: IncidentPriority;
  priority_reason: string;
  status: IncidentStatus;
  review_label: ReviewLabel | null;
  owner_name: string | null;
  related_event_count?: number;
  duplicate_group_id?: string;
};

export type IncidentFilters = {
  statuses: IncidentStatus[];
  reviewLabel: ReviewLabel | null;
  priority: IncidentPriority | null;
  site: string;
  query: string;
  from: string;
  to: string;
  group: string;
  sort: IncidentSort;
  descending: boolean;
  offset: number;
  pageSize: number;
};

export type IncidentPage = {
  items: IncidentSummary[];
  next_cursor: string | null;
  total: number;
};

const sites = ["North Campus", "Harbor Site", "West Yard", "East Annex"];
const sources = ["North Gate · Cam 04", "Loading Bay · Cam 12", "Lobby · Cam 02", "Perimeter · Cam 08"];
const types = [
  "After-hours access",
  "Unrecognized vehicle",
  "Restricted area entry",
  "Perimeter crossing",
  "Loitering detected",
  "Door held open",
  "Tailgating",
  "Unrecognized visitor",
];
const statuses: IncidentStatus[] = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "escalated",
  "resolved",
  "closed",
];
const priorities: IncidentPriority[] = ["high", "medium", "low"];
const reviewLabels: (ReviewLabel | null)[] = [
  "genuine",
  "false-positive",
  "duplicate",
  "uncertain",
  null,
];
const owners = ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Kim"];

export const initialMockIncidents: IncidentSummary[] = Array.from({ length: 55 }, (_, index) => {
  const priority = priorities[index % priorities.length];
  const groupEnd = Math.floor(index / 11) * 11 + 2;
  const duplicateGroupId = groupEnd < 55 && index >= groupEnd - 2 && index <= groupEnd
    ? `GRP-${String(2100 - groupEnd).padStart(4, "0")}`
    : undefined;
  return {
    id: `INC-${String(2100 - index).padStart(4, "0")}`,
    created_at: new Date(Date.now() - index * 46 * 60_000).toISOString(),
    site_name: sites[index % sites.length],
    source_name: sources[(index * 3) % sources.length],
    type: types[(index * 5) % types.length],
    priority,
    priority_reason: [
      "Restricted zone + after-hours + persistence 12s",
      "Vehicle match + loading bay + outside schedule",
      "Access rule + door held open 18s",
    ][index % 3],
    status: statuses[(index * 3) % statuses.length],
    review_label: duplicateGroupId ? "duplicate" : reviewLabels[(index * 2) % reviewLabels.length],
    owner_name: index % 4 === 0 ? null : owners[index % owners.length],
    related_event_count: index === groupEnd ? 3 : undefined,
    duplicate_group_id: duplicateGroupId,
  };
});

let mockIncidentStore = initialMockIncidents;

export function getMockIncidentStore() {
  return mockIncidentStore;
}

export function updateMockIncidentStore(
  update: (incidents: IncidentSummary[]) => IncidentSummary[],
) {
  mockIncidentStore = update(mockIncidentStore);
  return mockIncidentStore;
}

function getSortValue(incident: IncidentSummary, sort: IncidentSort): string {
  if (sort === "priority") {
    return String({ high: 3, medium: 2, low: 1 }[incident.priority]);
  }
  if (sort === "status") {
    return String(statuses.indexOf(incident.status)).padStart(2, "0");
  }
  return String(incident[sort] ?? "");
}

export function getMockIncidentPage(
  incidents: IncidentSummary[],
  filters: IncidentFilters,
): IncidentPage {
  const search = filters.query.trim().toLocaleLowerCase();
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to
    ? new Date(`${filters.to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
    : Number.POSITIVE_INFINITY;
  const matching = incidents
    .filter((incident) => {
      const created = new Date(incident.created_at).getTime();
      return (
        (filters.statuses.length === 0 || filters.statuses.includes(incident.status)) &&
        (!filters.reviewLabel || incident.review_label === filters.reviewLabel) &&
        (!filters.priority || incident.priority === filters.priority) &&
        (!filters.site || incident.site_name === filters.site) &&
        (!filters.group || incident.duplicate_group_id === filters.group) &&
        (!search ||
          `${incident.id} ${incident.site_name} ${incident.type}`.toLocaleLowerCase().includes(search)) &&
        created >= from &&
        created < to
      );
    })
    .sort((a, b) => {
      const result = getSortValue(a, filters.sort).localeCompare(getSortValue(b, filters.sort), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return filters.descending ? -result : result;
    });
  const items = matching.slice(filters.offset, filters.offset + filters.pageSize);
  const nextOffset = filters.offset + filters.pageSize;

  return {
    items,
    total: matching.length,
    next_cursor: nextOffset < matching.length ? String(nextOffset) : null,
  };
}

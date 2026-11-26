import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toast,
  type IncidentStatus,
  type ReviewLabel,
} from "../components/ui";
import {
  getMockIncidentPage,
  getMockIncidentStore,
  updateMockIncidentStore,
  type IncidentFilters,
  type IncidentPriority,
  type IncidentSort,
  type IncidentSummary,
} from "../data/incidentsMock";
import { allowedIncidentTransitions } from "../data/incidentTransitions";

const incidentStatuses: IncidentStatus[] = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "escalated",
  "resolved",
  "closed",
];
const reviewOptions: { value: ReviewLabel; label: string }[] = [
  { value: "genuine", label: "Genuine" },
  { value: "false-positive", label: "False positive" },
  { value: "duplicate", label: "Duplicate" },
  { value: "uncertain", label: "Uncertain" },
];
const pageSizes = [25, 50, 100];
const statusNames: Record<IncidentStatus, string> = {
  new: "New",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};
const reviewNames: Record<ReviewLabel, string> = {
  genuine: "Genuine",
  "false-positive": "False positive",
  duplicate: "Duplicate",
  uncertain: "Uncertain",
};

const numberFormat = new Intl.NumberFormat("en-US");
const localDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isStatus(value: string): value is IncidentStatus {
  return incidentStatuses.some((status) => status === value);
}

function isReviewLabel(value: string): value is ReviewLabel {
  return reviewOptions.some((option) => option.value === value);
}

function isPriority(value: string): value is IncidentPriority {
  return value === "high" || value === "medium" || value === "low";
}

function isIncidentSort(value: string): value is IncidentSort {
  return [
    "id",
    "created_at",
    "site_name",
    "source_name",
    "type",
    "priority",
    "status",
    "review_label",
    "owner_name",
  ].includes(value);
}

function readStatuses(params: URLSearchParams): IncidentStatus[] {
  const queryStatuses = params.getAll("status");
  if (queryStatuses.includes("open")) {
    return ["new", "assigned", "acknowledged", "investigating", "escalated"];
  }
  return queryStatuses.filter(isStatus);
}

function readFilters(params: URLSearchParams): IncidentFilters {
  const querySize = Number(params.get("page_size"));
  const requestedSort = params.get("sort") ?? "-created_at";
  const sortValue = requestedSort.startsWith("-") ? requestedSort.slice(1) : requestedSort;
  const priorityValue = params.get("priority") ?? "";
  const review = params.get("label") ??
    (params.get("review") === "irrelevant" ? "false-positive" : "");

  return {
    statuses: readStatuses(params),
    reviewLabel: isReviewLabel(review) ? review : null,
    priority: isPriority(priorityValue) ? priorityValue : null,
    site: params.get("site") ?? "",
    query: params.get("q") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    group: params.get("group") ?? "",
    sort: isIncidentSort(sortValue) ? sortValue : "created_at",
    descending: requestedSort.startsWith("-") || requestedSort === "-created_at",
    offset: Math.max(0, Number(params.get("page")) || 0),
    pageSize: pageSizes.includes(querySize) ? querySize : 25,
  };
}

function StatusFilter({
  selected,
  onChange,
}: {
  selected: IncidentStatus[];
  onChange: (statuses: IncidentStatus[]) => void;
}) {
  const filterRef = useRef<HTMLDetailsElement>(null);
  const label = selected.length === 0
    ? "Any status"
    : selected.length === incidentStatuses.length
      ? "All statuses"
      : `${selected.length} selected`;

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        filterRef.current &&
        event.target instanceof Node &&
        !filterRef.current.contains(event.target)
      ) {
        filterRef.current.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <details
      className="status-filter"
      ref={filterRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && filterRef.current) {
          filterRef.current.open = false;
          filterRef.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={`Filter by status: ${label}`}>
        <span>Status</span>
        <strong>{label}</strong>
        <span className="status-filter__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="status-filter__menu" aria-label="Incident statuses">
        {incidentStatuses.map((status) => (
          <label className="filter-check" key={status}>
            <input
              type="checkbox"
              checked={selected.includes(status)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, status]
                  : selected.filter((item) => item !== status);
                onChange(next);
              }}
            />
            <span>{statusNames[status]}</span>
          </label>
        ))}
        {selected.length > 0 && (
          <button className="status-filter__clear" type="button" onClick={() => onChange([])}>
            Clear status
          </button>
        )}
      </div>
    </details>
  );
}

function SortHeader({
  field,
  sort,
  descending,
  onSort,
  children,
}: {
  field: IncidentSort;
  sort: IncidentSort;
  descending: boolean;
  onSort: (field: IncidentSort) => void;
  children: string;
}) {
  const active = sort === field;
  return (
    <TableHeader aria-sort={active ? (descending ? "descending" : "ascending") : "none"}>
      <button className="sort-button" type="button" onClick={() => onSort(field)}>
        {children}
        {active ? (
          descending ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />
        ) : (
          <span className="sort-button__spacer" aria-hidden="true" />
        )}
      </button>
    </TableHeader>
  );
}

function IncidentTableSkeleton() {
  return (
    <div className="table-wrap">
      <table className="table incidents-table" aria-hidden="true">
        <thead>
          <tr>{Array.from({ length: 10 }, (_, index) => <th key={index}><Skeleton width="70%" height="12px" /></th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: 10 }, (_, column) => (
                <td key={column}><Skeleton width={column === 0 ? "72px" : column === 4 ? "130px" : "78%"} height="12px" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="incidents-error" role="alert">
      <span>Could not load incidents. Retry.</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function IncidentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState(getMockIncidentStore);
  const [pageData, setPageData] = useState<ReturnType<typeof getMockIncidentPage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"assign" | "escalate" | "close" | null>(null);
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [newIncidentType, setNewIncidentType] = useState("");
  const [newIncidentSite, setNewIncidentSite] = useState("North Campus");
  const [toastMessage, setToastMessage] = useState("");
  const searchKey = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchKey)), [searchKey]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPageData(null);
    const timer = window.setTimeout(() => {
      try {
        setPageData(getMockIncidentPage(incidents, filters));
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [filters, incidents, retryVersion]);

  useEffect(() => {
    setSelectedIds([]);
  }, [searchKey]);

  const updateParams = (update: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      update(next);
      next.delete("page");
      return next;
    }, { replace: true });
  };

  const clearFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams();
      const pageSize = current.get("page_size");
      if (pageSize) next.set("page_size", pageSize);
      return next;
    }, { replace: true });
  };

  const setStatusFilters = (statuses: IncidentStatus[]) => {
    updateParams((params) => {
      params.delete("status");
      params.delete("review");
      statuses.forEach((status) => params.append("status", status));
    });
  };

  const setFilter = (key: string, value: string) => {
    updateParams((params) => {
      if (key === "label") params.delete("review");
      if (value) params.set(key, value);
      else params.delete(key);
    });
  };

  const setSearch = (value: string) => {
    updateParams((params) => {
      if (value) params.set("q", value);
      else params.delete("q");
    });
  };

  const setSort = (sort: IncidentSort) => {
    const nextDirection = filters.sort === sort && !filters.descending;
    updateParams((params) => params.set("sort", `${nextDirection ? "" : "-"}${sort}`));
  };

  const setPageOffset = (offset: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (offset > 0) next.set("page", String(offset));
      else next.delete("page");
      return next;
    }, { replace: true });
  };

  const pageItems = pageData?.items ?? [];
  const pageIds = pageItems.map((incident) => incident.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const selectedIncidents = incidents.filter((incident) => selectedIds.includes(incident.id));
  const canBulkEscalate = selectedIncidents.length > 0 &&
    selectedIncidents.every((incident) => allowedIncidentTransitions[incident.status].includes("escalated"));
  const canBulkClose = selectedIncidents.length > 0 &&
    selectedIncidents.every((incident) => allowedIncidentTransitions[incident.status].includes("closed"));

  const togglePageSelection = () => {
    setSelectedIds((current) => allOnPageSelected
      ? current.filter((id) => !pageIds.includes(id))
      : Array.from(new Set([...current, ...pageIds])));
  };

  const toggleIncident = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const confirmBulkAction = () => {
    if (!bulkAction) return;
    if (bulkAction === "escalate" && !canBulkEscalate) {
      setBulkAction(null);
      setToastMessage("Only investigating incidents can be escalated.");
      return;
    }
    if (bulkAction === "close" && !canBulkClose) {
      setBulkAction(null);
      setToastMessage("Resolve selected incidents before closing them.");
      return;
    }
    const updatedIncidents = updateMockIncidentStore((current) => current.map((incident) => {
      if (!selectedIds.includes(incident.id)) return incident;
      if (bulkAction === "assign") {
        return {
          ...incident,
          status: allowedIncidentTransitions[incident.status].includes("assigned") ? "assigned" : incident.status,
          owner_name: "Alex Morgan",
        };
      }
      if (bulkAction === "escalate") return { ...incident, status: "escalated" };
      return { ...incident, status: "closed" };
    }));
    setIncidents(updatedIncidents);
    const result = bulkAction === "assign" ? "assigned" : bulkAction === "escalate" ? "escalated" : "closed";
    setToastMessage(`${numberFormat.format(selectedIds.length)} incident${selectedIds.length === 1 ? "" : "s"} ${result}.`);
    setSelectedIds([]);
    setBulkAction(null);
  };

  const createIncident = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextIncident: IncidentSummary = {
      id: `INC-${String(3000 + incidents.length).padStart(4, "0")}`,
      created_at: new Date().toISOString(),
      site_name: newIncidentSite,
      source_name: "Manual entry",
      type: newIncidentType.trim(),
      priority: "medium",
      priority_reason: "Created manually by an operator",
      status: "new",
      review_label: null,
      owner_name: null,
    };
    setIncidents(updateMockIncidentStore((current) => [nextIncident, ...current]));
    setNewIncidentOpen(false);
    setNewIncidentType("");
    setToastMessage("Incident created in prototype data.");
  };

  const clearFilterAction = (
    <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
  );

  return (
    <>
      <div className="page-heading incidents-heading">
        <div>
          <h1>Incidents</h1>
          <p>Review, filter, and respond to security events.</p>
        </div>
        <div className="incidents-heading__actions">
          <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
          <Link className="button button--secondary" to="/evidence"><Upload size={15} aria-hidden="true" />Upload evidence</Link>
          <Button variant="primary" onClick={() => setNewIncidentOpen(true)}><Plus size={16} aria-hidden="true" />New Incident</Button>
        </div>
      </div>

      <div className="incidents-filter-bar" aria-label="Incident filters">
        <label className="incident-search">
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label="Search incidents by ID, site, or type"
            placeholder="Search ID, site, type"
            value={filters.query}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <StatusFilter selected={filters.statuses} onChange={setStatusFilters} />
        <label className="incidents-filter">
          <span className="sr-only">Review label</span>
          <Select aria-label="Review label" value={filters.reviewLabel ?? ""} onChange={(event) => setFilter("label", event.currentTarget.value)}>
            <option value="">All labels</option>
            {reviewOptions.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
          </Select>
        </label>
        <label className="incidents-filter incidents-filter--priority">
          <span className="sr-only">Priority</span>
          <Select aria-label="Priority" value={filters.priority ?? ""} onChange={(event) => setFilter("priority", event.currentTarget.value)}>
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </label>
        <label className="incidents-filter incidents-filter--site">
          <span className="sr-only">Site</span>
          <Select aria-label="Site" value={filters.site} onChange={(event) => setFilter("site", event.currentTarget.value)}>
            <option value="">All sites</option>
            {["North Campus", "Harbor Site", "West Yard", "East Annex"].map((site) => <option key={site} value={site}>{site}</option>)}
          </Select>
        </label>
        <div className="incident-date-filter">
          <label><span className="sr-only">From date</span><Input aria-label="From date" type="date" value={filters.from} onChange={(event) => setFilter("from", event.currentTarget.value)} /></label>
          <span aria-hidden="true">–</span>
          <label><span className="sr-only">To date</span><Input aria-label="To date" type="date" value={filters.to} onChange={(event) => setFilter("to", event.currentTarget.value)} /></label>
        </div>
        {clearFilterAction}
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-actions" role="region" aria-label="Bulk actions">
          <span><strong>{numberFormat.format(selectedIds.length)}</strong> selected</span>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setBulkAction("assign")}>Assign</Button>
            <span className="bulk-action-tooltip" title={canBulkEscalate ? "" : "Only investigating incidents can be escalated."}>
              <Button variant="secondary" size="sm" disabled={!canBulkEscalate} onClick={() => setBulkAction("escalate")}>Escalate</Button>
            </span>
            <span className="bulk-action-tooltip" title={canBulkClose ? "" : "Resolve selected incidents before closing them."}>
              <Button variant="secondary" size="sm" disabled={!canBulkClose} onClick={() => setBulkAction("close")}>Close</Button>
            </span>
          </div>
        </div>
      )}

      <section className="incidents-table-panel" aria-label="Incidents">
        {loading ? (
          <IncidentTableSkeleton />
        ) : error ? (
          <InlineError onRetry={() => setRetryVersion((version) => version + 1)} />
        ) : pageItems.length === 0 ? (
          <EmptyState
            icon={<Search size={20} strokeWidth={1.5} />}
            title="No incidents match these filters."
            action={clearFilterAction}
          />
        ) : (
          <>
            <div className="table-wrap">
              <Table className="incidents-table">
                <TableHead>
                  <TableRow>
                    <TableHeader className="incidents-table__select">
                      <input
                        type="checkbox"
                        aria-label="Select all incidents on this page"
                        checked={allOnPageSelected}
                        ref={(element) => {
                          if (element) element.indeterminate = selectedOnPage > 0 && !allOnPageSelected;
                        }}
                        onChange={togglePageSelection}
                      />
                    </TableHeader>
                    <SortHeader field="id" sort={filters.sort} descending={filters.descending} onSort={setSort}>ID</SortHeader>
                    <SortHeader field="created_at" sort={filters.sort} descending={filters.descending} onSort={setSort}>Time</SortHeader>
                    <SortHeader field="site_name" sort={filters.sort} descending={filters.descending} onSort={setSort}>Site</SortHeader>
                    <SortHeader field="source_name" sort={filters.sort} descending={filters.descending} onSort={setSort}>Camera/Source</SortHeader>
                    <SortHeader field="type" sort={filters.sort} descending={filters.descending} onSort={setSort}>Type</SortHeader>
                    <SortHeader field="priority" sort={filters.sort} descending={filters.descending} onSort={setSort}>Priority</SortHeader>
                    <SortHeader field="status" sort={filters.sort} descending={filters.descending} onSort={setSort}>Status</SortHeader>
                    <SortHeader field="review_label" sort={filters.sort} descending={filters.descending} onSort={setSort}>Label</SortHeader>
                    <SortHeader field="owner_name" sort={filters.sort} descending={filters.descending} onSort={setSort}>Owner</SortHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageItems.map((incident) => {
                    const destination = `/incidents/${encodeURIComponent(incident.id)}${location.search}`;
                    return (
                      <TableRow
                        className="incident-row"
                        key={incident.id}
                        tabIndex={0}
                        aria-label={`Open ${incident.id}: ${incident.type}`}
                        onClick={(event) => {
                          const target = event.target;
                          if (target instanceof HTMLElement && target.closest("a, button, input, label")) return;
                          navigate(destination);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && event.target === event.currentTarget) navigate(destination);
                        }}
                      >
                        <TableCell className="incidents-table__select">
                          <input
                            type="checkbox"
                            aria-label={`Select ${incident.id}`}
                            checked={selectedIds.includes(incident.id)}
                            onChange={() => toggleIncident(incident.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell><Link className="incident-id mono-text" to={destination}>{incident.id}</Link></TableCell>
                        <TableCell><time className="mono-text" dateTime={incident.created_at}>{localDateTime.format(new Date(incident.created_at))}</time></TableCell>
                        <TableCell>{incident.site_name}</TableCell>
                        <TableCell>{incident.source_name}</TableCell>
                        <TableCell>
                          <span className="incident-type">{incident.type}</span>
                          {incident.related_event_count && incident.duplicate_group_id && (
                            <Link className="related-events" to={`/incidents?group=${encodeURIComponent(incident.duplicate_group_id)}`}>
                              {numberFormat.format(incident.related_event_count)} related events
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`priority-chip priority-chip--${incident.priority}`} title={incident.priority_reason}>
                            <span aria-hidden="true" />
                            {incident.priority[0].toUpperCase() + incident.priority.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={incident.status}>{statusNames[incident.status]}</Badge></TableCell>
                        <TableCell>{incident.review_label ? <Badge variant={incident.review_label}>{reviewNames[incident.review_label]}</Badge> : <span className="table-muted">—</span>}</TableCell>
                        <TableCell>{incident.owner_name ?? <span className="table-muted">Unassigned</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="incidents-pagination">
              <span>
                {numberFormat.format(filters.offset + 1)}–{numberFormat.format(Math.min(filters.offset + pageItems.length, pageData?.total ?? 0))}
                {" of "}
                {numberFormat.format(pageData?.total ?? 0)}
              </span>
              <label>
                <span>Rows</span>
                <Select
                  aria-label="Rows per page"
                  value={String(filters.pageSize)}
                  onChange={(event) => updateParams((params) => params.set("page_size", event.currentTarget.value))}
                >
                  {pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
                </Select>
              </label>
              <div className="incidents-pagination__buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Previous page"
                  disabled={filters.offset === 0}
                  onClick={() => setPageOffset(Math.max(0, filters.offset - filters.pageSize))}
                >
                  <ChevronLeft size={15} aria-hidden="true" />Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Next page"
                  disabled={!pageData?.next_cursor}
                  onClick={() => {
                    if (pageData?.next_cursor) setPageOffset(Number(pageData.next_cursor));
                  }}
                >
                  Next<ChevronRight size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal
        open={newIncidentOpen}
        title="New Incident"
        onClose={() => setNewIncidentOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewIncidentOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="new-incident-form">Create incident</Button>
          </>
        }
      >
        <form id="new-incident-form" className="incident-form" onSubmit={createIncident}>
          <Field label="Incident type" id="new-incident-type">
            <Input id="new-incident-type" value={newIncidentType} onChange={(event) => setNewIncidentType(event.currentTarget.value)} required placeholder="Describe the event" />
          </Field>
          <Field label="Site" id="new-incident-site">
            <Select id="new-incident-site" value={newIncidentSite} onChange={(event) => setNewIncidentSite(event.currentTarget.value)}>
              {["North Campus", "Harbor Site", "West Yard", "East Annex"].map((site) => <option value={site} key={site}>{site}</option>)}
            </Select>
          </Field>
          <p className="field__hint">This creates a local prototype incident; backend submission is not connected.</p>
        </form>
      </Modal>

      <Modal
        open={bulkAction !== null}
        title={`${bulkAction ? bulkAction[0].toUpperCase() + bulkAction.slice(1) : ""} ${numberFormat.format(selectedIds.length)} incidents?`}
        onClose={() => setBulkAction(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button variant={bulkAction === "close" ? "danger" : "primary"} onClick={confirmBulkAction}>
              Confirm {bulkAction ?? "action"}
            </Button>
          </>
        }
      >
        <p className="incident-modal-copy">
          {bulkAction === "assign"
            ? "Selected incidents will be assigned to Alex Morgan."
            : bulkAction === "escalate"
              ? "Selected incidents will be marked as escalated."
              : "Selected incidents will be marked as closed."}
        </p>
      </Modal>

      {toastMessage && (
        <div className="toast-container">
          <Toast>{toastMessage}</Toast>
          <button className="toast-dismiss" type="button" onClick={() => setToastMessage("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}

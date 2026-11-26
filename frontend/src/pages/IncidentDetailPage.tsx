import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileVideo2,
  Info,
  LockKeyhole,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Select,
  Skeleton,
  Textarea,
  type IncidentStatus,
  type ReviewLabel,
} from "../components/ui";
import {
  getMockIncidentStore,
  updateMockIncidentStore,
  type IncidentSummary,
} from "../data/incidentsMock";
import { allowedIncidentTransitions } from "../data/incidentTransitions";

type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail?: string;
};

type PendingAction =
  | { kind: "assign"; owner: string }
  | { kind: "status"; status: IncidentStatus }
  | { kind: "review"; label: ReviewLabel | null }
  | { kind: "export" };

type LoadState = "loading" | "ready" | "not-found" | "permission-denied";

const incidentStatuses: IncidentStatus[] = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "escalated",
  "resolved",
  "closed",
];
const reviewOptions: { value: ReviewLabel | ""; label: string }[] = [
  { value: "", label: "No label" },
  { value: "genuine", label: "Genuine" },
  { value: "false-positive", label: "False positive" },
  { value: "duplicate", label: "Duplicate" },
  { value: "uncertain", label: "Uncertain" },
];
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
const owners = ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Kim"];
function isIncidentStatus(value: string): value is IncidentStatus {
  return incidentStatuses.some((status) => status === value);
}

function isReviewValue(value: string): value is ReviewLabel | "" {
  return reviewOptions.some((option) => option.value === value);
}

function transitionDisabledReason(current: IncidentStatus, target: IncidentStatus) {
  if (current === target) return `The incident is already ${statusNames[target]}.`;
  if (current === "closed") return "Closed incidents cannot transition to another status.";
  if (target === "acknowledged" && current === "new") {
    return "Assign the incident before acknowledging it.";
  }
  const next = allowedIncidentTransitions[current];
  if (next.length === 0) return "No further status transitions are available.";
  return `${statusNames[current]} can move to ${next.map((status) => statusNames[status]).join(" or ")}, not ${statusNames[target]}.`;
}

const localTimestamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const localClock = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function utcTooltip(timestamp: string) {
  return `UTC ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp))}`;
}

function Timestamp({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const date = new Date(value);
  return (
    <time className="mono-text" dateTime={value} title={utcTooltip(value)}>
      {dateOnly ? localTimestamp.format(date) : localClock.format(date)}
    </time>
  );
}

function createInitialAudit(incident: IncidentSummary): AuditEntry[] {
  const entries: AuditEntry[] = [
    {
      id: `${incident.id}-created`,
      timestamp: incident.created_at,
      actor: "AlertEye",
      action: "created candidate event",
      detail: incident.type,
    },
    {
      id: `${incident.id}-evidence`,
      timestamp: incident.created_at,
      actor: "System",
      action: "attached an evidence reference",
      detail: incident.source_name,
    },
  ];
  if (incident.owner_name) {
    entries.push({
      id: `${incident.id}-assigned`,
      timestamp: incident.created_at,
      actor: "Alex Morgan",
      action: "assigned the incident",
      detail: incident.owner_name,
    });
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function IncidentDetailSkeleton() {
  return (
    <div className="incident-detail-layout" aria-label="Loading incident">
      <div className="incident-detail-main">
        <section className="detail-skeleton-panel">
          <Skeleton width="160px" height="14px" />
          <Skeleton width="60%" height="28px" />
          <Skeleton width="80%" height="14px" />
        </section>
        <section className="detail-skeleton-panel detail-skeleton-panel--evidence">
          <Skeleton width="120px" height="18px" />
          <Skeleton width="100%" height="210px" />
          <Skeleton width="65%" height="14px" />
        </section>
        <section className="detail-skeleton-panel">
          <Skeleton width="180px" height="18px" />
          <Skeleton width="90%" height="14px" />
          <Skeleton width="75%" height="14px" />
          <Skeleton width="80%" height="14px" />
        </section>
        <section className="detail-skeleton-panel detail-skeleton-panel--timeline">
          <Skeleton width="140px" height="18px" />
          <Skeleton width="100%" height="170px" />
        </section>
      </div>
      <div className="incident-detail-sidebar">
        <section className="detail-skeleton-panel">
          <Skeleton width="120px" height="18px" />
          <Skeleton width="100%" height="170px" />
        </section>
        <section className="detail-skeleton-panel">
          <Skeleton width="110px" height="18px" />
          <Skeleton width="100%" height="190px" />
        </section>
      </div>
    </div>
  );
}

function PriorityChip({ priority, reason }: { priority: IncidentSummary["priority"]; reason: string }) {
  return (
    <span className={`priority-chip priority-chip--${priority}`} title={reason} aria-label={`${priority} priority. ${reason}`}>
      <span aria-hidden="true" />
      {priority[0].toUpperCase() + priority.slice(1)}
    </span>
  );
}

function IncidentHeader({
  incident,
  updatedAt,
}: {
  incident: IncidentSummary;
  updatedAt: string;
}) {
  return (
    <section className="detail-incident-header">
      <div className="detail-incident-header__top">
        <span className="detail-incident-id mono-text">{incident.id}</span>
        <div className="detail-incident-header__badges">
          <Badge variant={incident.status}>{statusNames[incident.status]}</Badge>
          <PriorityChip priority={incident.priority} reason={incident.priority_reason} />
        </div>
      </div>
      <h1>{incident.type}</h1>
      <div className="detail-incident-subline">
        <span>{incident.site_name}</span>
        <span aria-hidden="true">·</span>
        <span>{incident.source_name}</span>
        <span aria-hidden="true">·</span>
        <Timestamp value={incident.created_at} />
        <span aria-hidden="true">·</span>
        <span>{incident.owner_name ?? "Unassigned"}</span>
      </div>
      <div className="detail-updated">Updated <Timestamp value={updatedAt} /></div>
    </section>
  );
}

function PanelHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="detail-panel-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function EvidencePanel({
  incident,
  onOpen,
}: {
  incident: IncidentSummary;
  onOpen: () => void;
}) {
  return (
    <section className="detail-panel evidence-panel">
      <PanelHeading title="Evidence" description="Authorized evidence preview" />
      <div className="evidence-placeholder">
        <div className="evidence-placeholder__icon"><LockKeyhole size={20} aria-hidden="true" /></div>
        <strong>Evidence preview unavailable</strong>
        <p>Evidence is shown only after access is authorized.</p>
        <Button variant="secondary" size="sm" onClick={onOpen}>
          <FileVideo2 size={15} aria-hidden="true" />
          Open evidence
        </Button>
      </div>
      <p className="evidence-upload-note">Evidence uploads up to 250 MB.</p>
      <dl className="evidence-metadata">
        <div><dt>Timestamp</dt><dd><Timestamp value={incident.created_at} /></dd></div>
        <div><dt>Source</dt><dd>{incident.source_name}</dd></div>
        <div><dt>Triggered rule</dt><dd>Perimeter access policy</dd></div>
      </dl>
    </section>
  );
}

function RuleExplanation({ incident }: { incident: IncidentSummary }) {
  const conditions = incident.priority_reason
    .split(/\s*\+\s*/)
    .map((condition) => condition.trim())
    .filter((condition) => Boolean(condition) && !/^persistence\s/i.test(condition));
  const persistence = incident.priority_reason.match(/persistence\s+(\d+)s/i)?.[1] ?? "12";

  return (
    <section className="detail-panel rule-panel">
      <PanelHeading title="Why this was flagged" description="Rule explanation" />
      <ul className="rule-list">
        <li><span>Zone</span><strong>{incident.site_name} · Restricted zone</strong></li>
        {conditions.map((condition) => <li key={condition}><span>Condition</span><strong>{condition}</strong></li>)}
        <li><span>Persistence</span><strong>{persistence} seconds</strong></li>
        <li><span>Cooldown</span><strong>60 seconds</strong></li>
      </ul>
      <p className="rule-disclaimer">
        <Info size={15} aria-hidden="true" />
        Priority is rule-based, shown separately from any model output.
      </p>
    </section>
  );
}

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="detail-panel audit-panel">
      <PanelHeading title="Activity / Audit trail" description="Views, exports, notes, and status changes" />
      {entries.length === 0 ? (
        <p className="detail-muted">No activity recorded yet.</p>
      ) : (
        <ol className="audit-timeline">
          {entries.map((entry) => (
            <li className="audit-timeline__item" key={entry.id}>
              <span className="audit-timeline__dot" aria-hidden="true" />
              <div className="audit-timeline__content">
                <p><strong>{entry.actor}</strong> {entry.action}</p>
                {entry.detail && <span>{entry.detail}</span>}
                <Timestamp value={entry.timestamp} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RelatedEvents({
  incident,
  items,
  search,
}: {
  incident: IncidentSummary;
  items: IncidentSummary[];
  search: string;
}) {
  const related = incident.duplicate_group_id
    ? items.filter((item) => item.duplicate_group_id === incident.duplicate_group_id && item.id !== incident.id)
    : [];
  const groupCount = incident.related_event_count ?? (related.length + 1);
  return (
    <section className="detail-panel related-panel">
      <PanelHeading title={`Grouped events (${groupCount})`} description="Deduplicated candidate events" />
      {related.length === 0 ? (
        <p className="detail-muted">No related events are grouped with this incident.</p>
      ) : (
        <ul className="related-event-list">
          {related.map((item) => (
            <li key={item.id}>
              <Link to={`/incidents/${encodeURIComponent(item.id)}${search}`}>
                <span className="mono-text">{item.id}</span>
                <span>{item.type}</span>
                <Timestamp value={item.created_at} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IncidentActions({
  incident,
  ownerDraft,
  setOwnerDraft,
  statusDraft,
  setStatusDraft,
  reviewDraft,
  setReviewDraft,
  onAssign,
  onTransition,
  onReview,
  onNote,
  onExport,
}: {
  incident: IncidentSummary;
  ownerDraft: string;
  setOwnerDraft: (owner: string) => void;
  statusDraft: IncidentStatus;
  setStatusDraft: (status: IncidentStatus) => void;
  reviewDraft: ReviewLabel | "";
  setReviewDraft: (label: ReviewLabel | "") => void;
  onAssign: () => void;
  onTransition: (status: IncidentStatus) => void;
  onReview: () => void;
  onNote: (note: string) => void;
  onExport: () => void;
}) {
  const transitions = allowedIncidentTransitions[incident.status];
  const transitionHint = transitions.length
    ? `Allowed next: ${transitions.map((status) => statusNames[status]).join(", ")}. Other transitions are disabled until this step is complete.`
    : "This incident is closed; no further status transitions are available.";
  const [note, setNote] = useState("");

  const quickActions: { status: IncidentStatus; label: string }[] = [
    { status: "acknowledged", label: "Acknowledge" },
    { status: "escalated", label: "Escalate" },
    { status: "resolved", label: "Resolve" },
    { status: "closed", label: "Close" },
  ];

  return (
    <section className="detail-panel actions-panel">
      <PanelHeading title="Actions" description="Operator-confirmed changes" />
      <div className="detail-action-group">
        <Field label="Assign owner" id="detail-owner">
          <div className="detail-control-row">
            <Select id="detail-owner" value={ownerDraft} onChange={(event) => setOwnerDraft(event.currentTarget.value)}>
              <option value="">Unassigned</option>
              {owners.map((owner) => <option value={owner} key={owner}>{owner}</option>)}
            </Select>
            <Button
              variant="secondary"
              size="sm"
              disabled={!ownerDraft || ownerDraft === incident.owner_name}
              onClick={onAssign}
            >
              Assign
            </Button>
          </div>
        </Field>
      </div>

      <div className="detail-action-group">
        <Field label="Change status" id="detail-status">
          <Select
            id="detail-status"
            value={statusDraft}
            aria-describedby="transition-hint"
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isIncidentStatus(value)) setStatusDraft(value);
            }}
          >
            {incidentStatuses.map((status) => {
              const allowed = transitions.includes(status);
              const reason = allowed ? "" : transitionDisabledReason(incident.status, status);
              return (
                <option key={status} value={status} disabled={!allowed} title={reason}>
                  {statusNames[status]}{status === incident.status ? " (current)" : ""}
                </option>
              );
            })}
          </Select>
          <span className="transition-hint" id="transition-hint">{transitionHint}</span>
          <Button
            className="detail-action-full"
            variant="secondary"
            size="sm"
            disabled={!transitions.includes(statusDraft)}
            onClick={() => onTransition(statusDraft)}
          >
            Change status
          </Button>
        </Field>
      </div>

      <div className="detail-action-group">
        <Field label="Review label" id="detail-review">
          <div className="detail-control-row">
            <Select
              id="detail-review"
              value={reviewDraft}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isReviewValue(value)) setReviewDraft(value);
              }}
            >
              {reviewOptions.map(({ value, label }) => <option value={value} key={value || "none"}>{label}</option>)}
            </Select>
            <Button
              variant="secondary"
              size="sm"
              disabled={reviewDraft === (incident.review_label ?? "")}
              onClick={onReview}
            >
              Save
            </Button>
          </div>
        </Field>
      </div>

      <div className="quick-actions" role="group" aria-label="Incident actions">
        {quickActions.map(({ status, label }) => {
          const enabled = transitions.includes(status);
          const disabledReason = enabled ? "" : transitionDisabledReason(incident.status, status);
          return (
            <span className="quick-action-tooltip" title={disabledReason} key={status}>
              <Button
                variant={status === "closed" ? "danger" : "secondary"}
                size="sm"
                disabled={!enabled}
                aria-label={enabled ? label : `${label} unavailable. ${disabledReason}`}
                onClick={() => onTransition(status)}
              >
                {label}
              </Button>
            </span>
          );
        })}
      </div>

      <div className="detail-action-group detail-note-group">
        <label className="field__label" htmlFor="detail-note">Add note</label>
        <Textarea id="detail-note" rows={3} value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder="Add an operational note…" />
        <Button
          variant="secondary"
          size="sm"
          disabled={!note.trim()}
          onClick={() => {
            onNote(note.trim());
            setNote("");
          }}
        >
          <MessageSquareText size={14} aria-hidden="true" />Save note
        </Button>
      </div>

      <div className="detail-export">
        <Button variant="secondary" className="detail-action-full" onClick={onExport}>
          <Download size={15} aria-hidden="true" />Export incident report (CSV)
        </Button>
      </div>
    </section>
  );
}

export function IncidentDetailPage() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const backToList = `/incidents${search}`;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [incident, setIncident] = useState<IncidentSummary | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<IncidentStatus>("new");
  const [reviewDraft, setReviewDraft] = useState<ReviewLabel | "">("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);

  useEffect(() => {
    setLoadState("loading");
    setPendingAction(null);
    setEvidenceDialogOpen(false);
    const timer = window.setTimeout(() => {
      const record = getMockIncidentStore().find((item) => item.id === decodeURIComponent(id));
      if (!record) {
        setIncident(null);
        setLoadState("not-found");
        return;
      }
      setIncident(record);
      setOwnerDraft(record.owner_name ?? "");
      setStatusDraft(record.status);
      setReviewDraft(record.review_label ?? "");
      setReviewer(record.review_label ? "Jordan Lee" : null);
      setUpdatedAt(record.updated_at ?? record.created_at);
      setAuditTrail(createInitialAudit(record));
      setLoadState("ready");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [id]);

  const relatedItems = useMemo(() => getMockIncidentStore(), [incident]);

  if (loadState === "loading") {
    return <IncidentDetailSkeleton />;
  }

  if (loadState === "permission-denied") {
    return (
      <div className="incident-access-denied">
        <p>You don&apos;t have access to this incident.</p>
        <Link className="button button--secondary button--sm" to={backToList}>
          <ArrowLeft size={14} aria-hidden="true" />Back to incidents
        </Link>
      </div>
    );
  }

  if (loadState === "not-found" || !incident) {
    return (
      <EmptyState
        icon={<ShieldAlert size={20} strokeWidth={1.5} />}
        title="Incident not found"
        description="This incident is not available in the prototype data."
        action={<Link className="button button--secondary button--sm" to={backToList}><ArrowLeft size={14} aria-hidden="true" />Back to incidents</Link>}
      />
    );
  }

  const allowed = allowedIncidentTransitions[incident.status];
  const persistence = incident.priority_reason.match(/persistence\s+(\d+)s/i)?.[1] ?? "12";

  const appendAudit = (action: string, detail?: string, timestamp = new Date().toISOString()) => {
    setAuditTrail((current) => [
      { id: `${timestamp}-${action}`, timestamp, actor: "Alex Morgan", action, detail },
      ...current,
    ]);
    setUpdatedAt(timestamp);
    updateMockIncidentStore((items) => items.map((item) =>
      item.id === incident.id ? { ...item, updated_at: timestamp } : item,
    ));
  };

  const commitIncident = (next: IncidentSummary) => {
    setIncident(next);
    updateMockIncidentStore((items) => items.map((item) => item.id === next.id ? next : item));
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "assign") {
      const timestamp = new Date().toISOString();
      const next = { ...incident, owner_name: pendingAction.owner };
      commitIncident(next);
      setOwnerDraft(pendingAction.owner);
      appendAudit("assigned the incident", pendingAction.owner, timestamp);
    } else if (pendingAction.kind === "status") {
      if (!allowed.includes(pendingAction.status)) {
        setPendingAction(null);
        return;
      }
      const timestamp = new Date().toISOString();
      const previous = statusNames[incident.status];
      const next = { ...incident, status: pendingAction.status };
      commitIncident(next);
      setStatusDraft(pendingAction.status);
      appendAudit(`changed status from ${previous} to ${statusNames[pendingAction.status]}`, undefined, timestamp);
    } else if (pendingAction.kind === "review") {
      const timestamp = new Date().toISOString();
      const next = { ...incident, review_label: pendingAction.label };
      commitIncident(next);
      setReviewDraft(pendingAction.label ?? "");
      setReviewer("Alex Morgan");
      appendAudit("updated the reviewed label", pendingAction.label ? reviewNames[pendingAction.label] : "No label", timestamp);
    } else {
      exportIncident(incident);
      appendAudit("exported the incident report", "CSV");
    }
    setPendingAction(null);
  };

  const requestEvidence = () => {
    setEvidenceDialogOpen(true);
    appendAudit("opened the evidence placeholder", "The media endpoint was not called; no footage was loaded or cached.");
  };

  const saveNote = (note: string) => {
    appendAudit("added an incident note", note);
  };

  const confirmationTitle = pendingAction?.kind === "assign"
    ? `Assign ${incident.id} to ${pendingAction.owner}?`
    : pendingAction?.kind === "status"
      ? `Change status to ${statusNames[pendingAction.status]}?`
      : pendingAction?.kind === "review"
        ? "Save reviewed label?"
        : "Export incident report?";
  const confirmationText = pendingAction?.kind === "assign"
    ? "This owner assignment will be recorded in the audit trail."
    : pendingAction?.kind === "status"
      ? `The incident will move from ${statusNames[incident.status]} to ${statusNames[pendingAction.status]}.`
      : pendingAction?.kind === "review"
        ? `The reviewed label will be set to ${pendingAction.label ? reviewNames[pendingAction.label] : "No label"}.`
        : "A CSV report containing this incident's operational details will be downloaded.";

  return (
    <div className="incident-detail-page">
      <div className="detail-topline">
        <Link className="detail-back-link" to={backToList}><ArrowLeft size={15} aria-hidden="true" />Incidents</Link>
        <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
      </div>
      <div className="human-review-banner" role="note">
        <ShieldAlert size={16} aria-hidden="true" />
        <span>A human operator must confirm before any consequential action. AlertEye does not make autonomous security decisions.</span>
      </div>
      <div className="incident-detail-layout">
        <div className="incident-detail-main">
          <IncidentHeader incident={incident} updatedAt={updatedAt} />
          <EvidencePanel incident={incident} onOpen={requestEvidence} />
          <RuleExplanation incident={incident} />
          <AuditTimeline entries={auditTrail} />
          <RelatedEvents incident={incident} items={relatedItems} search={search} />
        </div>
        <aside className="incident-detail-sidebar">
          <IncidentActions
            incident={incident}
            ownerDraft={ownerDraft}
            setOwnerDraft={setOwnerDraft}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            reviewDraft={reviewDraft}
            setReviewDraft={setReviewDraft}
            onAssign={() => ownerDraft && setPendingAction({ kind: "assign", owner: ownerDraft })}
            onTransition={(status) => setPendingAction({ kind: "status", status })}
            onReview={() => setPendingAction({ kind: "review", label: reviewDraft || null })}
            onNote={saveNote}
            onExport={() => setPendingAction({ kind: "export" })}
          />
          <section className="detail-panel facts-panel">
            <PanelHeading title="Incident facts" />
            <dl className="incident-facts">
              <div><dt>Site</dt><dd>{incident.site_name}</dd></div>
              <div><dt>Source</dt><dd>{incident.source_name}</dd></div>
              <div><dt>Type</dt><dd>{incident.type}</dd></div>
              <div><dt>Created</dt><dd><Timestamp value={incident.created_at} dateOnly /></dd></div>
              <div><dt>Updated</dt><dd><Timestamp value={updatedAt} dateOnly /></dd></div>
              <div><dt>Owner</dt><dd>{incident.owner_name ?? "Unassigned"}</dd></div>
              <div><dt>Reviewer</dt><dd>{reviewer ?? "—"}</dd></div>
              <div><dt>Persistence / cooldown</dt><dd>{persistence}s / 60s</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <Modal
        open={pendingAction !== null}
        title={confirmationTitle ?? "Confirm action"}
        onClose={() => setPendingAction(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingAction(null)}>Cancel</Button>
            <Button
              variant={pendingAction?.kind === "status" && pendingAction.status === "closed" ? "danger" : "primary"}
              onClick={confirmPendingAction}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="incident-modal-copy">{confirmationText}</p>
      </Modal>

      <Modal
        open={evidenceDialogOpen}
        title="Evidence access"
        onClose={() => setEvidenceDialogOpen(false)}
        footer={<Button variant="secondary" onClick={() => setEvidenceDialogOpen(false)}>Close</Button>}
      >
        <div className="evidence-access-message" role="status">
          <LockKeyhole size={18} aria-hidden="true" />
          <p>Evidence access is not connected in this prototype. The media endpoint was not called, and no footage was loaded or cached.</p>
        </div>
      </Modal>
    </div>
  );
}

function exportIncident(incident: IncidentSummary) {
  const rows = [
    ["ID", incident.id],
    ["Type", incident.type],
    ["Status", statusNames[incident.status]],
    ["Priority", incident.priority],
    ["Priority reason", incident.priority_reason],
    ["Site", incident.site_name],
    ["Source", incident.source_name],
    ["Created (UTC)", incident.created_at],
    ["Owner", incident.owner_name ?? ""],
    ["Review label", incident.review_label ? reviewNames[incident.review_label] : ""],
  ];
  const csv = rows.map(([key, value]) => `"${key}","${value.replace(/"/g, '""')}"`).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${incident.id}-report.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

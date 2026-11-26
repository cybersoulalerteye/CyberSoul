import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, ClipboardList, Clock3, FileUp, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button, EmptyState, Field, Input, Select, Textarea } from "../components/ui";
import { initialSites } from "../data/sourcesMock";
import {
  approvedEventTypes,
  initialRules,
  type RuleEventType,
  type RulePriority,
  type RuleRecord,
  type ZoneSensitivity,
} from "../data/rulesMock";

type RuleDraft = Omit<RuleRecord, "id" | "priority" | "priority_reason" | "enabled" | "updated_at">;
type AuditEntry = { id: string; timestamp: string; actor: string; action: string; detail: string };

const numberFormat = new Intl.NumberFormat("en-US");
const localTimestamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const utcTimestamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const defaultZone = JSON.stringify({
  type: "Polygon",
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
}, null, 2);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.length >= 2 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

function validateZoneJson(value: string) {
  if (!value.trim()) return "A valid polygon is required for restricted-zone intrusion.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return "Enter valid JSON for the zone polygon.";
  }
  if (!isRecord(parsed)) return "Zone JSON must be a GeoJSON Polygon or Feature.";
  const geometry = parsed.type === "Feature" ? parsed.geometry : parsed;
  if (!isRecord(geometry) || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    return "Zone JSON must contain a GeoJSON Polygon.";
  }
  if (geometry.coordinates.length === 0) return "The polygon must include a boundary ring.";
  for (const ring of geometry.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isCoordinate)) {
      return "Each polygon boundary needs at least four coordinate pairs.";
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!isCoordinate(first) || !isCoordinate(last) ||
        first.length !== last.length || !first.every((coordinate, index) => coordinate === last[index])) {
      return "Each polygon boundary must be closed by repeating its first coordinate.";
    }
  }
  return "";
}

function evaluatePriority(draft: Pick<RuleDraft, "zone_sensitivity" | "persistence_s" | "time_window">) {
  const persistence = Number.isFinite(draft.persistence_s) ? draft.persistence_s : null;
  const score =
    Number(draft.zone_sensitivity === "restricted") +
    Number(draft.time_window.enabled) +
    Number(persistence !== null && persistence >= 10);
  const priority: RulePriority = score === 3 ? "high" : score > 0 ? "medium" : "low";
  const zoneLabel = draft.zone_sensitivity === "restricted" ? "restricted zone" : "standard zone";
  const timeLabel = draft.time_window.enabled
    ? `after-hours (${draft.time_window.start}–${draft.time_window.end})`
    : "no time window";
  return {
    priority,
    explanation: `${priority[0].toLocaleUpperCase()}${priority.slice(1)} — ${zoneLabel} + ${timeLabel} + persistence ${persistence === null ? "unset" : `${numberFormat.format(persistence)}s`}.`,
  };
}

function emptyDraft(): RuleDraft {
  return {
    name: "",
    description: "",
    site_id: "all",
    event_type: "Restricted-zone intrusion",
    zone_json: defaultZone,
    zone_sensitivity: "restricted",
    persistence_s: 12,
    cooldown_s: 60,
    time_window: { enabled: true, start: "22:00", end: "06:00" },
  };
}

function draftFromRule(rule: RuleRecord): RuleDraft {
  return {
    name: rule.name,
    description: rule.description,
    site_id: rule.site_id,
    event_type: rule.event_type,
    zone_json: rule.zone_json,
    zone_sensitivity: rule.zone_sensitivity,
    persistence_s: rule.persistence_s,
    cooldown_s: rule.cooldown_s,
    time_window: { ...rule.time_window },
  };
}

function uniqueRuleId(rules: RuleRecord[]) {
  let sequence = 1;
  while (rules.some((rule) => rule.id === `RULE-${String(sequence).padStart(3, "0")}`)) sequence += 1;
  return `RULE-${String(sequence).padStart(3, "0")}`;
}

function PriorityBadge({ priority }: { priority: RulePriority }) {
  const label = `${priority[0].toLocaleUpperCase()}${priority.slice(1)}`;
  return <span className={`rule-priority rule-priority--${priority}`}><span aria-hidden="true" />{label}</span>;
}

function RuleAudit({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="rule-audit content-section" aria-label="Rule activity">
      <div className="section-heading">
        <div><h2>Rule activity</h2><p>Recent rule changes in this session</p></div>
      </div>
      {entries.length === 0 ? (
        <p className="rule-audit__empty">No rule changes recorded in this session.</p>
      ) : (
        <ol className="rule-audit__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="rule-audit__dot" aria-hidden="true" />
              <div>
                <p><strong>{entry.actor}</strong> {entry.action}</p>
                <span>{entry.detail}</span>
                <time dateTime={entry.timestamp} title={`UTC ${utcTimestamp.format(new Date(entry.timestamp))}`}>
                  {localTimestamp.format(new Date(entry.timestamp))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RulesPage() {
  const [rules, setRules] = useState(initialRules);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const auditSequence = useRef(0);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zoneFileRef = useRef<HTMLInputElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const editingRule = rules.find((rule) => rule.id === editingRuleId) ?? null;
  const priorityEvaluation = useMemo(() => evaluatePriority(draft), [draft]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setFormError("");
    setZoneError("");
    requestAnimationFrame(() => lastFocusedElement.current?.focus());
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen, closeEditor]);

  const addAudit = (action: string, detail: string) => {
    const timestamp = new Date().toISOString();
    auditSequence.current += 1;
    setAuditEntries((current) => [
      { id: `${timestamp}-${auditSequence.current}`, timestamp, actor: "Alex Morgan", action, detail },
      ...current,
    ]);
  };

  const openNewRule = (useTemplate = false) => {
    lastFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingRuleId(null);
    setDraft({ ...emptyDraft(), ...(useTemplate ? { name: "Restricted-zone intrusion template" } : {}) });
    setFormError("");
    setZoneError("");
    setEditorOpen(true);
  };

  const openEditRule = (rule: RuleRecord) => {
    lastFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingRuleId(rule.id);
    setDraft(draftFromRule(rule));
    setFormError("");
    setZoneError("");
    setEditorOpen(true);
  };

  function setDraftField<Key extends keyof RuleDraft>(key: Key, value: RuleDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const handleZoneFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setDraft((current) => ({ ...current, zone_json: content }));
      setZoneError(validateZoneJson(content));
    } catch {
      setZoneError("Could not read the selected JSON file.");
    } finally {
      input.value = "";
    }
  };

  const commitRule = (enabled: boolean) => {
    const name = draft.name.trim();
    if (!name) {
      setFormError("Enter a rule name.");
      return;
    }
    if (rules.some((rule) => rule.id !== editingRuleId && rule.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setFormError("A rule with this name already exists.");
      return;
    }
    if (draft.site_id !== "all" && !initialSites.some((site) => site.id === draft.site_id)) {
      setFormError("Select an existing site or All sites.");
      return;
    }
    if (!approvedEventTypes.some((eventType) => eventType === draft.event_type)) {
      setFormError("Choose an approved event type.");
      return;
    }
    if (!Number.isInteger(draft.persistence_s) || draft.persistence_s < 0 ||
        !Number.isInteger(draft.cooldown_s) || draft.cooldown_s < 0) {
      setFormError("Persistence and cooldown must be whole numbers zero or greater.");
      return;
    }
    if (draft.time_window.enabled &&
        (!/^\d{2}:\d{2}$/.test(draft.time_window.start) || !/^\d{2}:\d{2}$/.test(draft.time_window.end))) {
      setFormError("Enter both start and end times for the after-hours window.");
      return;
    }
    if (draft.event_type === "Restricted-zone intrusion") {
      const validation = validateZoneJson(draft.zone_json);
      setZoneError(validation);
      if (validation) {
        setFormError("Correct the zone definition before saving.");
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const nextRule: RuleRecord = {
      ...draft,
      id: editingRuleId ?? uniqueRuleId(rules),
      name,
      description: draft.description.trim(),
      zone_json: draft.zone_json.trim(),
      priority: priorityEvaluation.priority,
      priority_reason: priorityEvaluation.explanation,
      enabled,
      updated_at: timestamp,
    };
    if (editingRuleId) {
      if (!editingRule) {
        setFormError("This rule is no longer available. Close the editor and try again.");
        return;
      }
      setRules((current) => current.map((rule) => rule.id === editingRuleId ? nextRule : rule));
      addAudit("updated a rule", `${name} · ${enabled ? "Active" : "Disabled"}`);
    } else {
      setRules((current) => [...current, nextRule]);
      addAudit("created a rule", `${name} · ${enabled ? "Active" : "Disabled"}`);
    }
    setEditorOpen(false);
    setFormError("");
    setZoneError("");
    requestAnimationFrame(() => lastFocusedElement.current?.focus());
  };

  const saveRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitRule(editingRule?.enabled ?? true);
  };

  const siteName = (siteId: string) => siteId === "all"
    ? "All sites"
    : initialSites.find((site) => site.id === siteId)?.name ?? "Unknown site";

  return (
    <div className="rules-page">
      <div className="page-heading rules-heading">
        <div>
          <h1>Rules</h1>
          <p>Define transparent event triggers and prioritisation.</p>
        </div>
        <div className="rules-heading__actions">
          <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
          <Button variant="primary" onClick={() => openNewRule()}><Plus size={15} aria-hidden="true" />New rule</Button>
        </div>
      </div>

      <div className="rules-intro" role="note">
        <SlidersHorizontal size={17} aria-hidden="true" />
        <p>Rules define when an event becomes an incident and how it is prioritised. Priority factors are shown to operators — not model confidence.</p>
      </div>
      <div className="rules-guardrail" role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <p>Triggers are limited to observable event types: person/vehicle detection, restricted-zone intrusion, loitering, and crowd. Person detection does not imply criminal intent; suspicious behavior or intent inference is not used as a trigger.</p>
      </div>

      <section className="rules-table-panel" aria-label="Configured rules">
        <div className="rules-table-toolbar">
          <div><h2>Configured rules</h2><p>{numberFormat.format(rules.length)} rules in this workspace</p></div>
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={20} strokeWidth={1.5} />}
            title="No rules yet."
            description="Create a rule from the restricted-zone template to get started."
            action={<Button variant="primary" size="sm" onClick={() => openNewRule(true)}><Plus size={14} aria-hidden="true" />Create your first rule</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table rules-table">
              <thead className="table__head">
                <tr>
                  <th scope="col">Rule name</th>
                  <th scope="col">Scope (site)</th>
                  <th scope="col">Event type</th>
                  <th scope="col">Priority</th>
                  <th scope="col">State</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={`rules-table__row${rule.enabled ? "" : " is-disabled"}`}
                    onClick={() => openEditRule(rule)}
                  >
                    <td>
                      <button type="button" className="rule-name-button" onClick={(event) => {
                        event.stopPropagation();
                        openEditRule(rule);
                      }}>
                        {rule.name}
                      </button>
                      <span className="mono-text">{rule.id}</span>
                    </td>
                    <td>{siteName(rule.site_id)}</td>
                    <td>{rule.event_type}</td>
                    <td><PriorityBadge priority={rule.priority} /></td>
                    <td>
                      <span className={`rule-state${rule.enabled ? " rule-state--active" : " rule-state--disabled"}`}
                        title={rule.enabled ? "This rule may trigger incidents when its conditions match." : "Disabled rules never fire."}>
                        <span aria-hidden="true" />{rule.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <time className="rule-updated" dateTime={rule.updated_at} title={`UTC ${utcTimestamp.format(new Date(rule.updated_at))}`}>
                        {localTimestamp.format(new Date(rule.updated_at))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RuleAudit entries={auditEntries} />

      {editorOpen && (
        <div className="rule-drawer-layer">
          <button className="rule-drawer-backdrop" type="button" aria-label="Close rule editor" onClick={closeEditor} />
          <aside ref={drawerRef} className="rule-drawer" role="dialog" aria-modal="true" aria-labelledby="rule-drawer-title">
            <header className="rule-drawer__header">
              <div>
                <p className="rule-drawer__eyebrow">{editingRule ? `Rule ${editingRule.id}` : "Rule configuration"}</p>
                <h2 id="rule-drawer-title">{editingRule ? "Edit rule" : "New rule"}</h2>
              </div>
              <button ref={closeRef} type="button" className="rule-drawer__close" aria-label="Close rule editor" onClick={closeEditor}>
                <X size={17} aria-hidden="true" />
              </button>
            </header>
            <form id="rule-form" className="rule-form" onSubmit={saveRule}>
              <div className="rule-drawer__body">
                <section className="rule-form-section">
                  <div className="rule-form-section__heading"><span>1</span><div><h3>Basics</h3><p>Name the rule and choose its scope.</p></div></div>
                  <Field label="Rule name" id="rule-name">
                    <Input id="rule-name" value={draft.name} onChange={(event) => {
                      setDraftField("name", event.currentTarget.value);
                      setFormError("");
                    }} required maxLength={100} autoComplete="off" />
                  </Field>
                  <Field label="Description" id="rule-description" hint="Optional operational context.">
                    <Textarea id="rule-description" rows={2} value={draft.description} onChange={(event) => setDraftField("description", event.currentTarget.value)} />
                  </Field>
                  <Field label="Scope" id="rule-site">
                    <Select id="rule-site" value={draft.site_id} onChange={(event) => setDraftField("site_id", event.currentTarget.value)}>
                      <option value="all">All sites</option>
                      {initialSites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
                    </Select>
                  </Field>
                </section>

                <section className="rule-form-section">
                  <div className="rule-form-section__heading"><span>2</span><div><h3>Trigger</h3><p>Use an observable event and a defined zone.</p></div></div>
                  <Field label="Event type" id="rule-event-type">
                    <Select id="rule-event-type" value={draft.event_type} onChange={(event) => setDraftField("event_type", event.currentTarget.value as RuleEventType)}>
                      {approvedEventTypes.map((eventType, index) => <option key={eventType} value={eventType}>{index + 1}. {eventType}</option>)}
                    </Select>
                  </Field>
                  <Field label="Zone definition (GeoJSON Polygon)" id="rule-zone" hint="Polygon editor placeholder. Upload GeoJSON or edit the polygon JSON directly.">
                    <Textarea
                      id="rule-zone"
                      rows={5}
                      className="rule-zone-input"
                      value={draft.zone_json}
                      aria-invalid={Boolean(zoneError)}
                      aria-describedby={zoneError ? "rule-zone-error" : undefined}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraftField("zone_json", value);
                        setZoneError("");
                      }}
                    />
                  </Field>
                  <div className="rule-zone-actions">
                    <input ref={zoneFileRef} type="file" accept=".json,application/geo+json,application/json" hidden aria-label="Upload zone GeoJSON file" onChange={handleZoneFile} />
                    <Button variant="secondary" size="sm" onClick={() => zoneFileRef.current?.click()}><FileUp size={14} aria-hidden="true" />Upload JSON</Button>
                    {draft.event_type !== "Restricted-zone intrusion" && <span>Zone is optional for this event type.</span>}
                  </div>
                  {zoneError && <p id="rule-zone-error" className="rule-form-error" role="alert">{zoneError}</p>}
                  <div className="rule-form-grid">
                    <Field label="Persistence (seconds)" id="rule-persistence" hint="Minimum time in zone before creating an incident.">
                      <Input id="rule-persistence" type="number" min={0} step={1} value={Number.isFinite(draft.persistence_s) ? draft.persistence_s : ""} onChange={(event) => setDraftField("persistence_s", Number(event.currentTarget.value))} required />
                    </Field>
                    <Field label="Cooldown (seconds)" id="rule-cooldown" hint="Dedupe window for repeated events.">
                      <Input id="rule-cooldown" type="number" min={0} step={1} value={Number.isFinite(draft.cooldown_s) ? draft.cooldown_s : ""} onChange={(event) => setDraftField("cooldown_s", Number(event.currentTarget.value))} required />
                    </Field>
                  </div>
                </section>

                <section className="rule-form-section">
                  <div className="rule-form-section__heading"><span>3</span><div><h3>Priority factors</h3><p>Each factor contributes to the operator-facing explanation.</p></div></div>
                  <Field label="Zone sensitivity" id="rule-sensitivity">
                    <Select id="rule-sensitivity" value={draft.zone_sensitivity} onChange={(event) => setDraftField("zone_sensitivity", event.currentTarget.value as ZoneSensitivity)}>
                      <option value="restricted">Restricted — higher priority</option>
                      <option value="standard">Standard</option>
                    </Select>
                  </Field>
                  <div className="rule-after-hours">
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={draft.time_window.enabled}
                        onChange={(event) => {
                          const enabled = event.currentTarget.checked;
                          setDraft((current) => ({
                            ...current,
                            time_window: { ...current.time_window, enabled },
                          }));
                        }}
                      />
                      <span>Apply after-hours time window</span>
                    </label>
                    <Clock3 size={15} aria-hidden="true" />
                  </div>
                  <div className="rule-form-grid">
                    <Field label="From" id="rule-window-start">
                      <Input id="rule-window-start" type="time" value={draft.time_window.start} disabled={!draft.time_window.enabled} required={draft.time_window.enabled} onChange={(event) => {
                        const start = event.currentTarget.value;
                        setDraft((current) => ({
                          ...current,
                          time_window: { ...current.time_window, start },
                        }));
                      }} />
                    </Field>
                    <Field label="Until" id="rule-window-end">
                      <Input id="rule-window-end" type="time" value={draft.time_window.end} disabled={!draft.time_window.enabled} required={draft.time_window.enabled} onChange={(event) => {
                        const end = event.currentTarget.value;
                        setDraft((current) => ({
                          ...current,
                          time_window: { ...current.time_window, end },
                        }));
                      }} />
                    </Field>
                  </div>
                  <div className="rule-priority-preview" aria-live="polite">
                    <div><span>Resulting priority</span><PriorityBadge priority={priorityEvaluation.priority} /></div>
                    <p>{priorityEvaluation.explanation}</p>
                  </div>
                </section>

                <section className="rule-form-section rule-review-lock">
                  <div className="rule-form-section__heading"><span>4</span><div><h3>Review requirement</h3><p>Human verification remains mandatory.</p></div></div>
                  <label className="choice">
                    <input type="checkbox" checked disabled readOnly />
                    <span>Human verification required <small>Locked on for every rule</small></span>
                  </label>
                </section>

                {formError && <p className="rule-form-error rule-form-error--summary" role="alert">{formError}</p>}
              </div>
              <footer className="rule-drawer__footer">
                <Button variant="secondary" onClick={closeEditor}>Cancel</Button>
                {editingRule && (
                  <Button variant={editingRule.enabled ? "danger" : "secondary"} type="button" onClick={() => commitRule(!editingRule.enabled)}>
                    {editingRule.enabled ? "Disable rule" : "Enable rule"}
                  </Button>
                )}
                <Button variant="primary" type="submit" form="rule-form">{editingRule ? "Save changes" : "Save rule"}</Button>
              </footer>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

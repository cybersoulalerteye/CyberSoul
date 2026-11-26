import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, EmptyState, Field, Input, Modal, Select, Tabs, Textarea } from "../components/ui";
import {
  initialSites,
  initialSources,
  type IntegrationTestRecord,
  type SiteRecord,
  type SourceKind,
  type SourceProtocol,
  type SourceRecord,
  type SourceStatus,
} from "../data/sourcesMock";

type SiteForm = Omit<SiteRecord, "id" | "active_rules">;
type SourceForm = {
  label: string;
  site_id: string;
  kind: SourceKind;
  make: string;
  model: string;
  protocol: SourceProtocol;
  status: SourceStatus;
  notes: string;
  test_configuration: string;
  tested_by: string;
  tested_at: string;
  test_result: "" | "passed" | "failed";
};
type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
};
type DeleteTarget = { kind: "site" | "source"; id: string } | null;

const sourceKinds: SourceKind[] = ["IP camera", "NVR", "VMS"];
const sourceProtocols: SourceProtocol[] = ["RTSP", "ONVIF", "Vendor API"];
const sourceStatuses: SourceStatus[] = ["planned", "testing", "supported", "unsupported"];
const statusNames: Record<SourceStatus, string> = {
  planned: "Planned",
  testing: "Testing",
  supported: "Supported",
  unsupported: "Unsupported",
};
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

function localDateTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function uniqueId(prefix: string, records: { id: string }[]) {
  let sequence = 1;
  while (records.some((record) => record.id === `${prefix}-${String(sequence).padStart(4, "0")}`)) {
    sequence += 1;
  }
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const explanation = status === "supported"
    ? "Supported means tested against this specific configuration."
    : `${statusNames[status]} configuration status.`;
  return (
    <span
      className={`source-status source-status--${status}`}
      title={explanation}
      aria-label={`${statusNames[status]}. ${explanation}`}
    >
      <span className="source-status__dot" aria-hidden="true" />
      {statusNames[status]}
    </span>
  );
}

function SiteStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`site-status${active ? " site-status--active" : " site-status--inactive"}`}>
      <span aria-hidden="true" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="source-audit content-section" aria-label="Configuration activity">
      <div className="section-heading">
        <div>
          <h2>Configuration activity</h2>
          <p>Recent site and source changes</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="source-audit__empty">No configuration changes recorded in this session.</p>
      ) : (
        <ol className="source-audit__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="source-audit__dot" aria-hidden="true" />
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

function SiteTable({
  sites,
  sources,
  onEdit,
  onDelete,
  onAdd,
}: {
  sites: SiteRecord[];
  sources: SourceRecord[];
  onEdit: (site: SiteRecord) => void;
  onDelete: (site: SiteRecord) => void;
  onAdd: () => void;
}) {
  return (
    <section className="source-config-panel" aria-label="Sites">
      <div className="source-config-toolbar">
        <div>
          <h2>Sites</h2>
          <p>Manage monitored locations and operating context.</p>
        </div>
        <Button variant="primary" onClick={onAdd}><Plus size={15} aria-hidden="true" />Add site</Button>
      </div>
      {sites.length === 0 ? (
        <EmptyState
          icon={<Plus size={20} strokeWidth={1.5} />}
          title="No sites yet."
          description="Add a site before configuring video sources."
          action={<Button variant="primary" size="sm" onClick={onAdd}><Plus size={14} aria-hidden="true" />Add site</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table sources-table sites-table">
            <thead className="table__head">
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Location</th>
                <th scope="col">Cameras</th>
                <th scope="col">Active rules</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const sourceCount = sources.filter((source) => source.site_id === site.id).length;
                return (
                  <tr key={site.id}>
                    <td><span className="source-primary-text">{site.name}</span><span className="mono-text">{site.id}</span></td>
                    <td>{site.location || "—"}</td>
                    <td>{sourceCount}</td>
                    <td>{site.active_rules}</td>
                    <td><SiteStatusBadge active={site.active} /></td>
                    <td>
                      <div className="source-row-actions">
                        <Button variant="ghost" size="sm" aria-label={`Edit ${site.name}`} title={`Edit ${site.name}`} onClick={() => onEdit(site)}>
                          <Pencil size={14} aria-hidden="true" />Edit
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${site.name}`} title={`Delete ${site.name}`} onClick={() => onDelete(site)}>
                          <Trash2 size={14} aria-hidden="true" />Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SourceTable({
  sites,
  sources,
  onEdit,
  onDelete,
  onAdd,
}: {
  sites: SiteRecord[];
  sources: SourceRecord[];
  onEdit: (source: SourceRecord) => void;
  onDelete: (source: SourceRecord) => void;
  onAdd: () => void;
}) {
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  return (
    <section className="source-config-panel" aria-label="Video sources">
      <div className="source-config-toolbar">
        <div>
          <h2>Sources</h2>
          <p>Configuration references only. No live camera connection is attempted.</p>
        </div>
        <Button variant="primary" disabled={sites.length === 0} title={sites.length === 0 ? "Add a site before creating a source." : undefined} onClick={onAdd}>
          <Plus size={15} aria-hidden="true" />Add source
        </Button>
      </div>
      {sites.length === 0 || sources.length === 0 ? (
        <EmptyState
          icon={<Plus size={20} strokeWidth={1.5} />}
          title="No sources yet."
          description={sites.length === 0 ? "Add a site before configuring sources." : "Add a source to record its configuration."}
          action={sites.length > 0 && <Button variant="primary" size="sm" onClick={onAdd}><Plus size={14} aria-hidden="true" />Add source</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table sources-table">
            <thead className="table__head">
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Site</th>
                <th scope="col">Type</th>
                <th scope="col">Make / model</th>
                <th scope="col">Protocol</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td><span className="source-primary-text">{source.label}</span><span className="mono-text">{source.id}</span></td>
                  <td>{siteNames.get(source.site_id) ?? "Unknown site"}</td>
                  <td>{source.kind}</td>
                  <td>{[source.make, source.model].filter(Boolean).join(" ") || "—"}</td>
                  <td>{source.protocol}</td>
                  <td><SourceStatusBadge status={source.status} /></td>
                  <td>
                    <div className="source-row-actions">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${source.label}`} title={`Edit ${source.label}`} onClick={() => onEdit(source)}>
                        <Pencil size={14} aria-hidden="true" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${source.label}`} title={`Delete ${source.label}`} onClick={() => onDelete(source)}>
                        <Trash2 size={14} aria-hidden="true" />Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CompatibilityMatrix({ sites, sources }: { sites: SiteRecord[]; sources: SourceRecord[] }) {
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  return (
    <section className="source-config-panel compatibility-panel" aria-label="Compatibility matrix">
      <div className="source-config-toolbar">
        <div>
          <h2>Compatibility</h2>
          <p>Configuration matrix and recorded test coverage.</p>
        </div>
      </div>
      <div className="compatibility-boundary" role="note">
        <ClipboardCheck size={16} aria-hidden="true" />
        <p>Only a completed passing test record supports a Supported status. Prototype entries are examples and are not product certification.</p>
      </div>
      {sources.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={20} strokeWidth={1.5} />}
          title="No source configurations to compare."
          description="Add sources to list their compatibility and test-record state."
        />
      ) : (
        <div className="table-wrap">
          <table className="table sources-table compatibility-table">
            <thead className="table__head">
              <tr>
                <th scope="col">Configuration</th>
                <th scope="col">Site</th>
                <th scope="col">Type</th>
                <th scope="col">Protocol</th>
                <th scope="col">Test record</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    <span className="source-primary-text">{source.make} {source.model}</span>
                    <span className="source-source-label">{source.label}</span>
                  </td>
                  <td>{siteNames.get(source.site_id) ?? "Unknown site"}</td>
                  <td>{source.kind}</td>
                  <td>{source.protocol}</td>
                  <td>
                    {source.test_record ? (
                      <span className={`test-record-result${source.test_record.passed ? " is-passed" : " is-failed"}`}>
                        <span aria-hidden="true" />{source.test_record.passed ? "Passed" : "Failed"}
                        <small>{localTimestamp.format(new Date(source.test_record.tested_at))}</small>
                        <small className="compatibility-test-configuration">{source.test_record.configuration}</small>
                      </span>
                    ) : <span className="source-muted">Not recorded</span>}
                  </td>
                  <td><SourceStatusBadge status={source.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SourcesPage() {
  const [sites, setSites] = useState(initialSites);
  const [sources, setSources] = useState(initialSources);
  const [activeTab, setActiveTab] = useState("sites");
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteForm>({
    name: "",
    location: "",
    timezone: "UTC",
    notes: "",
    active: true,
  });
  const [sourceDraft, setSourceDraft] = useState<SourceForm>({
    label: "",
    site_id: initialSites[0]?.id ?? "",
    kind: "IP camera",
    make: "",
    model: "",
    protocol: "RTSP",
    status: "planned",
    notes: "",
    test_configuration: "",
    tested_by: "",
    tested_at: "",
    test_result: "",
  });
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const auditSequence = useRef(0);

  const siteBeingDeleted = deleteTarget?.kind === "site"
    ? sites.find((site) => site.id === deleteTarget.id) ?? null
    : null;
  const sourceBeingDeleted = deleteTarget?.kind === "source"
    ? sources.find((source) => source.id === deleteTarget.id) ?? null
    : null;
  const siteDependencies = useMemo(() => {
    if (!siteBeingDeleted) return { sources: 0, rules: 0 };
    return {
      sources: sources.filter((source) => source.site_id === siteBeingDeleted.id).length,
      rules: siteBeingDeleted.active_rules,
    };
  }, [siteBeingDeleted, sources]);

  const addAudit = (action: string, detail: string) => {
    const timestamp = new Date().toISOString();
    auditSequence.current += 1;
    setAuditEntries((current) => [
      { id: `${timestamp}-${auditSequence.current}`, timestamp, actor: "Alex Morgan", action, detail },
      ...current,
    ]);
  };

  function setSiteField<Key extends keyof SiteForm>(key: Key, value: SiteForm[Key]) {
    setSiteDraft((current) => ({ ...current, [key]: value }));
  }

  function setSourceField<Key extends keyof SourceForm>(key: Key, value: SourceForm[Key]) {
    setSourceDraft((current) => ({ ...current, [key]: value }));
  }

  const openNewSite = () => {
    setEditingSiteId(null);
    setSiteDraft({ name: "", location: "", timezone: "UTC", notes: "", active: true });
    setFormError("");
    setSiteModalOpen(true);
  };

  const openEditSite = (site: SiteRecord) => {
    setEditingSiteId(site.id);
    setSiteDraft({
      name: site.name,
      location: site.location,
      timezone: site.timezone,
      notes: site.notes,
      active: site.active,
    });
    setFormError("");
    setSiteModalOpen(true);
  };

  const saveSite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = siteDraft.name.trim();
    const duplicate = sites.some((site) =>
      site.id !== editingSiteId && site.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      setFormError("A site with this name already exists.");
      return;
    }
    if (editingSiteId) {
      setSites((current) => current.map((site) => site.id === editingSiteId
        ? { ...site, ...siteDraft, name }
        : site));
      addAudit("updated a site", name);
    } else {
      const newSite: SiteRecord = {
        id: uniqueId("SITE", sites),
        ...siteDraft,
        name,
        active_rules: 0,
      };
      setSites((current) => [...current, newSite]);
      addAudit("added a site", name);
    }
    setSiteModalOpen(false);
  };

  const openNewSource = () => {
    setEditingSourceId(null);
    setSourceDraft({
      label: "",
      site_id: sites[0]?.id ?? "",
      kind: "IP camera",
      make: "",
      model: "",
      protocol: "RTSP",
      status: "planned",
      notes: "",
      test_configuration: "",
      tested_by: "",
      tested_at: "",
      test_result: "",
    });
    setFormError("");
    setSourceModalOpen(true);
  };

  const openEditSource = (source: SourceRecord) => {
    const testRecord = source.test_record;
    setEditingSourceId(source.id);
    setSourceDraft({
      label: source.label,
      site_id: source.site_id,
      kind: source.kind,
      make: source.make,
      model: source.model,
      protocol: source.protocol,
      status: source.status,
      notes: source.notes,
      test_configuration: testRecord?.configuration ?? "",
      tested_by: testRecord?.tested_by ?? "",
      tested_at: testRecord ? localDateTimeValue(testRecord.tested_at) : "",
      test_result: testRecord ? (testRecord.passed ? "passed" : "failed") : "",
    });
    setFormError("");
    setSourceModalOpen(true);
  };

  const saveSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = sourceDraft.label.trim();
    if (!sites.some((site) => site.id === sourceDraft.site_id)) {
      setFormError("Select an existing site for this source.");
      return;
    }
    if (sources.some((source) =>
      source.id !== editingSourceId && source.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
    )) {
      setFormError("A source with this label already exists.");
      return;
    }

    const hasAnyTestDetails = Boolean(
      sourceDraft.test_configuration.trim() ||
      sourceDraft.tested_by.trim() ||
      sourceDraft.tested_at ||
      sourceDraft.test_result,
    );
    const hasCompleteTestRecord = Boolean(
      sourceDraft.test_configuration.trim() &&
      sourceDraft.tested_by.trim() &&
      sourceDraft.tested_at &&
      sourceDraft.test_result,
    );
    if ((sourceDraft.status === "supported" || hasAnyTestDetails) && !hasCompleteTestRecord) {
      setFormError("Complete the test configuration, tester, date, and result before saving.");
      return;
    }
    if (sourceDraft.status === "supported" && sourceDraft.test_result !== "passed") {
      setFormError("A source can be marked Supported only with a completed passing integration test.");
      return;
    }

    let testRecord: IntegrationTestRecord | null = null;
    if (hasCompleteTestRecord) {
      const testedDate = new Date(sourceDraft.tested_at);
      if (Number.isNaN(testedDate.getTime())) {
        setFormError("Enter a valid integration test date.");
        return;
      }
      testRecord = {
        configuration: sourceDraft.test_configuration.trim(),
        tested_by: sourceDraft.tested_by.trim(),
        tested_at: testedDate.toISOString(),
        passed: sourceDraft.test_result === "passed",
      };
    }

    const nextSource = {
      label,
      site_id: sourceDraft.site_id,
      kind: sourceDraft.kind,
      make: sourceDraft.make.trim(),
      model: sourceDraft.model.trim(),
      protocol: sourceDraft.protocol,
      status: sourceDraft.status,
      notes: sourceDraft.notes.trim(),
      test_record: testRecord,
    };
    if (editingSourceId) {
      const previous = sources.find((source) => source.id === editingSourceId);
      setSources((current) => current.map((source) => source.id === editingSourceId
        ? { ...source, ...nextSource }
        : source));
      const statusDetail = previous?.status !== nextSource.status
        ? ` (${statusNames[previous?.status ?? "planned"]} → ${statusNames[nextSource.status]})`
        : "";
      addAudit("updated a source", `${label}${statusDetail}`);
    } else {
      const newSource: SourceRecord = {
        id: uniqueId("SRC", sources),
        ...nextSource,
      };
      setSources((current) => [...current, newSource]);
      addAudit("added a source", `${label} · ${statusNames[nextSource.status]}`);
    }
    setSourceModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTarget?.kind === "site") {
      if (!siteBeingDeleted || siteDependencies.sources > 0 || siteDependencies.rules > 0) return;
      setSites((current) => current.filter((site) => site.id !== siteBeingDeleted.id));
      addAudit("deleted a site", siteBeingDeleted.name);
    } else if (deleteTarget?.kind === "source" && sourceBeingDeleted) {
      setSources((current) => current.filter((source) => source.id !== sourceBeingDeleted.id));
      addAudit("deleted a source", sourceBeingDeleted.label);
    }
    setDeleteTarget(null);
  };

  const tabs = [
    { id: "sites", label: "Sites", content: <SiteTable sites={sites} sources={sources} onEdit={openEditSite} onDelete={(site) => setDeleteTarget({ kind: "site", id: site.id })} onAdd={openNewSite} /> },
    { id: "sources", label: "Sources", content: <SourceTable sites={sites} sources={sources} onEdit={openEditSource} onDelete={(source) => setDeleteTarget({ kind: "source", id: source.id })} onAdd={openNewSource} /> },
    { id: "compatibility", label: "Compatibility", content: <CompatibilityMatrix sites={sites} sources={sources} /> },
  ];

  return (
    <div className="sources-page">
      <div className="page-heading sources-heading">
        <div>
          <h1>Sources &amp; Sites</h1>
          <p>Manage monitored locations and recorded source configurations.</p>
        </div>
        <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
      </div>

      <div className="sources-boundary" role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <p>Marking a source as Supported requires a completed integration test. Do not claim RTSP/ONVIF/NVR integration until verified per configuration.</p>
      </div>
      <p className="sources-no-live-note">Configuration only. This screen does not connect to cameras, NVRs, or VMS systems.</p>

      <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} />
      <AuditTimeline entries={auditEntries} />

      <Modal
        open={siteModalOpen}
        title={editingSiteId ? "Edit site" : "Add site"}
        onClose={() => setSiteModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSiteModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="site-form">{editingSiteId ? "Save site" : "Add site"}</Button>
          </>
        }
      >
        <form id="site-form" className="source-form" onSubmit={saveSite}>
          <Field label="Name" id="site-name">
            <Input id="site-name" value={siteDraft.name} onChange={(event) => setSiteField("name", event.currentTarget.value)} required autoFocus />
          </Field>
          <Field label="Address / region" id="site-location">
            <Input id="site-location" value={siteDraft.location} onChange={(event) => setSiteField("location", event.currentTarget.value)} placeholder="e.g. North District" />
          </Field>
          <Field label="Timezone" id="site-timezone">
            <Input id="site-timezone" value={siteDraft.timezone} onChange={(event) => setSiteField("timezone", event.currentTarget.value)} placeholder="e.g. America/Chicago" required />
          </Field>
          <Field label="Notes" id="site-notes">
            <Textarea id="site-notes" rows={3} value={siteDraft.notes} onChange={(event) => setSiteField("notes", event.currentTarget.value)} />
          </Field>
          <Field label="Status" id="site-status">
            <Select id="site-status" value={siteDraft.active ? "active" : "inactive"} onChange={(event) => setSiteField("active", event.currentTarget.value === "active")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          {formError && <p className="source-form-error" role="alert">{formError}</p>}
        </form>
      </Modal>

      <Modal
        open={sourceModalOpen}
        title={editingSourceId ? "Edit source" : "Add source"}
        onClose={() => setSourceModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSourceModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="source-form">{editingSourceId ? "Save source" : "Add source"}</Button>
          </>
        }
      >
        <form id="source-form" className="source-form" onSubmit={saveSource}>
          <Field label="Label" id="source-label">
            <Input id="source-label" value={sourceDraft.label} onChange={(event) => setSourceField("label", event.currentTarget.value)} required autoFocus />
          </Field>
          <Field label="Site" id="source-site">
            <Select id="source-site" value={sourceDraft.site_id} onChange={(event) => setSourceField("site_id", event.currentTarget.value)} required>
              {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
            </Select>
          </Field>
          <Field label="Type" id="source-kind">
            <Select id="source-kind" value={sourceDraft.kind} onChange={(event) => setSourceField("kind", event.currentTarget.value as SourceKind)}>
              {sourceKinds.map((kind) => <option value={kind} key={kind}>{kind}</option>)}
            </Select>
          </Field>
          <div className="source-form__two-column">
            <Field label="Make" id="source-make">
              <Input id="source-make" value={sourceDraft.make} onChange={(event) => setSourceField("make", event.currentTarget.value)} />
            </Field>
            <Field label="Model" id="source-model">
              <Input id="source-model" value={sourceDraft.model} onChange={(event) => setSourceField("model", event.currentTarget.value)} />
            </Field>
          </div>
          <div className="source-form__two-column">
            <Field label="Protocol" id="source-protocol">
              <Select id="source-protocol" value={sourceDraft.protocol} onChange={(event) => setSourceField("protocol", event.currentTarget.value as SourceProtocol)}>
                {sourceProtocols.map((protocol) => <option value={protocol} key={protocol}>{protocol}</option>)}
              </Select>
            </Field>
            <Field label="Status" id="source-status" hint="New sources start as Planned.">
              <Select id="source-status" value={sourceDraft.status} onChange={(event) => {
                setFormError("");
                setSourceField("status", event.currentTarget.value as SourceStatus);
              }}>
                {sourceStatuses.map((status) => <option value={status} key={status}>{statusNames[status]}</option>)}
              </Select>
            </Field>
          </div>
          {sourceDraft.status === "unsupported" && (
            <p className="source-inline-warning" role="note"><AlertTriangle size={14} aria-hidden="true" />This source configuration is marked Unsupported; no connection will be attempted.</p>
          )}
          {sourceDraft.protocol === "Vendor API" && sourceDraft.status !== "supported" && (
            <p className="source-inline-warning" role="note"><AlertTriangle size={14} aria-hidden="true" />Vendor APIs are configuration-specific. No verified integration is claimed for this source.</p>
          )}
          <fieldset className="source-test-record">
            <legend>Integration test record</legend>
            <p>Record the exact configuration and outcome. A passing test is required for Supported status; the API must enforce this rule as well.</p>
            <Field label="Tested configuration" id="source-test-configuration">
              <Input id="source-test-configuration" value={sourceDraft.test_configuration} onChange={(event) => setSourceField("test_configuration", event.currentTarget.value)} placeholder="Model, firmware, protocol options, and environment" />
            </Field>
            <div className="source-form__two-column">
              <Field label="Tested by" id="source-tested-by">
                <Input id="source-tested-by" value={sourceDraft.tested_by} onChange={(event) => setSourceField("tested_by", event.currentTarget.value)} />
              </Field>
              <Field label="Test date" id="source-tested-at">
                <Input id="source-tested-at" type="datetime-local" value={sourceDraft.tested_at} onChange={(event) => setSourceField("tested_at", event.currentTarget.value)} />
              </Field>
            </div>
            <Field label="Test result" id="source-test-result">
              <Select id="source-test-result" value={sourceDraft.test_result} onChange={(event) => setSourceField("test_result", event.currentTarget.value as SourceForm["test_result"])}>
                <option value="">Not recorded</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </Select>
            </Field>
          </fieldset>
          <Field label="Notes" id="source-notes">
            <Textarea id="source-notes" rows={2} value={sourceDraft.notes} onChange={(event) => setSourceField("notes", event.currentTarget.value)} />
          </Field>
          {formError && <p className="source-form-error" role="alert">{formError}</p>}
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title={siteBeingDeleted && (siteDependencies.sources > 0 || siteDependencies.rules > 0)
          ? "Site has dependencies"
          : `Delete ${siteBeingDeleted ? "site" : "source"}?`}
        onClose={() => setDeleteTarget(null)}
        footer={
          siteBeingDeleted && (siteDependencies.sources > 0 || siteDependencies.rules > 0)
            ? <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Close</Button>
            : (
              <>
                <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="danger" onClick={confirmDelete}>Delete</Button>
              </>
            )
        }
      >
        {siteBeingDeleted && (siteDependencies.sources > 0 || siteDependencies.rules > 0) ? (
          <div className="source-delete-warning" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              <strong>{siteBeingDeleted.name}</strong> has {siteDependencies.sources} source{siteDependencies.sources === 1 ? "" : "s"} and {siteDependencies.rules} active rule{siteDependencies.rules === 1 ? "" : "s"}.
              Move or remove these dependencies before deleting the site. No configuration was changed.
            </p>
          </div>
        ) : sourceBeingDeleted ? (
          <p className="source-delete-copy">Delete source <strong>{sourceBeingDeleted.label}</strong>? Its configuration and test record will be removed.</p>
        ) : siteBeingDeleted ? (
          <p className="source-delete-copy">Delete site <strong>{siteBeingDeleted.name}</strong>? This action cannot be undone.</p>
        ) : null}
      </Modal>
    </div>
  );
}

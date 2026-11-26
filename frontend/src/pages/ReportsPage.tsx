import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { Badge, Button, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { mockReportRecords, type ReportRecord } from "../data/reportsMock";

const labels = ["genuine", "false-positive", "duplicate", "uncertain"] as const;
const labelNames: Record<(typeof labels)[number], string> = { genuine: "Genuine", "false-positive": "False positive", duplicate: "Duplicate", uncertain: "Uncertain" };
const statuses = ["new", "assigned", "acknowledged", "investigating", "resolved", "closed"] as const;
const statusNames: Record<(typeof statuses)[number], string> = { new: "New", assigned: "Assigned", acknowledged: "Acknowledged", investigating: "Investigating", resolved: "Resolved", closed: "Closed" };
const sites = ["North Campus", "Harbor Site", "West Yard", "East Annex"];
const isoInput = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const day = 86400000;
const initialTo = new Date();
const initialFrom = new Date(initialTo.getTime() - 30 * day);
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const median = (values: number[]) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; };
const minutes = (value: number | null) => value === null ? null : `${number.format(value)} min`;
const shortDate = (iso: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
const fullDate = (iso: string) => new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type Metric = { label: string; value: string | null; note: string; definition: string };
function MetricCard({ metric }: { metric: Metric }) {
  return <article className="report-metric"><div className="report-metric__label">{metric.label}<span className="report-tooltip" tabIndex={0} aria-label={metric.definition} title={metric.definition}><Info size={14} /></span></div><strong>{metric.value || "Not enough data"}</strong><span className="report-metric__trend">{metric.value ? metric.note : "Required records are missing for this range."}</span></article>;
}

function csv(records: ReportRecord[]) {
  const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = [["Incident ID", "Created", "Site", "Shift", "Type", "Priority", "Status", "Review label", "Owner", "Documented action"], ...records.map((i) => [i.id, i.created_at, i.site_name, i.shift, i.type, i.priority, i.status, i.review_label || "", i.owner_name || "", i.documented_action === null ? "" : i.documented_action ? "Yes" : "No"] )];
  return rows.map((row) => row.map(quote).join(",")).join("\r\n");
}

function downloadCsv(records: ReportRecord[], from: string, to: string, site: string) {
  const blob = new Blob(["\uFEFF", csv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cybersoul-reports-${from || "all"}-to-${to || "all"}${site === "all" ? "" : "-" + site.toLowerCase().replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Quality({ records }: { records: ReportRecord[] }) {
  const buckets = new Map<string, Record<(typeof labels)[number], number>>();
  records.filter((i) => i.review_label).forEach((i) => {
    const d = new Date(i.created_at);
    const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    const count = buckets.get(key) || { genuine: 0, "false-positive": 0, duplicate: 0, uncertain: 0 };
    if (i.review_label) count[i.review_label] += 1;
    buckets.set(key, count);
  });
  const rows = [...buckets].slice(-8);
  return <>
    {rows.length ? <div className="report-chart" role="img" aria-label="Stacked bars show review labels by day; a table follows.">{rows.map(([date, counts]) => { const total = labels.reduce((sum, label) => sum + counts[label], 0); return <div className="report-chart__row" key={date}><time>{shortDate(date + "T12:00:00")}</time><div className="report-chart__bar">{labels.map((label) => counts[label] > 0 && <i key={label} className={`quality-segment--${label}`} style={{ width: `${counts[label] / total * 100}%` }} />)}</div><span>{total}</span></div>; })}</div> : <p className="report-muted">Not enough labeled incidents to chart this period.</p>}
    <div className="report-mobile-table"><Table><TableHead><TableRow><TableHeader>Date</TableHeader>{labels.map((l) => <TableHeader key={l}>{labelNames[l]}</TableHeader>)}</TableRow></TableHead><TableBody>{rows.map(([date, counts]) => <TableRow key={date}><TableCell>{shortDate(date + "T12:00:00")}</TableCell>{labels.map((l) => <TableCell key={l}>{counts[l]}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    <div className="report-legend">{labels.map((l) => <span key={l}><i className={`quality-segment--${l}`} />{labelNames[l]}</span>)}</div>
  </>;
}

function Funnel({ records }: { records: ReportRecord[] }) {
  const rows = statuses.map((status) => { const matched = records.filter((i) => i.status === status); return { status, count: matched.length, time: median(matched.map((i) => i.stage_minutes)) }; });
  const max = Math.max(1, ...rows.map((r) => r.count));
  return <><div className="report-funnel">{rows.map((r) => <div className="report-funnel__row" key={r.status}><span>{statusNames[r.status]}</span><div><i style={{ width: `${r.count / max * 100}%` }} /></div><strong>{r.count}</strong><small>{minutes(r.time) || "Not enough data"}</small></div>)}</div><div className="report-mobile-table"><Table><TableHead><TableRow><TableHeader>Stage</TableHeader><TableHeader>Count</TableHeader><TableHeader>Median time</TableHeader></TableRow></TableHead><TableBody>{rows.map((r) => <TableRow key={r.status}><TableCell>{statusNames[r.status]}</TableCell><TableCell>{r.count}</TableCell><TableCell>{minutes(r.time) || "Not enough data"}</TableCell></TableRow>)}</TableBody></Table></div><p className="report-note">Counts show the current stage; times use prototype timing data.</p></>;
}

export function ReportsPage() {
  const [from, setFrom] = useState(isoInput(initialFrom));
  const [to, setTo] = useState(isoInput(initialTo));
  const [site, setSite] = useState("all");
  const records = useMemo(() => mockReportRecords.filter((i) => {
    const created = new Date(i.created_at).getTime();
    return created >= (from ? new Date(`${from}T00:00:00`).getTime() : -Infinity) && created <= (to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity) && (site === "all" || i.site_name === site);
  }), [from, to, site]);
  const metrics = useMemo<Metric[]>(() => {
    const shifts = new Set(records.map((i) => `${i.site_name}:${i.shift}`)).size;
    const days = from && to ? Math.max(1, (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / day + 1) : 30;
    const weeks = days / 7;
    const reviewed = records.filter((i) => i.review_label);
    const owned = records.filter((i) => i.owner_name && i.documented_action !== null);
    const closed = records.filter((i) => ["resolved", "closed"].includes(i.status));
    return [
      { label: "Problem frequency", value: shifts ? `${number.format(records.length / (shifts * weeks))} / site-shift / week` : null, note: `${records.length} incidents across ${shifts} site-shifts`, definition: "Incidents in the selected period divided by distinct site and shift combinations, then divided by weeks. Shifts are Day, Evening, and Night." },
      { label: "Alert burden", value: records.length ? `${records.length} total · ${records.filter((i) => i.duplicate_group_id).length} duplicates · ${records.filter((i) => i.review_label === "false-positive").length} dismissed` : null, note: "Dismissed means labeled false positive.", definition: "Total incidents, incidents in a duplicate group, and incidents labeled false positive in the selected range." },
      { label: "Verification time", value: minutes(median(reviewed.flatMap((i) => i.review_minutes === null ? [] : [i.review_minutes]))), note: "Median from incident creation to first review label.", definition: "Verification time = median time from incident creation to first review label." },
      { label: "Response ownership", value: owned.length ? `${number.format(owned.filter((i) => i.documented_action).length / owned.length * 100)}%` : null, note: "With an owner and documented action.", definition: "Incidents with an assigned owner and documented action divided by records with both fields available." },
      { label: "Closure time", value: minutes(median(closed.flatMap((i) => i.closure_minutes === null ? [] : [i.closure_minutes]))), note: "Median creation to resolution or closure.", definition: "Closure time = median time from incident creation to resolution or closure." },
      { label: "Evidence retrieval time", value: minutes(median(records.flatMap((i) => i.evidence_retrieval_minutes === null ? [] : [i.evidence_retrieval_minutes]))), note: "Median time to retrieve linked evidence.", definition: "Evidence retrieval time = median time to retrieve evidence linked to incidents in the selected range." },
    ];
  }, [records, from, to]);
  const quality = labels.reduce((result, label) => ({ ...result, [label]: records.filter((i) => i.review_label === label).length }), {} as Record<(typeof labels)[number], number>);
  const partial = metrics.some((metric) => metric.value === null);

  return <main className="reports-page">
    <header className="reports-heading page-heading"><div><h1>Reports</h1><p>Operational performance and review labels over time.</p><span className="prototype-badge"><span aria-hidden="true" />Prototype data</span></div><div className="reports-filters"><label><span>From</span><input type="date" aria-label="Start date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label><label><span>To</span><input type="date" aria-label="End date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label><label><span>Site</span><Select aria-label="Site" value={site} onChange={(e) => setSite(e.currentTarget.value)}><option value="all">All sites</option>{sites.map((name) => <option key={name}>{name}</option>)}</Select></label><Button variant="primary" onClick={() => downloadCsv(records, from, to, site)}><Download size={15} />Export CSV</Button></div></header>
    {partial && records.length > 0 && <div className="reports-banner" role="status"><Info size={16} />Some metrics incomplete for this range. Missing values are excluded from calculations.</div>}
    <section className="reports-section" aria-labelledby="operational-heading"><div className="reports-section__heading"><div><h2 id="operational-heading">Operational metrics</h2><p>Open each info icon to see a metric definition.</p></div></div><div className="report-metrics">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div></section>
    <div className="reports-grid"><section className="reports-section report-panel" aria-labelledby="quality-heading"><div className="reports-section__heading"><div><h2 id="quality-heading">Alert quality</h2><p>Review labels in the selected period.</p></div></div><div className="report-quality-summary">{labels.map((label) => <span key={label}><Badge variant={label} /> <strong>{quality[label]}</strong></span>)}</div><Quality records={records} /></section><section className="reports-section report-panel" aria-labelledby="funnel-heading"><div className="reports-section__heading"><div><h2 id="funnel-heading">Response funnel</h2><p>Current stage counts and median stage time.</p></div></div><Funnel records={records} /></section></div>
    <section className="reports-section report-panel report-export" aria-labelledby="export-heading"><div className="reports-section__heading"><div><h2 id="export-heading">Export preview</h2><p>{records.length} incidents · current date and site filters</p></div><Button variant="secondary" size="sm" onClick={() => downloadCsv(records, from, to, site)}><Download size={14} />Download CSV</Button></div>{records.length === 0 ? <EmptyState title="No data for this period" description="Change the date range or site filter to view incidents." /> : <div className="report-table-scroll"><Table className="report-table"><TableHead><TableRow><TableHeader>Incident</TableHeader><TableHeader>Created</TableHeader><TableHeader>Site</TableHeader><TableHeader>Type</TableHeader><TableHeader>Status</TableHeader><TableHeader>Review label</TableHeader><TableHeader>Owner</TableHeader></TableRow></TableHead><TableBody>{records.map((i) => <TableRow key={i.id}><TableCell><span className="mono-text">{i.id}</span></TableCell><TableCell><time dateTime={i.created_at}>{fullDate(i.created_at)}</time></TableCell><TableCell>{i.site_name}</TableCell><TableCell>{i.type}</TableCell><TableCell>{i.status}</TableCell><TableCell>{i.review_label ? labelNames[i.review_label] : "Unlabeled"}</TableCell><TableCell>{i.owner_name || "Unassigned"}</TableCell></TableRow>)}</TableBody></Table></div>}</section>
  </main>;
}

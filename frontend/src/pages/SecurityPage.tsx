import { useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, DataProvenanceBadge, SecurityStatusBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { securityDomains, securityLastReviewed, type SecurityDomain } from "../data/securityMock";

const sections = ["Overview", "Access & Roles", "Authentication", "Encryption", "Footage & Retention", "Audit", "Tenancy", "Integrations", "Compliance", "Incidents"];
const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const relative = (iso: string) => { const elapsed = Math.max(0, Date.now() - new Date(iso).getTime()); const days = Math.floor(elapsed / 86400000); return days ? `${days}d ago` : `${Math.floor(elapsed / 3600000)}h ago`; };
const hrefFor = (domain: SecurityDomain) => `/security?section=${encodeURIComponent(domain.section)}#${domain.key}`;

export function SecurityPage() {
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const configured = securityDomains.filter((d) => d.status === "configured" && d.evidence && d.checked).length;
  const required = securityDomains.filter((d) => d.status === "required").length;
  const open = securityDomains.reduce((sum, d) => sum + d.openItems, 0);
  const lastEvent = useMemo(() => new Date(Date.now() - 4 * 60000).toISOString(), []);
  return <main className="security-page">
    <nav className="security-tabs" aria-label="Security module sections">{sections.map((section, index) => <a key={section} href={index ? `#${section.toLowerCase().replaceAll(/[^a-z]+/g, "-")}` : "#overview"}>{section}</a>)}</nav>
    <header className="security-heading" id="overview"><div><div className="security-title-row"><h1>Security posture</h1><DataProvenanceBadge kind="Mock" /><span className="security-environment">Prototype</span></div><p>Current organisation security controls and open items.</p><span className="security-last-reviewed">Last reviewed: <time dateTime={securityLastReviewed}>{fmt.format(new Date(securityLastReviewed))}</time>{refreshedAt && <span> · Refreshed {fmt.format(new Date(refreshedAt))}</span>}</span></div><Button variant="ghost" onClick={() => setRefreshedAt(new Date().toISOString())}><RefreshCw size={15} />Refresh</Button></header>
    <div className="security-honesty"><ShieldAlert size={18} aria-hidden="true" /><p>This reflects the current implementation. Items marked Required are not yet in place. Production-grade security is required before real customer footage or enterprise deployment.</p></div>
    <section className="security-score-row" aria-label="Security posture summary"><article><span>Controls configured</span><strong>{configured} / {securityDomains.length}</strong></article><article className={required > 0 ? "has-required" : ""}><span>Controls required</span><strong>{required}</strong></article><article><span>Open security items</span><strong>{open}</strong></article><article><span>Last audit event</span><strong>{relative(lastEvent)}</strong><small title={fmt.format(new Date(lastEvent))}>{fmt.format(new Date(lastEvent))}</small></article></section>
    <section className="security-domain-panel" aria-labelledby="security-domains-heading"><div className="security-panel-heading"><div><h2 id="security-domains-heading">Control domains</h2><p>Status reflects available evidence in this prototype. Unknown means it has not been verified.</p></div></div><Table caption="Security control domains and their current status"><TableHead><TableRow><TableHeader>Domain</TableHeader><TableHeader>Status</TableHeader><TableHeader>Owner</TableHeader><TableHeader>Last checked</TableHeader><TableHeader>Action</TableHeader></TableRow></TableHead><TableBody>{securityDomains.map((domain) => <TableRow key={domain.key} id={domain.key}><TableCell><Link className="security-domain-link" to={hrefFor(domain)}>{domain.name}</Link>{domain.evidence && <small className="security-evidence">Evidence: {domain.evidence}</small>}</TableCell><TableCell><SecurityStatusBadge status={domain.status} evidence={domain.evidence} checked={domain.checked} /></TableCell><TableCell>{domain.owner}</TableCell><TableCell>{domain.checked ? fmt.format(new Date(domain.checked)) : "Not verified"}</TableCell><TableCell><Link className="text-link" to={hrefFor(domain)}>Review</Link></TableCell></TableRow>)}</TableBody></Table></section>
    <footer className="security-policy-links"><span>Policy documents</span><a href="/settings#deletion-policy">Retention</a><a href="/settings#deletion-policy">Deletion</a><a href="/settings#deletion-policy">Incident response</a></footer>
  </main>;
}

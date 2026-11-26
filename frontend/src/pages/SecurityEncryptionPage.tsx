import { ArrowLeft, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { DataProvenanceBadge, SecurityStatusBadge } from "../components/ui";
import type { SecurityStatus } from "../data/securityMock";

type Item = { title: string; value: string; status: SecurityStatus; definition: string; checked?: string; evidence?: string; link?: string };
const cards: Item[] = [
  { title: "TLS in transit", value: "Deployment not verified", status: "unknown", definition: "Transport layer encryption for traffic in the active deployment. Certificate details are not displayed.", link: "/security#tls" },
  { title: "Data at rest", value: "Local filesystem · encryption not verified", status: "unknown", definition: "Encryption applied by the storage backend to evidence and application data at rest.", link: "/security#tls" },
  { title: "Secrets management", value: "Environment variables · partial; secret manager not set", status: "required", definition: "Where runtime secrets are stored and how access, rotation, and deployment are managed.", link: "/security#secrets" },
  { title: "Password hashing", value: "Algorithm and backend enforcement not verified", status: "required", definition: "Password hashing algorithm used by the authentication backend. Algorithm details and hashes are not exposed here.", link: "/security/auth" },
];
const hygiene: Item[] = [
  { title: "Secrets kept out of source control", value: "Repository scan and deployment verification not available", status: "unknown", definition: "Checks whether credentials and runtime secrets are excluded from source control and safely injected at runtime.", link: "/security#secrets" },
  { title: "Upload validation and safe storage paths", value: "File type and size validation present; storage path review pending", status: "in-progress", definition: "Evidence uploads validate file type and size; deployment storage path protections need separate verification.", checked: "2026-11-23T10:00:00Z", evidence: "Evidence upload flow validates extension, MIME type, and maximum file size.", link: "/security#upload-validation" },
  { title: "Private evidence access with authentication on every request", value: "Backend authorization not verified", status: "required", definition: "Every evidence read request must require authenticated, site-authorized access.", link: "/security#evidence-access" },
];
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function Definition({ text }: { text: string }) { return <span className="encryption-definition" tabIndex={0} title={text} aria-label={text}><Info size={14} aria-hidden="true" /></span>; }
function EncryptionCard({ item }: { item: Item }) {
  return <article className="encryption-card"><div className="encryption-card__heading"><h2>{item.title}<Definition text={item.definition} /></h2><SecurityStatusBadge status={item.status} evidence={item.evidence} checked={item.checked} /></div><p>{item.value}</p>{item.status === "configured" && item.checked && <small>Verified {dateFormat.format(new Date(item.checked))}</small>}{item.link && <Link className="text-link" to={item.link}>Review control</Link>}</article>;
}

export function SecurityEncryptionPage() {
  return <main className="security-encryption-page"><div className="auth-back"><Link to="/security"><ArrowLeft size={15} aria-hidden="true" />Security overview</Link><DataProvenanceBadge kind="Mock" /></div><header className="page-heading"><div><h1>Encryption &amp; data in transit</h1><p>Transport, storage, and secret management posture.</p></div></header><div className="security-honesty" role="note"><p>This reflects available implementation evidence. Unknown means the current deployment has not been verified.</p></div><section className="encryption-grid" aria-label="Encryption posture cards">{cards.map((item) => <EncryptionCard key={item.title} item={item} />)}</section><section className="auth-card"><div className="auth-section-heading"><div><h2>Hygiene checks</h2><p>Checks and evidence for common security practices.</p></div></div><div className="auth-control-list">{hygiene.map((item) => <div className="auth-control-row" key={item.title}><div className="auth-control-main"><strong>{item.title}<Definition text={item.definition} /></strong><span>{item.value}</span>{item.evidence && <small className="hygiene-evidence">Evidence: {item.evidence}{item.checked && ` Checked ${dateFormat.format(new Date(item.checked))}.`}</small>}</div><SecurityStatusBadge status={item.status} evidence={item.evidence} checked={item.checked} />{item.link && <Link className="text-link" to={item.link}>Evidence</Link>}</div>)}</div></section><aside className="encryption-claim-note"><strong>What we do not claim</strong><p>Do not claim TLS or encryption at rest unless verified for the current deployment.</p></aside></main>;
}

import { useState, type FormEvent } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, DataProvenanceBadge, Field, Input, SecurityStatusBadge } from "../components/ui";
import type { SecurityStatus } from "../data/securityMock";

type AuthControl = { label: string; value: string; status: SecurityStatus; definition: string };
const initialControls: AuthControl[] = [
  { label: "Password hashing", value: "Algorithm not verified", status: "required", definition: "Algorithm used to hash account passwords. No algorithm details are exposed on this page." },
  { label: "Multi-factor authentication", value: "Identity provider not connected", status: "required", definition: "MFA can only be marked configured after a connected identity provider verifies enforcement." },
  { label: "Session timeout", value: "30 minutes", status: "in-progress", definition: "Maximum idle time before the current session expires. Prototype value is not enforced by a backend." },
  { label: "Password policy", value: "Minimum 12 characters; complexity enforcement not verified", status: "required", definition: "Minimum password length and complexity rules enforced during account credential setup." },
  { label: "Failed-login lockout", value: "Threshold and window not verified", status: "required", definition: "Number of failed login attempts and time window before temporary lockout." },
];
const enforcement: AuthControl[] = [
  { label: "Password hashing", value: "Backend verification required", status: "required", definition: "Passwords must be hashed using a reviewed, current password hashing algorithm." },
  { label: "MFA enforcement", value: "Identity provider not connected", status: "required", definition: "A provider link and backend-enforced MFA policy are required before configuration can be confirmed." },
  { label: "Session expiration", value: "UI value only", status: "in-progress", definition: "The configured timeout must be enforced by the authentication backend." },
  { label: "TLS for authentication", value: "Deployment not verified", status: "unknown", definition: "TLS must be verified in the deployed environment for authentication traffic." },
];
const planned = ["Connect a managed identity provider and verify MFA enforcement.", "Verify password hashing and lockout behavior in the authentication backend.", "Enforce session expiration and password policy server-side."];
const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function Definition({ text }: { text: string }) { return <span className="auth-definition" tabIndex={0} title={text} aria-label={text}><Info size={14} aria-hidden="true" /></span>; }

function AuthRow({ control }: { control: AuthControl }) {
  return <div className="auth-control-row"><div className="auth-control-main"><strong>{control.label}<Definition text={control.definition} /></strong><span>{control.value}</span></div><SecurityStatusBadge status={control.status} /></div>;
}

export function SecurityAuthPage() {
  const [timeout, setTimeout] = useState("30");
  const [savedTimeout, setSavedTimeout] = useState("30");
  const [mfaRequested, setMfaRequested] = useState(false);
  const [notice, setNotice] = useState("");
  const [audit, setAudit] = useState<{ time: string; detail: string }[]>([]);
  const saveTimeout = (event: FormEvent) => { event.preventDefault(); setSavedTimeout(timeout); const time = new Date().toISOString(); setAudit([{ time, detail: `Session timeout draft saved as ${timeout} minutes. Backend enforcement remains unverified.` }, ...audit]); setNotice("Session timeout saved for this prototype session. Backend enforcement is not confirmed."); };
  const requestMfa = () => { setMfaRequested(!mfaRequested); const action = !mfaRequested ? "MFA enforcement requested" : "MFA enforcement request cleared"; const time = new Date().toISOString(); setAudit([{ time, detail: `${action}; an identity provider is not connected.` }, ...audit]); setNotice("MFA cannot be configured until an identity provider is connected."); };
  return <main className="security-auth-page">
    <div className="auth-back"><Link to="/security"><ArrowLeft size={15} aria-hidden="true" />Security overview</Link><DataProvenanceBadge kind="Mock" /></div>
    <header className="page-heading"><div><h1>Authentication</h1><p>Authentication controls and their current enforcement status.</p></div></header>
    <div className="auth-boundary" role="note">Password hashing, secrets kept out of source control, and TLS are required before real customer footage. This prototype may not yet meet production requirements.</div>
    <section className="auth-card" aria-labelledby="auth-posture-heading"><div className="auth-section-heading"><div><h2 id="auth-posture-heading">Current posture</h2><p>Values are not proof of backend enforcement.</p></div></div><div className="auth-control-list">{initialControls.map((control) => <AuthRow key={control.label} control={control.label === "Session timeout" ? { ...control, value: `${savedTimeout} minutes` } : control} />)}</div>
      <form className="auth-edit-form" onSubmit={saveTimeout}><Field label="Session timeout (minutes)" id="session-timeout" hint="Prototype preference only; server-side enforcement is not verified."><Input id="session-timeout" type="number" min="1" max="1440" required value={timeout} onChange={(event) => setTimeout(event.target.value)} /></Field><Button variant="primary" type="submit">Save timeout</Button></form>
      <div className="auth-mfa-control"><div><strong>MFA enforcement</strong><p>Requires identity provider configuration. This control cannot establish MFA by itself.</p></div><Button variant="secondary" aria-pressed={mfaRequested} onClick={requestMfa}>{mfaRequested ? "Clear request" : "Request MFA"}</Button><SecurityStatusBadge status="required" /></div>
    </section>
    <section className="auth-card"><div className="auth-section-heading"><div><h2>Enforcement</h2><p>Status is based on available verification, not a UI preference.</p></div></div><div className="auth-control-list">{enforcement.map((control) => <AuthRow key={control.label} control={control} />)}</div></section>
    <section className="auth-card auth-planned"><h2>Planned improvements</h2><span className="auth-planned-tag">Planned</span><p>Production-grade authentication has not yet been established.</p><ul>{planned.map((item) => <li key={item}>{item}</li>)}</ul></section>
    {notice && <p className="auth-save-notice" role="status" aria-live="polite">{notice}</p>}
    {audit.length > 0 && <section className="auth-card"><h2>Recent changes</h2><p>Changes from this session, shown for review.</p><ul className="auth-audit-list">{audit.map((item, index) => <li key={`${item.time}-${index}`}><time dateTime={item.time}>{when.format(new Date(item.time))}</time><span>{item.detail}</span></li>)}</ul></section>}
  </main>;
}

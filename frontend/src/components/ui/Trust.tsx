import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import type { SourceStatus } from "../../data/sourcesMock";

export function EvidenceBoundaryNotice() {
  return <div className="trust-notice trust-notice--info"><Info size={17} aria-hidden="true" /><p>Recorded evidence only. Live camera integration not yet available.</p></div>;
}

export function HumanInLoopBanner() {
  return <div className="trust-notice trust-notice--human"><ShieldCheck size={17} aria-hidden="true" /><p>A human operator confirms consequential actions. No autonomous decisions.</p></div>;
}

export function PriorityExplanation({ reason, factors = [] }: { reason: string; factors?: string[] }) {
  return <div className="priority-explanation"><strong>Rule-based priority</strong><p>{reason}</p>{factors.length > 0 && <ul>{factors.map((factor) => <li key={factor}>{factor}</li>)}</ul>}</div>;
}

export function DataProvenanceBadge({ kind = "Mock" }: { kind?: "Mock" | "Sample" | "Live-tested" }) {
  return <span className={`data-provenance data-provenance--${kind.toLowerCase().replaceAll("-", "")}`} title={`Data provenance: ${kind}`}>{kind}</span>;
}

export function MetricDefinition({ name, value, definition }: { name: string; value: ReactNode; definition: string }) {
  return <div className="metric-definition"><span>{name}<span className="metric-definition__tip" tabIndex={0} title={definition} aria-label={definition}><Info size={14} aria-hidden="true" /></span></span><strong>{value}</strong></div>;
}

const statusText: Record<SourceStatus, string> = { planned: "Planned", testing: "Testing", supported: "Supported", unsupported: "Unsupported" };
export function SourceStatusBadge({ status, hasPassingTest = false }: { status: SourceStatus; hasPassingTest?: boolean }) {
  const supported = status === "supported" && hasPassingTest;
  const label = status === "supported" && !hasPassingTest ? "Testing" : statusText[status];
  return <span className={`trust-source-status trust-source-status--${supported ? "supported" : status}`} title={supported ? "Supported with a passing test record." : status === "supported" ? "A passing test record is required before this source can be shown as supported." : `${label} configuration status.`} aria-label={`${label}${supported ? ", passing test recorded" : ""}`}><i aria-hidden="true" />{label}</span>;
}

export function InlineError({ onRetry }: { onRetry: () => void }) {
  return <div className="trust-error" role="alert"><AlertTriangle size={17} aria-hidden="true" /><span>Something went wrong.</span><Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button></div>;
}

export function ForbiddenState({ message = "You don’t have access to this information." }: { message?: string }) {
  return <div className="trust-forbidden" role="status"><ShieldCheck size={18} aria-hidden="true" /><p>{message}</p></div>;
}

import { useEffect, useState } from "react";
import { FileUp, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import type { IncidentStatus } from "../components/ui";
import {
  Badge,
  EmptyState,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import {
  getMockDashboardSummary,
  type DashboardRange,
  type DashboardSite,
  type DashboardSummary,
} from "../data/dashboardMock";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const percentFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const statusLabels: Record<IncidentStatus, string> = {
  new: "New",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

const statusOrder: IncidentStatus[] = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "escalated",
  "resolved",
  "closed",
];

function isDashboardRange(value: string): value is DashboardRange {
  return value === "today" || value === "7d" || value === "30d";
}

function isDashboardSite(value: string): value is DashboardSite {
  return value === "all" || value === "North Campus" || value === "Harbor Site" || value === "West Yard";
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function DashboardHeader({
  range,
  site,
  onRangeChange,
  onSiteChange,
}: {
  range: DashboardRange;
  site: DashboardSite;
  onRangeChange: (range: DashboardRange) => void;
  onSiteChange: (site: DashboardSite) => void;
}) {
  return (
    <div className="dashboard-heading">
      <div>
        <div className="dashboard-heading__title-row">
          <h1>Dashboard</h1>
          <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
        </div>
        <p>Today’s incident load and response performance.</p>
      </div>
      <div className="dashboard-filters">
        <label>
          <span className="sr-only">Date range</span>
          <Select
            aria-label="Date range"
            value={range}
            onChange={(event) => {
              if (isDashboardRange(event.currentTarget.value)) {
                onRangeChange(event.currentTarget.value);
              }
            }}
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Site</span>
          <Select
            aria-label="Site"
            value={site}
            onChange={(event) => {
              if (isDashboardSite(event.currentTarget.value)) {
                onSiteChange(event.currentTarget.value);
              }
            }}
          >
            <option value="all">All sites</option>
            <option value="North Campus">North Campus</option>
            <option value="Harbor Site">Harbor Site</option>
            <option value="West Yard">West Yard</option>
          </Select>
        </label>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  href,
  delta,
  deltaUnit,
  lowerIsBetter = true,
  note,
  alert = false,
}: {
  label: string;
  value: string;
  href: string;
  delta?: number;
  deltaUnit?: string;
  lowerIsBetter?: boolean;
  note?: string;
  alert?: boolean;
}) {
  const improved = delta !== undefined && (lowerIsBetter ? delta < 0 : delta > 0);
  const deltaText = delta === undefined
    ? note
    : `${delta < 0 ? "↓" : "↑"} ${oneDecimalFormat.format(Math.abs(delta))}${deltaUnit ? ` ${deltaUnit}` : ""} vs prev period`;

  return (
    <Link
      className={`kpi-tile ${alert ? "kpi-tile--alert" : ""}`}
      to={href}
      aria-label={`${label}: ${value}${deltaText ? `, ${deltaText}` : ""}`}
    >
      <span className="kpi-tile__label">{label}</span>
      <strong className="kpi-tile__value">{value}</strong>
      <span className={`kpi-tile__detail ${delta !== undefined ? (improved ? "is-positive" : "is-negative") : alert ? "is-negative" : ""}`}>
        {deltaText}
      </span>
    </Link>
  );
}

function KpiRow({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="dashboard-kpis" aria-label="Key performance indicators">
      <KpiTile
        label="Open incidents"
        value={numberFormat.format(summary.open_incidents)}
        delta={summary.open_incidents_delta}
        href="/incidents?status=open"
      />
      <KpiTile
        label="Avg verification time"
        value={`${oneDecimalFormat.format(summary.avg_verification_min)} min`}
        delta={summary.avg_verification_delta}
        deltaUnit="min"
        href="/reports?metric=verification-time"
      />
      <KpiTile
        label="Alerts dismissed as irrelevant"
        value={`${percentFormat.format(summary.dismissed_pct)}%`}
        note="of total alerts"
        href="/incidents?review=irrelevant"
      />
      <KpiTile
        label="Incidents without owner"
        value={numberFormat.format(summary.unassigned)}
        note={summary.unassigned > 0 ? "Needs assignment" : "All incidents assigned"}
        href="/incidents?owner=unassigned"
        alert={summary.unassigned > 0}
      />
    </section>
  );
}

function IncidentQueue({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="dashboard-panel queue-panel">
      <div className="dashboard-panel__heading">
        <div>
          <h2>Incident Queue Snapshot</h2>
          <p>Latest incidents across monitored sites</p>
        </div>
        <Link className="text-link" to="/incidents">View all</Link>
      </div>
      {summary.latest_incidents.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={20} />}
          title="No incidents yet"
          description="Incidents appear here once evidence is uploaded or events are received."
          action={
            <Link className="button button--secondary button--sm" to="/evidence">
              <FileUp size={14} aria-hidden="true" />
              Upload evidence
            </Link>
          }
        />
      ) : (
        <Table className="queue-table">
          <TableHead>
            <TableRow>
              <TableHeader>Time</TableHeader>
              <TableHeader>Site</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Priority</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.latest_incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell><time className="mono-text" dateTime={incident.timestamp}>{formatTime(incident.timestamp)}</time></TableCell>
                <TableCell>{incident.site}</TableCell>
                <TableCell><Link className="queue-incident-link" to={`/incidents?incident=${encodeURIComponent(incident.id)}`}>{incident.type}<span className="mono-text">{incident.id}</span></Link></TableCell>
                <TableCell><Badge variant={incident.status}>{statusLabels[incident.status]}</Badge></TableCell>
                <TableCell><span className={`priority priority--${incident.priority.toLowerCase()}`}>{incident.priority}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function StatusBreakdown({ summary }: { summary: DashboardSummary }) {
  const total = Object.values(summary.status_breakdown).reduce((sum, count) => sum + count, 0);
  return (
    <section className="dashboard-panel status-panel">
      <div className="dashboard-panel__heading">
        <div>
          <h2>Status Breakdown</h2>
          <p>{numberFormat.format(total)} incidents by current state</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="no-data-note">No data for this period.</p>
      ) : (
        <>
          <div
            className="status-stack"
            role="img"
            aria-label={statusOrder
              .filter((status) => summary.status_breakdown[status] > 0)
              .map((status) => `${statusLabels[status]} ${numberFormat.format(summary.status_breakdown[status])}`)
              .join(", ")}
          >
            {statusOrder.map((status) => {
              const count = summary.status_breakdown[status];
              return count > 0 ? (
                <span
                  className="status-stack__segment"
                  key={status}
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: `var(--status-${status})`,
                  }}
                  title={`${statusLabels[status]}: ${numberFormat.format(count)}`}
                />
              ) : null;
            })}
          </div>
          <ul className="status-legend">
            {statusOrder.map((status) => (
              <li key={status}>
                <span className="status-legend__swatch" style={{ backgroundColor: `var(--status-${status})` }} aria-hidden="true" />
                <span>{statusLabels[status]}</span>
                <strong>{numberFormat.format(summary.status_breakdown[status])}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function AlertQuality({ summary }: { summary: DashboardSummary }) {
  const labels = [
    { key: "genuine", label: "Genuine", value: summary.alert_quality.genuine, color: "var(--label-genuine)" },
    { key: "false-positive", label: "False positive", value: summary.alert_quality.false_positive, color: "var(--label-false-positive)" },
    { key: "duplicate", label: "Duplicate", value: summary.alert_quality.duplicate, color: "var(--label-duplicate)" },
  ];
  const chartDescription = labels
    .map(({ label, value }) => `${label} ${percentFormat.format(value)} percent`)
    .join(", ");

  return (
    <section className="dashboard-panel quality-panel">
      <div className="dashboard-panel__heading">
        <div>
          <h2>Alert Quality <span>(last 7 days)</span></h2>
          <p>Distribution of reviewed alert labels</p>
        </div>
      </div>
      <div className="quality-chart" role="img" aria-label={`Alert quality: ${chartDescription}`}>
        {labels.map(({ key, label, value, color }) => (
          <div className="quality-chart__item" key={key}>
            <div className="quality-chart__value">{percentFormat.format(value)}%</div>
            <div className="quality-chart__track">
              <span style={{ height: `${value}%`, backgroundColor: color }} />
            </div>
            <span className="quality-chart__label">{label}</span>
          </div>
        ))}
      </div>
      <p className="quality-note">Uncertain: {percentFormat.format(summary.alert_quality.uncertain)}% of reviewed alerts.</p>
    </section>
  );
}

function RecentActivity({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="dashboard-panel activity-panel">
      <div className="dashboard-panel__heading">
        <div>
          <h2>Recent Activity</h2>
          <p>Timestamped operational audit trail</p>
        </div>
      </div>
      {summary.activity.length === 0 ? (
        <p className="no-data-note">No data for this period.</p>
      ) : (
        <ol className="activity-feed">
          {summary.activity.map((event) => (
            <li className="activity-feed__item" key={event.id}>
              <time className="activity-feed__time mono-text" dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
              <span className="activity-feed__description"><strong>{event.actor}</strong> {event.action} <span>{event.target}</span></span>
              <span className="activity-feed__site">{event.site}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading dashboard">
      <div className="dashboard-kpis">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton__tile" key={index}>
            <Skeleton width="55%" height="12px" />
            <Skeleton width="40%" height="28px" />
            <Skeleton width="65%" height="12px" />
          </div>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <div className="dashboard-panel dashboard-skeleton__panel"><Skeleton width="34%" height="18px" /><Skeleton width="100%" height="190px" /></div>
        <div className="dashboard-panel dashboard-skeleton__panel"><Skeleton width="46%" height="18px" /><Skeleton width="100%" height="190px" /></div>
      </div>
      <div className="dashboard-panel dashboard-skeleton__panel"><Skeleton width="28%" height="18px" /><Skeleton width="100%" height="180px" /></div>
      <div className="dashboard-panel dashboard-skeleton__panel"><Skeleton width="24%" height="18px" /><Skeleton width="100%" height="220px" /></div>
    </div>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("today");
  const [site, setSite] = useState<DashboardSite>("all");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let active = true;
    setSummary(null);
    const timer = window.setTimeout(() => {
      if (active) setSummary(getMockDashboardSummary(range, site));
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [range, site]);

  return (
    <>
      <div className="dashboard-page-heading">
        <DashboardHeader
          range={range}
          site={site}
          onRangeChange={setRange}
          onSiteChange={setSite}
        />
      </div>
      {summary ? (
        <div className="dashboard-content">
          <KpiRow summary={summary} />
          <div className="dashboard-main-grid">
            <IncidentQueue summary={summary} />
            <StatusBreakdown summary={summary} />
          </div>
          <AlertQuality summary={summary} />
          <RecentActivity summary={summary} />
        </div>
      ) : (
        <div aria-busy="true"><DashboardSkeleton /></div>
      )}
    </>
  );
}

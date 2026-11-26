import { useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ClipboardList, Search } from "lucide-react";
import { AppShell } from "./components/shell/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { EvidencePage } from "./pages/EvidencePage";
import { SourcesPage } from "./pages/SourcesPage";
import { RulesPage } from "./pages/RulesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  Radio,
  Select,
  Skeleton,
  SkeletonRows,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  Toast,
} from "./components/ui";

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

const navPages: Record<string, { title: string; description: string }> = {
  "/evidence": { title: "Evidence", description: "Search and review captured evidence." },
  "/sources": { title: "Sources", description: "Manage cameras and monitored sites." },
  "/rules": { title: "Rules", description: "Configure detection and alerting rules." },
  "/reports": { title: "Reports", description: "Operational trends and activity summaries." },
  "/settings": { title: "Settings", description: "Manage your workspace preferences." },
};

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeading title={title} description={description} />
      <EmptyState
        icon={<Search size={20} strokeWidth={1.5} />}
        title={`No ${title.toLowerCase()} to show`}
        description="When activity is available, it will appear here."
      />
    </>
  );
}

const tabs = [
  { id: "overview", label: "Overview", content: <p className="preview-copy">Tab panels provide a compact way to switch between related views.</p> },
  { id: "activity", label: "Activity", content: <p className="preview-copy">Activity and related records can be shown in this panel.</p> },
];

function ComponentsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  return (
    <>
      <Breadcrumb items={[{ label: "Developer tools" }, { label: "Components" }]} />
      <PageHeading title="Component preview" description="AlertEye interface primitives and design tokens." />
      <div className="component-preview">
        <section className="preview-section">
          <h2>Buttons</h2>
          <div className="preview-row">
            <Button variant="primary">Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
          </div>
        </section>
        <section className="preview-section">
          <h2>Inputs</h2>
          <div className="preview-form-grid">
            <Field label="Search incidents" id="preview-search" hint="Search by ID, source, or keyword.">
              <Input id="preview-search" placeholder="e.g. INC-2048" />
            </Field>
            <Field label="Status" id="preview-status">
              <Select id="preview-status" defaultValue="new">
                <option value="new">New</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </Select>
            </Field>
            <Field label="Notes" id="preview-notes">
              <Textarea id="preview-notes" rows={3} placeholder="Add an operational note…" />
            </Field>
            <div className="choice-stack">
              <Checkbox label="Include resolved incidents" defaultChecked />
              <Radio name="priority" label="Standard priority" defaultChecked />
            </div>
          </div>
        </section>
        <section className="preview-section">
          <h2>Badges</h2>
          <div className="preview-row preview-row--wrap">
            {(["new", "assigned", "acknowledged", "investigating", "escalated", "resolved", "closed"] as const).map((status) => (
              <Badge key={status} variant={status} />
            ))}
            {(["genuine", "false-positive", "duplicate", "uncertain"] as const).map((label) => (
              <Badge key={label} variant={label} />
            ))}
          </div>
        </section>
        <section className="preview-section">
          <h2>Table</h2>
          <Table>
            <TableHead><TableRow><TableHeader>Incident</TableHeader><TableHeader>Source</TableHeader><TableHeader>Status</TableHeader></TableRow></TableHead>
            <TableBody>
              <TableRow><TableCell><span className="incident-title">Perimeter access after hours</span><span className="mono-text">INC-2048</span></TableCell><TableCell>North entrance</TableCell><TableCell><Badge variant="investigating" /></TableCell></TableRow>
              <TableRow><TableCell><span className="incident-title">Unrecognized vehicle</span><span className="mono-text">INC-2047</span></TableCell><TableCell>Loading bay</TableCell><TableCell><Badge variant="new" /></TableCell></TableRow>
            </TableBody>
          </Table>
        </section>
        <section className="preview-section">
          <h2>Tabs</h2>
          <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} />
        </section>
        <section className="preview-section">
          <h2>Avatar, empty state & loading</h2>
          <div className="preview-row">
            <Avatar name="Alex Morgan" size="sm" />
            <Avatar name="Jordan Lee" size="md" />
            <Avatar name="Operations Team" size="lg" />
            <Button variant="secondary" onClick={() => setShowToast(true)}>Show toast</Button>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          </div>
          <div className="preview-inline-empty">
            <EmptyState
              icon={<ClipboardList size={20} strokeWidth={1.5} />}
              title="No saved reports"
              description="Create a report to get started."
              action={<Button variant="primary" size="sm">Create report</Button>}
            />
          </div>
          <div className="preview-loading">
            <Skeleton width="160px" height="20px" />
            <SkeletonRows rows={2} />
          </div>
        </section>
      </div>
      <Modal
        open={modalOpen}
        title="Example modal"
        onClose={() => setModalOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setModalOpen(false)}>Confirm</Button></>}
      >
        <p className="preview-copy">A restrained modal surface with a single subtle elevation and a 480px default width.</p>
      </Modal>
      {showToast && <div className="toast-container"><Toast>Changes saved successfully.</Toast><button className="toast-dismiss" onClick={() => setShowToast(false)} aria-label="Dismiss notification">Dismiss</button></div>}
    </>
  );
}

function RoutedPage() {
  const { pathname } = useLocation();
  const page = navPages[pathname];
  return page ? <PlaceholderPage {...page} /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="evidence/upload" element={<EvidencePage />} />
        <Route path="evidence" element={<EvidencePage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="dev/components" element={<ComponentsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

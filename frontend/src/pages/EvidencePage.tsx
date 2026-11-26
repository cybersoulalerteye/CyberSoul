import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileVideo2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, EmptyState, Field, Input, Modal, Select, Textarea } from "../components/ui";
import { initialMockEvidence, type EvidenceRecord, type EvidenceStatus } from "../data/evidenceMock";
import { updateMockIncidentStore, type IncidentSummary } from "../data/incidentsMock";

const MAX_FILE_SIZE = 250 * 1024 * 1024;
const allowedExtensions = [".mp4", ".mov", ".webm"];
const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm"];
const evidenceStatuses: EvidenceStatus[] = ["queued", "processing", "ready", "failed"];
const sites = ["North Campus", "Harbor Site", "West Yard", "East Annex"];
const numberFormat = new Intl.NumberFormat("en-US");
const byteFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
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

type UploadContext = {
  site_name: string;
  source_name: string;
  captured_at: string;
  notes: string;
};

function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return typeof value === "string" && evidenceStatuses.includes(value as EvidenceStatus);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${byteFormat.format(bytes / 1024)} KB`;
  return `${byteFormat.format(bytes / (1024 * 1024))} MB`;
}

function statusLabel(status: EvidenceStatus) {
  return status[0].toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`evidence-status evidence-status--${status}`}>
      <span className="evidence-status__dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

function EvidenceTimestamp({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <time className="evidence-time" dateTime={value} title={`UTC ${utcTimestamp.format(date)}`}>
      {localTimestamp.format(date)}
    </time>
  );
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return "File exceeds 250 MB limit.";
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLocaleLowerCase();
  const hasAllowedExtension = allowedExtensions.includes(extension);
  const hasAllowedMime = !file.type || allowedMimeTypes.includes(file.type.toLocaleLowerCase());
  if (!hasAllowedExtension || !hasAllowedMime) {
    return "Unsupported file type. Accepted formats: MP4, MOV, and WebM.";
  }
  return null;
}

function parseUploadResponse(value: unknown, file: File, context: UploadContext): EvidenceRecord {
  const body = asRecord(value);
  if (!body || typeof body.id !== "string" || !body.id.trim() || !isEvidenceStatus(body.status)) {
    throw new Error("The evidence service returned an invalid upload response.");
  }
  if (body.processing_log !== undefined &&
      (!Array.isArray(body.processing_log) || !body.processing_log.every((entry) => typeof entry === "string"))) {
    throw new Error("The evidence service returned an invalid processing log.");
  }
  return {
    id: body.id,
    file_name: file.name,
    site_name: context.site_name,
    source_name: context.source_name,
    captured_at: context.captured_at,
    uploaded_at: typeof body.uploaded_at === "string" ? body.uploaded_at : new Date().toISOString(),
    notes: context.notes,
    duration_seconds: typeof body.duration_seconds === "number" ? body.duration_seconds : null,
    size_bytes: file.size,
    status: body.status,
    processing_log: body.processing_log as string[] | undefined ?? ["Upload received"],
    linked_incident_id: null,
    preview_url: typeof body.preview_url === "string" ? body.preview_url : undefined,
    error_reason: typeof body.error_reason === "string" ? body.error_reason : undefined,
    retry_supported: body.retry_supported === true,
    origin: "api",
  };
}

function parseDetailResponse(value: unknown, previous: EvidenceRecord): EvidenceRecord {
  const body = asRecord(value);
  if (!body || body.id !== previous.id || !isEvidenceStatus(body.status)) {
    throw new Error("The evidence service returned invalid detail data.");
  }
  if (body.processing_log !== undefined &&
      (!Array.isArray(body.processing_log) || !body.processing_log.every((entry) => typeof entry === "string"))) {
    throw new Error("The evidence service returned an invalid processing log.");
  }
  let linkedIncidentId = previous.linked_incident_id;
  if (body.incidents !== undefined) {
    if (!Array.isArray(body.incidents)) throw new Error("The evidence service returned invalid linked incidents.");
    const linkedIds = body.incidents.map((incident) => {
      if (typeof incident === "string") return incident;
      const item = asRecord(incident);
      if (!item || typeof item.id !== "string") throw new Error("The evidence service returned invalid linked incidents.");
      return item.id;
    });
    linkedIncidentId = linkedIds[0] ?? null;
  }
  return {
    ...previous,
    status: body.status,
    processing_log: body.processing_log as string[] | undefined ?? previous.processing_log,
    linked_incident_id: linkedIncidentId,
    duration_seconds: typeof body.duration_seconds === "number" ? body.duration_seconds : previous.duration_seconds,
    preview_url: typeof body.preview_url === "string" ? body.preview_url : undefined,
    error_reason: typeof body.error_reason === "string" ? body.error_reason : undefined,
    retry_supported: body.retry_supported === true,
  };
}

async function requestEvidenceDetail(item: EvidenceRecord, signal: AbortSignal) {
  const response = await fetch(`/api/evidence/${encodeURIComponent(item.id)}`, { signal });
  if (!response.ok) throw new Error(`Could not load evidence details (HTTP ${response.status}).`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The evidence service returned invalid JSON.");
  }
  return parseDetailResponse(data, item);
}

function getUploadError(xhr: XMLHttpRequest) {
  if (xhr.status === 413) return "File exceeds the server's 250 MB upload limit.";
  if (xhr.status === 0) return "Could not reach the evidence service. Check your connection and try again.";
  try {
    const body = asRecord(JSON.parse(xhr.responseText));
    if (typeof body?.message === "string") return body.message;
  } catch {
    return `Upload failed (HTTP ${xhr.status}).`;
  }
  return `Upload failed (HTTP ${xhr.status}).`;
}

function UploadDropzone({
  file,
  error,
  inputRef,
  onChoose,
  onFile,
}: {
  file: File | null;
  error: string;
  inputRef: RefObject<HTMLInputElement>;
  onChoose: () => void;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChoose();
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        className="evidence-file-input"
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onFile(event.currentTarget.files?.[0])}
      />
      <div
        className={`evidence-dropzone${dragging ? " is-dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Select or drop a video file"
        onClick={onChoose}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const target = event.relatedTarget;
          if (!(target instanceof Node) || !event.currentTarget.contains(target)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="evidence-dropzone__icon"><Upload size={19} aria-hidden="true" /></span>
        <strong>{file ? file.name : "Drop a recorded video here"}</strong>
        <span>{file ? `${formatBytes(file.size)} · Click to replace` : "or click to choose a file"}</span>
      </div>
      <p className="evidence-format-note">Accepted formats: MP4, MOV, WebM. Maximum file size: 250 MB.</p>
      {error && <p className="evidence-inline-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{error}</p>}
    </div>
  );
}

function EvidenceDrawer({
  item,
  loading,
  error,
  onClose,
  onCreateIncident,
  onRetry,
  retrying,
}: {
  item: EvidenceRecord;
  loading: boolean;
  error: string;
  onClose: () => void;
  onCreateIncident: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls]',
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
  }, [onClose]);

  return (
    <div className="evidence-drawer-layer">
      <button className="evidence-drawer-backdrop" type="button" aria-label="Close evidence details" onClick={onClose} />
      <aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-drawer-title">
        <header className="evidence-drawer__header">
          <div>
            <p className="evidence-drawer__eyebrow">Evidence details</p>
            <h2 id="evidence-drawer-title">{item.file_name}</h2>
          </div>
          <button ref={closeRef} type="button" className="evidence-drawer__close" aria-label="Close evidence details" onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="evidence-drawer__body">
          <div className="evidence-drawer__status"><StatusBadge status={item.status} /> <span className="mono-text">{item.id}</span></div>
          {item.status === "ready" && item.preview_url ? (
            <video className="evidence-preview-player" controls preload="metadata" src={item.preview_url}>
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="evidence-preview-placeholder" role="note">
              <LockKeyhole size={19} aria-hidden="true" />
              <strong>{item.status === "ready" ? "Preview unavailable" : "Preview not available yet"}</strong>
              <span>{item.status === "ready" ? "An authorized preview URL was not provided." : "A preview is available after processing is complete."}</span>
            </div>
          )}
          {error && <p className="evidence-inline-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{error}</p>}
          {loading && <p className="evidence-detail-loading">Refreshing evidence details…</p>}
          {item.status === "failed" && (
            <div className="evidence-failure" role="alert">
              <strong>Processing failed</strong>
              <span>{item.error_reason ?? "The evidence file could not be processed."}</span>
              {item.retry_supported && (
                <Button variant="secondary" size="sm" disabled={retrying} onClick={onRetry}>
                  <RotateCcw size={14} aria-hidden="true" />{retrying ? "Retrying…" : "Retry"}
                </Button>
              )}
            </div>
          )}
          <section className="evidence-drawer-section">
            <h3>Metadata</h3>
            <dl className="evidence-detail-facts">
              <div><dt>Site</dt><dd>{item.site_name}</dd></div>
              <div><dt>Source</dt><dd>{item.source_name}</dd></div>
              <div><dt>Duration</dt><dd>{item.duration_seconds === null ? "Not available" : `${numberFormat.format(item.duration_seconds)} sec`}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(item.size_bytes)}</dd></div>
              <div><dt>Captured</dt><dd><EvidenceTimestamp value={item.captured_at} /></dd></div>
              <div><dt>Uploaded</dt><dd><EvidenceTimestamp value={item.uploaded_at} /></dd></div>
              <div><dt>Notes</dt><dd>{item.notes || "—"}</dd></div>
            </dl>
          </section>
          <section className="evidence-drawer-section">
            <h3>Processing log</h3>
            {item.processing_log.length > 0 ? (
              <ol className="evidence-processing-log">
                {item.processing_log.map((entry, index) => <li key={`${item.id}-${index}`}>{entry}</li>)}
              </ol>
            ) : <p className="evidence-muted">No processing activity recorded.</p>}
          </section>
          <section className="evidence-drawer-section">
            <h3>Linked incidents</h3>
            {item.linked_incident_id ? (
              <Link className="evidence-incident-link" to={`/incidents/${encodeURIComponent(item.linked_incident_id)}`} onClick={onClose}>
                {item.linked_incident_id}<ChevronRight size={14} aria-hidden="true" />
              </Link>
            ) : <p className="evidence-muted">No incident linked.</p>}
            <Button
              className="evidence-create-incident"
              variant="secondary"
              size="sm"
              disabled={item.status !== "ready" || Boolean(item.linked_incident_id)}
              title={item.status !== "ready" ? "Available when processing is complete." : undefined}
              onClick={onCreateIncident}
            >
              <Plus size={14} aria-hidden="true" />Create incident from evidence
            </Button>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function EvidencePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const directUploadRoute = location.pathname === "/evidence/upload";
  const [items, setItems] = useState(initialMockEvidence);
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | "">("");
  const [siteFilter, setSiteFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(directUploadRoute);
  const [uploadStep, setUploadStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [site, setSite] = useState(sites[0]);
  const [source, setSource] = useState("");
  const [capturedAt, setCapturedAt] = useState(() => localDateTimeValue(new Date()));
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const filteredItems = useMemo(() => items.filter((item) => (
    (!statusFilter || item.status === statusFilter) &&
    (!siteFilter || item.site_name === siteFilter) &&
    (!dateFilter || item.uploaded_at.slice(0, 10) === dateFilter)
  )), [items, statusFilter, siteFilter, dateFilter]);

  useEffect(() => {
    if (directUploadRoute) setUploadOpen(true);
  }, [directUploadRoute]);

  useEffect(() => {
    if (!selected || selected.origin !== "api") {
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    let refreshing = false;
    let currentStatus = selected.status;
    let interval: number | undefined;
    setDetailLoading(true);
    setDetailError("");
    const stopPolling = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const startPolling = () => {
      if (
        document.visibilityState === "visible" &&
        (currentStatus === "queued" || currentStatus === "processing") &&
        interval === undefined
      ) {
        interval = window.setInterval(() => { void refresh(); }, 3000);
      }
    };
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const updated = await requestEvidenceDetail(selected, controller.signal);
        if (!active) return;
        currentStatus = updated.status;
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
        setDetailError("");
        if (currentStatus === "ready" || currentStatus === "failed") stopPolling();
        else startPolling();
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setDetailError(error instanceof Error ? error.message : "Could not refresh evidence details.");
        }
      } finally {
        refreshing = false;
        if (active) setDetailLoading(false);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") startPolling();
      else stopPolling();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    startPolling();
    void refresh();
    return () => {
      active = false;
      controller.abort();
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [selected?.id, selected?.origin]);

  useEffect(() => () => xhrRef.current?.abort(), []);

  const resetUpload = () => {
    setUploadStep(0);
    setFile(null);
    setFileError("");
    setSite(sites[0]);
    setSource("");
    setCapturedAt(localDateTimeValue(new Date()));
    setNotes("");
    setUploading(false);
    setUploadComplete(false);
    setUploadError("");
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeUpload = () => {
    const request = xhrRef.current;
    xhrRef.current = null;
    if (request) request.abort();
    setUploadOpen(false);
    resetUpload();
    if (directUploadRoute) navigate("/evidence", { replace: true });
  };

  const openUpload = () => {
    resetUpload();
    setUploadOpen(true);
  };

  const chooseFile = () => fileInputRef.current?.click();

  const setSelectedFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    const error = validateFile(nextFile);
    setFileError(error ?? "");
    setFile(error ? null : nextFile);
    setUploadError("");
    setUploadComplete(false);
  };

  const startUpload = () => {
    if (!file || uploading || !capturedAtIsValid) return;
    const context: UploadContext = {
      site_name: site,
      source_name: source.trim(),
      captured_at: new Date(capturedAt).toISOString(),
      notes: notes.trim(),
    };
    const formData = new FormData();
    formData.append("file", file);
    formData.append("site", context.site_name);
    formData.append("source", context.source_name);
    formData.append("captured_at", context.captured_at);
    formData.append("notes", context.notes);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/evidence");
    xhr.responseType = "text";
    xhr.timeout = 120_000;
    setUploading(true);
    setUploadComplete(false);
    setUploadError("");
    setUploadProgress(null);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setUploadProgress({ loaded: event.loaded, total: event.total });
    });
    xhr.addEventListener("load", () => {
      if (xhrRef.current !== xhr) return;
      xhrRef.current = null;
      setUploading(false);
      if (xhr.status < 200 || xhr.status >= 300) {
        setUploadError(getUploadError(xhr));
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        setUploadError("The evidence service returned invalid JSON.");
        return;
      }
      try {
        const uploaded = parseUploadResponse(payload, file, context);
        setItems((current) => [uploaded, ...current]);
        setUploadComplete(true);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Could not read the upload response.");
      }
    });
    xhr.addEventListener("error", () => {
      if (xhrRef.current !== xhr) return;
      xhrRef.current = null;
      setUploading(false);
      setUploadError("Could not reach the evidence service. Check your connection and try again.");
    });
    xhr.addEventListener("timeout", () => {
      if (xhrRef.current !== xhr) return;
      xhrRef.current = null;
      setUploading(false);
      setUploadError("The upload timed out. Check your connection and try again.");
    });
    xhr.addEventListener("abort", () => {
      if (xhrRef.current !== xhr) return;
      xhrRef.current = null;
      setUploading(false);
    });
    xhr.send(formData);
  };

  const openDetails = (item: EvidenceRecord) => {
    setSelectedId(item.id);
    setDetailError("");
  };

  const closeDetails = useCallback(() => setSelectedId(null), []);

  const retryProcessing = async () => {
    if (!selected || !selected.retry_supported || retrying) return;
    setRetrying(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/evidence/${encodeURIComponent(selected.id)}/retry`, { method: "POST" });
      if (!response.ok) throw new Error(`Could not retry processing (HTTP ${response.status}).`);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The evidence service returned invalid JSON.");
      }
      const updated = parseDetailResponse(payload, selected);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Could not retry evidence processing.");
    } finally {
      setRetrying(false);
    }
  };

  const capturedAtIsValid = capturedAt !== "" && !Number.isNaN(new Date(capturedAt).getTime());

  const confirmCreateIncident = () => {
    if (!selected || selected.status !== "ready" || selected.linked_incident_id) return;
    const existing = updateMockIncidentStore((current) => {
      let sequence = 3000;
      while (current.some((item) => item.id === `INC-${String(sequence).padStart(4, "0")}`)) sequence += 1;
      const incident: IncidentSummary = {
        id: `INC-${String(sequence).padStart(4, "0")}`,
        created_at: new Date().toISOString(),
        site_name: selected.site_name,
        source_name: selected.source_name,
        type: `Evidence review: ${selected.file_name}`,
        priority: "medium",
        priority_reason: "Created by an operator from uploaded evidence",
        status: "new",
        review_label: null,
        owner_name: null,
      };
      return [...current, incident];
    });
    const incident = existing[existing.length - 1];
    setItems((current) => current.map((item) =>
      item.id === selected.id ? { ...item, linked_incident_id: incident.id } : item,
    ));
    setCreateIncidentOpen(false);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setSiteFilter("");
    setDateFilter("");
  };

  const uploadFooter = uploadComplete ? (
    <Button variant="primary" onClick={closeUpload}>Done</Button>
  ) : uploading ? (
    <Button variant="secondary" disabled>Uploading…</Button>
  ) : uploadStep === 0 ? (
    <>
      <Button variant="secondary" onClick={closeUpload}>Cancel</Button>
      <Button variant="primary" disabled={!file} onClick={() => setUploadStep(1)}>Continue<ChevronRight size={15} aria-hidden="true" /></Button>
    </>
  ) : uploadStep === 1 ? (
    <>
      <Button variant="secondary" onClick={() => setUploadStep(0)}><ChevronLeft size={15} aria-hidden="true" />Back</Button>
      <Button variant="primary" disabled={!site || !source.trim() || !capturedAtIsValid} onClick={() => setUploadStep(2)}>Review upload<ChevronRight size={15} aria-hidden="true" /></Button>
    </>
  ) : uploadError ? (
    <>
      <Button variant="secondary" onClick={() => setUploadStep(1)}>Back</Button>
      <Button variant="primary" onClick={startUpload}><RotateCcw size={14} aria-hidden="true" />Retry upload</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={() => setUploadStep(1)}>Back</Button>
      <Button variant="primary" onClick={startUpload}><Upload size={15} aria-hidden="true" />Upload evidence</Button>
    </>
  );

  return (
    <div className="evidence-page">
      <div className="page-heading evidence-heading">
        <div>
          <h1>Evidence</h1>
          <p>Upload and review recorded video evidence.</p>
        </div>
        <div className="evidence-heading__actions">
          <span className="prototype-badge"><span aria-hidden="true" />Prototype data</span>
          <Button variant="primary" onClick={openUpload}><Upload size={15} aria-hidden="true" />Upload evidence</Button>
        </div>
      </div>

      <div className="evidence-boundary" role="note">
        <CircleHelp size={16} aria-hidden="true" />
        <p>This prototype supports recorded evidence upload. Live RTSP/ONVIF camera connection is not yet available and will be validated per configuration.</p>
      </div>

      <section className="evidence-library" aria-label="Evidence library">
        <div className="evidence-library__header">
          <div>
            <h2>Evidence library</h2>
            <p>{numberFormat.format(filteredItems.length)} {filteredItems.length === 1 ? "file" : "files"}</p>
          </div>
          <div className="evidence-filters" aria-label="Filter evidence">
            <label>
              <span className="sr-only">Site</span>
              <Select aria-label="Filter by site" value={siteFilter} onChange={(event) => setSiteFilter(event.currentTarget.value)}>
                <option value="">All sites</option>
                {sites.map((siteName) => <option value={siteName} key={siteName}>{siteName}</option>)}
              </Select>
            </label>
            <label>
              <span className="sr-only">Processing status</span>
              <Select aria-label="Filter by processing status" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as EvidenceStatus | "")}>
                <option value="">All statuses</option>
                {evidenceStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}
              </Select>
            </label>
            <label>
              <span className="sr-only">Uploaded date</span>
              <Input aria-label="Filter by uploaded date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.currentTarget.value)} />
            </label>
            {(siteFilter || statusFilter || dateFilter) && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<FileVideo2 size={20} strokeWidth={1.5} />}
            title="No evidence uploaded yet."
            description="Upload a recorded video to add it to the evidence library."
            action={<Button variant="primary" size="sm" onClick={openUpload}><Upload size={14} aria-hidden="true" />Upload evidence</Button>}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<FileVideo2 size={20} strokeWidth={1.5} />}
            title="No evidence matches these filters."
            action={<Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="table-wrap evidence-table-wrap">
            <table className="table evidence-table">
              <thead className="table__head">
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Source</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Size</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Status</th>
                  <th scope="col">Linked incident</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="evidence-table__row"
                    tabIndex={0}
                    aria-label={`Open evidence details for ${item.file_name}`}
                    onClick={() => openDetails(item)}
                    onKeyDown={(event) => {
                      if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetails(item);
                      }
                    }}
                  >
                    <td><span className="evidence-file-name">{item.file_name}</span><span className="mono-text">{item.id}</span></td>
                    <td><span className="evidence-site-name">{item.site_name}</span><span className="evidence-source-name">{item.source_name}</span></td>
                    <td>{item.duration_seconds === null ? "—" : `${numberFormat.format(item.duration_seconds)} sec`}</td>
                    <td>{formatBytes(item.size_bytes)}</td>
                    <td><EvidenceTimestamp value={item.uploaded_at} /></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      {item.linked_incident_id
                        ? <Link to={`/incidents/${encodeURIComponent(item.linked_incident_id)}`} onClick={(event) => event.stopPropagation()}>{item.linked_incident_id}</Link>
                        : <span className="evidence-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={uploadOpen}
        title="Upload evidence"
        onClose={closeUpload}
        footer={<div className="evidence-upload-footer">{uploadFooter}</div>}
      >
        <div className="evidence-upload-steps" aria-label={`Step ${uploadStep + 1} of 3`}>
          {["Select file", "Attach context", "Confirm"].map((label, index) => (
            <div className={`evidence-upload-step${index === uploadStep ? " is-active" : ""}${index < uploadStep || uploadComplete ? " is-complete" : ""}`} key={label}>
              <span>{index < uploadStep || uploadComplete ? <Check size={12} aria-hidden="true" /> : index + 1}</span>{label}
            </div>
          ))}
        </div>
        {uploadStep === 0 && !uploadComplete && (
          <UploadDropzone
            file={file}
            error={fileError}
            inputRef={fileInputRef}
            onChoose={chooseFile}
            onFile={setSelectedFile}
          />
        )}
        {uploadStep === 1 && !uploadComplete && (
          <div className="evidence-context-form">
            <Field label="Site" id="evidence-site">
              <Select id="evidence-site" value={site} onChange={(event) => setSite(event.currentTarget.value)}>
                {sites.map((siteName) => <option value={siteName} key={siteName}>{siteName}</option>)}
              </Select>
            </Field>
            <Field label="Source / camera label" id="evidence-source">
              <Input id="evidence-source" value={source} onChange={(event) => setSource(event.currentTarget.value)} placeholder="e.g. North Gate · Cam 04" />
            </Field>
            <Field label="Captured at" id="evidence-captured-at">
              <Input id="evidence-captured-at" type="datetime-local" value={capturedAt} onChange={(event) => setCapturedAt(event.currentTarget.value)} />
            </Field>
            <Field label="Notes (optional)" id="evidence-notes">
              <Textarea id="evidence-notes" rows={3} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} placeholder="Add context for the reviewer…" />
            </Field>
          </div>
        )}
        {uploadStep === 2 && !uploadComplete && (
          <div className="evidence-confirm-summary">
            <p>Confirm the recorded evidence and its context before upload.</p>
            <dl>
              <div><dt>File</dt><dd>{file?.name}</dd></div>
              <div><dt>Size</dt><dd>{file ? formatBytes(file.size) : "—"}</dd></div>
              <div><dt>Site</dt><dd>{site}</dd></div>
              <div><dt>Source</dt><dd>{source}</dd></div>
              <div><dt>Captured at</dt><dd>{capturedAt ? localTimestamp.format(new Date(capturedAt)) : "—"}</dd></div>
              {notes && <div><dt>Notes</dt><dd>{notes}</dd></div>}
            </dl>
            <p className="evidence-processing-note">Processing will begin automatically after upload.</p>
          </div>
        )}
        {uploading && (
          <div className="evidence-upload-progress" role="status" aria-live="polite">
            <p>{uploadProgress ? `Uploading ${formatBytes(uploadProgress.loaded)} of ${formatBytes(uploadProgress.total)}` : "Uploading recorded evidence…"}</p>
            {uploadProgress && (
              <progress max={uploadProgress.total} value={uploadProgress.loaded} aria-label="Evidence upload progress" />
            )}
            <span>Processing will begin automatically after upload.</span>
          </div>
        )}
        {uploadError && (
          <div className="evidence-inline-error evidence-upload-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" /><span>{uploadError}</span>
          </div>
        )}
        {uploadComplete && (
          <div className="evidence-upload-success" role="status">
            <span><Check size={17} aria-hidden="true" /></span>
            <div><strong>Evidence uploaded</strong><p>Processing will begin automatically. No incident has been linked.</p></div>
          </div>
        )}
      </Modal>

      {selected && (
        <EvidenceDrawer
          item={selected}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetails}
          onCreateIncident={() => setCreateIncidentOpen(true)}
          onRetry={retryProcessing}
          retrying={retrying}
        />
      )}
      <Modal
        open={createIncidentOpen}
        title="Create incident from evidence?"
        onClose={() => setCreateIncidentOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateIncidentOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={confirmCreateIncident}>Create incident</Button>
          </>
        }
      >
        <p className="evidence-create-confirm-copy">
          An operator-confirmed incident will be created from {selected?.file_name}. The evidence will be linked after you confirm.
        </p>
      </Modal>
    </div>
  );
}

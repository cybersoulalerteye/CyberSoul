export type EvidenceStatus = "queued" | "processing" | "ready" | "failed";

export type EvidenceRecord = {
  id: string;
  file_name: string;
  site_name: string;
  source_name: string;
  captured_at: string;
  uploaded_at: string;
  notes: string;
  duration_seconds: number | null;
  size_bytes: number;
  status: EvidenceStatus;
  processing_log: string[];
  linked_incident_id: string | null;
  preview_url?: string;
  error_reason?: string;
  retry_supported?: boolean;
  origin: "prototype" | "api";
};

const now = Date.now();

export const initialMockEvidence: EvidenceRecord[] = [
  {
    id: "EV-0142",
    file_name: "north-gate-after-hours.mp4",
    site_name: "North Campus",
    source_name: "North Gate · Cam 04",
    captured_at: new Date(now - 3 * 60 * 60_000).toISOString(),
    uploaded_at: new Date(now - 2 * 60 * 60_000).toISOString(),
    notes: "Operator-provided clip for review.",
    duration_seconds: 94,
    size_bytes: 68_157_440,
    status: "ready",
    processing_log: ["Upload received", "Media validated", "Processing completed"],
    linked_incident_id: "INC-2100",
    origin: "prototype",
  },
  {
    id: "EV-0139",
    file_name: "east-annex-entry.mp4",
    site_name: "East Annex",
    source_name: "Lobby · Cam 02",
    captured_at: new Date(now - 8 * 60 * 60_000).toISOString(),
    uploaded_at: new Date(now - 7 * 60 * 60_000).toISOString(),
    notes: "Submitted for operator review.",
    duration_seconds: 126,
    size_bytes: 83_886_080,
    status: "ready",
    processing_log: ["Upload received", "Media validated", "Processing completed"],
    linked_incident_id: null,
    origin: "prototype",
  },
  {
    id: "EV-0141",
    file_name: "loading-bay-review.webm",
    site_name: "Harbor Site",
    source_name: "Loading Bay · Cam 12",
    captured_at: new Date(now - 26 * 60 * 60_000).toISOString(),
    uploaded_at: new Date(now - 25 * 60 * 60_000).toISOString(),
    notes: "",
    duration_seconds: 41,
    size_bytes: 31_457_280,
    status: "processing",
    processing_log: ["Upload received", "Media validation completed", "Processing queued"],
    linked_incident_id: null,
    origin: "prototype",
  },
  {
    id: "EV-0140",
    file_name: "west-yard-review.mov",
    site_name: "West Yard",
    source_name: "Perimeter · Cam 08",
    captured_at: new Date(now - 4 * 24 * 60 * 60_000).toISOString(),
    uploaded_at: new Date(now - 4 * 24 * 60 * 60_000 + 5 * 60_000).toISOString(),
    notes: "File could not be decoded.",
    duration_seconds: null,
    size_bytes: 18_874_368,
    status: "failed",
    processing_log: ["Upload received", "Media validation failed"],
    linked_incident_id: null,
    error_reason: "The uploaded file could not be decoded.",
    retry_supported: false,
    origin: "prototype",
  },
];

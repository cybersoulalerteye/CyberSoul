export type SourceStatus = "planned" | "testing" | "supported" | "unsupported";
export type SourceKind = "IP camera" | "NVR" | "VMS";
export type SourceProtocol = "RTSP" | "ONVIF" | "Vendor API";

export type SiteRecord = {
  id: string;
  name: string;
  location: string;
  timezone: string;
  notes: string;
  active_rules: number;
  active: boolean;
};

export type IntegrationTestRecord = {
  configuration: string;
  tested_by: string;
  tested_at: string;
  passed: boolean;
};

export type SourceRecord = {
  id: string;
  label: string;
  site_id: string;
  kind: SourceKind;
  make: string;
  model: string;
  protocol: SourceProtocol;
  status: SourceStatus;
  notes: string;
  test_record: IntegrationTestRecord | null;
};

export const initialSites: SiteRecord[] = [
  {
    id: "SITE-0101",
    name: "North Campus",
    location: "North District",
    timezone: "America/Chicago",
    notes: "Primary operations campus.",
    active_rules: 2,
    active: true,
  },
  {
    id: "SITE-0102",
    name: "Harbor Site",
    location: "Harbor District",
    timezone: "America/Los_Angeles",
    notes: "",
    active_rules: 1,
    active: true,
  },
  {
    id: "SITE-0103",
    name: "West Yard",
    location: "West Industrial Zone",
    timezone: "America/Denver",
    notes: "Recorded evidence review only.",
    active_rules: 0,
    active: false,
  },
];

export const initialSources: SourceRecord[] = [
  {
    id: "SRC-0401",
    label: "North Gate · Cam 04",
    site_id: "SITE-0101",
    kind: "IP camera",
    make: "Axis",
    model: "P3245-LV",
    protocol: "RTSP",
    status: "planned",
    notes: "Configuration reference only.",
    test_record: null,
  },
  {
    id: "SRC-0402",
    label: "Loading Bay · Cam 12",
    site_id: "SITE-0102",
    kind: "IP camera",
    make: "Hanwha",
    model: "XND-6085",
    protocol: "ONVIF",
    status: "testing",
    notes: "",
    test_record: null,
  },
  {
    id: "SRC-0403",
    label: "West Yard NVR",
    site_id: "SITE-0103",
    kind: "NVR",
    make: "Hikvision",
    model: "DS-7608NI",
    protocol: "Vendor API",
    status: "unsupported",
    notes: "No verified integration is recorded.",
    test_record: null,
  },
  {
    id: "SRC-0404",
    label: "East Annex VMS",
    site_id: "SITE-0101",
    kind: "VMS",
    make: "Milestone",
    model: "XProtect",
    protocol: "Vendor API",
    status: "planned",
    notes: "",
    test_record: null,
  },
];

export type SecurityStatus = "configured" | "in-progress" | "required" | "not-applicable" | "unknown";
export type SecurityDomain = { key: string; name: string; status: SecurityStatus; owner: string; checked: string | null; evidence?: string; openItems: number; section: string };

export const securityDomains: SecurityDomain[] = [
  { key: "authentication", name: "Authentication", status: "required", owner: "Platform team", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "authentication" },
  { key: "authorization", name: "Authorization (RBAC)", status: "in-progress", owner: "Platform team", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "access-roles" },
  { key: "tls", name: "TLS / data in transit", status: "unknown", owner: "Infrastructure", checked: null, openItems: 1, section: "encryption" },
  { key: "evidence-access", name: "Evidence access control", status: "required", owner: "Product team", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "footage-retention" },
  { key: "upload-validation", name: "Upload validation", status: "configured", owner: "Product team", checked: "2026-11-23T10:00:00Z", evidence: "File type and size validation implemented in the evidence upload flow.", openItems: 0, section: "integrations" },
  { key: "tenancy", name: "Tenancy isolation", status: "required", owner: "Platform team", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "tenancy" },
  { key: "retention", name: "Footage retention & deletion", status: "required", owner: "Operations", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "footage-retention" },
  { key: "audit", name: "Audit logging", status: "in-progress", owner: "Product team", checked: "2026-11-23T10:00:00Z", openItems: 1, section: "audit" },
  { key: "backups", name: "Backups & recovery", status: "unknown", owner: "Infrastructure", checked: null, openItems: 0, section: "compliance" },
  { key: "secrets", name: "Secret management", status: "required", owner: "Platform team", checked: "2026-11-23T10:00:00Z", openItems: 0, section: "integrations" },
];

export const securityLastReviewed = "2026-11-23T10:00:00Z";

-- Session variable name must match security/tenant_context.py
-- app.current_tenant_id

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

CREATE POLICY incidents_tenant_isolation ON incidents
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Repeat per tenant-scoped table:
-- sites, cameras, zones, edge_devices, evidence_objects,
-- model_versions, edge_model_deployments, audit_log, latency_events
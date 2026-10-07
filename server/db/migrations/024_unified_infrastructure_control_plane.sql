-- MIGRATION 024: UNIFIED INFRASTRUCTURE CONTROL PLANE
CREATE TABLE IF NOT EXISTS infrastructure_providers (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(64) NOT NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'managed',
  region VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'connected',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_infra_providers_org ON infrastructure_providers(organization_id);

CREATE TABLE IF NOT EXISTS infrastructure_credentials (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) REFERENCES infrastructure_providers(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_infra_credentials_org ON infrastructure_credentials(organization_id);

CREATE TABLE IF NOT EXISTS infrastructure_resources (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id VARCHAR(64) REFERENCES project_environments(id) ON DELETE CASCADE,
  service VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider_id VARCHAR(64) REFERENCES infrastructure_providers(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'provisioning',
  plan VARCHAR(64) NOT NULL DEFAULT 'standard',
  region VARCHAR(64),
  endpoint TEXT,
  public_url TEXT,
  connection JSONB NOT NULL DEFAULT '{}'::jsonb,
  connection_secret_ciphertext TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_infra_resources_project ON infrastructure_resources(project_id, environment_id);
CREATE INDEX IF NOT EXISTS idx_infra_resources_service ON infrastructure_resources(service);

CREATE TABLE IF NOT EXISTS infrastructure_deployments (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id VARCHAR(64) REFERENCES project_environments(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) REFERENCES infrastructure_providers(id) ON DELETE SET NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'control-plane',
  image TEXT,
  commit_sha VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  replicas INTEGER NOT NULL DEFAULT 1,
  url TEXT,
  logs TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_infra_deployments_project ON infrastructure_deployments(project_id, environment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS infrastructure_usage_events (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
  environment_id VARCHAR(64) REFERENCES project_environments(id) ON DELETE CASCADE,
  service VARCHAR(64) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  quantity NUMERIC(20,6) NOT NULL DEFAULT 0,
  unit VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_infra_usage_org_time ON infrastructure_usage_events(organization_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS infrastructure_audit_events (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64),
  environment_id VARCHAR(64),
  user_id VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_infra_audit_org_time ON infrastructure_audit_events(organization_id, created_at DESC);


CREATE TABLE IF NOT EXISTS infrastructure_workers (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id VARCHAR(64) REFERENCES project_environments(id) ON DELETE CASCADE,
  resource_id VARCHAR(64) REFERENCES infrastructure_resources(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  endpoint TEXT,
  enrollment_hash TEXT,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_infra_workers_project ON infrastructure_workers(project_id, environment_id);
CREATE INDEX IF NOT EXISTS idx_infra_workers_status ON infrastructure_workers(status);

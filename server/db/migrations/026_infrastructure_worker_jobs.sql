-- MIGRATION 026: SECURE INFRASTRUCTURE WORKERS
ALTER TABLE infrastructure_workers
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_infra_workers_token_hash ON infrastructure_workers(token_hash);

CREATE TABLE IF NOT EXISTS infrastructure_worker_jobs (
  id VARCHAR(64) PRIMARY KEY,
  worker_id VARCHAR(64) NOT NULL REFERENCES infrastructure_workers(id) ON DELETE CASCADE,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id VARCHAR(64) REFERENCES project_environments(id) ON DELETE CASCADE,
  kind VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_infra_worker_jobs_worker_status
  ON infrastructure_worker_jobs(worker_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_infra_worker_jobs_project
  ON infrastructure_worker_jobs(project_id,environment_id,created_at DESC);

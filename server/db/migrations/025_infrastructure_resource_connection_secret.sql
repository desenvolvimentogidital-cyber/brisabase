ALTER TABLE infrastructure_resources ADD COLUMN IF NOT EXISTS connection_secret_ciphertext TEXT;
CREATE INDEX IF NOT EXISTS idx_infra_resources_provider ON infrastructure_resources(provider_id);

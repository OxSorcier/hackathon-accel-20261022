CREATE TABLE IF NOT EXISTS accel_industrial_display_versions (
  company_id text NOT NULL REFERENCES companies(company_id), version integer NOT NULL CHECK(version>0),
  payload jsonb NOT NULL, operation_key text NOT NULL, command_hash text NOT NULL,
  actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,version), UNIQUE(company_id,operation_key),
  CHECK(payload->>'companyId'=company_id AND (payload->>'version')::integer=version)
);
CREATE TABLE IF NOT EXISTS accel_industrial_display_heads (
  company_id text PRIMARY KEY REFERENCES companies(company_id), version integer NOT NULL,
  FOREIGN KEY(company_id,version) REFERENCES accel_industrial_display_versions(company_id,version)
);
CREATE TABLE IF NOT EXISTS accel_industrial_run_budgets (
  run_id text PRIMARY KEY REFERENCES runs(id), company_id text NOT NULL REFERENCES companies(company_id),
  provider_calls integer NOT NULL DEFAULT 0 CHECK(provider_calls>=0),
  tool_calls integer NOT NULL DEFAULT 0 CHECK(tool_calls>=0),
  max_provider_calls integer NOT NULL CHECK(max_provider_calls BETWEEN 1 AND 20),
  max_tool_calls integer NOT NULL CHECK(max_tool_calls BETWEEN 1 AND 40),
  max_duration_ms integer NOT NULL CHECK(max_duration_ms BETWEEN 1000 AND 120000),
  started_at timestamptz
);

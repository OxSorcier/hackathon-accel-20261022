-- Integration applies this additive proposal in its canonical industrial migration.
-- All methods run inside the caller transaction, under the company row lock.
CREATE TABLE IF NOT EXISTS accel_industrial_analysis_budgets (
  company_id text NOT NULL REFERENCES companies(company_id),
  event_id text NOT NULL,
  max_runs integer NOT NULL CHECK (max_runs BETWEEN 1 AND 10),
  runs_used integer NOT NULL DEFAULT 0 CHECK (runs_used >= 0 AND runs_used <= max_runs),
  PRIMARY KEY (company_id,event_id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_analysis_intents (
  id text PRIMARY KEY,
  company_id text NOT NULL,
  event_id text NOT NULL,
  intent_key text NOT NULL,
  basis jsonb NOT NULL CHECK (jsonb_typeof(basis)='object'),
  analysis_policy_version text NOT NULL,
  service_principal_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('ready','queued','running','done','stale','blocked','uncertain')),
  blocked_reason text,
  run_id text,
  budget jsonb NOT NULL CHECK (jsonb_typeof(budget)='object'),
  provider_calls integer NOT NULL DEFAULT 0 CHECK (provider_calls >= 0),
  tool_calls integer NOT NULL DEFAULT 0 CHECK (tool_calls >= 0),
  started_at timestamptz,
  created_at timestamptz NOT NULL,
  UNIQUE (company_id,intent_key),
  FOREIGN KEY (company_id,event_id) REFERENCES accel_industrial_analysis_budgets(company_id,event_id),
  CHECK ((status IN ('queued','running','done','uncertain')) <= (run_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS accel_industrial_analysis_ready ON accel_industrial_analysis_intents(company_id,created_at,id) WHERE status='ready';

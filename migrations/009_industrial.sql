CREATE TABLE IF NOT EXISTS accel_industrial_context_versions (
  company_id text NOT NULL REFERENCES companies(company_id), revision text NOT NULL,
  payload jsonb NOT NULL, source_manifest_hash text NOT NULL,
  actor_id text NOT NULL, operation_key text NOT NULL, command_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,revision), UNIQUE(company_id,operation_key),
  CHECK(payload->>'companyId'=company_id AND payload->>'revision'=revision)
);
CREATE TABLE IF NOT EXISTS accel_industrial_context_heads (
  company_id text PRIMARY KEY REFERENCES companies(company_id), revision text NOT NULL,
  FOREIGN KEY(company_id,revision) REFERENCES accel_industrial_context_versions(company_id,revision)
);
CREATE TABLE IF NOT EXISTS accel_industrial_releases (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(company_id),
  event_id text NOT NULL, revision text NOT NULL, payload jsonb NOT NULL,
  operation_key text NOT NULL, command_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id), UNIQUE(company_id,event_id,revision), UNIQUE(company_id,operation_key),
  CHECK(payload->>'companyId'=company_id AND payload->>'id'=id AND payload->>'revision'=revision)
);
CREATE TABLE IF NOT EXISTS accel_industrial_event_heads (
  company_id text NOT NULL, event_id text NOT NULL, release_id text NOT NULL,
  PRIMARY KEY(company_id,event_id),
  FOREIGN KEY(company_id,release_id) REFERENCES accel_industrial_releases(company_id,id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_reports (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(company_id),
  run_id text NOT NULL UNIQUE REFERENCES runs(id), payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id), CHECK(payload->>'companyId'=company_id AND payload->>'id'=id AND payload->>'runId'=run_id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_approvals (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(company_id),
  report_id text NOT NULL, plan_id text NOT NULL, operation_key text NOT NULL,
  command_hash text NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id), UNIQUE(company_id,plan_id), UNIQUE(company_id,operation_key),
  FOREIGN KEY(company_id,report_id) REFERENCES accel_industrial_reports(company_id,id),
  CHECK(payload->>'companyId'=company_id AND payload->>'id'=id AND payload->>'planId'=plan_id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_executions (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(company_id),
  approval_id text NOT NULL, operation_key text NOT NULL, command_hash text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id), UNIQUE(company_id,approval_id), UNIQUE(company_id,operation_key),
  FOREIGN KEY(company_id,approval_id) REFERENCES accel_industrial_approvals(company_id,id),
  CHECK(payload->>'companyId'=company_id AND payload->>'id'=id AND payload->>'approvalId'=approval_id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_resource_ledger (
  company_id text NOT NULL, id text NOT NULL, execution_id text NOT NULL,
  step_id text NOT NULL, kind text NOT NULL,
  payload jsonb NOT NULL, created_revision text NOT NULL,
  PRIMARY KEY(company_id,id),
  FOREIGN KEY(company_id,execution_id) REFERENCES accel_industrial_executions(company_id,id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_demo_records (
  company_id text NOT NULL, id text NOT NULL, execution_id text NOT NULL,
  kind text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(company_id,id),
  FOREIGN KEY(company_id,execution_id) REFERENCES accel_industrial_executions(company_id,id)
);
CREATE TABLE IF NOT EXISTS accel_industrial_principals (
  company_id text NOT NULL REFERENCES companies(company_id), id text NOT NULL,
  role text NOT NULL CHECK(role='analysis_only'), active boolean NOT NULL,
  PRIMARY KEY(company_id,id)
);

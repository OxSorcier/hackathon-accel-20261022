CREATE TABLE IF NOT EXISTS accel_industrial_report_attempts (
  company_id text NOT NULL REFERENCES companies(company_id), run_id text PRIMARY KEY REFERENCES runs(id),
  payload jsonb NOT NULL, outcome text NOT NULL CHECK(outcome IN ('uncertain','stale','blocked')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE accel_industrial_run_budgets ADD COLUMN IF NOT EXISTS research_dependencies jsonb NOT NULL DEFAULT '[]'::jsonb;

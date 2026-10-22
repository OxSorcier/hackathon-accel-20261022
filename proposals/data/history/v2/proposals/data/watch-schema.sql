-- Candidate migration for integrator reception. Never applied at startup by this module.
CREATE TABLE IF NOT EXISTS accel_watch_definitions (
  id text PRIMARY KEY,
  company_id text NOT NULL,
  actor_id text NOT NULL,
  operation_key text NOT NULL,
  public_topic text NOT NULL,
  source_urls jsonb NOT NULL CHECK (jsonb_typeof(source_urls) = 'array'),
  cadence_minutes integer NOT NULL CHECK (cadence_minutes BETWEEN 5 AND 10080),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (company_id, operation_key),
  UNIQUE (company_id, id)
);
CREATE INDEX IF NOT EXISTS accel_watch_due ON accel_watch_definitions (next_run_at, id) WHERE enabled;

CREATE TABLE IF NOT EXISTS accel_watch_occurrences (
  id text PRIMARY KEY,
  watch_id text NOT NULL,
  company_id text NOT NULL,
  operation_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'error')),
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  fence integer NOT NULL DEFAULT 0 CHECK (fence >= 0),
  lease_until timestamptz,
  worker_id text,
  result jsonb,
  error text,
  FOREIGN KEY (company_id, watch_id) REFERENCES accel_watch_definitions(company_id, id),
  UNIQUE (company_id, watch_id, operation_key),
  CHECK ((status = 'running') = (lease_until IS NOT NULL AND worker_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS accel_watch_pending ON accel_watch_occurrences (scheduled_at, id) WHERE status IN ('queued', 'running');
CREATE UNIQUE INDEX IF NOT EXISTS accel_watch_one_running ON accel_watch_occurrences (company_id, watch_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS accel_watch_evidence (
  company_id text NOT NULL,
  source_id text NOT NULL,
  content_hash text NOT NULL,
  evidence jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (company_id, source_id, content_hash)
);

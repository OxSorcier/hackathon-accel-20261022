CREATE TABLE IF NOT EXISTS companies (
  company_id text PRIMARY KEY,
  snapshot jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  actor jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(company_id),
  operation_key text NOT NULL,
  actor jsonb NOT NULL,
  payload jsonb NOT NULL,
  fence bigint NOT NULL DEFAULT 0,
  lease_until timestamptz,
  UNIQUE(company_id, operation_key)
);
CREATE TABLE IF NOT EXISTS proposals (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(company_id),
  run_id text NOT NULL UNIQUE REFERENCES runs(id),
  payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  company_id text NOT NULL REFERENCES companies(company_id),
  operation_key text NOT NULL,
  proposal_id text NOT NULL,
  actor_id text NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(company_id, operation_key)
);
CREATE TABLE IF NOT EXISTS memories (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(company_id),
  payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS business_events (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(company_id),
  revision text NOT NULL,
  actor_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

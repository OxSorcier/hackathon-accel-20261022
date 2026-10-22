-- Candidate additive migration. Integration owns application to each database.
-- Raw source bodies remain only in the existing watch occurrence/evidence tables.
CREATE UNIQUE INDEX IF NOT EXISTS accel_watch_occurrences_company_id_id_key
  ON accel_watch_occurrences(company_id,id);
CREATE TABLE IF NOT EXISTS accel_research_scopes (
  company_id text NOT NULL REFERENCES companies(company_id),
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  namespace text NOT NULL CHECK (namespace IN ('live','controlled')),
  generation bigint NOT NULL CHECK (generation BETWEEN 0 AND 9007199254740991),
  fingerprint text NOT NULL,
  state text NOT NULL CHECK (state IN ('reusable','missing','stale','partial','empty','error','uncertain')),
  observed_at timestamptz,
  valid_until timestamptz,
  occurrence_id text,
  evidence_refs jsonb NOT NULL CHECK (jsonb_typeof(evidence_refs)='array'),
  conditions jsonb NOT NULL CHECK (jsonb_typeof(conditions)='array'),
  reason text NOT NULL,
  PRIMARY KEY (company_id,profile_id,profile_version,namespace),
  FOREIGN KEY (company_id,occurrence_id) REFERENCES accel_watch_occurrences(company_id,id)
);
CREATE TABLE IF NOT EXISTS accel_research_commands (
  company_id text NOT NULL REFERENCES companies(company_id),
  operation_key text NOT NULL,
  actor_id text NOT NULL,
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  namespace text NOT NULL CHECK (namespace IN ('live','controlled')),
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('intent','done','uncertain')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  receipt jsonb,
  PRIMARY KEY (company_id,operation_key),
  FOREIGN KEY (company_id,profile_id,profile_version,namespace)
    REFERENCES accel_research_scopes(company_id,profile_id,profile_version,namespace)
);
CREATE INDEX IF NOT EXISTS accel_research_scope_commands
  ON accel_research_commands(company_id,profile_id,profile_version,namespace,created_at DESC);

CREATE TABLE IF NOT EXISTS decision_cases (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(company_id),
  payload jsonb NOT NULL,
  UNIQUE(company_id,id)
);
CREATE TABLE IF NOT EXISTS case_versions (
  company_id text NOT NULL,
  case_id text NOT NULL,
  case_revision text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(company_id,case_id,case_revision),
  FOREIGN KEY(company_id,case_id) REFERENCES decision_cases(company_id,id)
);
CREATE TABLE IF NOT EXISTS case_commands (
  company_id text NOT NULL REFERENCES companies(company_id),
  operation_key text NOT NULL,
  command_hash text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(company_id,operation_key)
);

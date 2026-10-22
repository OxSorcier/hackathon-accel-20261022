-- Proposed additive migration. The integrator owns canonical migration/application.
CREATE TABLE IF NOT EXISTS accel_pdf_documents (
  company_id text NOT NULL REFERENCES companies(company_id),
  document_hash text NOT NULL CHECK (document_hash ~ '^[a-f0-9]{64}$'),
  extractor_version text NOT NULL CHECK (length(extractor_version) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('intent','done','uncertain','failed')),
  intent_token uuid NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '120 seconds',
  completed_at timestamptz,
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance)='object' AND octet_length(provenance::text)<=10000),
  extraction jsonb CHECK (extraction IS NULL OR (jsonb_typeof(extraction)='object' AND octet_length(extraction::text)<=3500000)),
  error_code text CHECK (error_code IS NULL OR error_code ~ '^PDF_[A-Z_]{1,90}$'),
  PRIMARY KEY (company_id,document_hash,extractor_version),
  CHECK (expires_at>created_at),
  CHECK (
    (status='intent' AND completed_at IS NULL AND extraction IS NULL AND error_code IS NULL)
    OR (status='done' AND completed_at IS NOT NULL AND extraction IS NOT NULL AND error_code IS NULL)
    OR (status IN ('uncertain','failed') AND completed_at IS NOT NULL AND extraction IS NULL AND error_code IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS accel_pdf_documents_company_created ON accel_pdf_documents(company_id,created_at DESC);

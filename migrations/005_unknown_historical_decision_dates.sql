-- Migration 004 used transaction time for pre-existing decisions.
-- Its applied_at has the same transaction timestamp. Preserve unknown history as NULL.
ALTER TABLE decisions ALTER COLUMN created_at DROP NOT NULL;
UPDATE decisions SET created_at=NULL
WHERE created_at=(SELECT applied_at FROM schema_migrations WHERE name='004_decision_telemetry.sql');
ALTER TABLE decisions ALTER COLUMN created_at SET DEFAULT now();

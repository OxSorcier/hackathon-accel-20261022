-- Additive candidate for integration migration 007. Apply in one transaction.
-- Application terminal writers acquire the company row lock BEFORE writing an occurrence.
LOCK TABLE companies, accel_watch_occurrences, accel_research_scopes IN SHARE ROW EXCLUSIVE MODE;
CREATE SEQUENCE IF NOT EXISTS accel_watch_publication_seq AS bigint CACHE 1 NO CYCLE;
ALTER SEQUENCE accel_watch_publication_seq CACHE 1 NO CYCLE;
ALTER TABLE accel_watch_occurrences ADD COLUMN IF NOT EXISTS publication_seq bigint;
ALTER TABLE accel_research_scopes ADD COLUMN IF NOT EXISTS observed_publication_seq bigint NOT NULL DEFAULT 0 CHECK (observed_publication_seq >= 0);
CREATE TABLE IF NOT EXISTS accel_research_publication_boundary (
  singleton boolean PRIMARY KEY CHECK (singleton),
  historical_seq bigint NOT NULL CHECK (historical_seq >= 0)
);
DO $migration$
DECLARE occurrence_row record; boundary bigint; sequence_value bigint; sequence_called boolean;
BEGIN
  SELECT last_value,is_called INTO sequence_value,sequence_called FROM accel_watch_publication_seq;
  SELECT GREATEST(COALESCE(max(publication_seq),0),sequence_value) INTO boundary FROM accel_watch_occurrences;
  PERFORM setval('accel_watch_publication_seq',GREATEST(boundary,1),sequence_called OR boundary > 1 OR EXISTS(SELECT 1 FROM accel_watch_occurrences WHERE publication_seq IS NOT NULL));
  IF NOT EXISTS(SELECT 1 FROM accel_research_publication_boundary WHERE singleton) THEN
    -- Deterministic numbering is only a migration barrier, never reconstructed event order.
    FOR occurrence_row IN SELECT id FROM accel_watch_occurrences WHERE status IN ('completed','error') AND publication_seq IS NULL ORDER BY completed_at NULLS FIRST,id LOOP
      UPDATE accel_watch_occurrences SET publication_seq=nextval('accel_watch_publication_seq') WHERE id=occurrence_row.id;
    END LOOP;
    SELECT COALESCE(max(publication_seq),0) INTO boundary FROM accel_watch_occurrences;
    INSERT INTO accel_research_publication_boundary VALUES(true,boundary);
    -- Generation change invalidates old dependencies; historical evidence/refs remain intact.
    -- Integration also projects this invalidation into its pending-plan status if needed.
    UPDATE accel_research_scopes SET observed_publication_seq=boundary,generation=generation+1,
      fingerprint='publication-order-migration:'||fingerprint,
      state=CASE WHEN state='uncertain' THEN 'uncertain' ELSE 'stale' END,valid_until=NULL,
      conditions=conditions||'["HISTORICAL_PUBLICATION_ORDER_UNVERIFIED","REFRESH_REQUIRED_AFTER_ORDER_MIGRATION"]'::jsonb,
      reason='Historical publication order was not established. Refresh or reconcile before reuse.';
  END IF;
END $migration$;
CREATE UNIQUE INDEX IF NOT EXISTS accel_watch_publication_unique ON accel_watch_occurrences(publication_seq) WHERE publication_seq IS NOT NULL;
CREATE INDEX IF NOT EXISTS accel_watch_publication_adoption ON accel_watch_occurrences(company_id,watch_id,publication_seq DESC) WHERE status IN ('completed','error');
CREATE OR REPLACE FUNCTION accel_watch_assign_publication() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IN ('completed','error') THEN
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'TERMINAL_OCCURRENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.id,NEW.company_id,NEW.watch_id,NEW.operation_key) IS DISTINCT FROM (OLD.id,OLD.company_id,OLD.watch_id,OLD.operation_key) THEN
    RAISE EXCEPTION 'OCCURRENCE_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.status IN ('completed','error') THEN
    NEW.publication_seq=nextval('accel_watch_publication_seq');
  ELSE
    NEW.publication_seq=NULL;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS accel_watch_publication ON accel_watch_occurrences;
CREATE TRIGGER accel_watch_publication BEFORE INSERT OR UPDATE ON accel_watch_occurrences FOR EACH ROW EXECUTE FUNCTION accel_watch_assign_publication();
DO $constraint$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='accel_watch_publication_state' AND conrelid='accel_watch_occurrences'::regclass) THEN
    ALTER TABLE accel_watch_occurrences ADD CONSTRAINT accel_watch_publication_state CHECK ((status IN ('completed','error'))=(publication_seq IS NOT NULL) AND (publication_seq IS NULL OR publication_seq > 0));
  END IF;
END $constraint$;

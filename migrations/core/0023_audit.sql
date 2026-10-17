ALTER TABLE cb_events ADD COLUMN source_version INTEGER;
ALTER TABLE cb_events ADD COLUMN actor_version INTEGER;
ALTER TABLE cb_events ADD COLUMN facts TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(facts));
ALTER TABLE cb_events ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE cb_events ADD COLUMN actor_key_id TEXT;
ALTER TABLE cb_events ADD COLUMN entity_kind TEXT;
ALTER TABLE cb_events ADD COLUMN property_id TEXT;
ALTER TABLE cb_events ADD COLUMN booking_id TEXT;
ALTER TABLE cb_events ADD COLUMN source_revision TEXT;
ALTER TABLE cb_events ADD COLUMN result TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX cb_events_scope ON cb_events(property_id,booking_id,at);
CREATE INDEX cb_events_action ON cb_events(action,at);
CREATE INDEX cb_events_time ON cb_events(at DESC,id DESC);
CREATE INDEX cb_events_actor ON cb_events(actor_id,at);
CREATE TRIGGER cb_events_no_update BEFORE UPDATE ON cb_events BEGIN SELECT RAISE(ABORT,'Business events are immutable'); END;
CREATE TRIGGER cb_events_no_delete BEFORE DELETE ON cb_events BEGIN SELECT RAISE(ABORT,'Business history is permanent'); END;
CREATE TABLE cb_audit_redactions (subject_id TEXT PRIMARY KEY, anonymous_id TEXT NOT NULL UNIQUE, at TEXT NOT NULL, actor_id TEXT NOT NULL);

CREATE TRIGGER cb_native_audit_no_update BEFORE UPDATE ON oa_auth_audit BEGIN SELECT RAISE(ABORT,'Authorization history is immutable'); END;
CREATE TRIGGER cb_native_audit_no_delete BEFORE DELETE ON oa_auth_audit BEGIN SELECT RAISE(ABORT,'Authorization history is permanent'); END;

CREATE TRIGGER cb_audit_redactions_no_update BEFORE UPDATE ON cb_audit_redactions BEGIN SELECT RAISE(ABORT,'Anonymization references are permanent'); END;
CREATE TRIGGER cb_audit_redactions_no_delete BEFORE DELETE ON cb_audit_redactions BEGIN SELECT RAISE(ABORT,'Anonymization references are permanent'); END;

CREATE TABLE cb_ledger_journals (
 id TEXT PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, property_id TEXT NOT NULL,
 booking_id TEXT NOT NULL, owner_key TEXT NOT NULL, legal_entity TEXT NOT NULL,
 effective_date TEXT NOT NULL, posted_at TEXT NOT NULL, actor_id TEXT NOT NULL,
 source_type TEXT NOT NULL, source_id TEXT NOT NULL, source_revision TEXT NOT NULL,
 reversal_of TEXT REFERENCES cb_ledger_journals(id), data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE INDEX cb_ledger_scope ON cb_ledger_journals(property_id,booking_id,effective_date);
CREATE TRIGGER cb_ledger_no_update BEFORE UPDATE ON cb_ledger_journals BEGIN SELECT RAISE(ABORT,'Posted journals are immutable; reverse them'); END;
CREATE TRIGGER cb_ledger_no_delete BEFORE DELETE ON cb_ledger_journals BEGIN SELECT RAISE(ABORT,'Posted journals are permanent accounting records'); END;
CREATE TABLE cb_ledger_periods (month TEXT PRIMARY KEY, closed_at TEXT NOT NULL, actor_id TEXT NOT NULL);

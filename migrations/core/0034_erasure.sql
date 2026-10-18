-- Completion evidence contains opaque references only. Retained documents are
-- isolated from every operational reader and sender.
CREATE TABLE cb_privacy_receipts(id TEXT PRIMARY KEY, entity TEXT NOT NULL, subject_hash TEXT NOT NULL, completed_at TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TRIGGER cb_privacy_receipts_immutable_update BEFORE UPDATE ON cb_privacy_receipts BEGIN SELECT RAISE(ABORT,'Erasure receipts are permanent'); END;
CREATE TRIGGER cb_privacy_receipts_immutable_delete BEFORE DELETE ON cb_privacy_receipts BEGIN SELECT RAISE(ABORT,'Erasure receipts are permanent'); END;
CREATE TABLE cb_privacy_holds(id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES cb_privacy_receipts(id), source_table TEXT NOT NULL, source_id TEXT NOT NULL, reason TEXT NOT NULL, until_at TEXT NOT NULL, payload TEXT CHECK(payload IS NULL OR json_valid(payload)), released_at TEXT);
CREATE INDEX cb_privacy_holds_receipt ON cb_privacy_holds(receipt_id);
CREATE TABLE cb_privacy_reviews(id TEXT PRIMARY KEY, entity TEXT NOT NULL, subject_id TEXT NOT NULL, revision TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));

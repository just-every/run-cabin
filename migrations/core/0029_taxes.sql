-- Configuration is revisioned; source lines, review snapshots and evidence are append-only.
CREATE TABLE cb_tax_config (id TEXT PRIMARY KEY, kind TEXT NOT NULL, property_id TEXT NOT NULL, revision TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX cb_tax_config_property ON cb_tax_config(property_id,kind);
CREATE TABLE cb_tax_sources (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, booking_id TEXT NOT NULL, source_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE INDEX cb_tax_sources_property ON cb_tax_sources(property_id,booking_id);
CREATE TABLE cb_tax_lines (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, booking_id TEXT NOT NULL, month TEXT NOT NULL, jurisdiction_id TEXT NOT NULL, source_id TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX cb_tax_lines_period ON cb_tax_lines(property_id,month,jurisdiction_id);
CREATE TABLE cb_tax_reports (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, month TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved')), data TEXT NOT NULL);
CREATE INDEX cb_tax_reports_period ON cb_tax_reports(property_id,month);
CREATE TABLE cb_tax_deliveries (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, jurisdiction_id TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE cb_tax_evidence (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, jurisdiction_id TEXT NOT NULL, source_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TRIGGER cb_tax_sources_no_update BEFORE UPDATE ON cb_tax_sources BEGIN SELECT RAISE(ABORT,'Tax sources are immutable; record an adjustment'); END;
CREATE TRIGGER cb_tax_sources_no_delete BEFORE DELETE ON cb_tax_sources BEGIN SELECT RAISE(ABORT,'Tax sources are permanent'); END;
CREATE TRIGGER cb_tax_lines_no_update BEFORE UPDATE ON cb_tax_lines BEGIN SELECT RAISE(ABORT,'Tax lines are immutable; record an adjustment'); END;
CREATE TRIGGER cb_tax_lines_no_delete BEFORE DELETE ON cb_tax_lines BEGIN SELECT RAISE(ABORT,'Tax lines are permanent'); END;
CREATE TRIGGER cb_tax_evidence_no_update BEFORE UPDATE ON cb_tax_evidence BEGIN SELECT RAISE(ABORT,'Tax evidence is immutable; record a correction'); END;
CREATE TRIGGER cb_tax_evidence_no_delete BEFORE DELETE ON cb_tax_evidence BEGIN SELECT RAISE(ABORT,'Tax evidence is permanent'); END;
CREATE TRIGGER cb_tax_reports_frozen BEFORE UPDATE ON cb_tax_reports WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'Approved tax review is frozen'); END;
CREATE TRIGGER cb_tax_reports_no_delete BEFORE DELETE ON cb_tax_reports BEGIN SELECT RAISE(ABORT,'Tax reviews are permanent'); END;

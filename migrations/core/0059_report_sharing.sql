CREATE TABLE cb_saved_reports (
 id TEXT PRIMARY KEY, revision TEXT NOT NULL, creator_id TEXT NOT NULL, data TEXT NOT NULL
);
CREATE TABLE cb_report_schedules (
 id TEXT PRIMARY KEY, revision TEXT NOT NULL, creator_id TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 next_run_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE INDEX cb_report_schedules_due ON cb_report_schedules(enabled,next_run_at);
CREATE TABLE cb_report_runs (
 id TEXT PRIMARY KEY, schedule_id TEXT NOT NULL, due_at TEXT NOT NULL, data TEXT NOT NULL,
 UNIQUE(schedule_id,due_at)
);
CREATE TABLE cb_report_artifacts (
 run_id TEXT PRIMARY KEY REFERENCES cb_report_runs(id), content TEXT NOT NULL, sha256 TEXT NOT NULL,
 content_type TEXT NOT NULL, filename TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER cb_report_artifact_no_update BEFORE UPDATE ON cb_report_artifacts BEGIN SELECT RAISE(ABORT,'Report artifacts are immutable'); END;
CREATE TRIGGER cb_report_artifact_no_delete BEFORE DELETE ON cb_report_artifacts BEGIN SELECT RAISE(ABORT,'Report artifacts are permanent'); END;
CREATE TABLE cb_report_followups (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES cb_report_runs(id), data TEXT NOT NULL
);

CREATE TABLE cb_owner_policies (
 property_id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, revision TEXT NOT NULL,
 calendar_visibility TEXT NOT NULL CHECK(calendar_visibility IN ('hidden','availability','stays')),
 expense_limit_cents INTEGER NOT NULL CHECK(expense_limit_cents>=0), max_stay_nights INTEGER NOT NULL CHECK(max_stay_nights BETWEEN 0 AND 365),
 notice_days INTEGER NOT NULL CHECK(notice_days BETWEEN 0 AND 365), agreement TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
);
CREATE TABLE cb_owner_statement_grants (
 statement_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, granted_at TEXT NOT NULL, granted_by TEXT NOT NULL, reason TEXT NOT NULL,
 revoked_at TEXT, revoked_by TEXT, PRIMARY KEY(statement_id,email)
);
CREATE TABLE cb_owner_statement_views (
 id TEXT PRIMARY KEY, statement_id TEXT NOT NULL, revision TEXT NOT NULL, owner_key TEXT NOT NULL,
 viewed_at TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('view','download'))
);
CREATE INDEX cb_owner_statement_views_statement ON cb_owner_statement_views(statement_id,viewed_at);
CREATE TRIGGER cb_owner_views_no_update BEFORE UPDATE ON cb_owner_statement_views BEGIN SELECT RAISE(ABORT,'Statement access events are immutable'); END;
CREATE TRIGGER cb_owner_views_no_delete BEFORE DELETE ON cb_owner_statement_views BEGIN SELECT RAISE(ABORT,'Statement access events are permanent'); END;
CREATE TABLE cb_owner_documents (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('invoice','document')), content TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, withdrawn_at TEXT
);
CREATE TABLE cb_owner_expenses (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, revision TEXT NOT NULL, description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), document_id TEXT, status TEXT NOT NULL CHECK(status IN ('pending','approved','declined','withdrawn')),
 requested_at TEXT NOT NULL, requested_by TEXT NOT NULL, decided_at TEXT, decision_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE cb_owner_stay_requests (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, revision TEXT NOT NULL,
 start TEXT NOT NULL, end TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','declined','cancelled')),
 requested_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, decision_note TEXT NOT NULL DEFAULT '', booking_id TEXT
);
CREATE INDEX cb_owner_expenses_scope ON cb_owner_expenses(property_id,email);
CREATE INDEX cb_owner_documents_scope ON cb_owner_documents(property_id,email);
CREATE INDEX cb_owner_stays_scope ON cb_owner_stay_requests(property_id,email);
CREATE UNIQUE INDEX cb_owner_stays_pending ON cb_owner_stay_requests(property_id,email,start,end) WHERE status='pending';
CREATE TABLE cb_owner_reserve_reports (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0), effective_date TEXT NOT NULL,
 document_id TEXT NOT NULL, note TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by TEXT NOT NULL
);
CREATE INDEX cb_owner_reserves_scope ON cb_owner_reserve_reports(property_id,email,effective_date);
CREATE TRIGGER cb_owner_reserves_no_update BEFORE UPDATE ON cb_owner_reserve_reports BEGIN SELECT RAISE(ABORT,'Reserve reports are immutable; add a correction report'); END;

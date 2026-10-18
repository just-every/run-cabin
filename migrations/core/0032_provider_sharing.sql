CREATE TABLE cb_provider_sharing (
 id TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 revision TEXT NOT NULL,
 changed_at TEXT NOT NULL
);

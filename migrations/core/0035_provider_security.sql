-- Credentials are installation-local capabilities and never travel in archives.
CREATE TABLE cb_provider_security (
 id TEXT PRIMARY KEY,
 revision TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 actions TEXT NOT NULL,
 property_ids TEXT NOT NULL,
 credential_sealed TEXT,
 changed_by TEXT NOT NULL,
 changed_at TEXT NOT NULL
);

CREATE TABLE cb_qbo_connection (id INTEGER PRIMARY KEY CHECK(id=1), realm TEXT NOT NULL, mode TEXT NOT NULL, sealed TEXT NOT NULL, version TEXT NOT NULL, lease_until TEXT);
CREATE TABLE cb_qbo_oauth (state_hash TEXT PRIMARY KEY, actor_id TEXT NOT NULL, mode TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE cb_qbo_mappings (property_id TEXT NOT NULL, owner_key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(property_id,owner_key));
CREATE TABLE cb_qbo_entries (id TEXT PRIMARY KEY, realm TEXT NOT NULL, source_id TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(realm,source_id));
CREATE TABLE cb_qbo_batches (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE cb_qbo_catalog (realm TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE cb_qbo_app (id INTEGER PRIMARY KEY CHECK(id=1), sealed TEXT NOT NULL);
INSERT INTO cb_provider_sharing(id,enabled,revision,changed_at) VALUES('quickbooks',1,'initial','1970-01-01T00:00:00.000Z');

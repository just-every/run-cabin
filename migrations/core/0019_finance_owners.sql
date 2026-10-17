CREATE TABLE cb_owner_links(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE INDEX cb_owner_links_email ON cb_owner_links(email,created_at);
CREATE TABLE cb_owner_sessions(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE cb_finance_connections(id TEXT PRIMARY KEY,origin TEXT NOT NULL,token TEXT NOT NULL);

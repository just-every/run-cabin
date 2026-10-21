CREATE TABLE cb_guest_challenges (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, link_id TEXT NOT NULL,
 browser_hash TEXT NOT NULL, code_hash TEXT NOT NULL, email_hash TEXT NOT NULL,
 session_epoch TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 consumed_at INTEGER, status TEXT NOT NULL CHECK(status IN ('pending','accepted','failed'))
);
CREATE INDEX cb_guest_challenge_browser ON cb_guest_challenges(booking_id,browser_hash,created_at);
CREATE TABLE cb_guest_sessions (
 token_hash TEXT PRIMARY KEY, booking_id TEXT NOT NULL, link_id TEXT NOT NULL,
 browser_hash TEXT NOT NULL, email_hash TEXT NOT NULL, session_epoch TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX cb_guest_session_booking ON cb_guest_sessions(booking_id);
CREATE TABLE cb_guest_limits (
 booking_id TEXT PRIMARY KEY, send_start INTEGER NOT NULL, sends INTEGER NOT NULL DEFAULT 0,
 wrong_start INTEGER NOT NULL, wrong INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE cb_guest_guide_files (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL, name TEXT NOT NULL,
 mime_type TEXT NOT NULL, sha256 TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX cb_guest_guide_property ON cb_guest_guide_files(property_id);

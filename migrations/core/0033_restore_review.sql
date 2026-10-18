CREATE TABLE cb_restore_review (
 id INTEGER PRIMARY KEY CHECK(id=1),
 restored INTEGER NOT NULL CHECK(restored IN (0,1)),
 reviewed INTEGER NOT NULL CHECK(reviewed IN (0,1)),
 revision TEXT NOT NULL,
 reviewed_by TEXT,
 reviewed_at TEXT
);
INSERT INTO cb_restore_review(id,restored,reviewed,revision) VALUES(1,0,1,'new-installation');
INSERT OR IGNORE INTO cb_provider_sharing(id,enabled,revision,changed_at) VALUES
 ('calendars',1,'initial','1970-01-01T00:00:00.000Z'),
 ('mail',1,'initial','1970-01-01T00:00:00.000Z'),
 ('stripe',1,'initial','1970-01-01T00:00:00.000Z'),
 ('seam',1,'initial','1970-01-01T00:00:00.000Z'),
 ('twilio',1,'initial','1970-01-01T00:00:00.000Z'),
 ('booking',1,'initial','1970-01-01T00:00:00.000Z'),
 ('anthropic',1,'initial','1970-01-01T00:00:00.000Z'),
 ('pantry',1,'initial','1970-01-01T00:00:00.000Z');

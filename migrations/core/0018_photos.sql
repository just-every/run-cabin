-- A turnover is ready with several photos, and maintenance tasks carry theirs:
-- turnover_id now names the record a photo evidences (a turnover or a task),
-- and position orders a record's photos.
CREATE TABLE cb_photos_next(id TEXT PRIMARY KEY,turnover_id TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,mime_type TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL,caption TEXT NOT NULL,uploaded_by TEXT NOT NULL,uploaded_at TEXT NOT NULL,UNIQUE(turnover_id,position));
INSERT INTO cb_photos_next(id,turnover_id,position,mime_type,bytes,sha256,caption,uploaded_by,uploaded_at) SELECT id,turnover_id,0,mime_type,bytes,sha256,caption,uploaded_by,uploaded_at FROM cb_photos;
DROP TABLE cb_photos;
ALTER TABLE cb_photos_next RENAME TO cb_photos;

CREATE TABLE cb_verifications(id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE, property_id TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX cb_verifications_property ON cb_verifications(property_id);

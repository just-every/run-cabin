-- Direct booking configuration and guest records belong to this installation.
CREATE TABLE cb_direct_homes(property_id TEXT PRIMARY KEY REFERENCES cb_properties(id) ON DELETE CASCADE,slug TEXT NOT NULL UNIQUE,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE cb_direct_stays(id TEXT PRIMARY KEY,property_id TEXT NOT NULL REFERENCES cb_properties(id) ON DELETE RESTRICT,token_hash TEXT NOT NULL UNIQUE,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE INDEX cb_direct_stays_property ON cb_direct_stays(property_id);

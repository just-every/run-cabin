CREATE TABLE cb_provider_moveins(
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL,
 provider TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 plan TEXT NOT NULL CHECK(json_valid(plan)),
 status TEXT NOT NULL CHECK(status IN ('review','imported','signed-off','undone')),
 created_at TEXT NOT NULL,
 imported_at TEXT,
 signed_off_at TEXT,
 explanations TEXT CHECK(explanations IS NULL OR json_valid(explanations)),
 inventory TEXT CHECK(inventory IS NULL OR json_valid(inventory))
);
CREATE TABLE cb_movein_guests(
 id TEXT PRIMARY KEY,
 movein_id TEXT NOT NULL REFERENCES cb_provider_moveins(id),
 source_id TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE TABLE cb_opening_balances(
 id TEXT PRIMARY KEY,
 movein_id TEXT NOT NULL REFERENCES cb_provider_moveins(id),
 property_id TEXT NOT NULL REFERENCES cb_properties(id),
 source_id TEXT NOT NULL,
 owner_email TEXT NOT NULL,
 amount_cents INTEGER NOT NULL,
 as_of TEXT NOT NULL
);

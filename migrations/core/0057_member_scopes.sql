CREATE TABLE cb_member_scopes (
 member_id TEXT PRIMARY KEY REFERENCES cb_members(id) ON DELETE CASCADE,
 pms_role TEXT NOT NULL,
 property_ids TEXT NOT NULL CHECK(json_valid(property_ids)),
 actions TEXT NOT NULL CHECK(json_valid(actions)),
 revision INTEGER NOT NULL
);
CREATE TABLE cb_member_offboarding (email TEXT PRIMARY KEY COLLATE NOCASE, at TEXT NOT NULL);

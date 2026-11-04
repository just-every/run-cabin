-- A native person keeps one durable link to each sign-in identity their grant has used.
-- An address change must not hide the earlier identity from a reviewed erasure.
CREATE TABLE cb_member_operators (
  operator_id TEXT PRIMARY KEY REFERENCES oa_operators(id),
  member_id TEXT NOT NULL REFERENCES cb_members(id)
);
CREATE INDEX cb_member_operators_member ON cb_member_operators(member_id);

-- Signed Business admission binds an existing native operator to its native grant once.
-- Addresses remain contact fields and cannot transfer a company's sponsorship.
CREATE TABLE cb_agent_people (
  operator_id TEXT PRIMARY KEY REFERENCES oa_operators(id),
  member_id TEXT NOT NULL UNIQUE REFERENCES cb_members(id)
);

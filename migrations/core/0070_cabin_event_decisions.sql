-- These event types already identify the disposition determined by Base.
-- Preserve the retained ID, actor, classes and time, including on archive import.
CREATE TRIGGER cb_agent_event_decision
AFTER INSERT ON agent_door_events
WHEN json_extract(NEW.event,'$.type') IN ('approval.pending','review.flagged')
  AND json_type(NEW.event,'$.decision') IS NULL
  AND json_type(NEW.event,'$.tombstone') IS NULL
BEGIN
  UPDATE agent_door_events
  SET event=json_set(event,'$.decision',CASE json_extract(event,'$.type')
    WHEN 'approval.pending' THEN 'approval' ELSE 'review' END)
  WHERE id=NEW.id;
END;

UPDATE agent_door_events
SET event=json_set(event,'$.decision',CASE json_extract(event,'$.type')
  WHEN 'approval.pending' THEN 'approval' ELSE 'review' END)
WHERE json_extract(event,'$.type') IN ('approval.pending','review.flagged')
  AND json_type(event,'$.decision') IS NULL
  AND json_type(event,'$.tombstone') IS NULL;

-- One ordinary, partial covering expression index. Search still scans every
-- retained message, but reads indexed expressions rather than decoding bodies;
-- booking-first order also supports complete-thread activity and grouping.
CREATE INDEX cb_records_inbox_activity ON cb_records(
 json_extract(data,'$.bookingId'),
 CASE WHEN json_extract(data,'$.email') IS NOT NULL THEN 'e:'||json_extract(data,'$.email') WHEN json_extract(data,'$.phone') IS NOT NULL THEN 'p:'||json_extract(data,'$.phone') ELSE 'r:'||COALESCE(json_extract(data,'$.ref'),'unknown') END,
 json_extract(data,'$.propertyId'),
 COALESCE(json_extract(data,'$.sentAt'),json_extract(data,'$.createdAt'),''),
 CASE WHEN json_extract(data,'$.status') IN ('draft','drafting') THEN 1 ELSE 0 END,
 lower(COALESCE(json_extract(data,'$.text'),'')||' '||COALESCE(json_extract(data,'$.subject'),'')||' '||COALESCE(json_extract(data,'$.email'),'')||' '||COALESCE(json_extract(data,'$.phone'),'')||' '||COALESCE(json_extract(data,'$.ref'),''))
) WHERE kind='messages' AND json_extract(data,'$.status')!='discarded';

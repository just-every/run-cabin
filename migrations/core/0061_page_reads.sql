-- Native HTML pages narrow property and conversation reads before decoding bodies.
CREATE INDEX cb_records_message_booking ON cb_records(kind,json_extract(data,'$.bookingId'),json_extract(data,'$.createdAt'));
CREATE INDEX cb_records_property ON cb_records(kind,json_extract(data,'$.propertyId'));
CREATE INDEX cb_records_message_status ON cb_records(kind,json_extract(data,'$.status'));

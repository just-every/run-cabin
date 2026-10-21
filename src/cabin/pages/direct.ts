/** Calendar payment context contains no signed agreements, identity images or provider credentials. */
export async function calendarDirect(db:D1Database,bookingIds:string[]){
 const rows=await db.batch<{data:string}>([
  db.prepare("SELECT json_object('propertyId',property_id,'nightlyCents',json_extract(data,'$.nightlyCents'),'enabled',json_extract(data,'$.enabled'),'slug',slug) data FROM cb_direct_homes"),
  db.prepare("SELECT json_object('propertyId',property_id,'bookingId',json_extract(data,'$.bookingId'),'phase',json_extract(data,'$.phase'),'quote',json_extract(data,'$.quote'),'paymentId',json_extract(data,'$.paymentId'),'paymentMode',json_extract(data,'$.paymentMode'),'guestName',json_extract(data,'$.guestName'),'email',json_extract(data,'$.email'),'arrivalAt',json_extract(data,'$.arrivalAt'),'departureAt',json_extract(data,'$.departureAt'),'timeZone',json_extract(data,'$.timeZone')) data FROM cb_direct_stays WHERE json_extract(data,'$.bookingId') IN (SELECT value FROM json_each(?)) ORDER BY rowid DESC").bind(JSON.stringify(bookingIds)),
 ])
 return {homes:rows[0].results.map(r=>JSON.parse(r.data)),stays:rows[1].results.map(r=>JSON.parse(r.data))}
}

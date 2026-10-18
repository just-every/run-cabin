import { type Context, query } from '../model'
/** Append before the property's cb_records deletion, inside the existing erasure transaction/checkpoint.
 * View events contain only opaque references and a hashed owner key. Names/email are joined from
 * the frozen statement on read, so they disappear when that statement is erased. */
export function eraseOwnerProperty(c:Context,propertyId:string){
 const scope="SELECT id FROM cb_records WHERE kind='statements' AND json_extract(data,'$.propertyId')=?"
 c.queries.push(query(`DELETE FROM cb_owner_statement_grants WHERE statement_id IN (${scope})`,propertyId))
 for(const table of ['cb_owner_reserve_reports','cb_owner_policies','cb_owner_documents','cb_owner_expenses','cb_owner_stay_requests'])c.queries.push(query(`DELETE FROM ${table} WHERE property_id=?`,propertyId))
}

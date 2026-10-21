import { rentalInterests } from './interests'
import { type Context, type Member, type MemberScope, need, query, text } from '../model'
import { roleActions,roleNames,serviceRole,type PmsRole } from './policy'
export function memberGrant(c:Context,input:Record<string,unknown>,old:Member|undefined):{role:'manager'|'cleaner';scope:MemberScope}{
 const name=String(input.pmsRole??old?.scope?.pmsRole??input.role),pmsRole=name as PmsRole
 need(Object.hasOwn(roleNames,pmsRole),'Choose a PMS role')
 const explicit=input.propertyIds!==undefined||input.actions!==undefined||!old&&input.pmsRole!==undefined
 const list=(v:unknown,label:string)=>{const rows=typeof v==='string'?[v]:v;need(Array.isArray(rows)&&rows.length>0,`Choose ${label}`);return [...new Set(rows.map(v=>text(v,label,100)))]}
 const propertyIds=explicit?list(input.propertyIds,'properties'):old?.scope?.propertyIds??['*']
 need(propertyIds.every(id=>id==='*'||c.data.properties.some(p=>p.id===id)),'Choose existing properties')
 const actions=explicit?list(input.actions,'actions'):old?.scope?.actions??['*']
 need(actions.every(a=>!explicit&&a==='*'||roleActions[pmsRole].includes(a)),'An action is outside this role')
 if(pmsRole==='rental_owner')need(!propertyIds.includes('*')&&propertyIds.every(id=>rentalInterests(c.data,String(input.email),Date.parse(c.now)).some(p=>p.propertyId===id)),'Rental owners can receive only their own current interests',403)
 return {role:serviceRole(pmsRole)?'cleaner':'manager',scope:{pmsRole,propertyIds,actions,revision:(old?.revision??0)+1}}
}
export function saveMemberGrant(c:Context,row:Member){
 const s=row.scope!
 c.queries.push(query('INSERT INTO cb_member_scopes(member_id,pms_role,property_ids,actions,revision) VALUES(?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET pms_role=excluded.pms_role,property_ids=excluded.property_ids,actions=excluded.actions,revision=excluded.revision',row.id,s.pmsRole,JSON.stringify(s.propertyIds),JSON.stringify(s.actions),row.revision))
 if(row.active)c.queries.push(query('DELETE FROM cb_member_offboarding WHERE email=? COLLATE NOCASE',row.email))
 else{
  c.queries.push(query('INSERT INTO cb_member_offboarding(email,at) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET at=excluded.at',row.email,c.now),query('DELETE FROM cb_owner_sessions WHERE email=? COLLATE NOCASE',row.email),query('DELETE FROM cb_owner_links WHERE email=? COLLATE NOCASE',row.email))
  for(const code of c.data.codes.filter(code=>code.memberId===row.id&&code.status==='issued')){code.status='revoked';code.reason='Team member offboarded';if(code.lock.providerId)code.lock={...code.lock,state:'pending',error:null}}
 }
 const index=c.data.members.findIndex(m=>m.id===row.id);if(index<0)c.data.members.push(row);else c.data.members[index]=row
}

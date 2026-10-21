import { load } from '../storage'
import { rentalInterests } from './interests'
import { type Actor, type MemberScope } from '../model'
export { hasAction, permitsProperty } from './policy'
export async function memberActor(db:D1Database,operatorId:string):Promise<Actor|null>{
 const row=await db.prepare(`SELECT o.id,o.email,o.version AS operatorVersion,o.role AS operatorRole,m.id AS memberId,m.role,m.version AS memberVersion,s.pms_role,s.property_ids,s.actions,s.revision FROM oa_operators o LEFT JOIN cb_members m ON m.email=o.email COLLATE NOCASE AND m.active=1 LEFT JOIN cb_member_scopes s ON s.member_id=m.id WHERE o.id=? AND o.status='active'`).bind(operatorId).first<any>()
 if(!row)return null
 if(row.operatorRole==='owner')return {id:row.id,email:row.email,role:'owner',operatorVersion:row.operatorVersion,isAgent:false}
 if(row.operatorRole!=='member'||!row.memberId)return null
 const scope:MemberScope|undefined=row.pms_role?{pmsRole:row.pms_role,propertyIds:JSON.parse(row.property_ids),actions:JSON.parse(row.actions),revision:row.revision}:undefined
 let interests
 if(scope?.pmsRole==='rental_owner'){interests=rentalInterests(await load(db),row.email).filter(p=>scope.propertyIds.includes(p.propertyId));if(interests.length!==scope.propertyIds.length)return null}
 return {interests,id:row.id,email:row.email,role:row.role,memberId:row.memberId,memberVersion:row.memberVersion,operatorVersion:row.operatorVersion,isAgent:false,scope}
}

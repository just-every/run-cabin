import { type Context, text, integer, need, owner, query, newId, sha } from './model'
import { capacityCommand } from './dispatch/settings'
export async function peopleCommand(c:Context,name:string,p:Record<string,unknown>){
 const capacity = capacityCommand(c,name,p); if(capacity !== undefined)return capacity
 if(name==='property.save'){
  owner(c.actor);const old=p.id?c.data.properties.find(r=>r.id===text(p.id,'property ID')):undefined
  need(!p.id||old,'Property not found',404);if(old)need(integer(p.revision,'revision',1)===old.revision,'Property changed; reload',409)
  const id=old?.id??newId(),email=text(p.ownerEmail,'owner email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid owner email')
  need(!await c.db.prepare("SELECT 1 FROM cb_erasure_fences WHERE entity='property' AND id_hash IN (?,?)").bind(await sha(id),await sha(email)).first(),'An erased property identity cannot be reimported',409)
  const row={id,revision:(old?.revision??0)+1,name:text(p.name,'property name',160),ownerName:text(p.ownerName,'owner name',160),ownerEmail:email,commissionBps:integer(p.commissionBps,'commissionBps',0,10000)}
  c.queries.push(query('INSERT INTO cb_properties(id,name,owner_name,owner_email,commission_bps,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,owner_name=excluded.owner_name,owner_email=excluded.owner_email,commission_bps=excluded.commission_bps,version=excluded.version',row.id,row.name,row.ownerName,row.ownerEmail,row.commissionBps,row.revision));c.entityId=id;return row
 }
 if(name==='member.save'){
  owner(c.actor);const old=p.id?c.data.members.find(m=>m.id===text(p.id,'member ID')):undefined
  need(!p.id||old,'Member not found',404);if(old)need(integer(p.revision,'revision',1)===old.revision,'Member changed; reload',409)
  const email=text(p.email,'email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email');need(p.role==='manager'||p.role==='cleaner','Choose manager or cleaner');need(typeof p.active==='boolean','Set active explicitly')
  need(!await c.db.prepare("SELECT 1 FROM cb_erasure_fences WHERE entity='member' AND id_hash=?").bind(await sha(email)).first(),'This identity was erased',409)
  need(!c.data.members.some(m=>m.id!==old?.id&&m.email.toLowerCase()===email),'Email already has a grant',409)
  const row={id:old?.id??newId(),name:text(p.name,'member name',160),email,role:p.role,active:p.active,revision:(old?.revision??0)+1}
  c.queries.push(query('INSERT INTO cb_members(id,name,email,role,active,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active,version=excluded.version',row.id,row.name,row.email,row.role,row.active?1:0,row.revision));c.entityId=row.id;return row
 }
 return undefined
}

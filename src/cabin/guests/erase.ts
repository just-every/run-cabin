import { newId, type Context } from '../model'
import { guestGroup } from './resolve'
/** Erase reservation origins without stranding a reviewed group at another home. */
export function eraseProfiles(c:Context,ids:Set<string>) {
 const groups=new Map<string,ReturnType<typeof guestGroup>>()
 for(const id of ids){const group=guestGroup(c.data,id);if(group.length)groups.set(group.map(g=>g.id).sort().join(':'),group)}
 for(const group of groups.values()){
  const remaining=group.filter(g=>!ids.has(g.id)),root=remaining.find(g=>!g.mergedInto)??remaining[0]
  if(root)for(const g of remaining){if(g.id===root.id)delete g.mergedInto;else g.mergedInto=root.id;g.revision=newId()}
 }
 for(const g of c.data.guests)if(ids.has(g.id)){g.identities=[];g.facts=[];g.consents=[];g.erasedAt=c.now;g.revision=newId();delete g.mergedInto}
 for(const m of c.data.guestMerges)if(ids.has(m.fromId)||ids.has(m.intoId)){m.reason='Guest identity erased';m.revision=newId()}
 for(const o of c.data.guestOffers)if(ids.has(o.guestId)||o.profileIds.some(id=>ids.has(id))){o.status='revoked';o.email='';o.guestName='Erased guest';o.tokenHash='';o.revision=newId()}
}

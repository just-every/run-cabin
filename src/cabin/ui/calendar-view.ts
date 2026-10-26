import { sharesCapacity } from '../capacity'
const cache=new WeakMap<object,Map<string,any>>()
/** One render's home-local records; no data or timing is cached across requests. */
export function calendarHome(state:any,propertyId:string) {
 let homes=cache.get(state);if(!homes){homes=new Map();cache.set(state,homes)}
 let view=homes.get(propertyId)
 if(!view){view={...state};for(const kind of ['bookings','turnovers','tasks','codes','homeSettings','feeds','connections','requests','readinessPlans','readinessRecords'])view[kind]=(state[kind]??[]).filter((r:any)=>kind==='bookings'?sharesCapacity(state,r.propertyId,propertyId):r.propertyId===propertyId);homes.set(propertyId,view)}
 return view
}

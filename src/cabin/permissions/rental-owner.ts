import { hasAction } from './policy'
import type { Bindings } from '../../auth.server'
import { type Actor,need } from '../model'
import { ownersResponse } from '../owners/http'
/** Native rental-owner sessions reuse the owner portal without manufacturing a second session. */
export async function rentalOwnerResponse(request:Request,env:Bindings,actor:Actor){
 need(hasAction(actor,'owners:read'),'Owner reads are outside your grant',403)
 need(actor.scope?.pmsRole==='rental_owner','Rental-owner access required',403)
 const original=new URL(request.url),url=new URL(request.url)
 url.pathname=original.pathname==='/app'?'/owners':original.pathname.replace('/app/rental-owner','/owners')
 const response=await ownersResponse(new Request(url,request),env,actor);need(response,'Not found',404)
 const headers=new Headers(response.headers),location=headers.get('location')
 if(location?.startsWith('/owners'))headers.set('location',location.replace('/owners','/app/rental-owner'))
 if(headers.get('content-type')?.includes('text/html'))return new Response((await response.text()).replaceAll('/owners/signout','/auth/signout').replace(/\/owners(?=\/|[?#"'])/g,'/app/rental-owner'),{status:response.status,headers})
 return new Response(response.body,{status:response.status,headers})
}

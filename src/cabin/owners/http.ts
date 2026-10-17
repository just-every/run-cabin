import { runtimeBindings,type Bindings } from '../../auth.server'
import { need } from '../model'
import { ownerEmail,portalState,requestOwnerLink,confirmOwner,signOutOwner,ownerCsv } from './access'
import { portalPage,signInPage,confirmationPage } from './ui'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
export async function ownersResponse(request:Request,original:Bindings):Promise<Response|null>{
 const env=runtimeBindings(original),url=new URL(request.url),path=url.pathname
 if(path!=='/owners'&&!path.startsWith('/owners/'))return null
 try{
  need(url.origin===env.AUTH_ORIGIN,'Wrong application origin',403)
  need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  if(request.method==='POST'){
   need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
   need(Number(request.headers.get('content-length')??0)<4096,'Request too large',413)
   const value=request.headers.get('content-type')?.includes('application/json')?await request.json():Object.fromEntries(await request.formData())
   if(path==='/owners/signin'){await requestOwnerLink(env,value as Record<string,unknown>);return signInPage(env.AUTH_LOCAL==='true'||env.RER_DEMO==='1'?'Local development does not send email. Ask your manager to preview your owner portal from Statements.':'If this address owns a home, a sign-in link is on its way.')}
   if(path==='/owners/confirm')return new Response(null,{status:303,headers:{...headers,location:'/owners','set-cookie':await confirmOwner(env,(value as any).token)}})
   if(path==='/owners/signout')return new Response(null,{status:303,headers:{...headers,location:'/owners/signin','set-cookie':await signOutOwner(request,env)}})
  }else{
   if(path==='/owners/signin')return signInPage()
   if(path==='/owners/confirm')return confirmationPage(url.searchParams.get('token')??'')
   const email=await ownerEmail(request,env)
   if(path==='/owners')return portalPage(await portalState(env,email))
   if(path==='/owners/api/state')return Response.json(await portalState(env,email),{headers})
   const csv=path.match(/^\/owners\/statements\/([\w-]+)\.csv$/)
   if(csv)return new Response(await ownerCsv(env,email,csv[1]),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-statement-${csv[1]}.csv"`}})
  }
  return Response.json({error:'Not found'},{status:404,headers})
 }catch(error){
  const status=Number((error as any).status)||500,message=status<500?(error as Error).message:'Could not complete the request. Try again.'
  if(status===401&&path==='/owners')return new Response(null,{status:303,headers:{...headers,location:'/owners/signin'}})
  if(path==='/owners/api/state'||path.endsWith('.csv'))return Response.json({error:message},{status,headers})
  return signInPage(message,status)
 }
}

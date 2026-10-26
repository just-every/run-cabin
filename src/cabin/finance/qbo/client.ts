import type { Bindings } from '../../../auth.server'
import { unseal } from '../../seal'
import { need } from '../../model'
import { sharingAllowed } from '../../connections/guard'
import type { Connection } from './types'
export class QboError extends Error { constructor(readonly status:number,readonly code:string) {super(status===401?'QuickBooks authorization expired or was revoked. Reconnect the company.':`QuickBooks refused the request (HTTP ${status}, code ${code}). Review it in QuickBooks before trying this saved entry again.`)} }
export const apiOrigin=(mode:string)=>mode==='sandbox'?'https://sandbox-quickbooks.api.intuit.com':'https://quickbooks.api.intuit.com'
export async function app(env:Bindings) {
 const row=await env.DB.prepare('SELECT sealed FROM cb_qbo_app WHERE id=1').first<{sealed:string}>()
 if(row){const value=await unseal(env.SESSION_SECRET,'quickbooks-app',row.sealed);need(value,'Reconfigure the QuickBooks developer app on this installation',409);return JSON.parse(value) as {clientId:string;clientSecret:string}}
 need(env.QUICKBOOKS_CLIENT_ID&&env.QUICKBOOKS_CLIENT_SECRET,'Configure the QuickBooks app client ID and secret first',503);return {clientId:env.QUICKBOOKS_CLIENT_ID,clientSecret:env.QUICKBOOKS_CLIENT_SECRET}
}
export async function tokenRequest(env:Bindings,params:Record<string,string>) {
 await sharingAllowed(env.DB,'quickbooks','journal:read')
 const credentials=await app(env)
 let r:Response
 try {r=await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{authorization:'Basic '+btoa(credentials.clientId+':'+credentials.clientSecret),'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:new URLSearchParams(params)})}catch{throw new QboError(502,'unreachable')}
 if(!r.ok)throw new QboError(r.status,'oauth')
 const data=await r.json() as any
 need(typeof data.access_token==='string'&&typeof data.refresh_token==='string'&&Number.isFinite(data.expires_in)&&data.expires_in>0,'QuickBooks returned an invalid authorization response',502)
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:new Date(Date.now()+data.expires_in*1000).toISOString()}
}
export async function api<T=any>(env:Bindings,c:Connection,path:string,body?:unknown,propertyId?:string):Promise<T> {
 await sharingAllowed(env.DB,'quickbooks',body===undefined?'journal:read':'journal:write',propertyId)
 let r:Response
 try {r=await fetch(apiOrigin(c.mode)+'/v3/company/'+encodeURIComponent(c.realm)+'/'+path,{method:body===undefined?'GET':'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{authorization:'Bearer '+c.grant.accessToken,accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})}catch{throw new QboError(502,'unreachable')}
 const data=await r.json().catch(()=>null) as any
 if(!r.ok||data?.Fault)throw new QboError(r.status===200?400:r.status,String(data?.Fault?.Error?.[0]?.code??'response').replace(/[^\w-]/g,'').slice(0,30))
 need(data&&typeof data==='object','QuickBooks returned an unreadable response',502);return data as T
}
export async function query(env:Bindings,c:Connection,kind:string,where='',propertyId?:string) {
 const result=[]
 for(let start=1;start<=10001;start+=1000){const data=await api(env,c,'query?'+new URLSearchParams({query:`select * from ${kind}${where?' where '+where:''} STARTPOSITION ${start} MAXRESULTS 1000`}),undefined,propertyId),page=data.QueryResponse?.[kind]??[];need(Array.isArray(page),'Invalid QuickBooks query response',502);result.push(...page);if(page.length<1000)return result}
 need(false,'QuickBooks result is too large; narrow the accounting window',409)
}

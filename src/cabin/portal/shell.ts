import { themeFrame } from '../../base/theme-frame'
import branding from '../../branding.json'
import { h } from '../ui/shared'
export const portalHeaders={'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
export async function portalShell(home:string,body:string,status=200,cookies:string[]=[]){
 const frame=await themeFrame({href:'/rer-theme.css',productName:branding.name,accentColor:branding.primaryColor}),headers=new Headers({...portalHeaders,'content-security-policy':`default-src 'self'; ${frame.policy}; script-src 'none'; base-uri 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'`})
 for(const cookie of cookies)headers.append('set-cookie',cookie)
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your stay at ${h(home)}</title>${frame.head}<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/cabin.css"><link rel="stylesheet" href="/ops.css"><link rel="stylesheet" href="/booking.css"><link rel="stylesheet" href="/recovery.css"></head><body class="cabin guest"><header><span class="brand">${h(branding.name)}</span><span>Your stay · ${h(home)}</span></header><main id="main" class="stay-page">${body}</main></body></html>`,{status,headers})
}

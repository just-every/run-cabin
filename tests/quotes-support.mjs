import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
import { homeDay } from './home-calendar.mjs'
const syntheticStripeKey='synthetic-quote'
export const quoteDay=n=>homeDay(n,'America/New_York')
export async function quoteHarness(options={}){
 const sessions=new Map();let creates=0,paid=false
 const h=await harness({root:options.root,assets:options.assets,auth:{STRIPE_TEST_SECRET_KEY:['sk','test',syntheticStripeKey.replace('-','')].join('_')},outbound:async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');const form=new URLSearchParams(await request.text())
  if(url.pathname==='/v1/checkout/sessions'&&request.method==='POST'){
   const id='cs_quote_'+(++creates),amount=[...form].filter(([k])=>/line_items\[\d+\]\[price_data\]\[unit_amount\]/.test(k)).reduce((n,[,v])=>n+Number(v),0)
   const session={id,url:'https://checkout.stripe.com/c/pay/'+id,metadata:{stayId:form.get('metadata[stayId]')},amount_total:amount,currency:'usd',success_url:form.get('success_url')};sessions.set(id,session);return Response.json(session)
  }
  const session=sessions.get(url.pathname.split('/').at(-1));if(session)return Response.json({...session,status:paid?'complete':'open',payment_status:paid?'paid':'unpaid',payment_intent:paid?{id:'pi_'+session.id,status:'succeeded',amount_received:session.amount_total,currency:'usd',payment_method:'pm_quote'}:null})
  assert.fail('Unexpected Stripe request '+url.pathname)
 }})
 const p=await h.cmd('property.save',{name:'Harbor House',ownerName:'Morgan Owner',ownerEmail:'morgan@stay.example',commissionBps:2000})
 const cfg={propertyId:p.id,enabled:true,slug:'harbor-house',description:'A quiet coastal home',nightlyCents:15000,cleaningCents:5000,extraGuestCents:1000,includedGuests:2,maxGuests:4,minNights:2,maxNights:28,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'Lodging tax',taxBps:900,countyTaxLabel:'County',countyTaxBps:100,agreement:'Quiet hours after 10 pm',requireIdentity:false,policyName:'50% cancellation charge; full total on no-show',retainedBps:5000,noShowBps:10000}
 const home=await h.cmd('direct.configure',cfg)
 const input={propertyId:p.id,guestName:'Alex Rivera',email:'alex@stay.example',start:quoteDay(15),end:quoteDay(18),guests:3,expiresAt:new Date(Date.now()+86400000).toISOString(),hold:'yes'}
 const link=async row=>{const res=await h.send('/api/cabin/quotes/'+row.id+'/link',undefined,h.owner);assert.equal(res.status,303,res.text);return res.headers.get('location')}
 const accept=async(row,path,extra={})=>h.send(path+'/checkout',{start:input.start,end:input.end,guests:input.guests,homeRevision:home.revision,staffQuoteRevision:row.revision,guestName:input.guestName,email:input.email,signature:input.guestName,consent:'yes',...extra})
 return {...h,get mf(){return h.mf},get db(){return h.db},p,cfg,home,input,link,accept,sessions,get creates(){return creates},pay(){paid=true}}
}

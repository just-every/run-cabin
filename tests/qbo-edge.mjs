import assert from 'node:assert/strict'
export function qboEdge(){
 const entries=[],requests=new Map(),writes=[];let revoke=false,lose=false,reject=false,refreshes=0
 const accounts=['cash','receivable','advances','damageAuthorization','damageHolds','ownerLiability','managerRevenue','channelFees','expenses','taxes','guestCredits','vendorPayable','processorFunds','allocationClearing','ownerReserves','managerExpenses'].map((Id,i)=>({Id,Name:'Synthetic Cabin Account '+i,AccountType:'Other Current Asset',Active:true}))
 const classes=[{Id:'synthetic-cabin-class-1',Name:'Synthetic Cabin Class',Active:true}],vendors=[{Id:'synthetic-cabin-vendor-1',DisplayName:'Synthetic Cabin Owner',Active:true}]
 const outbound=async request=>{
  const url=new URL(request.url)
  if(url.hostname==='oauth.platform.intuit.com'){refreshes++;return Response.json({access_token:'synthetic-cabin-access-'+refreshes,refresh_token:'synthetic-cabin-refresh-'+refreshes,expires_in:3600})}
  assert.equal(url.hostname,'sandbox-quickbooks.api.intuit.com');assert.match(request.headers.get('authorization'),/^Bearer synthetic-cabin-/)
  if(revoke)return Response.json({Fault:{Error:[{code:'3200'}]}},{status:401})
  if(url.pathname.endsWith('/preferences'))return Response.json({Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}})
  if(url.pathname.includes('/companyinfo/'))return Response.json({CompanyInfo:{CompanyName:'Synthetic Cabin Sandbox',Country:'US'}})
  if(url.pathname.endsWith('/query')){
   const query=url.searchParams.get('query'),kind=query.match(/from (\w+)/)[1];let rows=kind==='Account'?accounts:kind==='Class'?classes:kind==='Vendor'?vendors:entries
   const doc=query.match(/DocNumber = '([^']+)'/);if(doc)rows=rows.filter(e=>e.DocNumber===doc[1])
   return Response.json({QueryResponse:{[kind]:rows}})
  }
  const id=url.pathname.match(/\/journalentry\/([^/]+)$/)?.[1]
  if(id){const e=entries.find(e=>e.Id===id);return e?Response.json({JournalEntry:e}):Response.json({Fault:{Error:[{code:'610'}]}},{status:404})}
  assert.ok(url.pathname.endsWith('/journalentry'));const key=url.searchParams.get('requestid'),body=await request.json();assert.ok(key);writes.push(key)
  if(requests.has(key))return Response.json({JournalEntry:requests.get(key)})
  if(reject)return Response.json({Fault:{Error:[{code:'6000'}]}},{status:400})
  const row={...body,Id:'synthetic-cabin-journal-'+(entries.length+1),SyncToken:'0'};entries.push(row);requests.set(key,row)
  if(lose){lose=false;throw Error('Synthetic lost response after acceptance')}
  return Response.json({JournalEntry:row})
 }
 return {outbound,entries,writes,accounts,classes,vendors,get refreshes(){return refreshes},revoke:()=>{revoke=true},restore:()=>{revoke=false},loseResponse:()=>{lose=true},reject:()=>{reject=true}}
}

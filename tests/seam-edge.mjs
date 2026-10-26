// A provider edge with persistent remote resources: application storage and HTTP remain real.
export function seamEdge({intercept}={}) {
 const codes=new Map(),calls=[]
 const outbound=async request=>{
  const url=new URL(request.url)
  if(url.hostname!=='connect.getseam.com')return new Response('Unexpected provider edge',{status:599})
  const action=url.pathname.split('/').at(-1),body=request.method==='GET'?Object.fromEntries(url.searchParams):await request.json()
  const call={action,path:url.pathname,body,auth:request.headers.get('authorization'),method:request.method};calls.push(call)
  const before=await intercept?.({...call,phase:'before',codes});if(before)return before
  let result
  if(action==='create'){
   const row={...body,access_code_id:'synthetic-cabin-'+(codes.size+calls.length),status:'set',errors:[],pending_mutations:[]};codes.set(row.access_code_id,row);result={access_code:{...row}}
  }else if(action==='update'){
   const row=codes.get(body.access_code_id);if(!row)return Response.json({ok:false},{status:404})
   Object.assign(row,body,{status:'set'});result={access_code:{...row}}
  }else if(action==='delete'){codes.delete(body.access_code_id);result={ok:true}}
  else if(action==='get'){const row=codes.get(body.access_code_id);result=row?{access_code:{...row}}:{ok:false};if(!row)return Response.json(result,{status:404})}
  else if(action==='list')result={access_codes:[...codes.values()].filter(row=>row.device_id===body.device_id).map(row=>({...row})),pagination:{has_next_page:false}}
  else return new Response('Unknown provider route',{status:404})
  return await intercept?.({...call,phase:'after',codes,result})??Response.json(result)
 }
 return {outbound,calls,codes,writes:()=>calls.filter(c=>['create','update','delete'].includes(c.action))}
}

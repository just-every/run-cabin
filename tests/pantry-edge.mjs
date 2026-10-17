import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// Only the external Pantry network boundary is replaced in the core-flow test.
export function pantryEdge() {
 const accounts = [['clearing','1001','Payout clearing','asset'],['owner-funds','2100','Owner funds','liability'],['management','4001','Management fees','income']].map(([id,code,name,type])=>({id,code,name,type,active:1,subtype:'other'}))
 const entries=[],documents=[],keys=new Map()
 let revoked=false,journalWrites=0
 return {
  entries, documents, get journalWrites(){return journalWrites}, revoke(){revoked=true},
  async fetch(request) {
   const url=new URL(request.url),path=url.pathname.replace('/api/pantry/integration/v1','')
   assert.equal(url.origin,'https://books.example.com')
   assert.match(request.headers.get('authorization'),/^Bearer pantry_integration_/)
   if(revoked)return Response.json({error:'Revoked'},{status:401})
   if(request.method==='GET') {
    if(path==='/state')return Response.json({accounts,taxCodes:[]})
    const collection=path==='/journals'?entries:documents,field=path==='/journals'?'entries':'documents'
    const rows=collection.filter(row=>[...url.searchParams].every(([key,value])=>['limit','cursor'].includes(key)||row[key]===value))
    return Response.json({[field]:rows,nextCursor:null})
   }
   const key=request.headers.get('idempotency-key');assert.ok(key)
   const body=await request.json(),prior=keys.get(key)
   if(prior){assert.deepEqual(prior.body,body);return Response.json(prior.record)}
   let record
   if(path==='/journals') {
    journalWrites++;assert.equal(body.post,true)
    record={id:'journal-'+journalWrites,entry_date:body.date,memo:body.memo,status:'posted',lines:body.lines.map(l=>({account_id:l.accountId,debit_cents:Math.round(Number(l.debit||0)*100),credit_cents:Math.round(Number(l.credit||0)*100),memo:l.memo}))}
    assert.equal(record.lines.reduce((n,l)=>n+l.debit_cents-l.credit_cents,0),0)
    entries.push(record)
   } else {
    assert.equal(path,'/documents')
    const source=Buffer.from(body.base64,'base64')
    record={id:'source-1',name:body.name,sha256:createHash('sha256').update(source).digest('hex'),linked_kind:body.linkedKind,linked_id:body.linkedId}
    const evidence=JSON.parse(source.toString());assert.equal(evidence.matchedPayouts.length,2);assert.equal(evidence.matchedBookings.length,2);assert.equal(evidence.statement.expenseCents,5000)
    documents.push(record)
   }
   keys.set(key,{body,record});return Response.json(record)
  }
 }
}

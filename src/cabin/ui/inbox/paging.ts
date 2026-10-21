import { h } from '../shared'
import type { InboxPage } from '../../pages/inbox'
import { threads } from '../../inbox/threads'

export function inboxLink(p:InboxPage,change:Record<string,string|number|null>={}) {
 const values={q:p.query||null,page:p.page>1?p.page:null,thread:p.open?.id??null,messages:p.messagePage>1?p.messagePage:null,...change},q=new URLSearchParams()
 for(const [key,value] of Object.entries(values))if(value!==null)q.set(key,String(value))
 return '/app/inbox'+(q.size?'?'+q.toString():'')
}
export function pagination(p:InboxPage,messages=false) {
 const current=messages?p.messagePage:p.page,total=messages?p.messageTotal:p.total,size=messages?p.messageSize:p.size,pages=messages?p.messagePages:p.pages
 const key=messages?'messages':'page',link=(n:number)=>inboxLink(p,{[key]:n,...(messages?{}:{thread:null,messages:null})})
 const start=total?(current-1)*size+1:0,end=Math.min(current*size,total)
 return `<nav class="pagination" aria-label="${messages?'Message':'Guest'} pages"><p role="status">${start}–${end} of ${total} ${messages?'messages · newest page first':'guests'} · page ${current} of ${pages}</p>${current>1?`<a class="button quiet" href="${h(link(current-1))}">${messages?'Newer messages':'Previous guests'}</a>`:''}${current<pages?`<a class="button quiet" href="${h(link(current+1))}">${messages?'Older messages':'Next guests'}</a>`:''}</nav>`
}
/** Action responses already have complete data; display the same explicit page. */
export function localInboxPage(s:any,thread?:string|null):InboxPage {
 const all=threads(s),selected=all.slice(0,25),source=all.find(t=>t.id===thread)??(thread?undefined:all[0]),open=source?{...source,messages:source.messages.slice(-50)}:undefined
 return {query:'',page:1,size:25,total:all.length,pages:Math.max(1,Math.ceil(all.length/25)),threads:selected,open,messagePage:1,messageSize:50,messageTotal:source?.messages.length??0,messagePages:Math.max(1,Math.ceil((source?.messages.length??0)/50)),latestIncoming:[...(source?.messages??[])].reverse().find(m=>m.direction==='in')}
}

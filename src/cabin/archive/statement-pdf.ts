import { closePdf } from '../finance/close-pdf'
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fontData from './inter-font.json'
import type { Statement } from '../model'
const usd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
/** Paginated portable statement; all amounts come from the frozen approved record. */
export async function statementPdf(s:Statement) {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit)
 const font=await pdf.embedFont(Uint8Array.from(atob(fontData),c=>c.charCodeAt(0)),{subset:true})
 pdf.setTitle(`${s.propertyName} - ${s.month} owner statement`);pdf.setAuthor('Cabin')
 const frozenAt=new Date(s.approval?.at??s.preparedAt);pdf.setCreationDate(frozenAt);pdf.setModificationDate(frozenAt)
 const green=rgb(.06,.25,.2),ink=rgb(.12,.16,.2),muted=rgb(.35,.4,.44)
 let page=pdf.addPage([612,792]),y=735
 const header=()=>{page.drawText('Cabin | Approved owner statement',{x:48,y:752,size:11,font,color:green});page.drawLine({start:{x:48,y:740},end:{x:564,y:740},color:green,thickness:1});y=714}
 header()
 const line=(value:string,size=11,color=ink)=>{
  for(const text of wrap(value,font,size,516)) {
   if(y<65){page=pdf.addPage([612,792]);header()}
   page.drawText(text,{x:48,y,size,font,color});y-=size+6
  }
 }
 line(s.propertyName,20,green);line(`${s.month} | ${s.ownerName}`);line(s.ownerEmail,10,muted);y-=14
 if(s.close)closePdf(s,line)
 for(const item of s.close?[]:s.lines){line(`${item.description}    ${usd(item.amountCents)}`);if(item.managementAgreementId)line(`Agreement ${item.managementAgreementId} | ${(item.commissionBps!/100).toFixed(2)}%`,9,muted)}
 y-=14
 if(s.source!=='recovery') {
  line(`Gross: ${usd(s.grossCents)}`);line(`Channel fees: ${usd(s.channelFeeCents??0)}`)
  line(`Paid owner expenses: ${usd(s.expenseCents??0)}`);line(`Management fee: ${usd(s.managementFeeCents)}`)
 }
 line(`${s.source==='recovery'?'Owner balance adjustment':'Owner payable'}: ${usd(s.netCents)}`,15,green);y-=12
 line(`Approved by ${s.approval?.actorName??'Recorded operator'} at ${s.approval?.at}`,9,muted)
 line(`Statement ${s.id} | Revision ${s.revision}`,8,muted)
 line('This statement records the amount due. It does not send a payment, refund or owner distribution.',9,muted)
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:520,y:32,size:9,font,color:muted}))
 return pdf.save()
}
function wrap(value:string,font:PDFFont,size:number,width:number) {
 const lines:string[]=[]
 for(const paragraph of value.split(/\r?\n/)) {
  let line=''
  for(const word of paragraph.split(/\s+/)) {
   if(line&&font.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line=''}
   if(font.widthOfTextAtSize(word,size)>width){
    for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line=''}line+=char}
   }else line+=(line?' ':'')+word
  }
  lines.push(line)
 }
 return lines
}

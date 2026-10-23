/** Text boundaries supplement structured omission; never use them to store credentials safely. */
export function sensitiveTextRedactor(secrets: readonly string[] = []) {
 const values=[...new Set(secrets.filter(v=>v.length>=4))].sort((a,b)=>b.length-a.length)
 const tokens=values.length?new RegExp(`(?<![A-Za-z0-9])(?:${values.map(secret=>secret.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})(?![A-Za-z0-9])`,'g'):undefined
 return (value:string) => {
 const result=tokens?value.replace(tokens,'[restricted]'):value
 return result
  .replace(/https?:\/\/[^\s<>"']*\/(?:offers\/|stay\/|ical\/|message-preferences\/|book\/stay\/|book\/quote\/|book\/return\/|book\/verification\/|owners\/confirm\?|auth\/confirm\?)[^\s<>"']*/gi, '[private link]')
  .replace(/\/message-preferences\/[a-z0-9_-]+\/[a-f0-9]{64}/gi, '[private link]')
  .replace(/\/(?:stay\/|book\/stay\/|book\/quote\/|book\/return\/|book\/verification\/)[a-z0-9_-]{20,}/gi, '[private link]')
  .replace(/\b(?:sk_(?:test|live)_[a-z0-9]+|sk-ant-[a-z0-9_-]+|Bearer\s+[a-z0-9._~-]+)/gi, '[credential]')
  .replace(/((?:door|guest|cleaner|entry|access)\s*(?:code|PIN)\s*[:#]?\s*)\d{4,10}\b/gi, '$1[restricted]')
  .replace(/((?:tax\s*ID|SSN|EIN|bank\s*(?:account|details)|routing\s*(?:number)?|account\s*number)\s*[:#]?\s*)[\d -]{4,30}/gi, '$1[restricted]')
  .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[tax ID]')
  .replace(/\b(?:\d[ -]?){13,19}\b/g, '[restricted number]')
}
}
export function redactSensitiveText(value:string,secrets:readonly string[]=[]){return sensitiveTextRedactor(secrets)(value)}

const PRIVATE_KEYS = new Set(['emailHash','sessionEpoch','bodySealed','stateSealed','beforeSealed','afterSealed','storageState','keySealed','bookingLinkSealed','credential_sealed','tokenSealed','token','tokenHash','token_hash','paymentMethod','customerId','checkoutUrl','bankAccount','routingNumber','taxId','ssn','idImage'])
/** Ordinary API/export/agent representations carry references, never active capabilities. */
const REFERENCES=new Set(['id','revision','uid','code','sourceKey','sourceId','sourceRevision','channelRef','replyTo','start','end','at','date','month','timeZone','first','checkout'])
export function ordinaryOutput(value: unknown, secrets: readonly string[] = [],field=''): any {
 if (typeof value === 'string') return REFERENCES.has(field)||/(?:Id|Ids|Revision|At|Date|Hash|Sha256)$/.test(field)?value:redactSensitiveText(value,secrets)
 if (Array.isArray(value)) return value.map(item => ordinaryOutput(item,secrets,field))
 if (!value || typeof value !== 'object') return value
 const row = value as Record<string,unknown>, result:Record<string,unknown>={}
 for(const [key,item] of Object.entries(row)) {
  if(PRIVATE_KEYS.has(key))continue
  if(key==='url'&&'intervalMinutes' in row){result[key]=null;continue}
  if((key==='code'||key==='link')&&'holder' in row){result[key]=null;continue}
  result[key]=ordinaryOutput(item,secrets,key)
 }
 return result
}

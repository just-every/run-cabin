import type { Account } from '../../ledger/types'
export interface Grant { accessToken:string; refreshToken:string; expiresAt:string }
export interface Connection { realm:string; mode:'sandbox'|'production'; version:string; grant:Grant }
export interface RemoteAccount { Id:string; Name:string; AccountType:string; Active:boolean }
export interface RemoteName { Id:string; Name?:string; DisplayName?:string; Active:boolean }
export interface Mapping { restored?:boolean; propertyId:string; ownerKey:string; realm:string; revision:string; classId:string; vendorId:string; accounts:Record<Account,string>; approvedBy:string; approvedAt:string }
export interface QboLine { Amount:number; Description:string; DetailType:'JournalEntryLineDetail'; JournalEntryLineDetail:{PostingType:'Debit'|'Credit'; AccountRef:{value:string}; ClassRef:{value:string}; Entity:{Type:'Vendor';EntityRef:{value:string}}} }
export interface Payload { DocNumber:string; TxnDate:string; PrivateNote:string; CurrencyRef:{value:string}; Line:QboLine[] }
export interface Entry { propertyId:string; restored?:boolean; id:string; realm:string; sourceId:string; sourceSha256:string; mappingRevision:string; payload:Payload; status:'preview'|'sending'|'uncertain'|'posted'|'conflict'|'rejected'; externalId?:string; syncToken?:string; remoteSha256?:string; detail:string; updatedAt:string }
export interface Batch { restored?:boolean; id:string; propertyId:string; month:string; realm:string; revision:string; entryIds:string[]; sourceIds:string[]; sourceSha256:string; debitCents:number; creditCents:number; accountTotals:Record<string,number>; createdAt:string; createdBy:string; approvedAt?:string; approvedBy?:string }

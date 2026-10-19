export type AgentChannel = 'airbnb' | 'vrbo' | 'booking.com'
export interface Profile {
 id:string; generation:string; channel:AgentChannel; propertyId:string; listingId?:string; listingUrl:string; status:'connecting'|'connected'|'needs_you'|'disconnected';
 grantedAt?:string; grantedBy?:string; stateSealed?:string; challenge?:'signin'|'2fa'|'captcha'|'bot'|'terms'|'uncertain'; updatedAt:string;
}
export interface Action {
 id:string; profileId:string; channel:AgentChannel; propertyId:string; kind:'connect'|'close'|'open'|'read-reservations'|'read-messages'|'read-payouts'; readUrl?:string; profileGeneration?:string; bookingId?:string; start?:string; end?:string; undoOf?:string;
 requestedBy?:string; performedBy?:string; status:'queued'|'running'|'succeeded'|'needs_you'|'failed'|'uncertain'|'cancelled'; attempts:number; createdAt:string; nextAt:string;
 lease?:string; leaseUntil?:string; beforeSealed?:string; afterSealed?:string; canUndo?:boolean; result?:'closed'|'open'|'connected'|'read'; imported?:number; detail?:string; completedAt?:string;
}
export interface RunnerKey {id:string; hash:string; ownerId:string; ownerEmail?:string; ownerVersion:number; expiresAt:string}
export const PROFILE='channelAgentProfiles', ACTION='channelAgentActions', KEY='channelAgentKeys', EVIDENCE='channelAgentEvidence'

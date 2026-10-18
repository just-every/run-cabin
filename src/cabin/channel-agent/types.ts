export type AgentChannel = 'airbnb' | 'vrbo' | 'booking.com'
export interface Profile {
 id:string; generation:string; channel:AgentChannel; propertyId:string; listingUrl:string; status:'connecting'|'connected'|'needs_you'|'disconnected';
 stateSealed?:string; challenge?:'signin'|'2fa'|'captcha'|'bot'|'uncertain'; updatedAt:string;
}
export interface Action {
 id:string; profileId:string; channel:AgentChannel; propertyId:string; kind:'connect'|'close'|'open'; bookingId?:string; start?:string; end?:string; undoOf?:string;
 status:'queued'|'running'|'succeeded'|'needs_you'|'failed'|'uncertain'|'cancelled'; attempts:number; createdAt:string; nextAt:string;
 lease?:string; leaseUntil?:string; beforeSealed?:string; afterSealed?:string; canUndo?:boolean; result?:'closed'|'open'|'connected'; completedAt?:string;
}
export interface RunnerKey {id:string; hash:string; ownerId:string; ownerVersion:number; expiresAt:string}
export const PROFILE='channelAgentProfiles', ACTION='channelAgentActions', KEY='channelAgentKeys', EVIDENCE='channelAgentEvidence'

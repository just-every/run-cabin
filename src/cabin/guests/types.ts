/** A profile is an immutable reservation identity origin. Reviewed merges only add a pointer. */
export interface GuestIdentity {
 id:string; kind:'name'|'email'|'phone'|'channel'; value:string; bookingId:string; source:string; at:string;
 verified?:{by:string; at:string; source:string};
}
export interface GuestFact {
 id:string; kind:'preference'|'service'|'note'; value:string; propertyIds:string[]; source:string; at:string; by:string;
}
export interface GuestConsent { id:string; purpose:'preferences'|'offers'; allowed:boolean; propertyId:string; source:string; at:string; by:string }
export interface GuestProfile {
 id:string; revision:string; bookingId:string; createdAt:string; identities:GuestIdentity[]; facts:GuestFact[]; consents:GuestConsent[];
 mergedInto?:string; erasedAt?:string;
}
export interface GuestMerge {
 id:string; revision:string; fromId:string; intoId:string; reason:string; reviewedBy:string; at:string; status:'active'|'undone'; undoneAt?:string; undoneBy?:string;
}
export interface GuestPolicy { id:string; revision:string; propertyId:string; allowPreferences:boolean; allowRepeatOffers:boolean }
export interface GuestOffer {
 id:string; revision:string; guestId:string; propertyId:string; priorBookingId:string; priorBookingRevision:string;
 profileIds:string[]; email:string; guestName:string; tokenHash:string; expiresAt:string; createdAt:string; createdBy:string;
 status:'issued'|'redeemed'|'revoked'; redeemedBookingId?:string; redeemedAt?:string; consentBaseline:string; homeRevision:string;
}
export interface GuestData { guests:GuestProfile[]; guestMerges:GuestMerge[]; guestPolicies:GuestPolicy[]; guestOffers:GuestOffer[] }

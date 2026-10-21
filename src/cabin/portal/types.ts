/** The private guide a guest sees on their stay page. version rises only when the text changes, so a guest can tell which instructions they are reading. */
export interface GuideFile { id:string; name:string; mimeType:string; sha256:string; size:number }
export interface GuestGuide { version: number; arrival: string; guidebook: string; files?:GuideFile[]; updatedAt: string; updatedBy: string }
/** Portal identity survives withheld or replaced physical door access. */
export interface GuestPortalLink { id:string; revision:string; propertyId:string; bookingId:string; token:string|null; expiresAt:string; emailHash:string; sessionEpoch:string; status:'active'|'revoked' }
/** A guest's stay link stops working this long after check-out; a manager can replace it sooner. */
export const LINK_GRACE_MS = 7 * 86_400_000

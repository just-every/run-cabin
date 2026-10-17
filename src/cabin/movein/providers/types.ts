export type Provider = 'guesty' | 'hostaway' | 'ownerrez'
export interface Upload { name: string; text: string }
export interface Location { file: string; row: number }
export interface SourceHome { externalId: string; name: string; ownerName: string; ownerEmail: string; commissionBps: number; links: { channel: 'airbnb' | 'vrbo' | 'booking.com'; url: string }[]; location?: Location }
export interface SourceGuest { externalId: string; name: string; email: string; phone: string; location?: Location }
export interface SourceStay { externalId: string; listingId: string; guestId: string; start: string; end: string; channel: 'airbnb' | 'vrbo' | 'booking.com' | 'direct'; status: 'confirmed' | 'cancelled'; channelRef?: string; icalUid?: string; location?: Location }
export interface SourceBalance { externalId: string; listingId: string; ownerEmail: string; amountCents: number; asOf: string; location?: Location }
export interface Refusal { file: string; row: number; reason: string; kind: string; externalId?: string }
export interface Normalized { provider: Provider; homes: SourceHome[]; guests: SourceGuest[]; stays: SourceStay[]; balances: SourceBalance[]; refusals: Refusal[]; warnings: string[]; mappings: { file: string; kind: string; columns: string[] }[]; sourceTotals: { reservations: number; futureNights: number; ownerBalanceCents: number }; asOf: string }
export interface Row { values: Record<string, string>; location: Location; error?: string }
export interface Table { name: string; columns: string[]; rows: Row[] }
export interface NativeStay { id: string; listingId: string; listingName: string; guestId: string; guestName: string; email: string; phone: string; start: string; end: string; channel: string; status: string; channelRef: string; location: Location; error?: string }
export interface NativeHome { id: string; name: string; location: Location }

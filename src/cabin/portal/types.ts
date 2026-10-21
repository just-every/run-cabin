/** The private guide a guest sees on their stay page. version rises only when the text changes, so a guest can tell which instructions they are reading. */
export interface GuestGuide { version: number; arrival: string; guidebook: string; updatedAt: string; updatedBy: string }
/** A guest's stay link stops working this long after check-out; a manager can replace it sooner. */
export const LINK_GRACE_MS = 7 * 86_400_000

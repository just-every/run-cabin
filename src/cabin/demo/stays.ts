// Each home's stays from about three weeks ago to four weeks ahead, the same for
// a given day, and the channel calendar files (.ics) that carry them.
import type { Channel } from '../model'
import { guests, homes, moreGuests, type DemoHome } from './portfolio'

export const DAY = 86_400_000
/** A stay as the business took it: from an Airbnb or Booking.com calendar file
 * (whose events carry no guest), or a Vrbo or direct request a person took in
 * Cabin with the guest's name. `summary` is what the channel's file says. */
export interface Stay { home: DemoHome; channel: Channel; uid: string; start: number; end: number; summary: string; guest: string; party: number; source: 'feed' | 'request' }
// A small deterministic generator, so a demo started on the same day looks the same.
export function random(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const hex = (next: () => number, length: number) => Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('')
/** A channel's own event UID shape: Airbnb's hex pair, Booking.com's reservation number. */
export function channelUid(channel: Channel, next: () => number) {
  return channel === 'airbnb' ? `${hex(next, 12)}-${hex(next, 32)}@airbnb.com` : `${4_100_000_000 + Math.floor(next() * 99_999_999)}@booking.com`
}
export const date = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

// What each channel's own calendar export names a stay: Airbnb writes "Reserved"
// for every reservation, Booking.com closes the nights as "CLOSED - Not available".
export const FEED_SUMMARY: Partial<Record<Channel, string>> = { airbnb: 'Reserved', 'booking.com': 'CLOSED - Not available' }
/** Stays as day numbers (UTC days since the epoch): check-in to the checkout day. */
export function plan(today: number): Stay[] {
  const stays: Stay[] = []
  homes.forEach((home, index) => {
    const next = random(index * 7919 + 17)
    let cursor = today - 24 + Math.floor(next() * 4), n = 0
    while (cursor < today + 28) {
      const start = cursor + 1 + Math.floor(next() * 3), nights = 2 + Math.floor(next() * next() * 6)
      const pick = next(), channel: Channel = home.bookingCom && pick < 0.3 ? 'booking.com' : pick > 0.84 ? 'vrbo' : pick > 0.74 ? 'direct' : 'airbnb'
      const party = 2 + Math.floor(next() * 5), guest = guests[(index * 5 + n * 3) % guests.length]
      const uid = channelUid(channel, next), source = channel === 'airbnb' || channel === 'booking.com' ? 'feed' : 'request'
      stays.push({ home, channel, uid, start, end: start + nights, summary: '', guest, party, source })
      cursor = start + nights; n++
    }
  })
  // Each guest is booked once. Nearest today first, a stay keeps its usual name
  // unless an earlier stay took it, and then takes the next unused one.
  const taken = new Set<string>(), spare = [...guests, ...moreGuests]
  for (const s of [...stays].sort((a, b) => Math.abs(a.start - today) - Math.abs(b.start - today) || homes.indexOf(a.home) - homes.indexOf(b.home) || a.start - b.start)) {
    if (taken.has(s.guest)) s.guest = spare.find(name => !taken.has(name)) ?? fail(`The demo has more stays than guest names (${spare.length})`)
    taken.add(s.guest); s.summary = FEED_SUMMARY[s.channel] ?? s.guest
  }
  return stays
}
function fail(message: string): never { throw new Error(message) }

/** The free nights in a home's calendar after `from`, long enough for a stay of `nights`. */
export function opening(stays: Stay[], home: DemoHome, from: number, nights: number) {
  const taken = stays.filter(s => s.home.id === home.id).sort((a, b) => a.start - b.start)
  let day = from
  for (const s of taken) { if (s.end <= day) continue; if (s.start - day >= nights + 1) return day + 1; day = Math.max(day, s.end) }
  return day + 1
}

const stamp = (at: number) => new Date(at).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
const all = (day: number) => date(day).replace(/-/g, '')
const escape = (text: string) => text.replace(/[\\;,]/g, c => '\\' + c)

/** A channel's calendar export, as the host downloads it and pastes it into Cabin. */
export function calendarFile(channel: Channel, events: { uid: string; start: number; end: number; summary: string; cancelled?: boolean }[], at: number) {
  const prodid = channel === 'airbnb' ? '-//Airbnb Inc//Hosting Calendar 1.0//EN' : '-//Booking.com//Availability calendar//EN'
  const body = events.map(e => ['BEGIN:VEVENT', `DTSTAMP:${stamp(at)}`, `DTSTART;VALUE=DATE:${all(e.start)}`, `DTEND;VALUE=DATE:${all(e.end)}`, `SUMMARY:${escape(e.summary)}`, `UID:${e.uid}`, ...(channel === 'airbnb' && !/not available/i.test(e.summary) ? [`DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM${e.uid.slice(0, 8).toUpperCase()}\\nPhone Number (Last 4 Digits): ${String(parseInt(e.uid.slice(0, 6), 16) % 10000).padStart(4, '0')}`] : []), ...(e.cancelled ? ['STATUS:CANCELLED'] : []), 'END:VEVENT'].join('\r\n'))
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodid}`, 'CALSCALE:GREGORIAN', ...body, 'END:VCALENDAR', ''].join('\r\n')
}

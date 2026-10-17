// Line icons for the workspace rail and the calendar, drawn inline so the page
// needs no icon font; channel glyphs are the channels' own marks, kept small.
const line = (d: string, extra = '') => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"${extra}>${d}</svg>`
export const ICONS: Record<string, string> = {
  calendar: line('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M7.5 2.5v4m9-4v4M3 9.5h18"/>'),
  inbox: line('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 13h4.5l1.5 3h6l1.5-3H21"/>'),
  reservations: line('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M7.5 2.5v4m9-4v4M3 9.5h18M8 14.5l2.5 2.5 5-5"/>'),
  readiness: line('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="m9 14.5 2 2 4-4"/>'),
  turnovers: line('<path d="m18.5 3-6.2 9.4"/><path d="M10.6 11.3 15 14l-2.6 6.6c-2.8.4-6.3-1.7-8.4-4.6l5.6-4.7Z"/><path d="m7.4 16.8 2.6-2"/>'),
  maintenance: line('<path d="M14.5 6.5a4 4 0 0 0-5.3 5L3.8 17a1.9 1.9 0 0 0 2.7 2.7l5.4-5.4a4 4 0 0 0 5-5.3l-2.5 2.5-2.4-.4-.4-2.4Z"/>'),
  direct: line('<path d="M12.5 3H20v7.5L11 19.5 3.5 12Z"/><circle cx="16" cy="7" r="1.3"/>'),
  statements: line('<path d="M6 3h9l4 4v14H6Z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>'),
  books: line('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  channels: line('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.3m-7.4 6.7 7.4 4.3"/>'),
  people: line('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20.5c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/><path d="M16 4.6a3.4 3.4 0 0 1 0 6.6M18 15.2c2 .6 3.2 2.4 3.5 5.3"/>'),
  import: line('<path d="M12 3v11m-4.5-4.5L12 14l4.5-4.5"/><path d="M4 15.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5"/>'),
  agent: line('<path d="M12 3.5 13.8 9 19.5 10.5 13.8 12.2 12 18l-1.8-5.8L4.5 10.5 10.2 9Z"/><path d="M19 16v4m-2-2h4"/>'),
  recovery: line('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6Z"/><path d="m8.8 12.2 2.2 2.2 4.3-4.4"/>'),
  settings: line('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>'),
  home: line('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/>'),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  chevron: line('<path d="m9 6 6 6-6 6"/>'),
  back: line('<path d="m15 6-6 6 6 6"/>'),
  broom: line('<path d="m18.5 3-6.2 9.4"/><path d="M10.6 11.3 15 14l-2.6 6.6c-2.8.4-6.3-1.7-8.4-4.6l5.6-4.7Z"/>'),
  lock: line('<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'),
  check: line('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  alert: line('<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.5m0 2.8v.2"/>'),
  menu: line('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  signout: line('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>'),
  spark: '<svg class="icon spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z"/></svg>',
}
/** Each channel's mark, as its bar shows it. */
export const GLYPHS: Record<string, string> = {
  airbnb: '<svg class="glyph g-airbnb" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 22.6c-1.9-2.4-3.1-4.6-3.5-6.5-.4-1.8.4-3.3 1.6-3.8a2.6 2.6 0 0 1 3.8 0c1.2.5 2 2 1.6 3.8-.4 1.9-1.6 4.1-3.5 6.5Zm9.7 1.1c-.4 2.6-3.1 4.4-5.7 3.6-1.3-.4-2.6-1.2-4-2.7-1.4 1.5-2.7 2.3-4 2.7-2.6.8-5.3-1-5.7-3.6-.2-1.5.2-2.8.9-4.4L12.6 8c1-2 2-3.8 3.4-3.8s2.4 1.8 3.4 3.8l5.4 11.3c.7 1.6 1.1 2.9.9 4.4Z"/></svg>',
  vrbo: '<span class="glyph g-vrbo" aria-hidden="true">Vrbo</span>',
  'booking.com': '<span class="glyph g-booking" aria-hidden="true">B<i>.</i></span>',
  direct: '<svg class="glyph g-direct" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.8 11h2.7v9.3h5V15h3v5.3h5V11h2.7Z"/></svg>',
  block: '<svg class="glyph g-block" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.8 11h2.7v9.3h5V15h3v5.3h5V11h2.7Z"/></svg>',
}
export const icon = (name: string) => ICONS[name] ?? ''

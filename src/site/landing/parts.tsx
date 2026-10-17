// The pieces every section is made of. Text in the drawings is real text; the
// drawings are HTML and CSS (styles/cards.css), never screenshots.
import type { ReactNode } from 'react'

/** One idea per section: eyebrow, heading and a short paragraph beside its drawing; `flip` puts the drawing first. */
export function Feature({ id, eyebrow, title, children, art, flip = false, label }: { id: string; eyebrow: string; title: ReactNode; children: ReactNode; art: ReactNode; flip?: boolean; label: string }) {
  return <section id={id} className={`feature${flip ? ' flip' : ''}`} aria-labelledby={`${id}-title`}>
    <div className="site-wrap feature-row">
      <div className="feature-copy"><p className="eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2><p className="feature-body">{children}</p></div>
      <div className="feature-art" role="img" aria-label={label}><div aria-hidden="true" className="feature-drawing">{art}</div></div>
    </div>
  </section>
}

/** A painted plate: AVIF, then WebP, at the sizes public/site holds. */
export function Painting({ name, widths, sizes, alt = '', className, phone, eager = false }: { name: string; widths: number[]; sizes: string; alt?: string; className?: string; phone?: { name: string; widths: number[]; media: string }; eager?: boolean }) {
  const set = (n: string, ws: number[], ext: string) => ws.map(w => `/site/${n}-${w}.${ext} ${w}w`).join(', ')
  const largest = Math.max(...widths)
  return <picture className={className}>
    {phone && <source media={phone.media} type="image/avif" srcSet={set(phone.name, phone.widths, 'avif')} sizes="100vw" />}
    {phone && <source media={phone.media} type="image/webp" srcSet={set(phone.name, phone.widths, 'webp')} sizes="100vw" />}
    <source type="image/avif" srcSet={set(name, widths, 'avif')} sizes={sizes} />
    <img src={`/site/${name}-${largest}.webp`} srcSet={set(name, widths, 'webp')} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  </picture>
}

/** Round status icons: a filled disc with a white glyph, as on the cards. */
export const Status = ({ tone, size = 'md' }: { tone: 'ok' | 'warn' | 'bad' | 'lock' | 'clean' | 'arrive' | 'money'; size?: 'sm' | 'md' }) => <span className={`status status-${tone} status-${size}`}>
  <svg viewBox="0 0 24 24" aria-hidden="true">{STATUS[tone]}</svg>
</span>
const STATUS: Record<string, ReactNode> = {
  ok: <path d="m7 12.4 3.3 3.3L17.2 8.8" />,
  warn: <><path d="M12 6.5v7" /><path d="M12 17.4v.1" /></>,
  bad: <><path d="M12 6.5v7" /><path d="M12 17.4v.1" /></>,
  lock: <><rect x="6.5" y="10.5" width="11" height="8.5" rx="1.6" /><path d="M9 10.5V8.6a3 3 0 0 1 6 0v1.9" /></>,
  arrive: <><path d="M13 5.5h4.5v13H13" /><path d="M5.5 12h8M10.5 8.8 13.7 12l-3.2 3.2" /></>,
  money: <path d="M12 5v14M15.4 8.3c-.6-1.1-1.9-1.7-3.4-1.7-2 0-3.4 1-3.4 2.6 0 3.6 6.9 1.9 6.9 5.5 0 1.6-1.5 2.7-3.5 2.7-1.7 0-3.1-.7-3.6-2" />,
  clean: <><path d="m14.8 5.2-5 7.6" /><path d="M7.6 11.6c2.2.4 4 1.6 4.8 3.6L11 19c-2.6-.2-4.7-1.6-5.6-4.4z" /></>,
}

export const Tick = () => <svg className="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" /></svg>

const PATHS: Record<string, ReactNode> = {
  laptop: <><rect x="4.5" y="5" width="15" height="10" rx="1.6" /><path d="M2.5 18.5h19" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.4-3.3 2.6-5.2 5.5-5.2s5.1 1.9 5.5 5.2" /><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 13.9c1.7.6 2.8 2.3 3 5.1" /></>,
  export: <><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H14" /><path d="M14 3.5 18.5 8v1.5" /><path d="M11 13.5h10M18 10.5l3 3-3 3" /></>,
  card: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.2" /><path d="M3.5 10h17M7 14.5h4" /></>,
  receipt: <><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5" /></>,
  person: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.7 3.4-5.8 7-5.8s6.4 2.1 7 5.8" /></>,
  wrench: <><path d="M14.7 6.3a4 4 0 0 0 5 5L12.4 18.6a2.3 2.3 0 0 1-3.3-3.3z" /><path d="M14.7 6.3 17.4 3.6a4 4 0 0 1-2.7 2.7z" /></>,
  bubble: <><path d="M12 4.5c4.4 0 8 2.9 8 6.6s-3.6 6.6-8 6.6c-.9 0-1.8-.1-2.6-.3L5 19.5l1.1-3.6C4.8 14.7 4 13 4 11.1 4 7.4 7.6 4.5 12 4.5z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  bed: <><path d="M3.5 18.5v-11M3.5 14h17v4.5M20.5 14v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7v5" /><circle cx="7" cy="11" r="1.6" /></>,
  paw: <><circle cx="8" cy="7.5" r="1.7" /><circle cx="16" cy="7.5" r="1.7" /><circle cx="4.8" cy="12" r="1.5" /><circle cx="19.2" cy="12" r="1.5" /><path d="M12 11.5c2.6 0 4.6 2.6 4.6 4.6 0 1.6-1.4 2.4-2.6 2.1-.8-.2-1.3-.6-2-.6s-1.2.4-2 .6c-1.2.3-2.6-.5-2.6-2.1 0-2 2-4.6 4.6-4.6z" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  sparkle: <><path d="M10 3.5 11.6 8.4 16.5 10l-4.9 1.6L10 16.5l-1.6-4.9L3.5 10l4.9-1.6z" /><path d="M17.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  dollar: <><path d="M12 3.5v17M16.2 7.6c-.7-1.4-2.3-2.2-4.2-2.2-2.5 0-4.2 1.3-4.2 3.2 0 4.5 8.6 2.4 8.6 6.9 0 2-1.9 3.4-4.4 3.4-2.1 0-3.8-.9-4.5-2.5" /></>,
  dots: <><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></>,
}
export const Icon = ({ name, className = '' }: { name: keyof typeof PATHS | string; className?: string }) => <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>

/** A channel or provider in a drawing, as plain text in the body face (never its trademark or logo). */
export const Channel = ({ name }: { name: 'Airbnb' | 'Vrbo' | 'Booking.com' }) => <span className={`channel channel-${name === 'Booking.com' ? 'booking' : name.toLowerCase()}`}>{name}</span>

/** An initials avatar on a soft green disc. */
export const Initials = ({ children, size = 'md' }: { children: string; size?: 'md' | 'lg' }) => <span className={`initials initials-${size}`}>{children}</span>

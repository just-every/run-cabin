// The pieces every section is made of. Text in the drawings is real text; the
// drawings are HTML and CSS (styles/stage.css and one sheet per section), never screenshots.
import type { ReactNode } from 'react'

/** A stage's heading block: the eyebrow with the stage and its date, the heading in the hero's face, and one short paragraph. */
export function StageHead({ id, eyebrow, title, children }: { id: string; eyebrow: ReactNode[]; title: ReactNode; children: ReactNode }) {
  return <div className="stage-head">
    <p className="stage-eyebrow"><Parts of={eyebrow} /></p>
    <h2 id={`${id}-title`}>{title}</h2>
    <p className="stage-lede">{children}</p>
  </div>
}

/** A painted plate: AVIF, then WebP, at the sizes public/site holds. */
export function Painting({ name, widths, sizes, alt = '', className, phone, eager = false }: { name: string; widths: number[]; sizes: string; alt?: string; className?: string; phone?: { name: string; widths: number[]; media: string }; eager?: boolean }) {
  const set = (n: string, ws: number[], ext: string) => ws.map(w => `/site/${n}-${w}.${ext} ${w}w`).join(', ')
  const fallback = widths.includes(1536) ? 1536 : Math.max(...widths)
  return <picture className={className}>
    {phone && <source media={phone.media} type="image/avif" srcSet={set(phone.name, phone.widths, 'avif')} sizes="100vw" />}
    {phone && <source media={phone.media} type="image/webp" srcSet={set(phone.name, phone.widths, 'webp')} sizes="100vw" />}
    <source type="image/avif" srcSet={set(name, widths, 'avif')} sizes={sizes} />
    <img src={`/site/${name}-${fallback}.webp`} srcSet={set(name, widths, 'webp')} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  </picture>
}

/** The full-bleed plates' widths: the painted size and its 1.5x and 2x for 1920 and 2560 screens. */
export const BLEED = [768, 1152, 1536, 2304, 3072]

type Tone = 'ok' | 'pine' | 'warn' | 'bad' | 'lock' | 'clean' | 'arrive' | 'amber'
type Glyph = keyof typeof GLYPHS

/** Round status discs with a white glyph, as on the cards and the hero's tags. */
export const Status = ({ tone, glyph, size = 'md' }: { tone: Tone; glyph?: Glyph; size?: 'sm' | 'md' }) => <span className={`status status-${tone} status-${size}`}>
  <svg viewBox="0 0 24 24" aria-hidden="true">{GLYPHS[glyph ?? DEFAULT[tone]]}</svg>
</span>
const GLYPHS = {
  check: <path d="m7 12.4 3.3 3.3L17.2 8.8" />,
  bang: <><path d="M12 6.5v7" /><path d="M12 17.4v.1" /></>,
  lock: <><rect x="6.5" y="10.5" width="11" height="8.5" rx="1.6" /><path d="M9 10.5V8.6a3 3 0 0 1 6 0v1.9" /></>,
  arrive: <><path d="M13 5.5h4.5v13H13" /><path d="M5.5 12h8M10.5 8.8 13.7 12l-3.2 3.2" /></>,
  clean: <><path d="m14.8 5.2-5 7.6" /><path d="M7.6 11.6c2.2.4 4 1.6 4.8 3.6L11 19c-2.6-.2-4.7-1.6-5.6-4.4z" /></>,
  clock: <path d="M12.6 5v8.2l-5.2 3.4" />,
  eye: <><path d="M3.8 12c2-3.6 4.8-5.4 8.2-5.4s6.2 1.8 8.2 5.4c-2 3.6-4.8 5.4-8.2 5.4S5.8 15.6 3.8 12z" /><circle cx="12" cy="12" r="2.3" /></>,
  doc: <><path d="M8 5.5h5.5l3 3v10H8z" /><path d="M13.5 5.5v3h3" /></>,
  calendar: <><rect x="6" y="7" width="12" height="11" rx="1.6" /><path d="M6 10.6h12M9.5 5.4v3M14.5 5.4v3M9.5 13.6h.1M12 13.6h.1M14.5 13.6h.1M9.5 15.9h.1M12 15.9h.1" /></>,
}
const DEFAULT: Record<Tone, Glyph> = { ok: 'check', pine: 'check', warn: 'bang', bad: 'bang', lock: 'lock', clean: 'clean', arrive: 'arrive', amber: 'clock' }

/** Line icons in the drawings' ink: the violet padlock, the pencil and the calendar. */
export const Icon = ({ name, className = '' }: { name: keyof typeof LINES; className?: string }) => <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">{LINES[name]}</svg>
const LINES = {
  padlock: <><rect x="5" y="10" width="14" height="11" rx="2.6" className="fill" /><path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" /><circle cx="12" cy="14.6" r="1.5" className="hole" /><path d="M12 15.6v2" className="hole-line" /></>,
  pencil: <><path d="M15.6 4.6a2.1 2.1 0 0 1 3 3L8.4 17.8 4.5 19.5l1.7-3.9z" /><path d="m13.8 6.4 3.8 3.8" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
}

/** A channel's coloured dot: Airbnb coral, Vrbo blue, Booking.com navy, direct pine. */
export const Dot = ({ channel }: { channel: 'airbnb' | 'vrbo' | 'booking' | 'direct' }) => <span className={`dot dot-${channel}`} aria-hidden="true" />

/** An initials avatar on a soft disc. */
export const Initials = ({ children, tone = 'soft' }: { children: string; tone?: 'soft' | 'pine' }) => <span className={`initials initials-${tone}`} aria-hidden="true">{children}</span>

/**
 * A line of values joined by separator dots, such as "Code 7102 for Ana · 1:30 – 4:00 pm". It wraps only at a separator and
 * drops the dot there (card.css), so each value stays whole and no line starts or ends with a dot. A string splits at " · ".
 */
export const Parts = ({ of }: { of: ReactNode[] | string }) => <span className="parts"><span>
  {(typeof of === 'string' ? of.split(' · ') : of).map((part, i) => <span key={i}>{part}</span>)}
</span></span>

/** A value that never breaks inside, such as a time range or "held, not charged". */
export const Whole = ({ children }: { children: ReactNode }) => <span className="nowrap">{children}</span>

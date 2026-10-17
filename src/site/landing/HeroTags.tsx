import { Status } from './parts'

// Saturday, Oct 17 across the host's homes, as Cabin shows it: each white tag sits on its home in the painting.
// The same stays, cleaners and codes appear in the sections below (Lake Loft's Airbnb stay, Luis at Desert Casita).
const TAGS = [
  { id: 'ready', tone: 'ok', title: 'Ready ✓', lines: ['Pine Ridge Cabin'] },
  { id: 'arriving', tone: 'arrive', title: 'Guest arriving 4 pm', lines: ['Airbnb · Lake Loft'] },
  { id: 'code', tone: 'lock', title: 'Door code 4417 active', lines: ['Sat 4 pm → Tue 10 am'] },
  { id: 'checkout', tone: 'ok', title: 'Checked out 10:00 am', lines: ['Sandy Shores'] },
  { id: 'cleaning', tone: 'clean', title: 'Cleaning · Luis', lines: ['11:00 am – 3:00 pm', 'Desert Casita'] },
  { id: 'declined', tone: 'bad', title: 'Vrbo request declined', lines: ['overlaps Airbnb', 'Lake Loft'] },
] as const

export function HeroTags() {
  return <ul className="hero-tags" aria-label="Today across your homes">
    {TAGS.map(tag => <li key={tag.id} className={`tag tag-${tag.id}`}>
      <Status tone={tag.tone} />
      <span className="tag-text"><strong>{tag.title}</strong>{tag.lines.map(line => <span key={line}>{line}</span>)}</span>
    </li>)}
  </ul>
}

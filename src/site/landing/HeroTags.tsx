import { Status } from './parts'

// Saturday, Oct 24 across the host's homes, as Cabin shows it: each white tag sits on its home in the painting.
// The same stays, cleaners and codes run through the stages below (Megan's Airbnb stay at Lake Loft, Luis at Desert Casita).
const TAGS = [
  { id: 'ready', tone: 'ok', title: 'Ready ✓', lines: ['Pine Ridge Cabin'] },
  { id: 'arriving', tone: 'arrive', title: 'Guest arriving 4\u00a0pm', lines: ['Airbnb · Lake Loft'] },
  { id: 'code', tone: 'lock', title: 'Door code 4417 active', lines: ['Sat\u00a04\u00a0pm → Tue\u00a010\u00a0am'] },
  { id: 'checkout', tone: 'ok', title: 'Checked out 10:00\u00a0am', lines: ['Sandy Shores'] },
  { id: 'cleaning', tone: 'clean', title: 'Cleaning · Luis', lines: ['11:00\u00a0am – 3:00\u00a0pm', 'Desert Casita'] },
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

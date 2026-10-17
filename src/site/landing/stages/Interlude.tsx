import { BLEED, Painting, Status } from '../parts'

/** The one painted band between the stories: the cleaner's cart at the A-frame's door, every home ready. */
export function Interlude() {
  return <section className="interlude" aria-label="All five homes ready for Saturday">
    <p className="interlude-badge"><Status tone="ok" />All five homes ready for Saturday</p>
    <Painting className="interlude-art" name="interlude" widths={BLEED} sizes="100vw" />
  </section>
}

import { Actions } from '../../shell/Actions'
import { SiteFooter } from '../../shell/SiteFooter'
import { Painting } from '../parts'

/** The closing promise over the lake at dusk, two chairs on the dock and the lantern lit; the footer under it. */
export function Closing() {
  return <>
    <section className="closing" aria-labelledby="closing-title">
      <Painting className="closing-art" name="closing" widths={[768, 1152, 1536]} sizes="100vw" />
      <div className="site-wrap closing-copy">
        <h2 id="closing-title">Every home, ready.</h2>
        <p className="closing-sub">Open source vacation rental software for hosts and managers.</p>
        <Actions demo={false} />
        <p className="closing-small">Free and open source, MIT licensed.</p>
      </div>
      <p className="closing-tag" aria-hidden="true"><span className="tick-disc solid"><svg className="tick" viewBox="0 0 16 16"><path d="m3 8.5 3.2 3.2L13 4.8" /></svg></span>Ready ✓</p>
    </section>
    <SiteFooter />
  </>
}

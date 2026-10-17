import { Icon, Initials, Parts, StageHead, Status, Whole } from '../parts'

const CHECKLIST = ['Strip and remake 3 beds', 'Restock coffee and towels', 'Hot tub cleaned and tested', 'Photos 12 / 12']
const PROOF = [['bed', 'The made bed with a pine throw'], ['coffee', 'The stocked coffee shelf'], ['tub', 'The cedar hot tub, cleaned']] as const

/** The cleaner's proof photos, redrawn clean at twice the picked screen's size by 12ui (public/site/proof-*). */
const Proof = ({ name, alt }: { name: string; alt: string }) => <picture>
  <source type="image/avif" srcSet={`/site/proof-${name}-138.avif 138w, /site/proof-${name}-276.avif 276w`} sizes="(max-width: 760px) 27vw, 138px" />
  <img src={`/site/proof-${name}-276.webp`} srcSet={`/site/proof-${name}-138.webp 138w, /site/proof-${name}-276.webp 276w`} sizes="(max-width: 760px) 27vw, 138px" alt={alt} width={138} height={179} loading="lazy" decoding="async" />
</picture>

/** Turnover day: Megan's Saturday, seen from Luis's phone at Desert Casita, with the front-door codes and the one broken thing. */
export function TurnoverDay() {
  return <section id="turnover-day" className="stage side flip turnover" aria-labelledby="turnover-day-title">
    <div className="s-wrap side-row">
      <StageHead id="turnover-day" eyebrow={[<Whole>Turnover day</Whole>, <Whole>Sat Oct 24</Whole>]} title={<>Checkout sends<br />the cleaner.</>}>
        Every checkout opens a turnover: the cleaner, the checklist, the photos and a fresh door code for the next guest.
      </StageHead>
      <div className="turnover-art">
        <div className="handset">
          <div className="handset-screen">
            <p className="handset-day">Today<i>·</i>Sat Oct&nbsp;24</p>
            <p className="handset-who"><Initials tone="pine">LR</Initials>Luis Ramos</p>
            <div className="card job">
              <p className="job-title"><Parts of={[<b>Desert Casita</b>, <Whole>11:00 am – 3:00 pm</Whole>]} /></p>
              <p className="job-ready"><Status tone="pine" size="sm" />Ready 2:41&nbsp;pm</p>
              <ul className="job-list">{CHECKLIST.map(item => <li key={item}><Status tone="ok" size="sm" />{item}</li>)}</ul>
              <div className="job-photos">{PROOF.map(([name, alt]) => <Proof key={name} name={name} alt={alt} />)}</div>
            </div>
            <p className="job-next"><Icon name="calendar" /><Parts of={[<b>Pine Ridge Cabin</b>, <Whole>Sun 10:00 am</Whole>]} /></p>
          </div>
        </div>
        <div className="card door">
          <Icon name="padlock" className="violet" />
          <div>
            <p className="door-title"><Parts of={[<Whole>Desert Casita</Whole>, <Whole>front door</Whole>]} /></p>
            <p className="door-line"><Parts of={['Luis', <Whole>code 3308</Whole>, <Whole>today 10:45 am – 3:15 pm</Whole>]} /></p>
            <p className="door-line"><Parts of={[<Whole>Next guest</Whole>, <Whole>code 5521</Whole>, <Whole>Sat 4 pm → Wed 10 am</Whole>]} /></p>
          </div>
        </div>
        <p className="float-chip patio"><Status tone="warn" /><Parts of={[<b className="nowrap">Patio light out</b>, <Whole>task added for Dale</Whole>]} /></p>
      </div>
    </div>
  </section>
}

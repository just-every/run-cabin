import { Icon, Initials, StageHead, Status } from '../parts'

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
      <StageHead id="turnover-day" eyebrow={<>Turnover day<i>·</i>Sat Oct&nbsp;24</>} title={<>Checkout sends<br />the cleaner.</>}>
        Every checkout opens a turnover: the cleaner, the checklist, the photos and a fresh door code for the next guest.
      </StageHead>
      <div className="turnover-art">
        <div className="handset">
          <div className="handset-screen">
            <p className="handset-day">Today<i>·</i>Sat Oct&nbsp;24</p>
            <p className="handset-who"><Initials tone="pine">LR</Initials>Luis Ramos</p>
            <div className="card job">
              <p className="job-title"><b>Desert Casita</b><i>·</i>11:00&nbsp;am – 3:00&nbsp;pm</p>
              <p className="job-ready"><Status tone="pine" size="sm" />Ready 2:41&nbsp;pm</p>
              <ul className="job-list">{CHECKLIST.map(item => <li key={item}><Status tone="ok" size="sm" />{item}</li>)}</ul>
              <div className="job-photos">{PROOF.map(([name, alt]) => <Proof key={name} name={name} alt={alt} />)}</div>
            </div>
            <p className="job-next"><Icon name="calendar" /><span><b>Pine Ridge Cabin</b><i>·</i>Sun 10:00&nbsp;am</span></p>
          </div>
        </div>
        <div className="card door">
          <Icon name="padlock" className="violet" />
          <div>
            <p className="door-title">Desert Casita<i>·</i>front door</p>
            <p className="door-line">Luis<i>·</i>code 3308<i>·</i>today 10:45&nbsp;am – 3:15&nbsp;pm</p>
            <p className="door-line">Next guest<i>·</i>code 5521<i>·</i>Sat 4&nbsp;pm → Wed 10&nbsp;am</p>
          </div>
        </div>
        <p className="float-chip patio"><Status tone="warn" /><span><b>Patio light out</b><i>·</i>task added for Dale</span></p>
      </div>
    </div>
  </section>
}

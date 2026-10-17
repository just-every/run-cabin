import { SiteHeader } from '../shell/SiteHeader'
import { Closing } from './Closing'
import { Hero } from './Hero'
import { MovingIn } from './MovingIn'
import { BeforeArrival } from './stages/BeforeArrival'
import { Booked } from './stages/Booked'
import { Interlude } from './stages/Interlude'
import { NextStay } from './stages/NextStay'
import { Payout } from './stages/Payout'
import { StageRail } from './stages/StageRail'
import { StayRecovery } from './stages/StayRecovery'
import { TurnoverDay } from './stages/TurnoverDay'
import '../styles/site.css'
import '../styles/card.css'
import '../styles/landing.css'
import '../styles/stage.css'
import '../styles/booked.css'
import '../styles/arrival.css'
import '../styles/turnover.css'
import '../styles/recovery.css'
import '../styles/payout.css'
import '../styles/next.css'
import '../styles/moving.css'

/**
 * run-cabin.com's homepage, built from the design desk's owner-approved structure (page-s1, 17 Oct 2026). It follows one stay
 * end to end: Megan Ortiz at the Lake Loft, Sat 24 to Tue 27 Oct 2026, through the six stages a host runs every booking through
 * (booked, before arrival, turnover day, stay recovery, payout, next stay; the interlude sits between recovery and payout),
 * then moving in and the closing. Painted art is the hero, the interlude, the closing and the cleaner's proof photos; every
 * other drawing is HTML and CSS.
 */
export function Landing() {
  return <>
    <SiteHeader overArt />
    <main id="main" className="landing">
      <Hero />
      <div className="stages">
        <StageRail />
        <Booked />
        <BeforeArrival />
        <TurnoverDay />
        <StayRecovery />
        <Interlude />
        <Payout />
        <NextStay />
      </div>
      <MovingIn />
      <Closing />
    </main>
  </>
}

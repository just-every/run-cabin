import { links } from './links'

/** The lockup: the A-frame mark beside "Cabin" in the heading face. */
export const Brand = ({ size }: { size: number }) => <a className="site-brand" href={links.home}>
  <img src="/brand/mark.svg" alt="" width={size} height={size} /><span>Cabin</span>
</a>

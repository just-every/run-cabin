import type { DirectHome,Quote } from './types'
import { dateLabel } from './presentation'
export interface AgreementTemplateText {id:string; title:string; state:string; text:string}
/** One exact document for the review screen, signature digest and retained download. */
export function bookingAgreement(home:DirectHome,price:Quote,version?:AgreementTemplateText){
 return `${version?version.title+' · US '+version.state+'\n\n'+version.text:home.agreement}\n\nStay: ${dateLabel(price.start)} to ${dateLabel(price.end)}; ${price.guests} guests.\nRent, fees and taxes: USD ${(price.totalCents/100).toFixed(2)}.${price.returningGuest?` Returning guest 10% rent saving: USD ${((price.discountCents??0)/100).toFixed(2)}.`:''} Damage authorization: USD ${(price.depositCents/100).toFixed(2)}.\nThe separate damage hold is requested within 48 hours of arrival, not when an advance booking is paid. Card authorizations expire; another authorization may be required during a longer stay. An expired hold provides no damage protection.`
}

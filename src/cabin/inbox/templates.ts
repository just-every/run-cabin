import { fill, type Facts } from './render'

// Templates answer only the saved arrival/departure facts. Requests to change
// them and questions about anything else always require the host's answer.
export function templateDraft(f: Facts | null, question: string) {
 const needsHost = (reason: string, message: string) => ({
  text: f ? fill(`Hi {guest},\n\n${message}`, f) : `Hi,\n\n${message}`,
  grounds: [] as string[], detail: `Needs you: ${reason} Confirm the answer before sending.`,
 })
 if (!f) return needsHost('No stay matches this sender.', 'Thanks for your message. I will check your question and get back to you.')
 if (/\b(early|earlier|late|later|refund|discount|credit|cancel|safety|safe|emergency|bag(?:s)?|drop.?off)\b/i.test(question)
  || /\b(?:can|could|may|possible|chance)\b[\s\S]*\b(?:check[ -]?in|check[ -]?out|arrive|leave)\b[\s\S]*(?:\d|before|after)/i.test(question)) {
  const arrival = /\b(check[ -]?in|arriv\w*|bag(?:s)?|drop.?off)\b/i.test(question)
  return needsHost('This request needs your approval; a template cannot confirm a change.', arrival
   ? 'Thanks for asking. The scheduled check-in is {checkin}. I will check whether your requested arrival is possible and confirm with you.'
   : 'Thanks for asking. I will check your request and confirm what is possible.')
 }
 if (/\b(wi[ -]?fi|internet|parking|pets?|dog|cat|pool|amenit\w*|hot tub|broken|problem|fee|cost|price)\b/i.test(question))
  return needsHost('The saved stay facts do not answer this question.', 'Thanks for your question. I will check the details and get back to you.')
 const access = /\b(code|door|lock|key|keys|get in|check[ -]?in|arriv\w*|address|directions)\b/i.test(question)
 const checkout = /\b(check[ -]?out|leave|leaving|depart\w*)\b/i.test(question)
 if (access) return { text: fill('Hi {guest},\n\nCheck-in at {home} is {checkin}.\n\nAddress: {address}\nDoor code: {code}\n\nYour stay page has the code and directions: {stay_link}', f), grounds: ['check-in time', 'address', 'door code', 'stay page'], detail: null }
 if (checkout) return { text: fill('Hi {guest},\n\nCheck-out from {home} is {checkout}.', f), grounds: ['check-out time'], detail: null }
 return needsHost('The saved stay facts do not answer this message.', 'Thanks for your message. I will check your question and get back to you.')
}

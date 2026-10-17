// The demo's rental business: Blue Ridge Getaways, a manager in western North
// Carolina with a dozen homes, their owners, the office and the cleaning crew.
export const business = { name: 'Blue Ridge Getaways', owner: 'Jess Harlan' }

export interface DemoHome { id: string; address: string; name: string; ownerName: string; ownerEmail: string; commissionBps: number; bookingCom: boolean; nightly: number; cleaning: number; hotTub: boolean; checklist: string[] }

const base = ['Strip beds and remake with fresh linen', 'Clean kitchen, run and empty the dishwasher', 'Scrub bathrooms and set out fresh towels', 'Vacuum and mop all floors', 'Empty trash and recycling to the bins', 'Restock coffee, paper goods and toiletries', 'Set thermostat to 68°F and lock all doors']
const tub = 'Test hot tub water, add chemicals, close the cover'
const fire = 'Clear the fire pit and restock firewood'
const deck = 'Sweep the deck and wipe down outdoor furniture'
const dock = 'Check the dock lines, kayaks and life jackets'
const list = (...extra: string[]) => [...base.slice(0, 6), ...extra, base[6]]

export const homes: DemoHome[] = [
  { id: 'demo-home-laurel-ridge', address: '214 Laurel Ridge Rd, Burnsville, NC 28714', name: 'Laurel Ridge Cabin', ownerName: 'Grace Whitfield', ownerEmail: 'grace.whitfield@example.com', commissionBps: 2000, bookingCom: true, nightly: 245, cleaning: 150, hotTub: true, checklist: list(tub, fire) },
  { id: 'demo-home-bearwallow', address: '88 Bearwallow Rd, Gerton, NC 28735', name: 'Bearwallow Lookout', ownerName: 'Daniel Ortiz', ownerEmail: 'dortiz@example.net', commissionBps: 2200, bookingCom: false, nightly: 310, cleaning: 175, hotTub: true, checklist: list(tub, deck) },
  { id: 'demo-home-riverbend', address: '1520 River Rd, Marshall, NC 28753', name: 'Riverbend A-Frame', ownerName: 'Priya Raman', ownerEmail: 'priya.raman@example.org', commissionBps: 1800, bookingCom: true, nightly: 205, cleaning: 125, hotTub: false, checklist: list(fire) },
  { id: 'demo-home-black-mountain', address: '17 Cherry St, Black Mountain, NC 28711', name: 'Black Mountain Bungalow', ownerName: 'Tom and Ellen Becker', ownerEmail: 'beckers@example.com', commissionBps: 2000, bookingCom: false, nightly: 165, cleaning: 110, hotTub: false, checklist: list(deck) },
  { id: 'demo-home-firefly', address: '402 Firefly Ln, Brevard, NC 28712', name: 'Firefly Hollow', ownerName: 'Marcus Greene', ownerEmail: 'marcus.greene@example.com', commissionBps: 2500, bookingCom: true, nightly: 195, cleaning: 125, hotTub: true, checklist: list(tub, fire) },
  { id: 'demo-home-hemlock', address: '61 Hemlock Trl, Sylva, NC 28779', name: 'Hemlock Hideaway', ownerName: 'Sarah Kim', ownerEmail: 'sarahkim@example.net', commissionBps: 1500, bookingCom: false, nightly: 180, cleaning: 120, hotTub: false, checklist: list(fire) },
  { id: 'demo-home-blue-ridge-loft', address: '35 Wall St, Asheville, NC 28801', name: 'Blue Ridge Loft', ownerName: 'Jordan Ellis', ownerEmail: 'jordan.ellis@example.org', commissionBps: 1800, bookingCom: true, nightly: 150, cleaning: 95, hotTub: false, checklist: list('Wipe down the balcony rail and table') },
  { id: 'demo-home-chimney-rock', address: '730 Main St, Chimney Rock, NC 28720', name: 'Chimney Rock Chalet', ownerName: 'Linda Morales', ownerEmail: 'lmorales@example.com', commissionBps: 2200, bookingCom: false, nightly: 275, cleaning: 160, hotTub: true, checklist: list(tub, deck, fire) },
  { id: 'demo-home-sourwood', address: '1180 Sourwood Hollow Rd, Mars Hill, NC 28754', name: 'Sourwood Farmhouse', ownerName: 'Henry Caldwell', ownerEmail: 'henry.caldwell@example.net', commissionBps: 2000, bookingCom: true, nightly: 340, cleaning: 210, hotTub: false, checklist: list(deck, 'Collect eggs and check the coop latch') },
  { id: 'demo-home-mill-creek', address: '9 Mill Creek Rd, Old Fort, NC 28762', name: 'Mill Creek Studio', ownerName: 'Aisha Bello', ownerEmail: 'aisha.bello@example.com', commissionBps: 1500, bookingCom: false, nightly: 110, cleaning: 80, hotTub: false, checklist: list() },
  { id: 'demo-home-lake-lure', address: '2954 Memorial Hwy, Lake Lure, NC 28746', name: 'Lake Lure Boathouse', ownerName: 'Robert and June Patterson', ownerEmail: 'pattersons@example.org', commissionBps: 2400, bookingCom: true, nightly: 380, cleaning: 225, hotTub: false, checklist: list(dock, deck) },
  { id: 'demo-home-weaverville', address: '22 Main St, Weaverville, NC 28787', name: 'Weaverville Carriage House', ownerName: 'Nina Foster', ownerEmail: 'nina.foster@example.com', commissionBps: 1800, bookingCom: false, nightly: 135, cleaning: 90, hotTub: false, checklist: list() },
]

export interface DemoMember { id: string; name: string; email: string; role: 'manager' | 'cleaner'; active: boolean }
export const members: DemoMember[] = [
  { id: 'demo-member-dana', name: 'Dana Whitaker', email: 'dana@blueridgegetaways.example', role: 'manager', active: true },
  { id: 'demo-member-rosa', name: 'Rosa Delgado', email: 'rosa.delgado@example.com', role: 'cleaner', active: true },
  { id: 'demo-member-kevin', name: 'Kevin Tran', email: 'kevin.tran@example.net', role: 'cleaner', active: true },
  { id: 'demo-member-mia', name: 'Mia Johnson', email: 'mia.johnson@example.org', role: 'cleaner', active: true },
  { id: 'demo-member-luis', name: 'Luis Herrera', email: 'luis.herrera@example.com', role: 'cleaner', active: true },
  { id: 'demo-member-brandon', name: 'Brandon Lee', email: 'brandon.lee@example.net', role: 'cleaner', active: false },
]
export const cleaners = members.filter(m => m.role === 'cleaner' && m.active)

export const guests = ['Emily Rhodes', 'Carlos Mendez', 'The Nguyen family', 'Hannah Brooks', 'Jamal Wright', 'Olivia Chen', 'Mike and Tara Dunn', 'Sofia Rossi', 'Ben Carter', 'Lauren Price', 'Ethan Walsh', 'Grace Park', 'Will Thompson', 'Rachel Adams', 'Noah Bennett', 'Ava Mitchell', 'Chris Howard', 'Megan Foley', 'David Kim', 'Natalie Hughes', 'Jason Reed', 'Amanda Cole', 'Tyler Bishop', 'Kelsey Morgan', 'Andre Lewis', 'Brooke Sullivan', 'Ryan Murphy', 'Jenna Hart', 'Sam Patel', 'Claire Dawson']

export const captions = ['Beds made, towels folded on each bed', 'Kitchen reset and counters wiped', 'Living room ready, throw pillows straightened', 'Primary bedroom with fresh linen', 'Bathroom stocked with towels and soap', 'Porch swept, chairs set out', 'Hot tub covered and locked', 'Front door locked, key back in the lockbox']

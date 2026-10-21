# Guest stay page

Each stay with a guest door code has a private stay page at `/stay/<token>`. The token is the guest's own link; nothing else identifies the holder, and a guessed or truncated link answers 404.

What the page shows, in order:

- **The reservation:** guest name, status, and check-in and check-out in the home's own time.
- **Before you arrive:** the guest's open and finished tasks from their saved records: the rental agreement signature (with its signing link), the identity check (with the guest's own review link) and any unpaid balance on a recorded reservation. A task reads Done only when its record says so.
- **Door code and timing:** the stay's code with the window it works and whether it is not active yet, active or expired, at the home's clock. A required agreement or identity check that is still open withholds the code, as before.
- **Arrival and your stay:** the home's arrival instructions, the house rules from the property profile and the digital guidebook, headed by the guide's version. Instructions and guidebook are shown only while access is released and check-out has not passed.
- **Offers and extras, issues and maintenance:** existing offers, the problem report form and the maintenance report form.

## Guide

Managers write each home's guide under **Turnovers → Guest portal by home** (`portal.guide`): arrival instructions (required) and a guidebook (optional). Saving changed text raises the version guests see; saving the same text changes nothing; a stale form is refused. Cleaners and agent credentials never receive guide text, and no public booking page carries it.

## Links

- A cancelled stay's page shows no code, instructions or tasks.
- After check-out the page shows no code or instructions.
- A link stops working seven days after check-out (404).
- **Replace guest link** (`portal.link.rotate`) ends the old link at once. The new link appears on the stay's turnover and in the next guest message; messages already sent keep the old, dead link.

Not yet covered: a link before the door code exists (a stay blocked by an unsigned agreement or open identity check has no stay page until access is released; its agreement and identity pages are separate links), a payment task for channel-paid stays, guidebook photos and files, and per-version guide history.

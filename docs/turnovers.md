Every reservation turns itself over. When a stay is booked on Airbnb, Vrbo or Booking.com (through its calendar link or file) or taken directly in Cabin, Cabin makes its turnover between that guest's check-out and the next guest's check-in, issues the guest a door code for the stay and, once a cleaner is assigned, gives the cleaner their own code for the turnover window and emails them the window, address and code. The cleaner marks the home ready from their phone with photos, and **Readiness** shows the owner which homes are ready for their next guests.

## Set up each home once

Open **Turnovers** and, under **Turnover settings by home**, open a home:

- **Address the cleaner drives to**, the home's **Time zone**, and its **Check-out** and **Check-in** times (10 am and 4 pm unless you change them).
- **Default cleaner**: every new turnover at this home goes to them automatically. Leave it as "Nobody" to assign each one yourself.
- **Maintenance person**: who gets the home's maintenance tasks.
- **Checklist**, one item per line, and **Photos to mark ready** (1 to 12).
- **Smart-lock device ID** (optional): see [Door codes](#door-codes).

Settings apply to turnovers Cabin makes from then on. Setting a default cleaner also assigns the home's turnovers that have no cleaner yet.

## What happens for each stay

- **A new stay** gets one turnover, from its check-out to the next check-in at that home (or the same day's check-in time when no next stay is booked yet). Stays that checked out before today start nothing.
- **A moved stay** (a channel changes the dates) moves its turnover window and codes, and so does the turnover before it. The cleaner gets an email that replaces the earlier one.
- **A cancelled stay** cancels its turnover and both its codes, and the cleaner is told.
- **Reassigning** a turnover (choose **Reassign to** on the job) gives the new cleaner fresh digits and an email; the old cleaner's code stops working and they are told it is no longer theirs.

Each turnover shows its window, the stay before and after it, its cleaner and whether their email went out. Without a mail provider (or in development, which never sends mail) the job says the email was not sent; the cleaner still sees it when they sign in.

You can also prepare a turnover by hand for review (or an agent can): approving it replaces the stay's open turnover. A stay never has two turnovers waiting.

## Door codes

Each stay's guest code works from check-in to check-out; each cleaner's code works for their turnover window. No two codes at a home overlap with the same digits. Guests see their code on their stay page: copy the **Guest stay page** link from the turnover and send it to the guest. A cancelled stay's page says so and shows no code.

Cabin pushes codes to a smart lock through [Seam](https://www.seam.co/) (which connects Schlage, Yale, August, Kwikset, igloohome, Nuki and other locks) when the owner's Seam API key is set as the `SEAM_API_KEY` secret and the home names its lock's Seam device ID. That account is a later step: until then every code says to set it on the keypad by hand. On RER Managed hosting, live lock push is not available yet (it cannot reach lock providers until RER adds a provider relay); it works on a self-hosted install. A lock that accepted a code is not a tested door: check it on site.

## What the cleaner does

The cleaner signs in on their phone and opens **Turnovers**, where they see only their own jobs: the window, the address (tap for directions) and their door code. For each job they:

1. Choose **Guests have left** when they find the home empty: Cabin records the actual check-out time (a manager can also choose **Record check-out now**).
2. Tick every checklist item.
3. Add the home's photos (at least the number the home asks for, up to 12). Phone photos are shrunk to fit before they upload.
4. Write a short note and choose **Mark ready**.

A job cannot be marked ready with an item unticked or too few photos, and it cannot be marked ready twice. If something is broken, they choose **Report something broken** on the job, say what is wrong, add photos and say whether the next guests can arrive. That becomes a maintenance task.

## Maintenance

**Maintenance** lists open and closed tasks. A cleaner's report goes to the home's maintenance person, who is emailed; you can add a task by hand, assign or reassign it, and close it with what was done and photos. The assignee can close it from their phone. An open task marked as blocking keeps the home from being ready.

## Readiness

**Readiness** answers "are my homes ready for Saturday?" Choose a day: each home shows its next arrival on or after it, the turnover before that arrival with its cleaner and photos, the guest's door code, and any blocking task. A home is **Ready** only when that turnover is done with its photos and nothing blocks it; when Cabin has no turnover before an arrival (the first stay it knows of), the home shows **Not known yet**, never ready.

Photos are private: only you, your managers, the job's cleaner and a task's assignee or reporter can open them.

Every home in Cabin carries its owner's name and email and the management commission you charge. Your team signs in with their own access: managers run the homes, cleaners see only their own jobs.

## Add a home

Open **Properties & people** and fill in **Add a property**:

| Field | What to enter |
| --- | --- |
| Property name | The name your team uses, such as Lake Loft. |
| Property owner name | The home's owner, who receives the statement. |
| Property owner email | The owner's email address. |
| Management commission | In basis points: `1500` means 15%, `2000` means 20%. From 0 to 10,000. |

Choose **Save property**. To change a home later, open **Edit property** on its card and choose **Save property changes**. A statement you have already approved keeps the owner details and commission it was approved with.

Have a spreadsheet of homes already? [Move in your homes](/docs/move-in) brings them in from one CSV.

## Add your team

Only you, the installation owner, grant access. In **Add a team member**, enter a **Name**, an **Email** and a **Role**:

- **Manager**: works the calendar, prepares and approves turnovers and statements, and sees every home. Managers read home details but cannot change owners or commission.
- **Cleaner**: sees only the turnovers assigned to them, with the home's name and the booking dates. Guest names on bookings read "Reserved", and owner details, commission, statements and calendars are hidden.

Choose **Save team member**, then **Send sign-in invitation** on their card. They sign in from the email.

## Change or end access

**Deactivate access** on a person's card ends their access on their next request; **Reactivate access** restores it. Deactivating keeps the record of the work they did.

## Try the other roles

On your own computer you can see Cabin as a manager or a cleaner without sending mail:

1. As the owner, add a team member with the email `cleaner@dev.localhost` and the role **Cleaner** (or `manager@dev.localhost` as **Manager**).
2. In another terminal, run the matching command:

```sh
rer dev --as cleaner
```

3. Open the private RER_OPEN link it prints in a separate browser profile. Use `rer dev --as manager` for the manager.

## Erase a home

**Erase property data** on a home's card permanently removes the home with its calendars, bookings, turnover jobs and photos, statements and the source of its move-in. Tick "I understand this permanently erases property data" and choose **Permanently erase property**. Export first if you need to keep anything: see [Back up, restore and erase](/docs/backup).

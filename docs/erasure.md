The installation owner opens **Properties & people** to review a property,
guest identity or team member, including a member who has accepted an invitation.
Activity also opens the guest review. A bearer assistant, manager or cleaner
cannot review, confirm or download erasure records.

Review lists reservations, the exact attachment and retained-source identifiers,
and each retained record's table, identifier, reason and end of retention.
The owner chooses the reason and end date for signed and accounting document
custody. The initial seven-year suggestion is an installation policy choice,
not a statement that a law requires that period. Posted ledger and tax records
are immutable: their holds explicitly say **Permanent**, identify the exact
records and explain the accounting constraint. No automatic deletion of posted
books is promised.

Confirmation binds the saved review, reservation/member/property revision,
installation version, retained-document digest, original photo hashes and source
snapshots. A change requires a fresh review. A delivery already being sent must
finish before erasure; it cannot be recalled midway through provider delivery.

Guest erasure clears the reviewed identity group, reservation contacts, messages,
preferences, consents, returning offers, recovery text, relevant job photographs
and retained vendor reports/undo snapshots. It cancels queued guest work and
revokes stay, agreement and identity links. Original signed documents move into
owner-only retention custody; normal staff agreement downloads return not found.
Other homes' unrelated guest identities stay separate. Property erasure deletes
its operational records, photos, public booking/calendar configuration and owner
portal grants, and retires affected original import custody. An indivisible source
file containing other homes is withdrawn as a whole; the other homes' already
imported native records survive.

Member erasure removes the grant and assignments, revokes its codes, removes
device-originated evidence photos and capacity profile, and suppresses notices.
An invited/active native operator is deactivated and anonymized, its sessions,
credentials and invitations revoked, and external identity links removed.
Permanent authority and business actions resolve through stable anonymous audit
references. The installation owner's own identity cannot be erased through a
team grant.

Every successful operation saves an append-only, downloadable completion receipt.
The receipt contains anonymous scope evidence, original identifiers/hashes,
retention inventory and external deletion steps, with no contact values or private
links. Owners can download held records separately; managers, cleaners, guests
and assistants cannot. Signed held agreements retain the exact original download.
When its chosen date arrives, the owner releases a document hold to remove its
payload. The release records its time and advances the archive erasure fence;
the permanent completion receipt remains. Immutable accounting holds cannot be
released through this command.

Erased email and phone hashes remain as durable contact fences. Product email
and SMS delivery must check those fences at their final network boundary. A later
import or old accounting snapshot does not authorize contact reuse. Historical
provider operations may require reconciliation directly with that provider.

Stripe Identity keeps only the provider reference needed to request redaction;
its state remains pending/processing until Stripe confirms completion. The owner
must separately ask booking channels, Stripe/payment providers, lock providers,
mail recipients and accounting-file recipients to delete their independent copies,
and revoke previously delivered physical access where necessary.

Export the post-erasure installation with `rer export --output later.rer` and
give its journal to a local restore:

```sh
rer import --input old.rer --journal later.rer --yes
```

The existing portability checkpoint refuses a pre-erasure archive before native
publication when the later journal is supplied. The later archive includes
receipts, contact fences and retained holds. An isolated old backup cannot learn
about future erasures. Delete downloaded backups, device drafts, attachments and
exports separately; Cabin cannot recall external copies or guarantee a partner's
deletion merely from a local completion receipt.

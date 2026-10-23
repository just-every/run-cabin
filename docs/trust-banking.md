# Trust-bank reconciliation

Open **Trust ledger → Trust-bank reconciliation**. A scoped accountant needs explicit `bank.account.create`, `bank.statement.import`, `bank.assign`, `bank.match` and `bank.reconcile` actions for the home's property. The existing finance read grant scopes every bank read. Only the installation owner can approve or cancel unexecuted distribution plans.

Configure the home's legal entity, then designate each USD trust/operating account with its institution, label and last four digits. Full account/routing details and provider credentials are not collected. Designations are immutable. One designation belongs to one home and its saved legal entity; existing journal ownership never follows a later property-owner change.

Import an actual bank statement using its source reference, custody evidence, period and opening/closing balances. The CSV has exactly these columns:

```text
Transaction ID,Date,Amount,Reference
```

Dates use ISO or US calendar dates; amounts use signed USD decimals, positive for deposits and negative for withdrawals. Opening plus all rows must equal closing. Replayed identical evidence returns the original; changed evidence, repeated transactions, overlapping/gapped later periods and inconsistent opening balances refuse publication. The normalized evidence and newline-normalized CSV digest remain immutable; no original document containing bank credentials is retained.

Assign every home journal explicitly to its bank account. Match each bank row to exactly one signed cash journal of the same amount and account. Neither attribution nor matching posts another receipt. Unassigned journals and unmatched bank rows prevent reconciliation. The frozen review explains bank closing, ledger cash, outstanding items and each original owner's payable, cash, receivables, reserves, guest advances, taxes and other liabilities. Journal corrections stay linked and require a new review; old reconciliations remain readable.

The native owner may approve an **unexecuted distribution plan** against a reconciled account and owner. Plans deduct other open plans, retained reserves and protected obligations, refuse another owner's cash and require all outstanding bank items to clear. An exact repeated approval returns the original plan; changed amounts/evidence require cancellation before replacement. Later journals, assignments or matches require reconciliation again. Cancellation releases only the internal plan reservation.

No ACH is submitted and no cash/liability distribution posting is invented. Actual movement still needs selected licensed-partner approval, authorized funded trust accounts, verified payees and fresh execution authority. Pending, settled, failed and returned ACH, actual return evidence and corrected owner statements remain FIN-006 gaps. Ct approval is pending for this conservative planning boundary. Restores retain source bank history and frozen reconciliations with distribution plans paused; historical approvals confer no execution authority.

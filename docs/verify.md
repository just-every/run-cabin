## Verification commands

Acceptance text and status come only from CONTRACT.md. Regenerate its acceptance and claims documents before checking the edition.

~~~sh
node src/base/contract-docs.mjs write
node src/base/contract-docs.mjs check
rer check
rer verify
rer build --site
~~~

Passing a structural check does not prove a promised outcome. Use the clause’s cited assertions and exact-commit Verify result; real-world receipts remain in the Field proof register.

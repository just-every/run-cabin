Verified against public provider documentation on 17 October 2026. These are specific report profiles, not a promise that every report from a provider has the same columns. The importer accepts UTF-8 CSV, semicolon CSV, and TSV, preserves IDs as strings, and reports physical source line numbers. XLSX/PDF must first be exported or saved as CSV. No spreadsheet formulas are evaluated.

Upload the native report files together with a separate `cabin-cutover-PROVIDER.csv`. The latter is **Cabin's operator-supplied cutover inventory**, not a provider export. Owners, management agreements, financial balances and retained channel feeds must be checked against the source account before supplying it. Missing business terms have no defaults.

## Native report profiles

### Guesty

From Reservations, customize the report and download CSV. Include `Listing ID`, `Listing's nickname` (or `Listing's title`), `Confirmation code`, `Guest's name`, `Check-in`, `Check-out`, `Integration`, and `Status`. Include the documented guest contact columns `Guest's email` and `Guest's phone` when available. `Reservation ID` is accepted when present; otherwise `Confirmation code` supplies the source reservation identity. Straight and curly apostrophes and letter case are accepted. `Check-in date` / `Check-out date` are documented alternate date labels. [Reservations report](https://help.guesty.com/hc/en-gb/articles/9370076145437-Setting-up-a-reservations-report), [guest/contact/date columns](https://help.guesty.com/hc/en-gb/articles/33981954569245-Red-Sky-Travel-Insurance), [reservation ID in guest CSV](https://help.guesty.com/hc/en-gb/articles/39922410694429-Pilot-Adding-multiple-guests-to-a-reservation).

A properties report with `Listing ID` and `Nickname` / `Title` also imports vacant homes. The supplied fixture uses those display columns. Guesty explicitly documents adding `Listing ID` to properties reports. Owner stays are excluded from its reservations report; they must be handled separately. Include `Currency` when exporting financial data, although reservation money is not imported as owner debt. [Property ID export](https://help.guesty.com/hc/en-gb/articles/9365078554653-Locating-a-Guesty-property-ID).

### Hostaway

Use **Financial Reporting > Rental Activity > Download report > Reservations report**, which is one row per reservation. Its documented CSV columns include `Reservation ID`, `Guest name`, `Channel name`, `Reservation status`, `Payment method`, `Paid`, `Arrival date`, `Departure date`, `Listing name`, and `Reservation date`. These are the fixture's exact headers. Do not upload the reservation-line-items variant: one reservation would appear repeatedly. The separate Reservations > Download Report export is configurable and is not the profile used here. [Rental Activity CSV fields](https://support.hostaway.com/hc/en-us/articles/1260801381250-Financial-Reporting-Rental-Activity), [other reservation export](https://support.hostaway.com/hc/en-us/articles/360021922293-Reservations-Download-Reservations-via-CSV).

The report lacks stable listing IDs and guest contact columns. Match `Listing name` exactly to one supplemental home, supplying its real Hostaway listing ID there. Duplicate names are refused. Guest names import; missing email/phone remain empty. Native `new` and `modified` mean confirmed; `cancelled` means canceled. `ownerStay`, pending/payment/verification states and inquiries are refused. Account-defined financial formulas do not establish a portable opening owner balance. [API statuses and owner statement formulas](https://api.hostaway.com/documentation).

### OwnerRez

Use **Reports > Stay Reports > Date Range > Export**, covering the future stay window. This report includes booking, property, guest and contact information. Its [official PDF example](https://uc.orez.io/w/files/bbd5254243074a5da22b0c5360db4f0b) provides these exact display headers, used as the synthetic CSV header projection:

```text
Booking #,Property,Owner,Arrival,Check-In,Departure,Check-Out,Cleaning Date,Events,Guest,Phone,Email,N,A,C,P,Door Code,Tags,Other Fields
```

The importer reads `Booking #`, `Property`, `Arrival`, `Departure`, `Guest`, `Phone`, and `Email`. Dates accept ISO or the example's US `MM/DD/YYYY`. `Booking #` retains the displayed `ORB` prefix. Property names must match exactly one supplemental home containing the real property ID. This report has no channel/status columns: provide verified `Channel` and `Status` in a supplemental reservation row for every booking. `Events` means arriving/departing/staying, not booking confirmation. Blocked-off time is refused. [Report/export instructions](https://www.ownerrez.com/support/articles/stay-date-range).

The OwnerRez fixture's canceled booking represents a report snapshot followed by a cancellation verified in the cutover inventory; cancellation is explicitly supplemental, not a fabricated native report column. For a current-only report, canceled reservations absent from the source report cannot be recovered by this import.

## Cabin supplemental cutover CSV

The filename must start with `cabin-cutover` and end in `.csv` or `.tsv`. Every row supplies `Provider` (`guesty`, `hostaway`, or `ownerrez`) and `Record type`. Header order is arbitrary; unused columns may be blank.

| Record type | Required columns | Meaning |
| --- | --- | --- |
| `home` | `Listing ID`, `Listing name`, `Owner name`, `Owner email`, `Commission percent` | Verified source ID and current management terms. `18.50` means 18.5%, stored as 1850 basis points. No `%` sign. |
| `reservation` | `Reservation ID`; `Channel` and `Status` when absent natively | Supplements an existing native row; cannot create a reservation by itself. Optional `Channel reference` and `iCal UID` preserve source matching keys. |
| `balance` | `Balance ID`, `Listing ID`, `Owner email`, `Opening balance`, `Currency`, `As of` | Unique reconciled ledger line. Amount is signed decimal USD, at most two decimals, without symbols/grouping. `As of` must equal the chosen cutover date. Include explicit zero balances. |
| `link` | `Listing ID`, `Channel`, `iCal URL` | Existing channel export feed to retain. One per home/channel. Uses Cabin's shared public HTTPS URL validation. |

Supported channels are Airbnb, Vrbo, Booking.com, and direct stays. Links support the first three. Channel identifiers documented by providers (such as `airbnbOfficial`, `airbnb2`, `homeaway`, `bookingcom`) map to those channels. Unknown channels are refused, never treated as direct. Supplemental `confirmed` / `cancelled` statuses must be verified by the operator. Supplemental status/channel may fill missing values but cannot override conflicting native values.

This file is necessary because neither a guest's outstanding payment nor a booking's owner revenue is the reconciled amount owed to an owner at cutover. Use source owner statements/remittance records and account for amounts already paid, reserves, expenses and dates. Guesty provides separate owner statement/payment exports; OwnerRez provides PM Owner Statement Summary exports; Hostaway's statement totals depend on selected formulas and event basis. These formats are not silently treated as the same ledger. [Guesty owner payments](https://help.guesty.com/hc/en-gb/articles/9370464544541-Exporting-payments-made-to-an-owner), [OwnerRez statement summary](https://www.ownerrez.com/support/articles/owner-statement-summary), [Hostaway financial report meanings](https://support.hostaway.com/hc/en-us/articles/360059839593-Financial-Reporting-Common-Questions).

Retain the original **channel export** URL that was imported into the former PMS. A former PMS's own export URL is a different feed and may stop when that account closes. Hostaway exposes listing iCal links separately, and iCal connections chiefly synchronize availability. OwnerRez standard export URLs and custom links have different revocation behavior. Guesty's imported-calendar API stores external feed URL and name. Native API channel connections are not recreated by retaining an iCal URL. [Hostaway iCal setup](https://support.hostaway.com/hc/en-us/articles/360002562334-Custom-iCal-Setup-Sync-and-Limitations), [OwnerRez iCal](https://www.ownerrez.com/support/articles/custom-ical-links), [Guesty imported calendars](https://open-api-docs.guesty.com/reference/importedcalendaropenapicontroller_getimportedcalendars).

## Reconciliation and limits

Initial limit: 100 homes, 500 nonempty data rows across all uploads, 20 files and 2 MB combined. Source reservation totals include valid and refused native rows. Future nights include parseable confirmed spans from `max(arrival, cutover)` up to the exclusive checkout date. Supplemental OwnerRez status determines whether those source nights are confirmed. Source owner balance totals include every parseable USD balance line, even one later refused for identity/date validation. Decimal conversion and sums must fit exact integer cents. Non-USD lines are refused without conversion.

Native rows retain `{file,row}` provenance. Reports without guest IDs get a deliberately source-scoped `reservation:ID:guest` identity. Equal guest names are never evidence that two contacts are the same person. Dates are property-local calendar dates; UTC timestamps must not simply be sliced to obtain stay dates. Imported bookings retain cancellation status and optional channel reference/iCal UID, allowing the lifecycle layer to detect conflicts and avoid duplicating later calendar events.

## Offline API response adapters

[The recorded API adapter](https://github.com/just-every/run-cabin/blob/main/src/cabin/movein/providers/recorded-api.ts) exports the pure `adaptRecordedApi` function, taking a provider and recorded responses. It performs no fetches and accepts no credentials. Its harness object contains separate `listings`, `reservations`, optional `guests`, `ownerStatements`, and `importedCalendars` response payloads. JSON is deliberately **not** accepted by the application upload path. These fixtures are synthetic response-shaped projections of official schemas, not captures from real accounts and not an application fallback.

| Provider | Documented response shapes used |
| --- | --- |
| Guesty | Listings `{results,fields,limit}` (the listing endpoint's prose describes this envelope, though its response schema also shows a bare array; adapter accepts both). V3 search `{results:[{reservationId,guestId,status,source,confirmationCode,checkInDateLocalized,checkOutDateLocalized,stay:[{listingId,...}]}],pagination:{skip,limit,hasMore}}`. Guest detail `{_id,firstName,lastName,fullName,email,phone,returningGuest}`. |
| Hostaway | `{status:'success',result:[...]}` for listings/reservations. Listings `{id,name}`. Reservations `{id,listingMapId,channelName,channelReservationId,guestName,guestEmail,phone,arrivalDate,departureDate,status}`. Guest contacts are embedded in reservations; no standalone guests endpoint is invented. |
| OwnerRez | Lists `{items:[...],limit,offset,next_page_url?}`. Property `{id,name,owner_id,currency_code}`; booking `{id,property_id,guest_id,arrival,departure,type,status,listing_site,platform_reservation_number?}`; guest `{id,first_name,last_name,email_addresses:[{address,is_default}],phones:[{number,is_default}]}`. |

[Guesty listing reference](https://open-api-docs.guesty.com/reference/propertieslistinglist), [V3 reservation search](https://open-api-docs.guesty.com/reference/reservationsopenapicontroller_searchreservations), [guest detail](https://open-api-docs.guesty.com/reference/guestsopenapicontroller_getguest), [Hostaway API](https://api.hostaway.com/documentation), [OwnerRez current OpenAPI](https://api.ownerrez.com/openapi/v2.json), [OwnerRez pagination](https://www.ownerrez.com/support/articles/api-pagination-etags).

Guesty owner statement response `{results,count,limit,skip,total}` contains `id`, `ownerId`, `listings`, `currency`, `endingBalance`, `dueToOwner`, and `minimumAccountBalance`, among other metadata. The adapter preserves statement evidence but does not allocate owner-level balances across properties or confuse funds due with reserves. Its optional imported-calendar fixture array holds individual documented calendar response objects `{id,listingId,name,url,...}`; names are user-defined, so the adapter does not infer channel from them. [Owner statements API](https://open-api-docs.guesty.com/reference/ownerstatementscontroller_list).

Hostaway's statement detail response wraps `summaryDataJson` entries containing `formulaName` and `totalValue`. It uses configurable formulas, so it produces a warning rather than an invented balance. OwnerRez's current public v2 OpenAPI exposes owners (including `last_owner_statement_id`) but no owner-statement balance or retained feed URL endpoint. These require explicit cutover evidence. Empty OwnerRez fields/collections can be absent, including `items` on an empty result. Direct bookings may lack an OTA reservation number and listing site; absence is not permission to guess. [OwnerRez omission rules](https://www.ownerrez.com/support/articles/api-response-format).

The API adapter refuses Guesty multi-segment stays rather than assigning all nights to the first home. It also refuses OwnerRez `owner`, `block`, `quote_hold` and `linked_availability` types and unsupported pending statuses. Guesty V3 avoids building a new integration around the deprecated legacy reservation API. [OwnerRez availability types](https://www.ownerrez.com/support/articles/api-webhooks), [Guesty deprecation](https://open-api-docs.guesty.com/changelog/2026-07-30).

## Synthetic bundles and reproducing evidence

[Each native CSV bundle](https://github.com/just-every/run-cabin/tree/main/tests/fixtures/movein) contains a native `reservations.csv` and an explicitly named Cabin cutover CSV; Guesty also includes `properties.csv`. At cutover `2026-10-17`, each bundle has 2 homes, 3 reservations (2 confirmed and 1 canceled), 7 future nights, 2 opening balance lines totaling USD 1750.42, 6 retained feeds, and zero parser refusals. `calendar.example.com` links are reserved-domain examples, not working provider connections.

[API harness fixtures](https://github.com/just-every/run-cabin/tree/main/tests/fixtures/movein/api) contain one response bundle per provider. The public move-in flow test includes recorded-response adapter assertions. From the application root, run:

```sh
node --test tests/movein.test.mjs
```

The adapter portion checks synthetic response shapes without contacting a provider. The public flow portion proves upload, preview, apply, reconciliation, signoff and undo against the test database.

Open **Direct bookings** in the installed Cabin workspace. Each home has its own booking page address, nightly rate, cleaning and extra guest fees, guest limit, stay length and spacing between stays. Enter money in US dollars and taxes as percentages. Save and publish the home to make `/book/<address>` available; `/book` lists published homes. Availability includes channel stays, blocks and unpaid checkout holds. Public availability never lists guest names.

## Connect and check Stripe from the page

On self-hosted Cabin, the **Connect Stripe** card has all the steps and links:

1. Create or sign in to your own [Stripe account](https://dashboard.stripe.com/register). Stripe charges its own [payment and Identity fees](https://stripe.com/pricing).
2. Open [test API keys](https://dashboard.stripe.com/test/apikeys), select your sandbox/test mode, and reveal its secret key beginning `sk_test_`. The publishable `pk_` key cannot make payments.
3. Paste it into **Stripe test secret key**, then **Save and check test key**. Cabin checks Stripe's balance API, then seals the secret using the installation's `SESSION_SECRET`. The page never echoes the key; database exports contain ciphertext. Preserve the installation secret when restoring an export, or enter the Stripe keys again.
4. Press **Open $1 Stripe test checkout**. Complete the real Stripe-hosted checkout using card `4242 4242 4242 4242`, a future expiry and any three-digit security code. No real money moves. Returning to Cabin reads Stripe's actual Checkout Session and successful $1 USD PaymentIntent. The card shows **Passed** only when Stripe confirms both. An unfinished checkout can be reopened from this card; **Check Stripe connection and test result** reads it again.
5. For real bookings, activate your account, reveal the secret beginning `sk_live_` from [live API keys](https://dashboard.stripe.com/apikeys), and save it in the live key form. Confirm that new bookings charge real money. Each existing stay retains its original payment mode, so keep both keys available while test and live stays remain open. Use the saved-key buttons to switch the mode for new bookings.
6. Enable [Stripe Identity](https://dashboard.stripe.com/identity) for your account before requiring identity checks. A test payment does not establish live Identity eligibility or verify a real guest.

A privately configured `STRIPE_TEST_SECRET_KEY` or `STRIPE_SECRET_KEY` also works. Keys entered on the page take precedence. Self-hosted Cabin talks directly to Stripe; there is no relay account to configure. On **RER Managed**, payments, deposits and Identity are unavailable because there is no outbound Stripe connection or provider relay. Cabin refuses provider requests there, even if a key exists.

## Guest booking and confirmation

Guests review the itemized price, separate damage authorization and rental agreement before signing. They consent to payment, saved-card use for damage holds, and Stripe Identity if required. Cabin keeps the exact agreement, signature, time, version, consent and SHA-256. Guests and authorized staff can download that record. Later changes to home settings do not change a saved agreement or quote.

Checkout reserves nights atomically, then opens Stripe's hosted card form. Card numbers never pass through Cabin. Success requires reading Stripe's paid Checkout Session and matching successful USD PaymentIntent; a return parameter alone proves nothing. Returning from payment or Identity automatically reconciles the stay before showing its status. The guest's private booking page links back to payment, ID verification, damage authorization and their signed agreement. If Stripe cannot create checkout after nights are reserved, Cabin takes the guest to that saved page with the provider error and booking link.

A received payment queues a real receipt email containing dates, amount, next steps and the private booking link. When the required checks complete, Cabin queues a separate confirmation. Both use the installed guest email provider and appear in the Inbox, where hosts can see delivery failures and retry them. Direct bookings also shows their delivery status. Local development and demo suppress external mail; a configured hosted mail provider actually sends it. Cabin does not claim that a queued or failed email was delivered.

Unpaid expired sessions reopen nights. A five-minute job reconciles payments and required checks. Cabin's calendar exports immediately include held nights; external channels read those exports on their own schedule.

## Damage holds near arrival and renewal

Cabin saves the guest's card mandate at rent payment but defers the initial damage hold until **48 hours before the home's local check-in time**. The five-minute job requests it when due; opening the booking page also checks it. An advance reservation can be confirmed after rent and required ID checks while the damage hold is scheduled. The page explicitly says no funds are held yet. For imminent arrivals, a required hold must succeed before initial confirmation.

Stripe supplies the authorization's actual expiry. Cabin shows it in the home's time zone. A hold expiring before arrival or checkout is flagged; an expired authorization is displayed as expired and secures no funds. Card holds are short lived, so long stays can need renewal. See [Stripe's authorization windows](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).

When a saved card needs authentication or a hold expires, the guest can open their private booking page and choose **Authorize damage deposit** or **Renew damage authorization**. This opens a separate real Stripe-hosted manual-capture checkout, where the guest supplies or authenticates their card. Renewal is available once the 48-hour window opens and an existing hold does not cover checkout. A replacement can temporarily appear alongside the old authorization. Cabin releases the old hold after Stripe confirms the replacement. A lost or failed response remains visible for host review. Holds are not silently renewed, and a confirmed reservation does not imply that an expired damage authorization still protects it.

Staff record actual departure with **Mark guest checked out** after arrival. Otherwise Cabin uses the home's local checkout time. The scheduled job releases unclaimed holds after the configured release hours (plus up to five minutes). Hosts can release after checkout or capture a documented damage amount, in dollars, with a reason and evidence. Stripe releases the uncaptured remainder. Refresh reconciles uncertain capture/release responses before another financial action.

## Lodging taxes and remaining scope

The configured state and county percentages apply to rent and fees, appear as separate checkout lines, and are collected with the payment. Check the correct applicability and rate for the home. After filing and remitting through the relevant authority, record its confirmation reference on the stay. Cabin records evidence; it does not file or remit taxes. Exemptions, city levies, refunds, adjusted returns and automatic filing still require further work.

Other remaining work includes ACH, installment schedules, refunds/cancellations, agreement amendments and renewed signatures, a custom-domain gallery/search site, an authorized embed, and manual identity-review controls.

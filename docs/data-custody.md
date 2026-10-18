# Your data and providers

Cabin stores reservations, guest profiles and threads, payouts, trust journals,
statements, photos and signed documents in the installation's D1 database and
file storage. Local mode uses the owner's computer; a self-hosted deployment
uses the owner's server account. There is no Cabin author account, product
telemetry endpoint or central Cabin database.

In **Channels → Your data & connected providers**, review each destination,
purpose, data and provider terms. Existing configuration is the connection:
a saved calendar link, mail configuration, Stripe key, Seam key, Twilio key,
Booking.com machine account, Anthropic key or Pantry credential. Merely allowing
sharing in this panel does not connect a service. API partner access remains
separate from iCal, and unsupported hosted connections remain unavailable.

Only the installation owner can disconnect or reconnect sharing. The durable
setting is checked immediately before each new provider request and product
email, including background work and requests made with credentials already
loaded in memory. Calendar sharing also gates secret iCal export reads. A
disconnected calendar keeps its last known inventory and shows a failed sync;
it never reports an empty calendar as a successful response. Redirecting
calendar links require the owner to connect the final destination explicitly.

A reconnection requires the current settings revision and explicit review.
Already submitted requests and delivered copies cannot be recalled: revoke
credentials and follow the recipient's deletion process where needed. Native
sign-in remains available; product invitations stop when email sharing is
disconnected. Historical business records remain readable.

`tests/data-custody.test.mjs` exercises a channel booking, guest conversation,
USD payout import and completed cleaner photo through product routes. It records
all outbound requests, checks the resulting private database/media records,
and proves that disconnecting blocks subsequent manual and Cron requests and
calendar exports without deleting the held reservation. It also exercises
owner-only control, explicit reconnection and blocked invitation delivery.

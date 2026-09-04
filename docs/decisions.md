# Decisions

## 1. Derive fill status live instead of storing it

**Chose:** Never store `OPEN`/`PARTIALLY_FILLED`/`FILLED`/`CLOSED` as a column. Compute it every
time from `signup.count()` vs `capacity`, plus `isClosed` and whether `endTime` has passed.

**Rejected:** Storing a `status` column and updating it whenever a signup/cancellation happens.

**Why:** A stored status can drift out of sync with reality if any code path forgets to update
it (a cancelled signup that doesn't re-check the status, a bulk operation that skips the
update step, etc.). Deriving it removes an entire class of bugs at the cost of a small amount
of extra computation on read. Given the spec explicitly says these states "can never be set by
hand," deriving them was really the only reading that matches the requirement.

## 2. Reject-on-Filled as the required core behavior, waitlist as an explicit opt-in layer on top — REVERSED FROM MY FIRST APPROACH

**What I built first:** An automatic waitlist — when a shift was full, a signup attempt
silently queued the volunteer instead of failing.

**What I changed it to, and why:** Re-reading the README closely, goal 4 says plainly: "A
signup can only be created for a shift that is Open or Partially Filled, never for one that is
Filled or Closed." A waitlist is listed separately, under optional "Stretch ideas," not as part
of the required behavior. My first version directly contradicted the required rule. I reworked
signup to reject outright with a clear error when a shift is Filled, and added the waitlist
back as a genuinely separate, explicitly-triggered action (`POST /waitlist`) that a volunteer
has to choose — so the required behavior and the stretch behavior coexist without the stretch
one silently overriding the spec.

## 3. Coordinator-only program membership, not volunteer self-join — ALSO REVERSED

**What I built first:** A `POST /programs/:id/join` endpoint a volunteer could call themselves.

**What I changed it to:** The spec says "Only a coordinator can add or remove a volunteer from
a program." I removed self-join entirely and replaced it with a coordinator-facing "add member
by email" flow (`POST /programs/:id/members`, coordinator-only, looks up an existing volunteer
account by email). This also meant volunteers must sign up for an account first, and the
coordinator has to already know their email — I'm assuming this happens outside the app
(matching how the scenario describes coordination happening via group chat today), which I'm
flagging here explicitly as an assumption rather than something the README states directly.

## 4. Different Supabase connection modes for local development vs. Render deployment

**Chose:** Local `.env` uses Supabase's direct connection (port 5432). Render's environment
variable uses the transaction pooler (port 6543, with `?pgbouncer=true`).

**Why:** Render's outbound networking is IPv4-only; Supabase's direct connection is IPv6-only,
so the direct connection fails from Render with a "can't reach database server" error, even
though it works fine locally. The pooler is IPv4-compatible. I confirmed this by testing
`Test-NetConnection` against both hosts and reading Supabase's own documentation note about
IPv6-by-default direct connections. Migrations still have to run against the direct connection
even locally, since PgBouncer (what the pooler runs) doesn't support the schema-lock behavior
`prisma migrate` needs — so there are effectively three connection contexts in play (local
app runtime, local migrations, and production runtime), and I use direct/pooler appropriately
for each rather than one connection string everywhere.

## 5. Storing emails lowercase for case-insensitive login

**Chose:** Normalize every email to lowercase before storing it (`email.toLowerCase()`) and
before looking it up on login or when a coordinator adds a member by email.

**Rejected:** Storing emails exactly as typed and doing a case-insensitive comparison at query
time (e.g. Postgres `ILIKE` or a citext column type).

**Why:** Storing normalized is simpler — the unique constraint on `email` then naturally
prevents `Test@x.com` and `test@x.com` being registered as two different accounts, with no
extra query logic needed anywhere. The trade-off is that the exact casing a user typed at
signup isn't preserved for display — a minor cosmetic loss I accepted for the simplicity.

## 6. A duplicate Express route silently shadowing the real one

**What happened:** While iterating on the shifts list endpoint (adding pagination), an edit
landed as a *second* `router.get('/', ...)` block instead of replacing the first one. Express
uses the first matching route and silently ignores the second — so the old, non-paginated
version kept responding indefinitely, and the newer code with pagination and search never ran
at all, even though it was sitting right there in the file. This also silently deleted the
`GET /:id` single-shift route in the process, which had been sitting between the two duplicate
blocks and got orphaned as a dead comment.

**How I found it:** By comparing the actual JSON shape coming back from the API (a plain array)
against what the code was supposed to return (a `{data, pagination}` object) using the
browser's Network tab, rather than assuming the code I'd last written was what was actually
running.

**What I'd do differently:** When editing a route file, view the whole file's route list
afterward (or run a quick `grep` for duplicate `router.get('/'` patterns) rather than trusting
that a "replace this block" instruction landed as a clean replacement.

## Other real decisions worth naming briefly

- **Node/Express/Prisma/React over Django or another stack**, specifically because I already
  knew JS/HTML/CSS from prior projects and DSA practice — the goal was to spend learning effort
  on backend concepts and the domain logic, not on a second new language at the same time.
- **Notify-and-let-claim instead of auto-promoting the longest-waiting volunteer** when a
  waitlisted spot opens up — fairer to whoever still actually wants the spot right now, and
  avoids silently committing someone without their active confirmation.
- **Format-only email validation (regex) instead of real email verification** — real
  verification needs a third-party mail service, which felt disproportionate to the brief's
  scope (in-app notifications only, no email infrastructure asked for).

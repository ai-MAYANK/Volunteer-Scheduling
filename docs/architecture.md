# Architecture

## The moving pieces

- **Frontend** — React (Vite), plain inline styles, React Router for navigation. Runs in the
  browser. Deployed as a static build on Vercel.
- **Backend** — Node.js + Express, a REST API under `/api/*`. Runs as a single always-on
  process. Deployed on Render (free web service).
- **Database** — PostgreSQL, hosted on Supabase. Accessed only through the backend via Prisma
  (an ORM) — the frontend never talks to the database directly.
- **Auth** — JWT tokens issued by the backend on login/signup, stored in the browser's
  `localStorage`, sent back on every request as an `Authorization: Bearer <token>` header.
  Password hashing via bcrypt.

## How they talk to each other

Frontend → HTTPS requests (via axios) → Backend (Express routes) → Prisma Client → Postgres
(Supabase).

The frontend never queries the database directly and never trusts a role sent from the
client — every route that needs a coordinator vs. volunteer check re-verifies the role from the
JWT payload on the server, not from anything the browser claims.

## Where each piece actually runs

- Frontend: static files served by Vercel's CDN, built from `frontend/` via `npm run build`.
- Backend: a single Node process on Render, built from `backend/` via `npm install` (and
  `npx prisma generate`, added to the build command after I hit a bug where Render's generated
  Prisma Client fell out of sync with schema changes).
- Database: Supabase-managed Postgres. Two different connection strings are used on purpose:
  the backend's local `.env` uses Supabase's *direct* connection (port 5432, IPv6), while
  Render's environment variable uses the *transaction pooler* connection (port 6543, IPv4,
  with `?pgbouncer=true`). I hit this the hard way: the direct connection worked perfectly on
  my own machine but failed with "can't reach database server" once deployed, because Render's
  outbound networking is IPv4-only and Supabase's direct connection is IPv6-only. The pooler is
  IPv4-compatible, so that's what production uses. Migrations still have to run against the
  direct connection locally, since the pooler doesn't support the schema-lock operations
  `prisma migrate` needs.

## Request path for one representative action: a volunteer signing up for a shift

1. Volunteer clicks "Sign up" on `/shifts/:id` in the React app.
2. Frontend sends `POST /api/shifts/:shiftId/signup` with the JWT in the `Authorization` header,
   no body needed.
3. Express middleware (`requireAuth`) verifies the JWT signature, decodes `{userId, role}`,
   attaches it to `req.user`. A second middleware (`requireRole('VOLUNTEER')`) rejects the
   request with 403 if the token belongs to a coordinator.
4. The route handler loads the shift, computes its current fill status from a live
   `signup.count()` against `capacity` (status is never stored — always derived).
5. If the shift is `CLOSED`, reject with 400. If `FILLED`, reject with 409 and point the
   volunteer at the separate waitlist endpoint instead (this is required — signups can only be
   created for Open or Partially Filled shifts).
6. If Open/Partially Filled, check two things before allowing the signup: (a) does the
   volunteer have a `Membership` row for this shift's program — if not, reject with 403; (b)
   does this signup's time window overlap any other signup this volunteer already holds, across
   any program — if so, reject with 409 naming the conflicting shift.
7. If all checks pass, the actual insert happens inside a Prisma `$transaction` that re-counts
   current signups immediately before inserting — this closes a race condition where two
   volunteers hitting "sign up" on the last open spot at the same instant could otherwise both
   succeed.
8. A `TimelineEvent` row is written in the same transaction, recording the old and new fill
   state.
9. The response (`201`, the new signup) goes back to the frontend, which reloads the shift and
   re-renders the updated status and button state.

## What I decided not to build

- **Email verification / sending real email.** Signup only validates that the email is
  well-formed (regex), not that it's deliverable. Real verification needs a third-party mail
  provider (SendGrid/Resend/SES) with its own account setup and sender-domain verification,
  which felt disproportionate given the brief scoped notifications as in-app only. This is the
  first thing I'd add with more time.
- **Auto-promotion from the waitlist.** When a spot opens up, every waitlisted volunteer is
  notified, but nobody is automatically signed up — each has to actively claim the spot. I
  considered auto-promoting the longest-waiting person, but decided notify-and-let-claim is
  fairer (first person who still actually wants the spot gets it, not just whoever's been
  waiting longest) and avoids silently opting someone into a commitment.
- **Pagination controls in the UI.** The backend fully supports `page`/`limit` query params on
  the shift list and returns a total count, but the frontend always requests page . With more
  time I'd add page-through controls; for now this is a known, disclosed gap rather than a
  hidden one.
- **A shared `getFillStatus()` utility module.** The same small function is currently
  duplicated in a few route files (`shifts.js`, `signups.js`, `dashboard.js`, `alerts.js`).
  Under time pressure I prioritized correctness over refactoring; this is the first cleanup
  I'd do in a follow-up pass.

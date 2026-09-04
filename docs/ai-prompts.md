# AI Prompts

I used Claude as a collaborator throughout — asking it to explain concepts, generate code I
then typed/pasted and tested myself, and walk me through debugging. Below is a grouped,
honest log of the real prompts, including the ones that led somewhere wrong.

## Planning and stack selection

- Asked for a process for successfully delivering this kind of take-home project, given it was 
  my project of this type for a placement round.
- Asked to pick a tech stack for me since I didn't have strong framework experience yet, given
  I knew C++/Python/Java and basic HTML/CSS/JS. Got Node/Express/Prisma/React with the
  reasoning that reusing JS across frontend and backend minimizes new syntax to learn while I
  focus on backend concepts.
- Worked through the full data model together before writing any code — asked it to propose
  entities and a schema, then pushed back with real requirements (global overlap check per
  volunteer, a waitlist with notify-not-auto-promote, in-app notifications only) until we had a
  design I could defend.

## Environment setup (produced some wrong results, corrected)

- Asked for terminal commands to scaffold the backend. Hit a PowerShell execution-policy
  block on `npm`,  then discovered `npx prisma init` had installed a pre-release Prisma CLI 
  (v8.0.0-rc.12) with a completely different, incompatible command structure than what every 
  tutorial and the documentation describes. Asked how to fix it — downgraded explicitly to 
  `prisma@5.22.0` to get the standard `migrate dev` command back.
- Asked for help connecting to Supabase. Went through several rounds of connection-string
  troubleshooting — an auth failure that turned out to be a issue where the pooler connection 
  failed differently from the direct connection. Eventually diagnosed as a protocol mismatch, 
  fixed with `?pgbouncer=true` and by using the direct connection specifically for running 
  migrations.

## Backend feature build

- Asked for auth (signup/login, bcrypt, JWT) with an explanation of what each library call does.
- Asked for role-based middleware, then Programs/Shifts CRUD, then — the most important
  request — the signup/waitlist state machine with a transaction-safe capacity check, since I
  specifically asked about the race-condition case (two volunteers claiming the last spot at
  once) and wanted to understand how a database transaction prevents that.
- Asked for search/filter/pagination, notifications, understaffed alerts, recurring shifts, CSV
  export, and dashboard aggregation, largely as complete route files I reviewed and pasted in,
  given time pressure by that point in the project.

## A prompt that produced something wrong, and what I did about it

I asked for the shifts list endpoint to be updated to add pagination, expecting the existing
route to be replaced. What actually landed in the file was a **second, duplicate route**
alongside the original — Express silently used the first one and ignored the second, so my app
kept serving old, non-paginated data no matter how much I edited the "new" code, and a separate
single-shift-detail route got orphaned as a dead comment in the process. I noticed something
was wrong because the frontend kept showing "No shifts found" despite shifts existing in the
database. I asked for help debugging by comparing the actual API response shape (via the
browser's Network tab) against what the code was supposed to return, which surfaced the
duplicate route. I asked for the entire file to be rewritten from scratch rather than patched
again, to be certain no second copy remained.

## Spec re-verification (a major correction)

After most of the app was built, I pasted the original README text back in and asked Claude to
walk through it against what we'd actually built, goal by goal. This surfaced that I'd built an
**automatic waitlist as if it were required**, when the actual required rule for goal 4 is to
reject a signup outright on a Filled shift — waitlist is listed only as an optional stretch
idea. It also surfaced a missing `location` field on shifts, that I'd built volunteer
self-service program joining when the spec requires coordinator-only membership management, a
wrong alert window, and other smaller gaps. I asked for a full explanation of the intended system 
logic first, confirmed I understood it, then asked for the corrected code for each gap in turn.

## Deployment

- Asked for Render setup for the backend, hit a "signup failed" bug once live that took real 
  debugging: first a `500` masking a database-connection error (the IPv4/IPv6 pooler
  issue described in decisions.md), then a second, separate issue after that was fixed, where
  Render's generated Prisma Client was stale relative to a schema change — fixed by adding
  `npx prisma generate` to Render's build command explicitly.
- Asked for Vercel setup for the frontend, hit a 404-on-refresh bug (classic SPA routing issue), 
  fixed with a `vercel.json` rewrite rule.

## UI/UX corrections

- Asked to restrict what data volunteers can see (hide other volunteers' emails and the audit
  timeline from non-coordinators), which introduced a follow-on bug: the frontend's
  "already signed up" detection broke because it depended on a field (`volunteerId`) that
  wasn't present anymore in the trimmed response shape sent to volunteers. Asked for help
  tracing it, which led to using a `isYou` boolean flag on both the frontend check and the
  backend response instead.
- Asked for case-insensitive login and for existing test accounts' emails to be normalized
  retroactively, since accounts created before the fix still had mixed-case emails stored.

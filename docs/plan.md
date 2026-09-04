# Plan

## How I broke the work into sessions

I worked in a handful of short sessions rather than strict daily blocks, but for some days it 
goes long as am stuck in the database connection issue. Roughly:

1. **Environment + data model session.** Installing Node, fixing a PowerShell execution-policy
   block, setting up a Supabase Postgres database, writing the full Prisma schema, running the
   first migration, initializing git with a deliberate first commit (`.gitignore` alone, before
   any code, so secrets could never accidentally slip into history).
2. **Backend core session.** Auth (signup/login, bcrypt, JWT), role middleware, Programs and
   Shifts CRUD, then the signup/waitlist state machine — the most important and most carefully
   tested part of the whole project.
3. **Backend breadth session.** Search/filter/pagination, notifications, understaffed alerts,
   recurring shifts, CSV export, dashboard aggregation.
4. **Frontend session.** React + Vite scaffold, auth pages, shift list, shift detail with
   signup/cancel/claim, a basic dashboard.
5. **Deployment session.** Render for the backend, Vercel for the frontend, plus real
   infrastructure debugging (Prisma CLI version mismatch, Supabase IPv4/IPv6 connection issue,
   a Vercel SPA-routing 404 on refresh).
6. **Spec-compliance correction session.** After re-reading the original README goals closely
   against what I'd actually built, I found real gaps — most importantly, that I'd built an
   automatic waitlist as if it were core, when the required behavior for goal 4 is simpler and
   stricter (reject a signup outright when a shift is Filled; waitlist is explicitly a stretch
   idea, not required). I reworked the signup logic to match the spec exactly, added the
   waitlist back in as an explicit opt-in layer on top, and fixed several other gaps: a missing
   `location` field on shifts, coordinator-only program membership (I'd originally built
   volunteer self-join, which the spec explicitly forbids), the 3-day (not 48-hour) alert
   window, dismiss/reappear logic for alerts, and a full page restructure (Home / Program /
   Shift) to match "opening a program shows its shifts."
7. **UX and correctness fixes.** Case-insensitive login, hiding other volunteers' contact
   details and the audit timeline from non-coordinators, restricting each coordinator to only
   their own programs and shifts, a "cancel signup" bug caused by a response-shape mismatch
   after I changed what data volunteers vs. coordinators receive.

## What order I built in, and why

Data model first, because everything else depends on it. Auth second, because every other
route needs to know who's calling. Then the shift lifecycle before anything else backend-side,
because it's the actual hard logic the rest of the app hangs off of — I wanted to get the
trickiest part right early rather than save it. Deployment came before full UI polish, 
deliberately — a live link is a hard requirement, and I'd rather have something plain but 
actually reachable than something polished but only running on my own machine. Spec 
re-verification came later than it should have — I built ahead on assumptions in a couple 
of places (the waitlist, self-service membership) that turned out to contradict the
literal README wording, and had to rework them once I caught it.

## What I estimated vs. what it actually took

I underestimated environment/infrastructure setup significantly — I expected maybe 30-45
minutes to get Node, Prisma, and a database connected, and it took several hours across two
separate issues: a pre-release Prisma CLI (v8.0.0-rc.12) that got installed by default and had
a completely different, incompatible command structure, and then a Supabase connection-pooling
authentication issue that turned out to be a protocol mismatch (PgBouncer doesn't support
Prisma's prepared-statement approach) rather than a credentials problem, which took a while to
correctly diagnose. I also didn't budget time for a full spec re-read partway through, which
surfaced real rework (the waitlist-vs-reject issue in particular).

## What I cut when I ran short

- Frontend pagination controls (backend supports it, UI doesn't expose it yet).
- A dedicated UI for the recurring-shift generator — the endpoint works and is reachable via
  direct API calls, but there's no form for it in the app yet.
- Deeper visual design — the UI is deliberately plain (readable tables, basic forms) rather
  than polished, since I prioritized functional correctness against the spec over aesthetics
  once time got tight.
- A shared utility module for the fill-status calculation, which is currently duplicated
  across a few route files instead of centralized.

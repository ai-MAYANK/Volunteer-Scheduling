# Submission

## Links

- **GitHub repository:** https://github.com/ai-MAYANK/Volunteer-Scheduling
- **Live application:** https://volunteer-scheduling.vercel.app

## Notes for the reviewer

The backend is hosted on Render's free tier, which spins down after inactivity. The first request after idle time can take 50+ seconds; even a page load shortly after a prior request can take around 10 seconds while the instance fully wakes up. This is expected — please give it a moment on first load rather than reading a slow response as a broken deployment.

Please log in as the Coordinator first to see the full picture (programs, shifts, dashboard, alerts), then log in as a Volunteer in a separate/incognito window to see the member-restricted view.

## Demo credentials

| Role        | Email              | Password  |
| ----------- | ------------------ | --------- |
| Coordinator | rahul123@gmail.com | Rahul123@ |
| Volunteer   | rohan12@gmail.com  | Rohan12@  |
| Volunteer   | vikash14@gmail.com | Vikash14@ |
| Volunteer   | ad123@gmail.com    | Ad123@    |

## Stack

|-- Layer --|---------------------  What you used ---------------------|------- Why -------|                              

|  Frontend | React (Vite), React Router, axios                        | Already knew JS/HTML/CSS, so I could focus learning effort on backend concepts and domain logic rather than a new frontend framework and language at once.|

|  Backend  | Node.js, Express                                         | Minimal, unopinionated — I can point to the actual code for any behavior rather than framework convention, which matters for explaining decisions.|

|  Database | PostgreSQL (via Supabase), Prisma ORM                    | Prisma's schema file doubles as living documentation of the data model, and made writing schema.md straightforward. |

|  Hosting  | Render (backend), Vercel (frontend), Supabase (database) | All have workable free tiers matching the brief's guidance.|

## Goal checklist

| #   |---------- Goal ----------| Status  |--------------------  Notes  --------------------|

| 1   | Accounts & roles         | Done    | Email/password auth, JWT, two roles, enforced server-side via middleware on every protected route. Coordinator can sign up/cancel any volunteer for any shift via dedicated override endpoints.|

| 2   | Programs                 | Done    | Create, edit, archive, restore — archiving is non-destructive (shifts/data preserved, just hidden from default views). |

| 3   | Shifts inside programs   | Done    | Date, start/end time, location, headcount. Full CRUD by coordinators. Opening a program (Program Detail page) shows its shifts. |

| 4   | Shift lifecycle          | Done    | Fill state (Open/Partially Filled/Filled/Closed) is always derived, never stored. Signups rejected outright on Filled/Closed shifts with a specific error message. Overlap check across all of a volunteer's signups. Coordinator can manually close a shift. A stretch-feature waitlist sits alongside this, not instead of it (see decisions.md). |

| 5   | Program membership       | Done    | Coordinator-only add/remove by email. Volunteers only ever see programs they belong to and shifts within them.|

| 6   | Finding shifts           | Done    | Server-side search over title and location, filters for program/status/date, sorting by date and fill-state, pagination with a total count returned by the API. (Pagination UI controls not yet built in the frontend — the API supports it but the app currently always requests page) |

| 7   | Recurring schedule + CSV | Partial | Backend fully implemented: date-range + weekly pattern generation with holiday exclusions, reporting created vs. skipped shifts and why; CSV export of every volunteer with total hours across a program. No frontend form for the recurring generator yet — reachable via direct API call only.|

| 8   | Dashboard                | Done    | Shifts/open/signups/closed this week, breakdown by fill-state and by program, 8-week signup chart.|

| 9   | Audit timeline           | Done    | Every shift's creation, fill-state transitions with old and new state, signups/cancellations with actor, and coordinator notes — append-only, visible to coordinators. |

| 10  | Understaffed alerts      | Done    | 3-day window, dismissible, reappears automatically if a cancellation drops a shift back below Filled within the window (implemented by clearing the dismissal whenever a cancellation happens). Nav badge shows a live count.|

## How much time did you actually spend?

Roughly 20-25 hours across several sessions over a few days — significantly more than the
brief's ~12-hour estimate. A meaningful chunk of that was infrastructure debugging that wasn't
really "building the app": a pre-release Prisma CLI that installed by default and had an
incompatible command set, and a Supabase IPv4/IPv6 connection issue between my local machine
and Render that took real diagnosis to trace to its actual cause. I also spent time re-reading
the spec closely partway through and reworking a couple of features (most significantly, the
waitlist-vs-reject behavior) that I'd built on assumptions that turned out to be wrong.

## What would you do next, with another 12 hours?

- Build the recurring-shift generator's frontend form so it's usable without direct API calls.
- Add pagination controls to the shift list UI.
- Move the fill-status calculation into a shared utility module instead of duplicating it
  across route files, and push more of the dashboard's aggregation (especially the 8-week
  chart) into single SQL queries instead of looping.
- Add automated tests to lock in the lifecycle rules, since correctness currently rests on
  manual testing I did during development.
- Seed more realistic demo data and clean out leftover test/debug records.

## What are you least happy with in this codebase, and why?

The duplicated `getFillStatus()` logic across multiple route files. It's correct everywhere
right now because I was careful to keep the copies in sync, but that's a fragile guarantee —
it's exactly the kind of thing that causes a subtle bug later if one copy gets updated and
another doesn't, similar to the duplicate-route bug I actually hit and had to debug during this
project. I'd extract it into a single shared module as the very first thing in any follow-up
session.

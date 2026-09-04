# Volunteer Scheduling
 
A full-stack web app for coordinating volunteer programs and shifts — coordinators create
programs and shifts, add volunteers to programs, and track who's signed up; volunteers browse
and sign up for shifts in the programs they belong to.
 
Built as a take-home project. See [`SUBMISSION.md`] for live links, demo
credentials, and a self-assessment against the project brief, and [`docs/`] for architecture, schema, planning, and decision write-ups.
 

## Live app
 
- **App:** https://volunteer-scheduling.vercel.app
- **API:** https://volunteer-scheduling-api.onrender.com

The backend is on a free-tier host that sleeps when idle — the first request can take up to a minute to wake it up.
 

## Tech stack
 
- **Frontend:** React (Vite), React Router, axios
- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Supabase), via Prisma ORM
- **Auth:** JWT + bcrypt
- **Hosting:** Vercel (frontend), Render (backend), Supabase (database)


## What it does
 
- Coordinators create and archive programs, and create/edit/delete/close shifts within them.
- Coordinators add or remove volunteers from a program — volunteers can't join themselves.
- Volunteers sign up for and cancel shifts in programs they belong to. Shift fill status (Open / Partially Filled / Filled / Closed) is always derived from live signup counts, never set directly.
- Signups are blocked on Filled/Closed shifts and on any shift that overlaps a volunteer's existing signup elsewhere. A shift-level waitlist lets volunteers opt in when a shift is full, with active claiming (not auto-promotion) when a spot opens.
- Shifts can be searched and filtered by title, location, program, status, and date, with server-side pagination.
- Coordinators can bulk-generate recurring weekly shifts and export a program's roster (every volunteer with total hours) as CSV.
- A dashboard shows weekly metrics, a fill-state/program breakdown, and an 8-week signup chart.
- Every shift has a permanent, append-only timeline of creation, state changes, signups, cancellations, and coordinator notes.
- Coordinators get alerts for shifts understaffed within the next 3 days, with a nav badge and dismiss option; alerts reappear if a later cancellation drops a shift back below Filled.


## Project structure
 
```
backend/     Express API, Prisma schema and migrations
frontend/    React app (Vite)
docs/        Architecture, schema, plan, decisions, AI usage log
SUBMISSION.md  Links, credentials, goal checklist, self-assessment
```
 

## Running locally
 
**Backend**
```bash
cd backend
npm install
# create a .env with DATABASE_URL and JWT_SECRET — see backend/.env.example
npx prisma migrate dev
node index.js
```
 
**Frontend**
```bash
cd frontend
npm install
# create a .env.local with VITE_API_URL=http://localhost:4000/api
npm run dev
```
 
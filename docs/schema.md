# Schema

8 tables, managed through Prisma (`backend/prisma/schema.prisma`), Postgres on Supabase.

## Tables

**User** — id (uuid, PK), name, email (unique, stored lowercase for case-insensitive login),
passwordHash, role (enum: COORDINATOR | VOLUNTEER), createdAt.

**Program** — id (PK), name, description (nullable), isArchived (bool, default false),
coordinatorId (FK → User), createdAt.

**Membership** — id (PK), userId (FK → User), programId (FK → Program), joinedAt. Unique
constraint on (userId, programId) — a volunteer can't join the same program twice.

**Shift** — id (PK), programId (FK → Program), title, location, startTime, endTime, capacity
(int), isClosed (bool, default false), dismissedAt (nullable datetime — used for the
understaffed-alert dismiss feature), createdAt.

**Signup** — id (PK), shiftId (FK → Shift), volunteerId (FK → User), createdAt. Unique
constraint on (shiftId, volunteerId) — the database itself prevents a duplicate signup, not
just application logic.

**Waitlist** — id (PK), shiftId (FK → Shift), volunteerId (FK → User), createdAt. Same unique
pair constraint as Signup.

**Notification** — id (PK), userId (FK → User), message, relatedEntityType, relatedEntityId
(these two together point at any entity type without a rigid foreign key — used for "a spot
opened up" notifications), isRead (bool), createdAt.

**TimelineEvent** — id (PK), entityType, entityId (same polymorphic pattern as Notification),
action (string, e.g. CREATED / SIGNED_UP / CANCELLED / CLOSED / NOTE), oldState/newState
(nullable — populated for fill-state transitions), actorId (FK → User), details (nullable free
text — used for coordinator notes), createdAt.

## Relationships

- User ↔ Program: one-to-many (one coordinator owns many programs) via `coordinatorId`.
- User ↔ Program via Membership: many-to-many (a volunteer can belong to many programs, a
  program can have many volunteers) — Membership is the join table.
- Program ↔ Shift: one-to-many (a shift belongs to exactly one program).
- Shift ↔ User via Signup: many-to-many in principle, but constrained to at most one row per
  (shift, volunteer) pair by the unique index, so in practice each volunteer has 0 or 1 signup
  per shift.
- Shift ↔ User via Waitlist: same shape as Signup.
- TimelineEvent and Notification aren't true foreign-key relationships to "any entity" — they
  store a type string and an id, which the application interprets. This trades referential
  integrity for flexibility (one timeline/notification table instead of one per entity type).

## Constraints: database vs. application

**Enforced at the database level:**
- Unique email per user.
- Unique (userId, programId) per membership — no duplicate joins.
- Unique (shiftId, volunteerId) per signup and per waitlist entry — no duplicate signups even
  under concurrent requests, since this is a real unique index, not just an application check.
- Foreign key integrity on every relation (can't create a Signup pointing at a nonexistent
  Shift, etc.).

**Enforced only in application code (Express route handlers):**
- Role-based authorization (coordinator vs. volunteer) — the database has no concept of "who's
  allowed to call this."
- The entire shift fill-state derivation (Open/Partially Filled/Filled/Closed) — deliberately
  not a stored column at all, computed live from `signup.count()` vs `capacity` plus
  `isClosed`/`endTime`. I chose this specifically so the state can never drift out of sync with
  reality — there's no "update the status" step to forget.
- The overlap check (no two signups for the same volunteer with overlapping time windows) — no
  natural way to express this as a Postgres constraint without a much heavier exclusion
  constraint setup, so it's checked in the signup route before the insert, then re-verified
  inside the transaction to close the race-condition window.
- Program-membership gating (a volunteer must be a member before signing up for a shift in that
  program) — checked in the route, not the schema.
- The 3-day understaffed-alert window and the "alert reappears if a filled shift drops back
  down" rule — computed live on every request to `/alerts/understaffed`, never stored as a
  persistent "is this alert active" flag (only `dismissedAt` is stored, and it gets cleared on
  any cancellation so the alert can naturally reappear).

## What I deliberately denormalized

- **Fill status isn't stored anywhere** — it's the opposite of denormalization, really: I
  chose to compute it every time rather than cache/store it, to guarantee it's never wrong.
  The cost is an extra `count()` query on almost every shift read; at low volume this is
  negligible.
- **TimelineEvent and Notification use a generic (entityType, entityId) pair instead of proper
  foreign keys.** This means the database can't guarantee a TimelineEvent actually points at a
  real Shift — that's trusted to application code. I accepted this because building separate
  timeline tables per entity type felt like overkill for a project this size, and nothing here
  is safety-critical enough to need DB-enforced referential integrity on the audit log itself.

## What would break first at 100x the data

At 100x current volume (which is still small test data — maybe a few thousand shifts and tens
of thousands of signups), I'd expect the first real strain to be:

1. **The fill-status computation.** Every shift list request currently does a `count()` per
   shift (or a joined `signups: true` include and counts in JS). At 100x, listing shifts would
   mean 100x more of these counts. This is the first thing I'd address — either by adding a
   cached `signupCount` column updated transactionally alongside inserts/deletes, or by
   pushing the fill-status computation into a single SQL aggregate query instead of N+1-style
   per-shift counting.
2. **The recurring-shift generator's existing-shift check**, which currently does a
   `findFirst` per candidate date inside a loop rather than one batched query — fine for
   generating a few dozen shifts, but would get slow generating hundreds.
3. **The dashboard's 8-week signup chart**, which currently runs 8 separate `count()` queries
   (one per week) rather than a single grouped query — again, fine at small scale, wasteful at
   scale.

None of these are correctness problems, just N+1-style performance ones — they'd all be fixable
by moving more of the aggregation into SQL rather than looping in JavaScript.

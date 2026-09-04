const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function getFillStatus(shift, signupCount) {
  if (shift.isClosed || new Date() > new Date(shift.endTime)) return 'CLOSED';
  if (signupCount === 0) return 'OPEN';
  if (signupCount < shift.capacity) return 'PARTIALLY_FILLED';
  return 'FILLED';
}

// Create a shift (coordinator only) — now requires location
router.post('/', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { programId, title, location, startTime, endTime, capacity } = req.body;
  if (!programId || !title || !location || !startTime || !endTime || !capacity) {
    return res.status(400).json({ error: 'programId, title, location, startTime, endTime, capacity are required' });
  }

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return res.status(404).json({ error: 'program not found' });
  if (program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the program coordinator can add shifts' });
  }

  const shift = await prisma.shift.create({
    data: { programId, title, location, startTime: new Date(startTime), endTime: new Date(endTime), capacity: parseInt(capacity) },
  });

  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: shift.id, action: 'CREATED', actorId: req.user.userId },
  });

  res.status(201).json(shift);
});

// Edit a shift (coordinator only, owning program)
router.patch('/:id', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can edit this shift' });
  }

  const { title, location, startTime, endTime, capacity } = req.body;
  const updated = await prisma.shift.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(location && { location }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(capacity && { capacity: parseInt(capacity) }),
    },
  });
  res.json(updated);
});

// Delete a shift
router.delete('/:id', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can delete this shift' });
  }
  await prisma.signup.deleteMany({ where: { shiftId: req.params.id } });
  await prisma.waitlist.deleteMany({ where: { shiftId: req.params.id } });
  await prisma.shift.delete({ where: { id: req.params.id } });
  res.json({ message: 'shift deleted' });
});

// Coordinator manually closes a shift (goal 4)
router.post('/:id/close', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can close this shift' });
  }
  const count = await prisma.signup.count({ where: { shiftId: req.params.id } });
  const oldStatus = getFillStatus(shift, count);
  const updated = await prisma.shift.update({ where: { id: req.params.id }, data: { isClosed: true } });
  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: req.params.id, action: 'CLOSED', oldState: oldStatus, newState: 'CLOSED', actorId: req.user.userId },
  });
  res.json(updated);
});

// Coordinator leaves a note on a shift's timeline (goal 9)
router.post('/:id/notes', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note text is required' });
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can add notes' });
  }
  const event = await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: req.params.id, action: 'NOTE', details: note, actorId: req.user.userId },
  });
  res.status(201).json(event);
});

// Get a shift's full timeline (goal 9)
router.get('/:id/timeline', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can view this timeline' });
  }
  const events = await prisma.timelineEvent.findMany({
    where: { entityType: 'Shift', entityId: req.params.id },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(events);
});

// List shifts — search (title/location), filter (program/status/date), sort, pagination (goal 6)
router.get('/', requireAuth, async (req, res) => {
  const { programId, status, search, date, sortBy = 'startTime', sortDir = 'asc', page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (req.user.role === 'VOLUNTEER') {
    const memberships = await prisma.membership.findMany({ where: { userId: req.user.userId } });
    const memberProgramIds = memberships.map(m => m.programId);
    where.programId = programId ? programId : { in: memberProgramIds };
  } else if (req.user.role === 'COORDINATOR') {
    const ownPrograms = await prisma.program.findMany({ where: { coordinatorId: req.user.userId } });
    const ownProgramIds = ownPrograms.map(p => p.id);
    where.programId = programId ? programId : { in: ownProgramIds };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (date) {
    const dayStart = new Date(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.startTime = { gte: dayStart, lt: dayEnd };
  }

  const validSort = ['startTime', 'fillStatus'].includes(sortBy) ? sortBy : 'startTime';
  const orderBy = validSort === 'fillStatus' ? { startTime: 'asc' } : { [validSort]: sortDir === 'desc' ? 'desc' : 'asc' };

  const [shifts, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: { signups: true, waitlist: true, program: { select: { name: true } } },
      orderBy,
      skip,
      take: parseInt(limit),
    }),
    prisma.shift.count({ where }),
  ]);

  let withStatus = shifts.map(s => ({ ...s, fillStatus: getFillStatus(s, s.signups.length) }));
  if (status) withStatus = withStatus.filter(s => s.fillStatus === status.toUpperCase());
  if (validSort === 'fillStatus') {
    const order = { OPEN: 0, PARTIALLY_FILLED: 1, FILLED: 2, CLOSED: 3 };
    withStatus.sort((a, b) => sortDir === 'desc' ? order[b.fillStatus] - order[a.fillStatus] : order[a.fillStatus] - order[b.fillStatus]);
  }

  res.json({ data: withStatus, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
});

// Get one shift with full detail
router.get('/:id', requireAuth, async (req, res) => {
  const shift = await prisma.shift.findUnique({
    where: { id: req.params.id },
    include: { signups: { include: { volunteer: { select: { name: true, email: true } } } }, waitlist: true, program: true },
  });
  if (!shift) return res.status(404).json({ error: 'shift not found' });

  const isOwner = req.user.role === 'COORDINATOR' && shift.program.coordinatorId === req.user.userId;
  const responseShift = { ...shift, fillStatus: getFillStatus(shift, shift.signups.length) };

  if (!isOwner) {
    responseShift.signups = shift.signups.map(s => ({ id: s.id, isYou: s.volunteerId === req.user.userId }));
    responseShift.waitlist = shift.waitlist.map(w => ({ id: w.id, isYou: w.volunteerId === req.user.userId }));
  }
  res.json(responseShift);
});

// Recurring shift generator — date range + weekly pattern + holiday exclusions (goal 7)
router.post('/recurring', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { programId, title, location, dayOfWeek, startTime, durationMinutes, capacity, rangeStart, rangeEnd, excludeDates = [] } = req.body;
  if (!programId || !title || !location || dayOfWeek === undefined || !startTime || !durationMinutes || !capacity || !rangeStart || !rangeEnd) {
    return res.status(400).json({ error: 'programId, title, location, dayOfWeek, startTime, durationMinutes, capacity, rangeStart, rangeEnd are required' });
  }

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return res.status(404).json({ error: 'program not found' });
  if (program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the program coordinator can add shifts' });
  }

  const excludeSet = new Set(excludeDates.map(d => new Date(d).toDateString()));
  const [hh, mm] = startTime.split(':').map(Number);
  const created = [];
  const skipped = [];

  let cursor = new Date(rangeStart);
  const end = new Date(rangeEnd);
  while (cursor <= end) {
    if (cursor.getDay() === parseInt(dayOfWeek)) {
      const shiftStart = new Date(cursor);
      shiftStart.setHours(hh, mm, 0, 0);
      const shiftEnd = new Date(shiftStart.getTime() + durationMinutes * 60000);

      if (excludeSet.has(cursor.toDateString())) {
        skipped.push({ date: cursor.toDateString(), reason: 'excluded as holiday' });
      } else {
        const existing = await prisma.shift.findFirst({
          where: { programId, startTime: shiftStart },
        });
        if (existing) {
          skipped.push({ date: cursor.toDateString(), reason: 'a shift already exists for this program at this date and time' });
        } else {
          const shift = await prisma.shift.create({
            data: { programId, title, location, startTime: shiftStart, endTime: shiftEnd, capacity: parseInt(capacity) },
          });
          await prisma.timelineEvent.create({
            data: { entityType: 'Shift', entityId: shift.id, action: 'CREATED', details: 'via recurring generator', actorId: req.user.userId },
          });
          created.push(shift);
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.status(201).json({ message: `${created.length} shifts created, ${skipped.length} skipped`, created, skipped });
});

// CSV roster export — every volunteer with total hours across the PROGRAM (goal 7)
router.get('/program/:programId/roster.csv', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const program = await prisma.program.findUnique({ where: { id: req.params.programId } });
  if (!program) return res.status(404).json({ error: 'program not found' });
  if (program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can export this roster' });
  }

  const signups = await prisma.signup.findMany({
    where: { shift: { programId: req.params.programId } },
    include: { volunteer: true, shift: true },
  });

  const hoursByVolunteer = {};
  for (const s of signups) {
    const hours = (new Date(s.shift.endTime) - new Date(s.shift.startTime)) / (1000 * 60 * 60);
    if (!hoursByVolunteer[s.volunteerId]) {
      hoursByVolunteer[s.volunteerId] = { name: s.volunteer.name, email: s.volunteer.email, totalHours: 0 };
    }
    hoursByVolunteer[s.volunteerId].totalHours += hours;
  }

  const rows = ['Name,Email,TotalHours'];
  for (const v of Object.values(hoursByVolunteer)) {
    rows.push(`"${v.name}","${v.email}","${v.totalHours.toFixed(1)}"`);
  }
  const csv = rows.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="roster-${req.params.programId}.csv"`);
  res.send(csv);
});

module.exports = router;
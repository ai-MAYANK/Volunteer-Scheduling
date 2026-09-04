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

async function checkOverlapAndMembership(volunteerId, shift) {
  const membership = await prisma.membership.findUnique({
    where: { userId_programId: { userId: volunteerId, programId: shift.programId } },
  });
  if (!membership) {
    return { error: 'you must be a member of this program before signing up for its shifts' };
  }

  const alreadySignedUp = await prisma.signup.findUnique({
    where: { shiftId_volunteerId: { shiftId: shift.id, volunteerId } },
  });
  if (alreadySignedUp) {
    return { error: 'Already joined in this shift', alreadyJoined: true };
  }

  const existingSignups = await prisma.signup.findMany({
    where: { volunteerId, shiftId: { not: shift.id } },
    include: { shift: true },
  });
  const overlap = existingSignups.find(s =>
    new Date(shift.startTime) < new Date(s.shift.endTime) &&
    new Date(shift.endTime) > new Date(s.shift.startTime)
  );
  if (overlap) {
    return { error: `this overlaps with your existing signup for "${overlap.shift.title}"` };
  }
  return null;
}async function checkOverlapAndMembership(volunteerId, shift) {
  const membership = await prisma.membership.findUnique({
    where: { userId_programId: { userId: volunteerId, programId: shift.programId } },
  });
  if (!membership) {
    return { error: 'you must be a member of this program before signing up for its shifts' };
  }

  const alreadySignedUp = await prisma.signup.findUnique({
    where: { shiftId_volunteerId: { shiftId: shift.id, volunteerId } },
  });
  if (alreadySignedUp) {
    return { error: 'Already joined in this shift', alreadyJoined: true };
  }

  const existingSignups = await prisma.signup.findMany({
    where: { volunteerId, shiftId: { not: shift.id } },
    include: { shift: true },
  });
  const overlap = existingSignups.find(s =>
    new Date(shift.startTime) < new Date(s.shift.endTime) &&
    new Date(shift.endTime) > new Date(s.shift.startTime)
  );
  if (overlap) {
    return { error: `this overlaps with your existing signup for "${overlap.shift.title}"` };
  }
  return null;
}

// Core signup: rejects if shift is not Open/Partially Filled (per required spec — no auto-waitlist)
router.post('/:shiftId/signup', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const { shiftId } = req.params;
  const volunteerId = req.user.userId;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });

  const signupCount = await prisma.signup.count({ where: { shiftId } });
  const status = getFillStatus(shift, signupCount);

  if (status === 'CLOSED') {
    return res.status(400).json({ error: 'this shift is closed and no longer accepting signups' });
  }
  if (status === 'FILLED') {
    return res.status(409).json({ error: 'this shift is full. You may join the waitlist instead via POST /:shiftId/waitlist' });
  }

  const checkResult = await checkOverlapAndMembership(volunteerId, shift);
  if (checkResult?.error) return res.status(checkResult.error.includes('member') ? 403 : 409).json({ error: checkResult.error });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.signup.count({ where: { shiftId } });
      if (currentCount >= shift.capacity) throw new Error('RACE_NOW_FULL');
      const signup = await tx.signup.create({ data: { shiftId, volunteerId } });
      const newCount = currentCount + 1;
      const newStatus = getFillStatus(shift, newCount);
      await tx.timelineEvent.create({
        data: { entityType: 'Shift', entityId: shiftId, action: 'SIGNED_UP', oldState: status, newState: newStatus, actorId: volunteerId },
      });
      return signup;
    });
    res.status(201).json({ message: 'signed up successfully', signup: result });
  } catch (err) {
    if (err.message === 'RACE_NOW_FULL') {
      return res.status(409).json({ error: 'this shift filled up just now. You may join the waitlist instead.' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'you have already signed up for this shift' });
    }
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

// Explicit opt-in waitlist (stretch feature, only when shift is Filled — not Closed)
router.post('/:shiftId/waitlist', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const { shiftId } = req.params;
  const volunteerId = req.user.userId;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });

  const signupCount = await prisma.signup.count({ where: { shiftId } });
  const status = getFillStatus(shift, signupCount);

  if (status !== 'FILLED') {
    return res.status(400).json({ error: 'waitlist is only available for shifts that are currently Filled' });
  }

  const checkResult = await checkOverlapAndMembership(volunteerId, shift);
  if (checkResult?.error) return res.status(checkResult.error.includes('member') ? 403 : 409).json({ error: checkResult.error });

  const existing = await prisma.waitlist.findUnique({
    where: { shiftId_volunteerId: { shiftId, volunteerId } },
  });
  if (existing) return res.status(409).json({ error: 'you are already on the waitlist for this shift' });

  const entry = await prisma.waitlist.create({ data: { shiftId, volunteerId } });
  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: shiftId, action: 'WAITLISTED', actorId: volunteerId },
  });
  res.status(201).json({ message: 'added to waitlist', waitlist: entry });
});

// Volunteer cancels their own signup
router.delete('/:shiftId/signup', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  await performCancel(req.params.shiftId, req.user.userId, req.user.userId, res);
});

// Coordinator cancels any volunteer's signup (goal 1 — coordinator override)
router.delete('/:shiftId/signup/:volunteerId', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.shiftId }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can do this' });
  }
  await performCancel(req.params.shiftId, req.params.volunteerId, req.user.userId, res);
});

// Coordinator signs up a volunteer on their behalf (goal 1 — coordinator override)
router.post('/:shiftId/signup/:volunteerId', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { shiftId, volunteerId } = req.params;
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can do this' });
  }

  const signupCount = await prisma.signup.count({ where: { shiftId } });
  const status = getFillStatus(shift, signupCount);
  if (status === 'CLOSED') return res.status(400).json({ error: 'this shift is closed' });
  if (status === 'FILLED') return res.status(409).json({ error: 'this shift is full' });

  const checkResult = await checkOverlapAndMembership(volunteerId, shift);
  if (checkResult?.error) return res.status(checkResult.error.includes('member') ? 403 : 409).json({ error: checkResult.error });

  try {
    const signup = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.signup.count({ where: { shiftId } });
      if (currentCount >= shift.capacity) throw new Error('RACE_NOW_FULL');
      const s = await tx.signup.create({ data: { shiftId, volunteerId } });
      const newStatus = getFillStatus(shift, currentCount + 1);
      await tx.timelineEvent.create({
        data: { entityType: 'Shift', entityId: shiftId, action: 'SIGNED_UP_BY_COORDINATOR', oldState: status, newState: newStatus, actorId: req.user.userId, details: `on behalf of volunteer ${volunteerId}` },
      });
      return s;
    });
    res.status(201).json({ message: 'volunteer signed up successfully', signup });
  } catch (err) {
    if (err.message === 'RACE_NOW_FULL') return res.status(409).json({ error: 'shift filled up just now' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'volunteer already signed up for this shift' });
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

async function performCancel(shiftId, volunteerId, actorId, res) {
  const signup = await prisma.signup.findUnique({
    where: { shiftId_volunteerId: { shiftId, volunteerId } },
  });
  if (!signup) return res.status(404).json({ error: 'this volunteer is not signed up for this shift' });

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { program: true } });
  const beforeCount = await prisma.signup.count({ where: { shiftId } });
  const oldStatus = getFillStatus(shift, beforeCount);

  await prisma.signup.delete({ where: { id: signup.id } });
  const newStatus = getFillStatus(shift, beforeCount - 1);

  // Reset alert dismissal — a cancellation may re-trigger understaffed status (goal 10 requirement)
  await prisma.shift.update({ where: { id: shiftId }, data: { dismissedAt: null } });

  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: shiftId, action: 'CANCELLED', oldState: oldStatus, newState: newStatus, actorId },
  });

  const waitlisted = await prisma.waitlist.findMany({ where: { shiftId } });
  for (const entry of waitlisted) {
    await prisma.notification.create({
      data: { userId: entry.volunteerId, message: `A spot opened up in "${shift.title}" — sign up now if you'd like it`, relatedEntityType: 'Shift', relatedEntityId: shiftId },
    });
  }
  if (waitlisted.length > 0) {
    await prisma.notification.create({
      data: { userId: shift.program.coordinatorId, message: `A volunteer cancelled on "${shift.title}" — ${waitlisted.length} people notified from the waitlist`, relatedEntityType: 'Shift', relatedEntityId: shiftId },
    });
  }

  res.json({ message: 'signup cancelled', notifiedWaitlist: waitlisted.length });
}

// Waitlisted volunteer claims an open spot
router.post('/:shiftId/claim', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const { shiftId } = req.params;
  const volunteerId = req.user.userId;

  const waitlistEntry = await prisma.waitlist.findUnique({
    where: { shiftId_volunteerId: { shiftId, volunteerId } },
  });
  if (!waitlistEntry) return res.status(404).json({ error: 'you are not on the waitlist for this shift' });

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.signup.count({ where: { shiftId } });
      if (currentCount >= shift.capacity) throw new Error('STILL_FULL');
      const signup = await tx.signup.create({ data: { shiftId, volunteerId } });
      await tx.waitlist.delete({ where: { id: waitlistEntry.id } });
      await tx.timelineEvent.create({
        data: { entityType: 'Shift', entityId: shiftId, action: 'CLAIMED_FROM_WAITLIST', actorId: volunteerId },
      });
      return signup;
    });
    res.status(201).json({ message: 'spot claimed successfully', signup: result });
  } catch (err) {
    if (err.message === 'STILL_FULL') return res.status(409).json({ error: 'someone else claimed this spot first' });
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

module.exports = router;
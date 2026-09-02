const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Volunteer signs up for a shift
router.post('/:shiftId/signup', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const { shiftId } = req.params;
  const volunteerId = req.user.userId;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { signups: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.isClosed || new Date() > new Date(shift.endTime)) {
    return res.status(400).json({ error: 'this shift is closed' });
  }

  // Check 1: overlap — does this volunteer have any existing signup whose time window overlaps this shift?
  const existingSignups = await prisma.signup.findMany({
    where: { volunteerId },
    include: { shift: true },
  });
  const overlap = existingSignups.find(s =>
    new Date(shift.startTime) < new Date(s.shift.endTime) &&
    new Date(shift.endTime) > new Date(s.shift.startTime)
  );
  if (overlap) {
    return res.status(409).json({ error: `this overlaps with your existing signup for "${overlap.shift.title}"` });
  }

  try {
    // Transaction: re-check capacity and insert atomically, so two concurrent
    // requests can't both slip into the last open spot (race condition guard).
    const result = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.signup.count({ where: { shiftId } });

      if (currentCount >= shift.capacity) {
        // Shift is full — add to waitlist instead
        const existingWaitlist = await tx.waitlist.findUnique({
          where: { shiftId_volunteerId: { shiftId, volunteerId } },
        });
        if (existingWaitlist) throw new Error('ALREADY_WAITLISTED');

        const waitlistEntry = await tx.waitlist.create({ data: { shiftId, volunteerId } });
        await tx.timelineEvent.create({
          data: { entityType: 'Shift', entityId: shiftId, action: 'WAITLISTED', actorId: volunteerId },
        });
        return { type: 'waitlisted', data: waitlistEntry };
      }

      const signup = await tx.signup.create({ data: { shiftId, volunteerId } });
      await tx.timelineEvent.create({
        data: { entityType: 'Shift', entityId: shiftId, action: 'SIGNED_UP', actorId: volunteerId },
      });
      return { type: 'signed_up', data: signup };
    });

    if (result.type === 'waitlisted') {
      return res.status(200).json({ message: 'shift is full, you have been added to the waitlist', waitlist: result.data });
    }
    return res.status(201).json({ message: 'signed up successfully', signup: result.data });

  } catch (err) {
    if (err.message === 'ALREADY_WAITLISTED') {
      return res.status(409).json({ error: 'you are already on the waitlist for this shift' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'you have already signed up for this shift' });
    }
    console.error(err);
    return res.status(500).json({ error: 'something went wrong' });
  }
});

// Volunteer cancels their signup
router.delete('/:shiftId/signup', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const { shiftId } = req.params;
  const volunteerId = req.user.userId;

  const signup = await prisma.signup.findUnique({
    where: { shiftId_volunteerId: { shiftId, volunteerId } },
  });
  if (!signup) return res.status(404).json({ error: 'you are not signed up for this shift' });

  await prisma.signup.delete({ where: { id: signup.id } });
  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: shiftId, action: 'CANCELLED', actorId: volunteerId },
  });

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { program: true } });
  const waitlisted = await prisma.waitlist.findMany({ where: { shiftId } });

  // Notify every waitlisted volunteer that a spot opened (no auto-promotion)
  for (const entry of waitlisted) {
    await prisma.notification.create({
      data: {
        userId: entry.volunteerId,
        message: `A spot opened up in "${shift.title}" — sign up now if you'd like it`,
        relatedEntityType: 'Shift',
        relatedEntityId: shiftId,
      },
    });
  }

  // Notify the coordinator too, using the program's actual coordinatorId
  if (waitlisted.length > 0) {
    await prisma.notification.create({
      data: {
        userId: shift.program.coordinatorId,
        message: `A volunteer cancelled on "${shift.title}" — ${waitlisted.length} people notified from the waitlist`,
        relatedEntityType: 'Shift',
        relatedEntityId: shiftId,
      },
    });
  }

  res.json({ message: 'signup cancelled', notifiedWaitlist: waitlisted.length });
});

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
      if (currentCount >= shift.capacity) {
        throw new Error('STILL_FULL');
      }
      const signup = await tx.signup.create({ data: { shiftId, volunteerId } });
      await tx.waitlist.delete({ where: { id: waitlistEntry.id } });
      await tx.timelineEvent.create({
        data: { entityType: 'Shift', entityId: shiftId, action: 'CLAIMED_FROM_WAITLIST', actorId: volunteerId },
      });
      return signup;
    });
    res.status(201).json({ message: 'spot claimed successfully', signup: result });
  } catch (err) {
    if (err.message === 'STILL_FULL') {
      return res.status(409).json({ error: 'someone else claimed this spot first' });
    }
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

module.exports = router;
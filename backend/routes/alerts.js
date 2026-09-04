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

// Understaffed shifts: within next 3 days, still Open or Partially Filled, not dismissed
router.get('/understaffed', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      startTime: { gte: now, lte: cutoff },
      isClosed: false,
      program: { coordinatorId: req.user.userId },
    },
    include: { signups: true, program: { select: { name: true } } },
  });

  const understaffed = shifts
    .map(s => ({ ...s, fillStatus: getFillStatus(s, s.signups.length) }))
    .filter(s => (s.fillStatus === 'OPEN' || s.fillStatus === 'PARTIALLY_FILLED') && !s.dismissedAt)
    .map(s => ({
      id: s.id, title: s.title, location: s.location, programName: s.program.name,
      startTime: s.startTime, capacity: s.capacity,
      filled: s.signups.length, spotsOpen: s.capacity - s.signups.length,
    }));

  res.json(understaffed);
});

// Badge count for nav (same query, just a number)
router.get('/understaffed/count', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const shifts = await prisma.shift.findMany({
    where: { startTime: { gte: now, lte: cutoff }, isClosed: false, program: { coordinatorId: req.user.userId } },
    include: { signups: true },
  });
  const count = shifts
    .map(s => ({ ...s, fillStatus: getFillStatus(s, s.signups.length) }))
    .filter(s => (s.fillStatus === 'OPEN' || s.fillStatus === 'PARTIALLY_FILLED') && !s.dismissedAt).length;
  res.json({ count });
});

// Dismiss an alert (reappears automatically if it drops back below Filled later, since cancel resets dismissedAt)
router.post('/:shiftId/dismiss', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.shiftId }, include: { program: true } });
  if (!shift) return res.status(404).json({ error: 'shift not found' });
  if (shift.program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the owning coordinator can dismiss this alert' });
  }
  const updated = await prisma.shift.update({ where: { id: req.params.shiftId }, data: { dismissedAt: new Date() } });
  res.json(updated);
});

module.exports = router;
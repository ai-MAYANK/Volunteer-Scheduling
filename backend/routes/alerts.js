const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Shifts starting soon that are still understaffed
router.get('/understaffed', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const hoursAhead = parseInt(req.query.hours) || 48;
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      startTime: { gte: now, lte: cutoff },
      isClosed: false,
      program: { coordinatorId: req.user.userId },
    },
    include: { signups: true, program: { select: { name: true } } },
  });

  const understaffed = shifts
    .filter(s => s.signups.length < s.capacity)
    .map(s => ({
      id: s.id, title: s.title, programName: s.program.name,
      startTime: s.startTime, capacity: s.capacity,
      filled: s.signups.length, spotsOpen: s.capacity - s.signups.length,
    }));

  res.json(understaffed);
});

module.exports = router;
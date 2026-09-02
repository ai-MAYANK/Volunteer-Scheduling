const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const coordinatorId = req.user.userId;

  const programs = await prisma.program.findMany({
    where: { coordinatorId },
    include: { shifts: { include: { signups: true } }, memberships: true },
  });

  let totalShifts = 0, openShifts = 0, filledShifts = 0, totalVolunteers = new Set();
  for (const p of programs) {
    for (const s of p.shifts) {
      totalShifts++;
      const count = s.signups.length;
      if (count === 0) openShifts++;
      if (count >= s.capacity) filledShifts++;
      s.signups.forEach(sg => totalVolunteers.add(sg.volunteerId));
    }
    p.memberships.forEach(m => totalVolunteers.add(m.userId));
  }

  res.json({
    totalPrograms: programs.length,
    totalShifts,
    openShifts,
    filledShifts,
    partiallyFilledShifts: totalShifts - openShifts - filledShifts,
    totalVolunteers: totalVolunteers.size,
  });
});

module.exports = router;
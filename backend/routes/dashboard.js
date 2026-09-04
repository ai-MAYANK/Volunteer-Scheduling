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

router.get('/', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const coordinatorId = req.user.userId;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  const programs = await prisma.program.findMany({
    where: { coordinatorId },
    include: { shifts: { include: { signups: true } } },
  });

  let shiftsThisWeek = 0, openShiftsThisWeek = 0, closedShiftsThisWeek = 0;
  const byFillState = { OPEN: 0, PARTIALLY_FILLED: 0, FILLED: 0, CLOSED: 0 };
  const byProgram = [];

  for (const p of programs) {
    let programOpen = 0, programTotal = 0;
    for (const s of p.shifts) {
      const status = getFillStatus(s, s.signups.length);
      byFillState[status]++;
      programTotal++;
      if (status === 'OPEN' || status === 'PARTIALLY_FILLED') programOpen++;

      if (new Date(s.startTime) >= startOfWeek && new Date(s.startTime) < endOfWeek) {
        shiftsThisWeek++;
        if (status === 'OPEN' || status === 'PARTIALLY_FILLED') openShiftsThisWeek++;
        if (status === 'CLOSED') closedShiftsThisWeek++;
      }
    }
    byProgram.push({ programName: p.name, totalShifts: programTotal, openShifts: programOpen });
  }

  const programIds = programs.map(p => p.id);
  const signupsThisWeek = await prisma.signup.count({
    where: { shift: { programId: { in: programIds } }, createdAt: { gte: startOfWeek, lt: endOfWeek } },
  });

  // Signups per week, last 8 weeks
  const weeklyChart = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(startOfWeek.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const count = await prisma.signup.count({
      where: { shift: { programId: { in: programIds } }, createdAt: { gte: weekStart, lt: weekEnd } },
    });
    weeklyChart.push({ weekStart: weekStart.toISOString().slice(0, 10), signups: count });
  }

  res.json({
    shiftsThisWeek,
    openShiftsThisWeek,
    signupsThisWeek,
    closedShiftsThisWeek,
    byFillState,
    byProgram,
    weeklySignupChart: weeklyChart,
  });
});

module.exports = router;
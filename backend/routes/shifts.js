const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Derive fill status for a shift given its signup count
function getFillStatus(shift) {
  const count = shift.signups.length;
  const now = new Date();
  if (shift.isClosed || now > new Date(shift.endTime)) return 'CLOSED';
  if (count === 0) return 'OPEN';
  if (count < shift.capacity) return 'PARTIALLY_FILLED';
  return 'FILLED';
}

// Create a shift (coordinator only)
router.post('/', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { programId, title, startTime, endTime, capacity } = req.body;
  if (!programId || !title || !startTime || !endTime || !capacity) {
    return res.status(400).json({ error: 'programId, title, startTime, endTime, capacity are required' });
  }

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return res.status(404).json({ error: 'program not found' });
  if (program.coordinatorId !== req.user.userId) {
    return res.status(403).json({ error: 'only the program coordinator can add shifts' });
  }

  const shift = await prisma.shift.create({
    data: { programId, title, startTime: new Date(startTime), endTime: new Date(endTime), capacity: parseInt(capacity) },
  });

  await prisma.timelineEvent.create({
    data: { entityType: 'Shift', entityId: shift.id, action: 'CREATED', actorId: req.user.userId },
  });

  res.status(201).json(shift);
});

// List shifts (basic version — filters added later)
router.get('/', requireAuth, async (req, res) => {
  const shifts = await prisma.shift.findMany({
    include: { signups: true, program: { select: { name: true } } },
    orderBy: { startTime: 'asc' },
  });
  const withStatus = shifts.map(s => ({ ...s, fillStatus: getFillStatus(s) }));
  res.json(withStatus);
});

// Get one shift with full detail
// List shifts with search, filter, and pagination
router.get('/', requireAuth, async (req, res) => {
  const { programId, status, search, page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (programId) where.programId = programId;
  if (search) where.title = { contains: search, mode: 'insensitive' };

  const [shifts, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: { signups: true, program: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.shift.count({ where }),
  ]);

  let withStatus = shifts.map(s => ({ ...s, fillStatus: getFillStatus(s) }));

  // status filter is applied after computing fillStatus, since it's derived, not a DB column
  if (status) {
    withStatus = withStatus.filter(s => s.fillStatus === status.toUpperCase());
  }

  res.json({
    data: withStatus,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
  });
});

module.exports = router;
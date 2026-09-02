const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Create a program (coordinator only)
router.post('/', requireAuth, requireRole('COORDINATOR'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const program = await prisma.program.create({
    data: { name, description, coordinatorId: req.user.userId },
  });
  res.status(201).json(program);
});

// List all programs
router.get('/', requireAuth, async (req, res) => {
  const programs = await prisma.program.findMany({
    include: { coordinator: { select: { name: true, email: true } } },
  });
  res.json(programs);
});

// Get one program
router.get('/:id', requireAuth, async (req, res) => {
  const program = await prisma.program.findUnique({
    where: { id: req.params.id },
    include: { shifts: true, memberships: { include: { user: { select: { name: true, email: true } } } } },
  });
  if (!program) return res.status(404).json({ error: 'program not found' });
  res.json(program);
});

// Volunteer joins a program
router.post('/:id/join', requireAuth, requireRole('VOLUNTEER'), async (req, res) => {
  const programId = req.params.id;
  const existing = await prisma.membership.findUnique({
    where: { userId_programId: { userId: req.user.userId, programId } },
  });
  if (existing) return res.status(409).json({ error: 'already a member of this program' });

  const membership = await prisma.membership.create({
    data: { userId: req.user.userId, programId },
  });
  res.status(201).json(membership);
});

module.exports = router;
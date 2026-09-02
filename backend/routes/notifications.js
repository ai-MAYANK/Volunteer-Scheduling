const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(notifications);
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user.userId) {
    return res.status(404).json({ error: 'notification not found' });
  }
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json(updated);
});

module.exports = router;
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Create a program (coordinator only)
router.post("/", requireAuth, requireRole("COORDINATOR"), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const program = await prisma.program.create({
    data: { name, description, coordinatorId: req.user.userId },
  });
  res.status(201).json(program);
});

// List programs (coordinators see their own + option to include archived; volunteers see only their memberships)
router.get("/", requireAuth, async (req, res) => {
  const { includeArchived } = req.query;

  if (req.user.role === "VOLUNTEER") {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.userId },
      include: {
        program: {
          include: { coordinator: { select: { name: true, email: true } } },
        },
      },
    });
    return res.json(memberships.map((m) => m.program));
  }

  const programs = await prisma.program.findMany({
    where: {
      coordinatorId: req.user.userId,
      ...(includeArchived === "true" ? {} : { isArchived: false }),
    },
    include: { coordinator: { select: { name: true, email: true } } },
  });
  res.json(programs);
});

// Get one program
router.get("/:id", requireAuth, async (req, res) => {
  const program = await prisma.program.findUnique({
    where: { id: req.params.id },
    include: {
      shifts: true,
      memberships: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!program) return res.status(404).json({ error: "program not found" });
  res.json(program);
});

// Edit a program
router.patch(
  "/:id",
  requireAuth,
  requireRole("COORDINATOR"),
  async (req, res) => {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
    });
    if (!program) return res.status(404).json({ error: "program not found" });
    if (program.coordinatorId !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "only the owning coordinator can edit this program" });
    }
    const { name, description } = req.body;
    const updated = await prisma.program.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(updated);
  },
);

// Archive a program
router.patch(
  "/:id/archive",
  requireAuth,
  requireRole("COORDINATOR"),
  async (req, res) => {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
    });
    if (!program) return res.status(404).json({ error: "program not found" });
    if (program.coordinatorId !== req.user.userId) {
      return res.status(403).json({
        error: "only the owning coordinator can archive this program",
      });
    }
    const updated = await prisma.program.update({
      where: { id: req.params.id },
      data: { isArchived: true },
    });
    res.json(updated);
  },
);

// Unarchive a program
router.patch(
  "/:id/unarchive",
  requireAuth,
  requireRole("COORDINATOR"),
  async (req, res) => {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
    });
    if (!program) return res.status(404).json({ error: "program not found" });
    if (program.coordinatorId !== req.user.userId) {
      return res.status(403).json({
        error: "only the owning coordinator can unarchive this program",
      });
    }
    const updated = await prisma.program.update({
      where: { id: req.params.id },
      data: { isArchived: false },
    });
    res.json(updated);
  },
);

// Coordinator adds a volunteer to their program (by email)
router.post(
  "/:id/members",
  requireAuth,
  requireRole("COORDINATOR"),
  async (req, res) => {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: "volunteer email is required" });

    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
    });
    if (!program) return res.status(404).json({ error: "program not found" });
    if (program.coordinatorId !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "only the owning coordinator can add members" });
    }

    const volunteer = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!volunteer || volunteer.role !== "VOLUNTEER") {
      return res
        .status(404)
        .json({ error: "no volunteer found with that email" });
    }

    const existing = await prisma.membership.findUnique({
      where: {
        userId_programId: { userId: volunteer.id, programId: req.params.id },
      },
    });
    if (existing)
      return res.status(409).json({ error: "volunteer is already a member" });

    const membership = await prisma.membership.create({
      data: { userId: volunteer.id, programId: req.params.id },
    });
    res.status(201).json(membership);
  },
);

// Coordinator removes a volunteer from their program
router.delete(
  "/:id/members/:userId",
  requireAuth,
  requireRole("COORDINATOR"),
  async (req, res) => {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
    });
    if (!program) return res.status(404).json({ error: "program not found" });
    if (program.coordinatorId !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "only the owning coordinator can remove members" });
    }
    await prisma.membership.deleteMany({
      where: { userId: req.params.userId, programId: req.params.id },
    });
    res.json({ message: "member removed" });
  },
);

module.exports = router;

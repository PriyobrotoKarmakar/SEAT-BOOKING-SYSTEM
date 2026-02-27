import express from "express";
import {
  getAllUsers,
  updateUserBatch,
  adminBookSeat,
  isAdmin,
} from "../controllers/adminController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { db } from "../config/firebase.js";
import { io } from "../index.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/users", isAdmin, getAllUsers);
router.put("/users/:userId/batch", isAdmin, updateUserBatch);
router.post("/book", isAdmin, adminBookSeat);

router.post("/release", isAdmin, async (req, res) => {
  const { userId, date } = req.body;
  try {
    await db.collection("bookings").doc(`${date}_${userId}`).delete();

    // Release from bookedSeats as well
    const snapshot = await db
      .collection("bookedSeats")
      .where("userId", "==", userId)
      .where("date", "==", date)
      .get();

    if (snapshot.empty) {
      io.emit("seatUpdate", { date, type: "release" });
      return res.status(200).json({ message: "Admin release successful" });
    }

    const deleteBatch = db.batch();
    snapshot.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    io.emit("seatUpdate", { date, type: "release" });
    return res.status(200).json({ message: "Admin release successful" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Holiday / Working-day override management ─────────────────────────────
// POST  /admin/special-days  { date, type: "holiday"|"working" }
router.post("/special-days", isAdmin, async (req, res) => {
  const { date, type } = req.body;
  if (!date || !["holiday", "working"].includes(type)) {
    return res
      .status(400)
      .json({ error: "date and type ('holiday'|'working') required" });
  }
  try {
    await db
      .collection("specialDays")
      .doc(date)
      .set({ date, type, setAt: new Date().toISOString() });
    io.emit("specialDayUpdate", { date, type });
    res.status(200).json({ message: `${date} marked as ${type}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/special-days/:date  — remove override, reverts to default
router.delete("/special-days/:date", isAdmin, async (req, res) => {
  const { date } = req.params;
  try {
    await db.collection("specialDays").doc(date).delete();
    io.emit("specialDayUpdate", { date, type: null });
    res.status(200).json({ message: "Override removed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

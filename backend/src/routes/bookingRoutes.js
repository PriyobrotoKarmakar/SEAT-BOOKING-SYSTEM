import express from "express";
import {
  bookSeat,
  releaseSeat,
  getWeeklyView,
  getBookingStatus,
  getDailyBookedSeats,
} from "../controllers/bookingController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/book", bookSeat);

router.post("/book/designated", (req, res) => {
  req.body.type = "designated";

  req.body.date = req.body.date || new Date().toISOString().split("T")[0];
  bookSeat(req, res);
});

router.post("/book/floating", (req, res) => {
  req.body.type = "floating";
  req.body.date = req.body.date || new Date().toISOString().split("T")[0];
  bookSeat(req, res);
});

router.post("/release", (req, res) => {
  req.body.date = req.body.date || new Date().toISOString().split("T")[0];
  releaseSeat(req, res);
});

router.get("/weekly", getWeeklyView);
router.get("/status", getBookingStatus);
router.get("/dailyBookedSeats", getDailyBookedSeats);

// Public read of special-day overrides (admins and users both need this)
router.get("/special-days", async (req, res) => {
  try {
    const { db } = await import("../config/firebase.js");
    const snap = await db.collection("specialDays").get();
    const days = {};
    snap.forEach((doc) => {
      days[doc.id] = doc.data();
    });
    res.status(200).json(days);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

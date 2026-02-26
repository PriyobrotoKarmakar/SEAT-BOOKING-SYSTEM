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

export default router;

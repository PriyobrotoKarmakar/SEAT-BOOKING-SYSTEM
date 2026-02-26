import { db } from "../config/firebase.js";
import { io } from "../index.js";

const isDesignatedProcessingDay = (batch, date) => {
  const dateObj = new Date(date.includes("T") ? date : date + "T00:00:00");
  const day = dateObj.getDay();

  if (day === 0 || day === 6) return false;

  if (batch === 1) {
    return [1, 2, 3].includes(day); // Mon, Tue, Wed
  } else if (batch === 2) {
    return [4, 5].includes(day); // Thu, Fri
  }
  return false;
};

// Helper to get document ID for daily stats: YYYY-MM-DD
const getDailyStatsId = (dateStr) => {
  return dateStr; // Assuming dateStr is already YYYY-MM-DD
};

export const bookSeat = async (req, res) => {
  try {
    const { userId, userName, batch, date, type, seatId } = req.body;
    // date format: "2023-10-27"
    // seatId should be 1-50

    if (!userId || !batch || !date || !type || !seatId) {
      return res
        .status(400)
        .json({ error: "Missing required fields (including seatId)" });
    }

    if (seatId < 1 || seatId > 50) {
      return res
        .status(400)
        .json({ error: "Invalid seatId. Must be between 1 and 50." });
    }

    const bookingRef = db.collection("bookings").doc(`${date}_${userId}`);
    const specificSeatRef = db
      .collection("bookedSeats")
      .doc(`${date}_${seatId}`);
    const dailyStatsRef = db
      .collection("dailyStats")
      .doc(getDailyStatsId(date));

    // Run as a transaction to ensure seat counts and specific seat locking are atomic
    await db.runTransaction(async (t) => {
      const bookingDoc = await t.get(bookingRef);
      if (bookingDoc.exists) {
        throw new Error("You already have a booking for this date.");
      }

      const specificSeatDoc = await t.get(specificSeatRef);
      if (specificSeatDoc.exists) {
        throw new Error(`Seat #${seatId} is already booked by someone else.`);
      }

      const dailyStatsDoc = await t.get(dailyStatsRef);
      let dailyData = dailyStatsDoc.exists
        ? dailyStatsDoc.data()
        : {
            date,
            designatedCount: 0,
            floatingCount: 0,
            releasedCount: 0,
            baseFloatingBuffer: 10, // Initial buffer
            totalFloatingAvailable: 10, // Starts at 10
          };

      // 0. Time Check for 3 PM Cutoff
      // Ensure we parse the booking date as midnight LOCAL time to calculate the previous day correctly
      const bookingDate = new Date(
        date.includes("T") ? date : date + "T00:00:00",
      );
      const previousDay = new Date(bookingDate);
      previousDay.setDate(bookingDate.getDate() - 1);
      previousDay.setHours(15, 0, 0, 0); // 3 PM previous day

      const now = new Date();
      const isAfterCutoff = now > previousDay;

      // 1. Check if it's a Designated Booking
      const isDesignatedDay = isDesignatedProcessingDay(batch, date);

      if (type === "designated") {
        if (!isDesignatedDay) {
          throw new Error(
            "Today is not your designated day. You must book a floating seat.",
          );
        }
        if (seatId > 40) {
          throw new Error("Designated seats must be chosen from Seats 1-40.");
        }

        t.set(bookingRef, {
          userId,
          userName,
          batch,
          date,
          type: "designated",
          seatId,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        });

        t.set(specificSeatRef, {
          userId,
          userName,
          date,
          type: "designated",
          seatId,
        });

        t.set(dailyStatsRef, {
          ...dailyData,
          designatedCount: (dailyData.designatedCount || 0) + 1,
        });
      } else if (type === "floating") {
        if (!isAfterCutoff) {
          throw new Error(
            "Floating seats can only be booked after 3 PM the day before.",
          );
        }
        if (seatId < 41 || seatId > 50) {
          throw new Error(
            "Floating seats must be chosen from the Buffer Pool (Seats 41-50).",
          );
        }

        // Floating pool is base buffer (10) + any explicitly released seats.
        // It's tracked by dailyData.totalFloatingAvailable which is incremented upon release.
        const totalAvailable = dailyData.totalFloatingAvailable || 10;

        const currentFloatingBooked = dailyData.floatingCount || 0;

        if (currentFloatingBooked >= totalAvailable) {
          throw new Error(
            `No floating seats available. (Pool: ${totalAvailable}, Booked: ${currentFloatingBooked})`,
          );
        }

        t.set(bookingRef, {
          userId,
          userName,
          batch,
          date,
          type: "floating",
          seatId,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        });

        t.set(specificSeatRef, {
          userId,
          userName,
          date,
          type: "floating",
          seatId,
        });

        // If after cutoff, we are consuming what was potentially a designated seat
        // But we just track it as floating count
        t.set(
          dailyStatsRef,
          {
            ...dailyData,
            floatingCount: currentFloatingBooked + 1,
          },
          { merge: true },
        );
      } else {
        throw new Error("Invalid booking type");
      }
    });

    // Emit real-time update event
    io.emit("seatUpdate", { date, type: "book" });

    res.status(200).json({ message: "Seat booked successfully", date, type });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const releaseSeat = async (req, res) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ error: "Missing userId or date" });
    }

    const bookingRef = db.collection("bookings").doc(`${date}_${userId}`);
    const dailyStatsRef = db
      .collection("dailyStats")
      .doc(getDailyStatsId(date));

    await db.runTransaction(async (t) => {
      const bookingDoc = await t.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new Error("No booking found to release");
      }

      const bookingData = bookingDoc.data();
      const specificSeatRef = db
        .collection("bookedSeats")
        .doc(`${date}_${bookingData.seatId}`);

      const dailyStatsDoc = await t.get(dailyStatsRef);

      if (!dailyStatsDoc.exists) {
        throw new Error("System error: Daily stats missing");
      }

      const dailyData = dailyStatsDoc.data();

      // If it's a Designated Seat being released -> It becomes a Floating Seat for others
      if (bookingData.type === "designated") {
        t.delete(bookingRef);
        t.delete(specificSeatRef);

        // Update stats:
        // - decrease designatedCount
        // - increase releasedCount
        // - increase totalFloatingAvailable (This is the key requirement: "available for others")
        t.update(dailyStatsRef, {
          designatedCount: (dailyData.designatedCount || 0) - 1,
          releasedCount: (dailyData.releasedCount || 0) + 1,
          totalFloatingAvailable: (dailyData.totalFloatingAvailable || 10) + 1,
        });
      }
      // If it's a Floating Seat being released -> Just free up the space
      else if (bookingData.type === "floating") {
        t.delete(bookingRef);
        t.delete(specificSeatRef);

        t.update(dailyStatsRef, {
          floatingCount: (dailyData.floatingCount || 0) - 1,
        });
      }
    });

    // Emit real-time update event
    io.emit("seatUpdate", { date, type: "release" });

    res.status(200).json({ message: "Seat released successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getWeeklyView = async (req, res) => {
  try {
    const { startDate, endDate } = req.query; // YYYY-MM-DD

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start and end date required" });
    }

    const snapshot = await db
      .collection("dailyStats")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const weeklyData = [];
    snapshot.forEach((doc) => weeklyData.push(doc.data()));

    res.status(200).json(weeklyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBookingStatus = async (req, res) => {
  try {
    const { userId, date } = req.query;
    if (!userId || !date)
      return res.status(400).json({ error: "Missing params" });

    const bookingDoc = await db
      .collection("bookings")
      .doc(`${date}_${userId}`)
      .get();

    if (bookingDoc.exists) {
      res.status(200).json({ booked: true, ...bookingDoc.data() });
    } else {
      // Also return stats for that day so UI knows if floating is available
      const statsDoc = await db.collection("dailyStats").doc(date).get();
      const stats = statsDoc.exists
        ? statsDoc.data()
        : { totalFloatingAvailable: 10, floatingCount: 0 };

      res.status(200).json({
        booked: false,
        availableFloating:
          (stats.totalFloatingAvailable || 10) - (stats.floatingCount || 0),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDailyBookedSeats = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const snapshot = await db
      .collection("bookedSeats")
      .where("date", "==", date)
      .get();

    const bookedSeats = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      bookedSeats.push({
        seatId: data.seatId,
        type: data.type,
        userName: data.userName, // To show who booked it if needed
        userId: data.userId, // Helpful for identifying "your" seat
      });
    });

    res.status(200).json(bookedSeats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import { db } from "../config/firebase.js";
import { io } from "../index.js";

const isDesignatedProcessingDay = (batch, date) => {
  const dateObj = new Date(date.includes("T") ? date : date + "T00:00:00");
  const day = dateObj.getDay();

  if (day === 0 || day === 6) return false;

  if (batch === 1) {
    return [1, 2, 3].includes(day);
  } else if (batch === 2) {
    return [4, 5].includes(day);
  }
  return false;
};

const getDailyStatsId = (dateStr) => {
  return dateStr;
};

const releaseUnbookedDesignatedSeats = async (date, t) => {
  const dateObj = new Date(date.includes("T") ? date : date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) return 0;

  const now = new Date();
  const releaseTime = new Date(dateObj);
  releaseTime.setDate(dateObj.getDate() - 1);
  releaseTime.setHours(12, 0, 0, 0);

  if (dayOfWeek === 1) {
    releaseTime.setDate(dateObj.getDate() - 3);
  }

  if (now <= releaseTime) return 0;

  const bookedSeatsQuery = await db
    .collection("bookedSeats")
    .where("date", "==", date)
    .where("type", "==", "designated")
    .get();

  const bookedDesignatedSeats = new Set();
  bookedSeatsQuery.forEach((doc) => {
    const data = doc.data();
    if (data.seatId <= 40) {
      bookedDesignatedSeats.add(data.seatId);
    }
  });

  const totalDesignatedSeats = 40;
  const unbookedCount = totalDesignatedSeats - bookedDesignatedSeats.size;

  return unbookedCount;
};

export const bookSeat = async (req, res) => {
  try {
    const { userId, userName, batch, date, type, seatId } = req.body;

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

    await db.runTransaction(async (t) => {
      const bookingDoc = await t.get(bookingRef);
      if (bookingDoc.exists) {
        throw new Error("You already have a booking for this date.");
      }

      const specificSeatDoc = await t.get(specificSeatRef);
      let floatingUserToKick = null;

      if (specificSeatDoc.exists) {
        const seatData = specificSeatDoc.data();
        if (
          type === "designated" &&
          seatData.type === "floating" &&
          seatId <= 40
        ) {
          floatingUserToKick = seatData.userId;
        } else {
          throw new Error(`Seat #${seatId} is already booked by someone else.`);
        }
      }

      const dailyStatsDoc = await t.get(dailyStatsRef);
      let dailyData = dailyStatsDoc.exists
        ? dailyStatsDoc.data()
        : {
            date,
            designatedCount: 0,
            floatingCount: 0,
            releasedCount: 0,
            baseFloatingBuffer: 10,
            totalFloatingAvailable: 10,
          };

      const bookingDate = new Date(
        date.includes("T") ? date : date + "T00:00:00",
      );
      const dayOfWeek = bookingDate.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        throw new Error("This is holiday, enjoy at your home!");
      }

      const cutoffDate = new Date(bookingDate);

      if (dayOfWeek === 1) {
        cutoffDate.setDate(bookingDate.getDate() - 3);
      } else {
        cutoffDate.setDate(bookingDate.getDate() - 1);
      }

      cutoffDate.setHours(12, 0, 0, 0);

      const now = new Date();
      const isAfterCutoff = now > cutoffDate;

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

        if (floatingUserToKick) {
          const kickedBookingRef = db
            .collection("bookings")
            .doc(`${date}_${floatingUserToKick}`);
          t.delete(kickedBookingRef);
          dailyData.floatingCount = Math.max(
            0,
            (dailyData.floatingCount || 0) - 1,
          );
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
            "Floating seats can only be booked after 12 PM the day before.",
          );
        }

        const unbookedDesignatedSeats = await releaseUnbookedDesignatedSeats(
          date,
          t,
        );

        let totalAvailable = dailyData.totalFloatingAvailable || 10;
        let canUseDesignatedSeats = false;

        if (unbookedDesignatedSeats > 0) {
          canUseDesignatedSeats = true; // Enable booking from designated zone if releases are active

          const expectedFromDesignated = unbookedDesignatedSeats;
          const alreadyCounted =
            (dailyData.totalFloatingAvailable || 10) -
            10 -
            (dailyData.releasedCount || 0);

          if (alreadyCounted < expectedFromDesignated) {
            const additionalSeats =
              expectedFromDesignated - Math.max(0, alreadyCounted);
            totalAvailable += additionalSeats;

            dailyData = {
              ...dailyData,
              totalFloatingAvailable: totalAvailable,
              autoReleasedFromDesignated: expectedFromDesignated,
            };
          }
        }

        if (!canUseDesignatedSeats && (seatId < 41 || seatId > 50)) {
          throw new Error(
            "Floating seats must be chosen from the Buffer Pool (Seats 41-50).",
          );
        } else if (canUseDesignatedSeats && (seatId < 1 || seatId > 50)) {
          throw new Error("Invalid seat ID. Must be between 1 and 50.");
        }

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

    // Step 1: find the actual booking document (direct key first, then query fallback)
    let bookingRef = db.collection("bookings").doc(`${date}_${userId}`);
    const directCheck = await bookingRef.get();

    if (!directCheck.exists) {
      // Fallback: admin may have stored booking with a different userId format
      const querySnap = await db
        .collection("bookings")
        .where("userId", "==", userId)
        .where("date", "==", date)
        .limit(1)
        .get();

      if (querySnap.empty) {
        return res.status(400).json({ error: "No booking found to release" });
      }
      bookingRef = querySnap.docs[0].ref;
    }

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

      // Admin-override bookings don't use dailyStats counters — short-circuit
      if (bookingData.type === "admin-override") {
        t.delete(bookingRef);
        t.delete(specificSeatRef);
        return;
      }

      // Regular bookings need dailyStats to decrement counters
      const dailyStatsDoc = await t.get(dailyStatsRef);
      if (!dailyStatsDoc.exists) {
        throw new Error("System error: Daily stats missing");
      }

      const dailyData = dailyStatsDoc.data();

      if (bookingData.type === "designated") {
        t.delete(bookingRef);
        t.delete(specificSeatRef);
        t.update(dailyStatsRef, {
          designatedCount: (dailyData.designatedCount || 0) - 1,
          releasedCount: (dailyData.releasedCount || 0) + 1,
          totalFloatingAvailable: (dailyData.totalFloatingAvailable || 10) + 1,
        });
      } else if (bookingData.type === "floating") {
        t.delete(bookingRef);
        t.delete(specificSeatRef);
        t.update(dailyStatsRef, {
          floatingCount: (dailyData.floatingCount || 0) - 1,
        });
      } else {
        throw new Error(
          `Cannot release a booking of unknown type: ${bookingData.type}`,
        );
      }
    });

    io.emit("seatUpdate", { date, type: "release" });
    res.status(200).json({ message: "Seat released successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getWeeklyView = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

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

    // Try the standard key first
    let bookingDoc = await db
      .collection("bookings")
      .doc(`${date}_${userId}`)
      .get();

    // Fallback: query by userId + date fields (handles admin-override key mismatches)
    if (!bookingDoc.exists) {
      const querySnap = await db
        .collection("bookings")
        .where("userId", "==", userId)
        .where("date", "==", date)
        .limit(1)
        .get();
      if (!querySnap.empty) bookingDoc = querySnap.docs[0];
    }

    if (bookingDoc.exists) {
      res.status(200).json({ booked: true, ...bookingDoc.data() });
    } else {
      const statsDoc = await db.collection("dailyStats").doc(date).get();
      const stats = statsDoc.exists
        ? statsDoc.data()
        : { totalFloatingAvailable: 10, floatingCount: 0 };

      const unbookedDesignatedSeats = await releaseUnbookedDesignatedSeats(
        date,
        null,
      );

      let totalAvailable = stats.totalFloatingAvailable || 10;

      if (unbookedDesignatedSeats > 0) {
        const alreadyCounted =
          (stats.totalFloatingAvailable || 10) -
          10 -
          (stats.releasedCount || 0);
        if (alreadyCounted < unbookedDesignatedSeats) {
          const additionalSeats =
            unbookedDesignatedSeats - Math.max(0, alreadyCounted);
          totalAvailable += additionalSeats;
        }
      }

      res.status(200).json({
        booked: false,
        availableFloating: totalAvailable - (stats.floatingCount || 0),
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
        userName: data.userName,
        userId: data.userId,
      });
    });

    res.status(200).json(bookedSeats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

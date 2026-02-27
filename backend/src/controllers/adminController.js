import { db } from "../config/firebase.js";
import { io } from "../index.js";

// Middleware to check for Admin role
// Assumes authMiddleware has already run and populated req.user
export const isAdmin = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const userDoc = await db.collection("users").doc(uid).get();

    // Check if user exists and has isAdmin flag true
    if (!userDoc.exists || !userDoc.data().isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    
    // Attach full user data to request for controller use
    req.userData = userDoc.data();
    req.userData.uid = uid;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = [];
    snapshot.forEach((doc) => {
      // Don't return passwords
      const { password, ...user } = doc.data();
      users.push({ id: doc.id, ...user });
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserBatch = async (req, res) => {
  try {
    const { userId } = req.params;
    const { batch } = req.body;

    if (!batch) {
      return res.status(400).json({ error: "Batch is required" });
    }

    await db.collection("users").doc(userId).update({ batch: Number(batch) });
    res.status(200).json({ message: "User batch updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const adminBookSeat = async (req, res) => {
  try {
    const { userId, userName, batch, date, seatId } = req.body;

    // Check existing booking
    const bookingRef = db.collection("bookings").doc(`${date}_${userId}`);
    const existing = await bookingRef.get();
    
    // If seat is occupied by someone else, kick them
    const seatRef = db.collection("bookedSeats").doc(`${date}_${seatId}`);
    const seatDoc = await seatRef.get();
    
    if (seatDoc.exists) {
        const occupant = seatDoc.data();
        if (occupant.userId !== userId) {
            // Kick occupant
            await db.collection("bookings").doc(`${date}_${occupant.userId}`).delete();
        }
    }

    // Force create booking for admin target user
    await bookingRef.set({
      userId,
      userName,
      batch,
      date,
      type: "admin-override",
      seatId,
      status: "confirmed",
      createdAt: new Date().toISOString()
    });

    await seatRef.set({
      userId,
      userName,
      date,
      type: "admin-override",
      seatId
    });
    
    // Update daily stats vaguely (increment count) - imprecise but works for override
    const statsRef = db.collection("dailyStats").doc(date);
    // Use set with merge to create if missing
    await statsRef.set({
        date,
        // We don't actively manage counts here perfectly to avoid race conditions with main logic
        // but frontend relies on bookedSeats collection mostly for map
    }, { merge: true });

    io.emit("seatUpdate", { date, type: "book" });

    res.status(200).json({ message: "Admin override booking successful" });
  } catch (error) {
    res.status(500).json({ error: error.message });      
  }
};

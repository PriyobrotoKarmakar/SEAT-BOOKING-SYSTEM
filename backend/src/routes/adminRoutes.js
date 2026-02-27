import express from "express";
import { getAllUsers, updateUserBatch, adminBookSeat, isAdmin } from "../controllers/adminController.js";
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
        const snapshot = await db.collection("bookedSeats")
            .where("userId", "==", userId)
            .where("date", "==", date)
            .get();
        
        if (snapshot.empty) {
            io.emit("seatUpdate", { date, type: "release" });
            return res.status(200).json({ message: "Admin release successful" });
        }
        
        const deleteBatch = db.batch();
        snapshot.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        
        io.emit("seatUpdate", { date, type: "release" });
        return res.status(200).json({ message: "Admin release successful" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;

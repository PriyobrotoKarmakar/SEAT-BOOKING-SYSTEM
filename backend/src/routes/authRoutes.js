import express from "express";
import { login, signup, updateProfile } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.put("/profile", updateProfile);

export default router;

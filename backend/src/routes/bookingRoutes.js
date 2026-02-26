import express from 'express';
import { bookSeat, releaseSeat, getWeeklyView, getBookingStatus } from '../controllers/bookingController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// All booking routes require a valid Firebase Auth token
router.use(authMiddleware);

router.post('/book', bookSeat); 
// We can split into specialized routes or handle in controller
// The user asked for /book/designated and /book/floating in frontend endpoints previously
// For cleaner backend design, let's map those to the single logic or separate them if needed.
// The controller I wrote handles both via 'type' parameter.
// Let's make an adapter or just use '/book' and frontend passes type.
// But to match previous frontend code:
router.post('/book/designated', (req, res) => {
  req.body.type = 'designated';
  // Ensure date defaults to "today" or passed from frontend
  // For now pass through to main controller
  req.body.date = req.body.date || new Date().toISOString().split('T')[0]; 
  bookSeat(req, res);
});

router.post('/book/floating', (req, res) => {
  req.body.type = 'floating';
  req.body.date = req.body.date || new Date().toISOString().split('T')[0];
  bookSeat(req, res);
});

router.post('/release', (req, res) => {
  req.body.date = req.body.date || new Date().toISOString().split('T')[0];
  releaseSeat(req, res);
});

router.get('/weekly', getWeeklyView);
router.get('/status', getBookingStatus);

export default router;

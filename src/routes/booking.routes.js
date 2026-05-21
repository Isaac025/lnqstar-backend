// ── booking.routes.js ──────────────────────────────────────────────────────
const express = require("express");
const bookingRouter = express.Router();
const bookingCtrl = require("../controllers/booking.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const {
  createBookingRules,
  cancelBookingRules,
} = require("../utils/bookingValidators");
const { validate } = require("../utils/validators");

bookingRouter.use(protect);

// User routes
bookingRouter.post(
  "/",
  createBookingRules,
  validate,
  bookingCtrl.createBooking,
);
bookingRouter.get("/my", bookingCtrl.getMyBookings);
bookingRouter.get("/ref/:bookingRef", bookingCtrl.getBookingByRef);
bookingRouter.get("/:id", bookingCtrl.getBooking);
bookingRouter.put(
  "/:id/cancel",
  cancelBookingRules,
  validate,
  bookingCtrl.cancelBooking,
);

// Admin routes
bookingRouter.get("/", restrictTo("admin"), bookingCtrl.getAllBookings);
bookingRouter.patch(
  "/:id/status",
  restrictTo("admin"),
  bookingCtrl.updateBookingStatus,
);

module.exports = bookingRouter;

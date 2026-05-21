const express = require("express");
const router = express.Router();
const paymentCtrl = require("../controllers/payment.controller");
const { protect } = require("../middlewares/auth.middleware");
const { initiatePaymentRules } = require("../utils/bookingValidators");
const { validate } = require("../utils/validators");

// ── Public ─────────────────────────────────────────────────────────────────
// Webhook — must be raw body for signature verification
router.post("/webhook", express.json(), paymentCtrl.handleWebhook);

// Estimates & currencies (public — used on booking summary screen)
router.get("/estimate", paymentCtrl.getEstimate);
router.get("/currencies", paymentCtrl.getCurrencies);

// ── Protected ──────────────────────────────────────────────────────────────
router.use(protect);

router.post(
  "/initiate",
  initiatePaymentRules,
  validate,
  paymentCtrl.initiatePayment,
);
router.get("/booking/:bookingId", paymentCtrl.getPaymentByBooking);
router.get("/:id/status", paymentCtrl.checkPaymentStatus);

module.exports = router;

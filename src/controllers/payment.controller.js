const Booking = require("../models/Booking.model");
const Payment = require("../models/Payment.model");
const ApiResponse = require("../utils/apiResponse");
const { notify } = require("../services/notification.service");
const cryptoSvc = require("../services/crypto.service");

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/payments/initiate
// @desc    Initiate a crypto payment for a booking
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.initiatePayment = async (req, res) => {
  try {
    const { bookingId, currency = "BTC" } = req.body;

    // 1. Fetch booking
    const booking = await Booking.findById(bookingId).populate(
      "celebrity",
      "name",
    );
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");

    // 2. Only the owner can pay
    if (booking.user.toString() !== req.user._id.toString()) {
      return ApiResponse.forbidden(res);
    }

    // 3. Only unpaid or failed bookings can be paid
    if (booking.paymentStatus === "paid") {
      return ApiResponse.error(res, "This booking has already been paid.");
    }
    if (booking.status === "cancelled") {
      return ApiResponse.error(res, "Cannot pay for a cancelled booking.");
    }

    // 4. Check for an existing active payment
    const existingPayment = await Payment.findOne({
      booking: bookingId,
      status: { $in: ["waiting", "confirming"] },
    });
    if (existingPayment) {
      return ApiResponse.success(
        res,
        {
          payment: existingPayment,
          payAddress: existingPayment.payAddress,
          cryptoAmount: existingPayment.cryptoAmount,
          currency: existingPayment.cryptoCurrency,
          expiresAt: existingPayment.expiresAt,
        },
        "Payment already initiated. Please complete the payment.",
      );
    }

    // 5. Get crypto estimate
    let cryptoAmount = null;
    try {
      const estimate = await cryptoSvc.getEstimate(
        booking.totalAmount,
        currency,
      );
      cryptoAmount = estimate.estimated_amount;
    } catch (_) {
      // Continue without estimate — NOWPayments will handle it
    }

    // 6. Create NOWPayments invoice
    const providerData = await cryptoSvc.createPayment({
      amountUSD: booking.totalAmount,
      currency,
      bookingRef: booking.bookingRef,
    });

    // 7. Save payment record
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour default
    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      amountUSD: booking.totalAmount,
      cryptoAmount: cryptoAmount || providerData.pay_amount,
      cryptoCurrency: currency.toUpperCase(),
      providerPaymentId: providerData.payment_id,
      payAddress: providerData.pay_address,
      paymentUrl: providerData.invoice_url || null,
      expiresAt,
      provider: "NOWPayments",
    });

    // 8. Update booking payment status
    booking.paymentStatus = "awaiting_confirmation";
    await booking.save();

    await notify.paymentAwaiting(req.app, req.user._id, booking);

    return ApiResponse.created(
      res,
      {
        payment,
        payAddress: providerData.pay_address,
        cryptoAmount: payment.cryptoAmount,
        currency: currency.toUpperCase(),
        amountUSD: booking.totalAmount,
        bookingRef: booking.bookingRef,
        expiresAt,
        paymentUrl: providerData.invoice_url || null,
        // Booking summary for the payment screen
        summary: {
          celebrityName: booking.celebrity.name,
          baseBookingFee: booking.baseBookingFee,
          serviceFee: booking.serviceFee,
          totalAmount: booking.totalAmount,
        },
      },
      "Payment initiated. Send the exact crypto amount to the address provided.",
    );
  } catch (error) {
    console.error("Payment initiation error:", error.message);
    return ApiResponse.serverError(
      error.response.data.message,
      "Failed to initiate payment. Please try again.",
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/payments/webhook
// @desc    NOWPayments IPN webhook — confirms payment
// @access  Public (verified via HMAC signature)
// ─────────────────────────────────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-nowpayments-sig"];
    const payload = req.body;

    // 1. Verify signature
    const isValid = cryptoSvc.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      console.warn("⚠️  Invalid webhook signature received");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const {
      payment_id,
      payment_status,
      order_id,
      actually_paid,
      pay_currency,
      outcome_amount,
    } = payload;

    // 2. Find payment record
    const payment = await Payment.findOne({
      providerPaymentId: String(payment_id),
    });
    if (!payment) {
      console.warn(`Webhook: Payment not found for provider ID ${payment_id}`);
      return res.status(200).json({ received: true }); // 200 to stop retries
    }

    // 3. Map and update status
    const internalStatus = cryptoSvc.mapStatus(payment_status);
    payment.status = internalStatus;
    payment.rawWebhook = payload;

    if (actually_paid) payment.cryptoAmount = actually_paid;
    if (outcome_amount) payment.networkFee = outcome_amount;

    const isConfirmed = ["confirmed", "finished"].includes(payment_status);

    if (isConfirmed && !payment.paidAt) {
      payment.paidAt = new Date();

      // 4. Confirm the booking
      const booking = await Booking.findByIdAndUpdate(
        payment.booking,
        { $set: { status: "confirmed", paymentStatus: "paid" } },
        { new: true },
      );

      if (booking) {
        await notify.bookingConfirmed(req.app, booking.user, booking);
      }
    }

    if (["failed", "expired"].includes(payment_status)) {
      const booking = await Booking.findByIdAndUpdate(
        payment.booking,
        { $set: { paymentStatus: "unpaid" } },
        { new: true },
      );
      if (booking) {
        await notify.paymentFailed(req.app, booking.user, booking);
      }
    }

    await payment.save();

    // Always return 200 to NOWPayments
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.status(200).json({ received: true }); // still 200 to avoid retries
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/booking/:bookingId
// @desc    Get payment info for a specific booking
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getPaymentByBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");

    const isOwner = booking.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return ApiResponse.forbidden(res);

    const payment = await Payment.findOne({
      booking: req.params.bookingId,
    }).sort({ createdAt: -1 });

    if (!payment)
      return ApiResponse.notFound(res, "No payment found for this booking.");

    return ApiResponse.success(res, payment);
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/:id/status
// @desc    Check live payment status from NOWPayments
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.checkPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return ApiResponse.notFound(res, "Payment not found.");

    const isOwner = payment.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return ApiResponse.forbidden(res);

    // Poll live status from NOWPayments
    let liveStatus = null;
    try {
      const live = await cryptoSvc.getPaymentStatus(payment.providerPaymentId);
      liveStatus = live.payment_status;

      // Sync if changed
      const mapped = cryptoSvc.mapStatus(liveStatus);
      if (mapped !== payment.status) {
        payment.status = mapped;
        await payment.save();
      }
    } catch (_) {
      liveStatus = "unknown";
    }

    return ApiResponse.success(res, {
      payment,
      liveStatus,
    });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/estimate
// @desc    Get crypto equivalent for a USD amount
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getEstimate = async (req, res) => {
  try {
    const { amount, currency = "btc" } = req.query;
    if (!amount) return ApiResponse.error(res, "Amount is required");

    const estimate = await cryptoSvc.getEstimate(Number(amount), currency);
    return ApiResponse.success(res, estimate);
  } catch (error) {
    return ApiResponse.serverError(res, "Could not fetch crypto estimate.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/currencies
// @desc    Get all supported crypto currencies
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getCurrencies = async (req, res) => {
  try {
    const data = await cryptoSvc.getCurrencies();
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.serverError(res, "Could not fetch currencies.");
  }
};

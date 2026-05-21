const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Amounts ────────────────────────────────────────────
    amountUSD: { type: Number, required: true }, // original USD amount
    cryptoAmount: { type: Number, default: null }, // e.g. 0.00153 BTC
    cryptoCurrency: {
      type: String,
      default: "BTC",
      enum: ["BTC", "ETH", "USDT", "USDC", "LTC", "BNB"],
    },

    // ── NOWPayments data ───────────────────────────────────
    providerPaymentId: { type: String, default: null }, // NOWPayments payment_id
    payAddress: { type: String, default: null }, // wallet address shown to user
    paymentUrl: { type: String, default: null }, // hosted payment page (if used)
    txHash: { type: String, default: null }, // blockchain tx hash (on confirm)
    networkFee: { type: Number, default: null },

    // ── Status ─────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "waiting",
        "confirming",
        "confirmed",
        "failed",
        "expired",
        "refunded",
      ],
      default: "waiting",
    },

    // ── Timestamps ─────────────────────────────────────────
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    // ── Provider ───────────────────────────────────────────
    provider: { type: String, default: "NOWPayments" },

    // ── Raw webhook payload (for debugging) ───────────────
    rawWebhook: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { timestamps: true },
);

paymentSchema.index({ booking: 1 });
paymentSchema.index({ providerPaymentId: 1 });
paymentSchema.index({ user: 1 });

module.exports = mongoose.model("Payment", paymentSchema);

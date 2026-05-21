const mongoose = require("mongoose");

const EVENT_TYPES = [
  "Private Event",
  "Corporate Event",
  "Birthday Party",
  "Wedding",
  "Concert",
  "Meet & Greet",
  "Virtual Event",
  "Film/TV Appearance",
  "Brand Endorsement",
  "Charity Event",
  "Other",
];

const bookingSchema = new mongoose.Schema(
  {
    // ── Reference ──────────────────────────────────────────
    bookingRef: {
      type: String,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    celebrity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Celebrity",
      required: true,
    },

    // ── Event Details ──────────────────────────────────────
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: { values: EVENT_TYPES, message: "Invalid event type" },
    },
    eventLocation: {
      type: String,
      required: [true, "Event location is required"],
      trim: true,
    },
    eventDate: {
      type: Date,
      required: [true, "Event date is required"],
    },
    eventTime: {
      type: String,
      required: [true, "Event time is required"],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, "Duration is required"],
      trim: true,
    },

    // ── Contact Details ────────────────────────────────────
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female", "Non-binary", "Prefer not to say"],
    },
    specialRequest: {
      type: String,
      default: null,
      trim: true,
    },

    // ── Financials ─────────────────────────────────────────
    baseBookingFee: {
      type: Number,
      required: true,
    },
    serviceFee: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },

    // ── Status ─────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "awaiting_confirmation", "paid", "refunded"],
      default: "unpaid",
    },

    // ── Cancellation ───────────────────────────────────────
    cancelledBy: { type: String, enum: ["user", "admin", null], default: null },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtual: isPast ────────────────────────────────────────
bookingSchema.virtual("isPast").get(function () {
  return new Date(this.eventDate) < new Date();
});

// ── Auto-generate booking reference ───────────────────────
bookingSchema.pre("save", async function () {
  if (!this.bookingRef) {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.bookingRef = `LNQ-${year}-${random}`;
  }
});

// ── Indexes ────────────────────────────────────────────────
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ celebrity: 1 });
bookingSchema.index({ eventDate: 1 });
// bookingSchema.index({ bookingRef: 1 }); // bookingRef already has a unique index from the field definition

module.exports = mongoose.model("Booking", bookingSchema);

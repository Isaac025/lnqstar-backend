const mongoose = require("mongoose");

const CATEGORIES = [
  "Movies",
  "Music",
  "Sports",
  "TV Shows",
  "Comedy",
  "Fashion",
  "Gaming",
  "Social Media",
  "Books",
];

const celebritySchema = new mongoose.Schema(
  {
    // ── Core Info ──────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Celebrity name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    bio: {
      type: String,
      required: [true, "Bio is required"],
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: { values: CATEGORIES, message: "Invalid category" },
    },
    nationality: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String], // e.g. ['Grammy winner', 'Hollywood', 'NBA']
      default: [],
    },

    // ── Media ──────────────────────────────────────────────
    picture: {
      type: String,
      required: [true, "A profile picture is required"],
    },
    gallery: {
      type: [String], // Additional photos
      default: [],
    },

    // ── Booking Settings ───────────────────────────────────
    baseBookingFee: {
      type: Number,
      required: [true, "Base booking fee is required"],
      min: [0, "Fee cannot be negative"],
    },
    serviceFee: {
      type: Number,
      required: [true, "Service fee is required"],
      min: [0, "Fee cannot be negative"],
    },
    currency: {
      type: String,
      default: "USD",
    },
    available: {
      type: Boolean,
      default: true,
    },

    // ── Fan Engagement ─────────────────────────────────────
    fanCardPrice: {
      type: Number,
      default: 0,
    },
    donationsEnabled: {
      type: Boolean,
      default: true,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
    totalFanCards: {
      type: Number,
      default: 0,
    },

    // ── Social Links ───────────────────────────────────────
    socialLinks: {
      instagram: { type: String, default: null },
      twitter: { type: String, default: null },
      youtube: { type: String, default: null },
      tiktok: { type: String, default: null },
    },

    // ── Admin ──────────────────────────────────────────────
    featured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtual: total amount ─────────────────────────────────
celebritySchema.virtual("totalFee").get(function () {
  return this.baseBookingFee + this.serviceFee;
});

// ── Auto-generate slug from name ──────────────────────────
celebritySchema.pre("save", function () {
  if (this.isModified("name") || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
});

// ── Indexes for fast filtering ────────────────────────────
celebritySchema.index({ category: 1 });
celebritySchema.index({ available: 1 });
celebritySchema.index({ featured: 1 });
celebritySchema.index({ name: "text", bio: "text", tags: "text" }); // full-text search

module.exports = mongoose.model("Celebrity", celebritySchema);

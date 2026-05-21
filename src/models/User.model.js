const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const INTERESTS = [
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

const userSchema = new mongoose.Schema(
  {
    // ── Core Identity ──────────────────────────────────
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must not exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never returned in queries by default
    },

    // ── Profile ────────────────────────────────────────
    profilePicture: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },

    // ── Celebrity Interests ────────────────────────────
    interests: {
      type: [String],
      enum: INTERESTS,
      default: [],
    },

    // ── Notification Preferences ───────────────────────
    notificationPreferences: {
      exclusiveEvents: { type: Boolean, default: false },
      platformUpdates: { type: Boolean, default: false },
    },

    // ── Role & Status ──────────────────────────────────
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "deactivated"],
      default: "active",
    },

    // ── Stats ──────────────────────────────────────────
    totalBookings: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },

    // ── Email Verification ─────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // ── Password Reset ─────────────────────────────────
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // ── Refresh Token ──────────────────────────────────
    refreshToken: { type: String, select: false },
  },
  {
    timestamps: true, // createdAt = memberSince equivalent
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtual: memberSince (alias for createdAt) ─────────
userSchema.virtual("memberSince").get(function () {
  return this.createdAt;
});

// ── Pre-save: hash password ────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Method: compare passwords ──────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Method: sanitize output (remove sensitive fields) ──
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);

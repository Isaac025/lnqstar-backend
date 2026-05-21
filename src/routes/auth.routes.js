const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

const {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
} = require("../utils/validators");

// ── Public Routes ──────────────────────────────────────────────────────────

// Register
router.post("/register", ...registerRules, validate, authController.register);

// Verify Email
router.get("/verify-email/:token", authController.verifyEmail);

// Resend Verification Email
router.post("/resend-verification", authController.resendVerification);

// Login
router.post("/login", ...loginRules, validate, authController.login);

// Refresh Access Token
router.post("/refresh-token", authController.refreshToken);

// Forgot Password
router.post(
  "/forgot-password",
  ...forgotPasswordRules,
  validate,
  authController.forgotPassword,
);

// Reset Password
router.post(
  "/reset-password/:token",
  ...resetPasswordRules,
  validate,
  authController.resetPassword,
);

// ── Protected Routes ──────────────────────────────────────────────────────

// Get current user
router.get("/me", protect, authController.getMe);

// Change Password
router.put(
  "/change-password",
  protect,
  ...changePasswordRules,
  validate,
  authController.changePassword,
);

// Logout
router.post("/logout", protect, authController.logout);

module.exports = router;

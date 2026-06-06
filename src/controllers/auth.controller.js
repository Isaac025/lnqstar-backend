const crypto = require("crypto");
const User = require("../models/User.model");
const ApiResponse = require("../utils/apiResponse");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/token");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} = require("../services/email.service");

// ── Helper: build verification URL ────────────────────────────────────────
const verificationUrl = (token) =>
  `${process.env.SERVER_URL}/api/auth/verify-email/${token}`;

const resetUrl = (token) =>
  `${process.env.CLIENT_URL}/auth/reset-password/${token}`;

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      phone,
      country,
      password,
      interests,
      notificationPreferences,
    } = req.body;

    // 1. Check duplicates
    const existingEmail = await User.findOne({ email });
    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });

    if (existingEmail)
      return ApiResponse.error(
        res,
        "An account with this email already exists.",
        409,
      );
    if (existingUsername)
      return ApiResponse.error(res, "This username is already taken.", 409);

    // 2. Generate email verification token
    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);

    // 3. Create user
    const user = await User.create({
      fullName,
      username: username.toLowerCase(),
      email,
      phone,
      country,
      password,
      interests: interests || [],
      notificationPreferences: notificationPreferences || {},
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    // 4. Send verification email (non-blocking)
    // 4. Send verification email
    try {
      await sendVerificationEmail(user, verificationUrl(rawToken));
    } catch (emailErr) {
      console.error("⚠️ Verification email failed:", emailErr);

      return ApiResponse.serverError(
        res,
        "Account created, but verification email could not be sent.",
      );
    }

    return ApiResponse.created(res, {
      message:
        "Registration successful! Please check your email to verify your account.",
      userId: user._id,
    });
  } catch (error) {
    console.error("Register error:", error);
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const hashedToken = hashToken(req.params.token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return ApiResponse.error(
        res,
        "Verification link is invalid or has expired.",
        400,
      );
    }

    // Mark verified & clear token fields
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
    } catch (_) {}

    return ApiResponse.success(
      res,
      null,
      "Email verified successfully! You can now log in.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/resend-verification
// @desc    Resend email verification link
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select(
      "+emailVerificationToken +emailVerificationExpires",
    );

    if (!user)
      return ApiResponse.notFound(res, "No account found with that email.");
    if (user.isEmailVerified)
      return ApiResponse.error(res, "Email is already verified.");

    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendVerificationEmail(user, verificationUrl(rawToken));

    return ApiResponse.success(
      res,
      null,
      "Verification email resent. Please check your inbox.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login with email/username + password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // 1. Find by email OR username
    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail
        ? { email: identifier.toLowerCase() }
        : { username: identifier.toLowerCase() },
    ).select("+password +refreshToken");

    if (!user) {
      return ApiResponse.error(res, "Invalid credentials.", 401);
    }

    // 2. Check account status
    if (user.accountStatus === "suspended") {
      return ApiResponse.forbidden(
        res,
        "Your account has been suspended. Please contact support.",
      );
    }
    if (user.accountStatus === "deactivated") {
      return ApiResponse.forbidden(res, "Your account has been deactivated.");
    }

    // 3. Check email verification
    if (!user.isEmailVerified) {
      return ApiResponse.error(
        res,
        "Please verify your email address before logging in.",
        403,
        [
          {
            type: "email_unverified",
            msg: "Check your inbox for the verification link.",
          },
        ],
      );
    }

    // 4. Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ApiResponse.error(res, "Invalid credentials.", 401);
    }

    // 5. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // 6. Store hashed refresh token
    user.refreshToken = hashToken(refreshToken);
    user.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });

    // 7. Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    return ApiResponse.success(
      res,
      {
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
      },
      "Login successful",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/refresh-token
// @desc    Get a new access token using refresh token
// @access  Public (requires refresh token)
// ─────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return ApiResponse.unauthorized(res, "No refresh token provided.");
    }

    // 1. Verify token signature
    const decoded = verifyRefreshToken(token);

    // 2. Find user and compare stored token
    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user || user.refreshToken !== hashToken(token)) {
      return ApiResponse.unauthorized(
        res,
        "Invalid refresh token. Please log in again.",
      );
    }

    // 3. Issue new tokens (token rotation)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = hashToken(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return ApiResponse.success(
      res,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed",
    );
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return ApiResponse.unauthorized(
        res,
        "Refresh token expired. Please log in again.",
      );
    }
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Logout user (clear cookies + refresh token)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    // Clear refresh token in DB
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

    clearAuthCookies(res);

    return ApiResponse.success(res, null, "Logged out successfully.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    // Always return success to prevent email enumeration
    if (!user) {
      return ApiResponse.success(
        res,
        null,
        "If an account with that email exists, a reset link has been sent.",
      );
    }

    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(user, resetUrl(rawToken));
    } catch (emailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return ApiResponse.serverError(
        res,
        "Failed to send reset email. Please try again.",
      );
    }

    return ApiResponse.success(
      res,
      null,
      "If an account with that email exists, a reset link has been sent.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using token from email
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = hashToken(req.params.token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      return ApiResponse.error(
        res,
        "Password reset link is invalid or has expired.",
        400,
      );
    }

    // Set new password
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null; // invalidate all existing sessions
    await user.save();

    // Notify user
    try {
      await sendPasswordChangedEmail(user);
    } catch (_) {}

    // Clear cookies in case they're logged in on another device
    clearAuthCookies(res);

    return ApiResponse.success(
      res,
      null,
      "Password reset successful! Please log in with your new password.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return ApiResponse.error(res, "Current password is incorrect.", 401);
    }

    // Update password
    user.password = newPassword;
    user.refreshToken = null; // logout from all other devices
    await user.save();

    // Notify user
    try {
      await sendPasswordChangedEmail(user);
    } catch (_) {}

    // Issue fresh tokens for this session
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, refreshToken);

    return ApiResponse.success(
      res,
      { accessToken, refreshToken },
      "Password changed successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return ApiResponse.success(
      res,
      user.toSafeObject(),
      "User fetched successfully",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

const User = require("../models/User.model");
const ApiResponse = require("../utils/apiResponse");
const { verifyAccessToken } = require("../utils/token");

/**
 * protect — Verifies JWT and attaches req.user
 * Accepts token from: Authorization header OR httpOnly cookie
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check Authorization header (Bearer token)
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. Fallback: httpOnly cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return ApiResponse.unauthorized(res, "Access denied. No token provided.");
    }

    // 3. Verify token
    const decoded = verifyAccessToken(token);

    // 4. Check user still exists and is active
    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user) {
      return ApiResponse.unauthorized(res, "User no longer exists.");
    }
    if (user.accountStatus !== "active") {
      return ApiResponse.forbidden(
        res,
        `Account is ${user.accountStatus}. Please contact support.`,
      );
    }

    // 5. Update last activity
    user.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return ApiResponse.unauthorized(
        res,
        "Token expired. Please log in again.",
      );
    }
    if (error.name === "JsonWebTokenError") {
      return ApiResponse.unauthorized(
        res,
        "Invalid token. Please log in again.",
      );
    }
    return ApiResponse.serverError(res, error.message);
  }
};

/**
 * restrictTo — Role-based access control
 * Usage: restrictTo('admin') or restrictTo('admin', 'moderator')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(
        res,
        "You do not have permission to perform this action.",
      );
    }
    next();
  };
};

/**
 * optionalAuth — Attaches user if token present, continues either way
 * Useful for public routes that behave differently when authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.accountStatus === "active") req.user = user;
    }
  } catch (_) {
    // silently continue
  }
  next();
};

module.exports = { protect, restrictTo, optionalAuth };

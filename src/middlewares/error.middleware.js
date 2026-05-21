const ApiResponse = require("../utils/apiResponse");

/**
 * Global error handler — must be registered LAST in app.js
 * Catches all errors passed via next(error)
 */
const errorMiddleware = (err, req, res, next) => {
  console.error(`❌ [${req.method}] ${req.path} →`, err.message);

  // Mongoose: Duplicate key (e.g. unique email/username)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return ApiResponse.error(
      res,
      `${field} "${value}" is already in use.`,
      409,
    );
  }

  // Mongoose: Validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return ApiResponse.error(res, "Validation failed", 422, messages);
  }

  // Mongoose: Bad ObjectId
  if (err.name === "CastError") {
    return ApiResponse.error(res, `Invalid ${err.path}: ${err.value}`, 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return ApiResponse.unauthorized(res, "Invalid token.");
  }
  if (err.name === "TokenExpiredError") {
    return ApiResponse.unauthorized(
      res,
      "Token has expired. Please log in again.",
    );
  }

  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return ApiResponse.error(
      res,
      "File size too large. Maximum allowed is 5MB.",
      413,
    );
  }

  // Default
  return ApiResponse.error(
    res,
    err.message || "Internal Server Error",
    err.statusCode || 500,
  );
};

/**
 * 404 handler — for unknown routes
 */
const notFoundMiddleware = (req, res) => {
  return ApiResponse.notFound(
    res,
    `Route ${req.method} ${req.originalUrl} not found.`,
  );
};

module.exports = { errorMiddleware, notFoundMiddleware };

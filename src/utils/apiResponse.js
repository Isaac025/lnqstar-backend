/**
 * Standard API response helpers
 * Usage: return ApiResponse.success(res, data, 'Created', 201)
 */

const ApiResponse = {
  success(res, data = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },

  error(
    res,
    message = "Something went wrong",
    statusCode = 400,
    errors = null,
  ) {
    const payload = { success: false, message };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
  },

  created(res, data, message = "Created successfully") {
    return this.success(res, data, message, 201);
  },

  notFound(res, message = "Resource not found") {
    return this.error(res, message, 404);
  },

  unauthorized(res, message = "Unauthorized. Please log in.") {
    return this.error(res, message, 401);
  },

  forbidden(
    res,
    message = "You do not have permission to perform this action.",
  ) {
    return this.error(res, message, 403);
  },

  serverError(res, message = "Internal server error") {
    return this.error(res, message, 500);
  },
};

module.exports = ApiResponse;

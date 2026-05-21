const { body, validationResult } = require("express-validator");
const ApiResponse = require("../utils/apiResponse");

// ── Reusable: Run validations & return errors ──────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.error(res, "Validation failed", 422, errors.array());
  }
  next();
};

// ── Register ───────────────────────────────────────────────────────────────
const registerRules = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2 })
    .withMessage("Full name must be at least 2 characters"),

  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .toLowerCase(),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  body("country").trim().notEmpty().withMessage("Country is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((value, { req }) => {
      if (value !== req.body.password)
        throw new Error("Passwords do not match");
      return true;
    }),

  body("interests")
    .optional()
    .isArray()
    .withMessage("Interests must be an array")
    .custom((arr) => {
      const valid = [
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
      const invalid = arr.filter((i) => !valid.includes(i));
      if (invalid.length)
        throw new Error(`Invalid interests: ${invalid.join(", ")}`);
      return true;
    }),

  body("notificationPreferences.exclusiveEvents")
    .optional()
    .isBoolean()
    .withMessage("exclusiveEvents must be a boolean"),

  body("notificationPreferences.platformUpdates")
    .optional()
    .isBoolean()
    .withMessage("platformUpdates must be a boolean"),
];

// ── Login ──────────────────────────────────────────────────────────────────
const loginRules = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Email or username is required"),

  body("password").notEmpty().withMessage("Password is required"),
];

// ── Forgot Password ────────────────────────────────────────────────────────
const forgotPasswordRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
];

// ── Reset Password ─────────────────────────────────────────────────────────
const resetPasswordRules = [
  body("password")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((value, { req }) => {
      if (value !== req.body.password)
        throw new Error("Passwords do not match");
      return true;
    }),
];

// ── Change Password ────────────────────────────────────────────────────────
const changePasswordRules = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword)
        throw new Error("New password must be different from current password");
      return true;
    }),

  body("confirmNewPassword")
    .notEmpty()
    .withMessage("Please confirm your new password")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword)
        throw new Error("Passwords do not match");
      return true;
    }),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
};

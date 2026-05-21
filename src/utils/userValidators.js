const { body } = require("express-validator");

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

// ── Update Profile ─────────────────────────────────────────────────────────
const updateProfileRules = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Full name must be at least 2 characters"),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .toLowerCase(),

  body("phone")
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  body("country")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Country cannot be empty"),

  body("address").optional().trim(),

  body("interests")
    .optional()
    .isArray()
    .withMessage("Interests must be an array")
    .custom((arr) => {
      const invalid = arr.filter((i) => !INTERESTS.includes(i));
      if (invalid.length)
        throw new Error(`Invalid interests: ${invalid.join(", ")}`);
      return true;
    }),

  body("notificationPreferences.exclusiveEvents")
    .optional()
    .isBoolean()
    .withMessage("Must be true or false"),

  body("notificationPreferences.platformUpdates")
    .optional()
    .isBoolean()
    .withMessage("Must be true or false"),
];

module.exports = { updateProfileRules };

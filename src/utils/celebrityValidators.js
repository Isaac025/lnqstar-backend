const { body } = require("express-validator");

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

// ── Create Celebrity ───────────────────────────────────────────────────────
const createCelebrityRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),

  body("bio")
    .trim()
    .notEmpty()
    .withMessage("Bio is required")
    .isLength({ max: 1000 })
    .withMessage("Bio cannot exceed 1000 characters"),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn(CATEGORIES)
    .withMessage(`Category must be one of: ${CATEGORIES.join(", ")}`),

  body("nationality").optional().trim(),

  body("baseBookingFee")
    .notEmpty()
    .withMessage("Base booking fee is required")
    .isFloat({ min: 0 })
    .withMessage("Base booking fee must be a positive number"),

  body("serviceFee")
    .notEmpty()
    .withMessage("Service fee is required")
    .isFloat({ min: 0 })
    .withMessage("Service fee must be a positive number"),

  body("fanCardPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fan card price must be a positive number"),

  // Replace the old tags line with this:
  body("tags")
    .optional()
    .customSanitizer((value) => {
      if (!value) return [];

      if (Array.isArray(value)) return value;

      if (typeof value === "string") {
        const trimmed = value.trim();

        // Try JSON first
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {}
        }

        // Comma separated fallback
        return trimmed
          .split(",")
          .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
          .filter((tag) => tag.length > 0);
      }

      return [];
    })
    .isArray()
    .withMessage("Tags must be an array"),

  body("donationsEnabled")
    .optional()
    .isBoolean()
    .withMessage("donationsEnabled must be true or false"),

  body("socialLinks.instagram").optional().trim(),
  body("socialLinks.twitter").optional().trim(),
  body("socialLinks.youtube").optional().trim(),
  body("socialLinks.tiktok").optional().trim(),
];

// ── Update Celebrity ───────────────────────────────────────────────────────
const updateCelebrityRules = [
  body("name").optional().trim().isLength({ max: 100 }),
  body("bio").optional().trim().isLength({ max: 1000 }),
  body("category")
    .optional()
    .isIn(CATEGORIES)
    .withMessage(`Must be one of: ${CATEGORIES.join(", ")}`),
  body("nationality").optional().trim(),
  body("baseBookingFee").optional().isFloat({ min: 0 }),
  body("serviceFee").optional().isFloat({ min: 0 }),
  body("fanCardPrice").optional().isFloat({ min: 0 }),
  body("tags").optional().isArray(),
  body("donationsEnabled").optional().isBoolean(),
  body("available").optional().isBoolean(),
  body("featured").optional().isBoolean(),
];

module.exports = { createCelebrityRules, updateCelebrityRules };

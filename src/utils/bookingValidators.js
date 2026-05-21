const { body } = require("express-validator");

const EVENT_TYPES = [
  "Private Event",
  "Corporate Event",
  "Birthday Party",
  "Wedding",
  "Concert",
  "Meet & Greet",
  "Virtual Event",
  "Film/TV Appearance",
  "Brand Endorsement",
  "Charity Event",
  "Other",
];

const createBookingRules = [
  body("celebrity")
    .notEmpty()
    .withMessage("Celebrity ID is required")
    .isMongoId()
    .withMessage("Invalid celebrity ID"),
  body("eventType")
    .trim()
    .notEmpty()
    .withMessage("Event type is required")
    .isIn(EVENT_TYPES)
    .withMessage(`Must be one of: ${EVENT_TYPES.join(", ")}`),
  body("eventLocation")
    .trim()
    .notEmpty()
    .withMessage("Event location is required"),
  body("eventDate")
    .notEmpty()
    .withMessage("Event date is required")
    .isISO8601()
    .withMessage("Event date must be a valid date (YYYY-MM-DD)")
    .custom((value) => {
      if (new Date(value) < new Date())
        throw new Error("Event date must be in the future");
      return true;
    }),
  body("eventTime").trim().notEmpty().withMessage("Event time is required"),
  body("duration").trim().notEmpty().withMessage("Duration is required"),
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required"),
  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isIn(["Male", "Female", "Non-binary", "Prefer not to say"]),
  body("specialRequest").optional().trim(),
];

const cancelBookingRules = [body("reason").optional().trim()];

const initiatePaymentRules = [
  body("bookingId")
    .notEmpty()
    .withMessage("Booking ID is required")
    .isMongoId()
    .withMessage("Invalid booking ID"),
  body("currency")
    .optional()
    .isIn(["BTC", "ETH", "USDT", "USDC", "LTC", "BNB"])
    .withMessage("Supported: BTC, ETH, USDT, USDC, LTC, BNB"),
];

module.exports = {
  createBookingRules,
  cancelBookingRules,
  initiatePaymentRules,
};

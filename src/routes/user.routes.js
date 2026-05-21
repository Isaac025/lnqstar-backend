const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const { updateProfileRules } = require("../utils/userValidators");
const { validate } = require("../utils/validators");

// All user routes require authentication
router.use(protect);

// ── Profile ────────────────────────────────────────────────────────────────

// GET  /api/users/profile          → get own profile
// PUT  /api/users/profile          → update profile details
// PUT  /api/users/profile/picture  → upload profile picture
// DEL  /api/users/profile/picture  → remove profile picture
// PUT  /api/users/profile/address  → update address

router
  .route("/profile")
  .get(userController.getProfile)
  .put(updateProfileRules, validate, userController.updateProfile);

router
  .route("/profile/picture")
  .put(upload.single("profilePicture"), userController.updateProfilePicture)
  .delete(userController.removeProfilePicture);

router.put("/profile/address", userController.updateAddress);

// ── Account Info ───────────────────────────────────────────────────────────

// GET /api/users/account → member since, status, total bookings, last activity
router.get("/account", userController.getAccountInfo);

// ── Notification Preferences ───────────────────────────────────────────────

// PUT /api/users/notifications → update notification preferences
router.put("/notifications", userController.updateNotificationPreferences);

// ── Account Deactivation ───────────────────────────────────────────────────

// DELETE /api/users/account → soft-deactivate own account
router.delete("/account", userController.deactivateAccount);

// ── Admin Only Routes ──────────────────────────────────────────────────────

// GET   /api/users            → list all users (paginated)
// GET   /api/users/:id        → get a specific user
// PATCH /api/users/:id/status → suspend / reactivate user

router.get("/", restrictTo("admin"), userController.getAllUsers);
router.get("/:id", restrictTo("admin"), userController.getUserById);
router.patch(
  "/:id/status",
  restrictTo("admin"),
  userController.updateUserStatus,
);

module.exports = router;

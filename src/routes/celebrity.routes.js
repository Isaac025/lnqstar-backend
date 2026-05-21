const express = require("express");
const router = express.Router();

const celebrityController = require("../controllers/celebrity.controller");
const {
  protect,
  restrictTo,
  optionalAuth,
} = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const {
  createCelebrityRules,
  updateCelebrityRules,
} = require("../utils/celebrityValidators");
const { validate } = require("../utils/validators");

// ── Public Routes ──────────────────────────────────────────────────────────

// GET /api/celebrities                → list all (filter, search, paginate)
// GET /api/celebrities/featured       → featured celebrities (homepage)
// GET /api/celebrities/categories     → all categories + counts
// GET /api/celebrities/:id            → single celebrity (by ID or slug)

router.get("/featured", celebrityController.getFeaturedCelebrities);
router.get("/categories", celebrityController.getCategories);
router.get("/", celebrityController.getCelebrities);
router.get("/:id", celebrityController.getCelebrity);

// ── Protected: Recommended (matches user interests) ───────────────────────

// GET /api/celebrities/recommended  → personalised list (requires login)
router.get("/recommended", protect, celebrityController.getRecommended);

// ── Admin Only Routes ──────────────────────────────────────────────────────

// POST   /api/celebrities                        → create celebrity
// PUT    /api/celebrities/:id                    → update celebrity
// DELETE /api/celebrities/:id                    → delete celebrity
// PATCH  /api/celebrities/:id/toggle-availability→ toggle on/off
// POST   /api/celebrities/:id/gallery            → add gallery images (up to 6)
// DELETE /api/celebrities/:id/gallery            → remove gallery image

router.post(
  "/",
  protect,
  restrictTo("admin"),
  upload.single("picture"), // main profile picture
  createCelebrityRules,
  validate,
  celebrityController.createCelebrity,
);

router.put(
  "/:id",
  protect,
  restrictTo("admin"),
  upload.single("picture"), // optional new picture
  updateCelebrityRules,
  validate,
  celebrityController.updateCelebrity,
);

router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  celebrityController.deleteCelebrity,
);

router.patch(
  "/:id/toggle-availability",
  protect,
  restrictTo("admin"),
  celebrityController.toggleAvailability,
);

router.post(
  "/:id/gallery",
  protect,
  restrictTo("admin"),
  upload.array("images", 6), // up to 6 gallery images at once
  celebrityController.addGalleryImages,
);

router.delete(
  "/:id/gallery",
  protect,
  restrictTo("admin"),
  celebrityController.removeGalleryImage,
);

module.exports = router;

const express = require("express");
const router = express.Router();
const chatCtrl = require("../controllers/chat.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

// ── User routes ────────────────────────────────────────────────────────────
router.post("/session", chatCtrl.openSession); // open or get existing session + welcome msg
router.get("/session", chatCtrl.getSession); // get session + paginated messages
router.post("/session/close", chatCtrl.closeSession); // close session
router.get("/unread-count", chatCtrl.getUnreadCount); // badge count for chat button

// ── Admin routes ───────────────────────────────────────────────────────────
router.get("/sessions", restrictTo("admin"), chatCtrl.getAllSessions);
router.get(
  "/sessions/:chatId/messages",
  restrictTo("admin"),
  chatCtrl.getSessionMessages,
);

module.exports = router;

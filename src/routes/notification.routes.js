const express = require("express");
const router = express.Router();
const notifCtrl = require("../controllers/notification.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/", notifCtrl.getNotifications); // ?tab=all|unread|bookings|system
router.patch("/read-all", notifCtrl.markAllAsRead);
router.delete("/", notifCtrl.clearAll);
router.patch("/:id/read", notifCtrl.markAsRead);
router.delete("/:id", notifCtrl.deleteNotification);

module.exports = router;

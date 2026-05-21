const Notification = require("../models/Notification.model");
const ApiResponse = require("../utils/apiResponse");

// GET /api/notifications — Get user notifications with tab filter
exports.getNotifications = async (req, res) => {
  try {
    const { tab = "all", page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const base = { recipient: req.user._id };

    let filter;
    switch (tab) {
      case "unread":
        filter = { ...base, read: false };
        break;
      case "bookings":
        filter = { ...base, type: "booking" };
        break;
      case "system":
        filter = { ...base, type: { $in: ["system", "payment"] } };
        break;
      default:
        filter = base;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);

    return ApiResponse.success(res, {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// PATCH /api/notifications/:id/read — Mark one as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true } },
      { new: true },
    );
    if (!notification)
      return ApiResponse.notFound(res, "Notification not found.");
    return ApiResponse.success(res, notification, "Marked as read.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// PATCH /api/notifications/read-all — Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } },
    );
    return ApiResponse.success(res, null, "All notifications marked as read.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// DELETE /api/notifications/:id — Delete one notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    if (!notification)
      return ApiResponse.notFound(res, "Notification not found.");
    return ApiResponse.success(res, null, "Notification deleted.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// DELETE /api/notifications — Clear all notifications
exports.clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    return ApiResponse.success(res, null, "All notifications cleared.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

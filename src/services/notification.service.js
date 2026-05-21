const Notification = require("../models/Notification.model");

/**
 * Create a notification and optionally push via Socket.io
 */
const createNotification = async (
  app,
  { recipient, type, title, message, refModel = null, refId = null },
) => {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      refModel,
      refId,
    });

    const io = app?.get("io");
    if (io) {
      io.to(`user_${recipient.toString()}`).emit("notification", {
        _id: notification._id,
        type,
        title,
        message,
        read: false,
        createdAt: notification.createdAt,
      });
    }
    return notification;
  } catch (err) {
    console.error("Notification error:", err.message);
  }
};

const notify = {
  bookingCreated: (app, userId, booking) =>
    createNotification(app, {
      recipient: userId,
      type: "booking",
      title: "📋 Booking Submitted",
      message: `Your booking (${booking.bookingRef}) has been submitted. Complete payment to confirm.`,
      refModel: "Booking",
      refId: booking._id,
    }),
  paymentAwaiting: (app, userId, booking) =>
    createNotification(app, {
      recipient: userId,
      type: "payment",
      title: "💳 Payment Initiated",
      message: `We are waiting for your crypto payment for booking ${booking.bookingRef}.`,
      refModel: "Booking",
      refId: booking._id,
    }),
  bookingConfirmed: (app, userId, booking) =>
    createNotification(app, {
      recipient: userId,
      type: "booking",
      title: "✅ Booking Confirmed!",
      message: `Great news! Your booking ${booking.bookingRef} has been confirmed. Get ready!`,
      refModel: "Booking",
      refId: booking._id,
    }),
  bookingCancelled: (app, userId, booking) =>
    createNotification(app, {
      recipient: userId,
      type: "booking",
      title: "❌ Booking Cancelled",
      message: `Your booking ${booking.bookingRef} has been cancelled.`,
      refModel: "Booking",
      refId: booking._id,
    }),
  paymentFailed: (app, userId, booking) =>
    createNotification(app, {
      recipient: userId,
      type: "payment",
      title: "⚠️ Payment Failed",
      message: `Payment for booking ${booking.bookingRef} could not be confirmed. Please try again.`,
      refModel: "Booking",
      refId: booking._id,
    }),
  system: (app, userId, title, message) =>
    createNotification(app, {
      recipient: userId,
      type: "system",
      title,
      message,
    }),
};

module.exports = { createNotification, notify };

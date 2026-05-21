const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["booking", "payment", "system", "celebrity"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },

    // Optional link-back data
    refModel: {
      type: String,
      enum: ["Booking", "Payment", "Celebrity", null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);

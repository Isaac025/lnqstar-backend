const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Session status
    status: {
      type: String,
      enum: ["open", "closed", "pending"],
      default: "open",
    },

    // Assigned support agent (admin user), null = bot/unassigned
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Last message preview for chat list
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    // Unread count for support side
    unreadBySupport: {
      type: Number,
      default: 0,
    },
    // Unread count for user side
    unreadByUser: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

chatSchema.index({ user: 1, status: 1 });
chatSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);

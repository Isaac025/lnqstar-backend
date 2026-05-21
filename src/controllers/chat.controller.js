const Chat = require("../models/Chat.model");
const Message = require("../models/Message.model");
const ApiResponse = require("../utils/apiResponse");
const { WELCOME_MESSAGE, QUICK_REPLIES } = require("../services/bot.service");

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/chat/session
// @desc    Open a new chat session (or return existing open one)
//          Also sends the bot welcome message
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.openSession = async (req, res) => {
  try {
    // Return existing open session if one exists
    let chat = await Chat.findOne({ user: req.user._id, status: "open" });

    if (!chat) {
      chat = await Chat.create({ user: req.user._id });

      // Save welcome bot message to DB
      await Message.create({
        chat: chat._id,
        senderType: "bot",
        text: WELCOME_MESSAGE,
        read: false,
      });

      chat.lastMessage = WELCOME_MESSAGE;
      chat.lastMessageAt = new Date();
      await chat.save();
    }

    // Fetch the first page of messages
    const messages = await Message.find({ chat: chat._id })
      .sort({ createdAt: 1 })
      .limit(50);

    return ApiResponse.success(
      res,
      {
        chat,
        messages,
        quickReplies: QUICK_REPLIES,
      },
      "Chat session ready.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/chat/session
// @desc    Get current user's active chat session + messages
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getSession = async (req, res) => {
  try {
    const chat = await Chat.findOne({ user: req.user._id, status: "open" });
    if (!chat) {
      return ApiResponse.success(res, {
        chat: null,
        messages: [],
        quickReplies: QUICK_REPLIES,
      });
    }

    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
      Message.find({ chat: chat._id })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Message.countDocuments({ chat: chat._id }),
    ]);

    // Mark all messages as read for this user
    await Message.updateMany(
      { chat: chat._id, senderType: { $in: ["support", "bot"] }, read: false },
      { $set: { read: true } },
    );
    await Chat.findByIdAndUpdate(chat._id, { $set: { unreadByUser: 0 } });

    return ApiResponse.success(res, {
      chat,
      messages,
      quickReplies: QUICK_REPLIES,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/chat/session/close
// @desc    Close the user's active chat session
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.closeSession = async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { user: req.user._id, status: "open" },
      { $set: { status: "closed" } },
      { new: true },
    );

    if (!chat) return ApiResponse.error(res, "No active chat session found.");

    return ApiResponse.success(res, null, "Chat session closed.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/chat/unread-count
// @desc    Get unread message count for the badge on chat button
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const chat = await Chat.findOne({ user: req.user._id, status: "open" });
    return ApiResponse.success(res, { unreadCount: chat?.unreadByUser || 0 });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/chat/sessions  (Admin)
// @desc    Get all chat sessions with filters
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.getAllSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [sessions, total] = await Promise.all([
      Chat.find(filter)
        .populate("user", "fullName username profilePicture")
        .populate("assignedTo", "fullName")
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Chat.countDocuments(filter),
    ]);

    return ApiResponse.success(res, {
      sessions,
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

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/chat/sessions/:chatId/messages  (Admin)
// @desc    Get all messages for a specific session
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.getSessionMessages = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId).populate(
      "user",
      "fullName username profilePicture email",
    );
    if (!chat) return ApiResponse.notFound(res, "Chat session not found.");

    const messages = await Message.find({ chat: req.params.chatId }).sort({
      createdAt: 1,
    });

    // Mark all user messages as read for support side
    await Message.updateMany(
      { chat: req.params.chatId, senderType: "user", read: false },
      { $set: { read: true } },
    );
    await Chat.findByIdAndUpdate(req.params.chatId, {
      $set: { unreadBySupport: 0 },
    });

    return ApiResponse.success(res, { chat, messages });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

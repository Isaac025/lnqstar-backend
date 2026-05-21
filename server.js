require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const connectDB = require("./src/config/db");

// Models
const Chat = require("./src/models/Chat.model");
const Message = require("./src/models/Message.model");

// Bot service
const {
  getBotReply,
  requiresHuman,
  QUICK_REPLIES,
} = require("./src/services/bot.service");

// JWT for socket auth
const { verifyAccessToken } = require("./src/utils/token");
const User = require("./src/models/User.model");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ── Socket.io Setup ────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Attach io to app so controllers can emit events
app.set("io", io);

// ── Socket Auth Middleware ─────────────────────────────────────────────────
// Validates JWT on every socket connection
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      // Allow unauthenticated connections for guest chat (optional)
      socket.user = null;
      return next();
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select(
      "_id fullName username role profilePicture",
    );
    if (!user) return next(new Error("User not found"));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});

// ── Socket Event Handlers ──────────────────────────────────────────────────
io.on("connection", async (socket) => {
  const user = socket.user;

  // ── Authenticated user joins their personal notification room ───────────
  if (user) {
    socket.join(`user_${user._id}`);
    console.log(`🔌 ${user.username} connected (${socket.id})`);

    // If admin, join the admin room for support dashboard
    if (user.role === "admin") {
      socket.join("admin_room");
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // EVENT: join_chat
  // Client joins a specific chat room using the chat session ID
  // ────────────────────────────────────────────────────────────────────────
  socket.on("join_chat", async ({ chatId }) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat)
        return socket.emit("error", { message: "Chat session not found." });

      // Only the owner or an admin can join
      const isOwner = user && chat.user.toString() === user._id.toString();
      const isAdmin = user?.role === "admin";
      if (!isOwner && !isAdmin)
        return socket.emit("error", { message: "Access denied." });

      socket.join(`chat_${chatId}`);
      socket.emit("joined_chat", { chatId });
    } catch (err) {
      socket.emit("error", { message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // EVENT: send_message
  // User or support sends a message
  // ────────────────────────────────────────────────────────────────────────
  socket.on("send_message", async ({ chatId, text }) => {
    try {
      if (!text?.trim()) return;

      const chat = await Chat.findById(chatId);
      if (!chat || chat.status === "closed") {
        return socket.emit("error", { message: "Chat session is closed." });
      }

      const isAdmin = user?.role === "admin";
      const senderType = isAdmin ? "support" : "user";

      // 1. Save the user/support message
      const message = await Message.create({
        chat: chatId,
        senderType,
        sender: user?._id || null,
        text: text.trim(),
      });

      // 2. Update chat's last message
      await Chat.findByIdAndUpdate(chatId, {
        $set: { lastMessage: text.trim(), lastMessageAt: new Date() },
        $inc: isAdmin ? { unreadByUser: 1 } : { unreadBySupport: 1 },
      });

      // 3. Broadcast message to everyone in the chat room
      io.to(`chat_${chatId}`).emit("new_message", {
        _id: message._id,
        chatId,
        senderType,
        sender: user
          ? {
              _id: user._id,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            }
          : null,
        text: message.text,
        createdAt: message.createdAt,
      });

      // 4. Notify admin room of new user message
      if (!isAdmin) {
        io.to("admin_room").emit("new_support_message", {
          chatId,
          userId: user?._id,
          username: user?.username,
          text: text.trim(),
        });
      }

      // 5. Bot auto-reply (only for user messages when no admin is assigned)
      if (!isAdmin && !chat.assignedTo) {
        // Small delay to feel natural
        setTimeout(async () => {
          const botText = getBotReply(text);
          const botMessage = await Message.create({
            chat: chatId,
            senderType: "bot",
            text: botText,
          });

          await Chat.findByIdAndUpdate(chatId, {
            $set: { lastMessage: botText, lastMessageAt: new Date() },
            $inc: { unreadByUser: 1 },
          });

          io.to(`chat_${chatId}`).emit("new_message", {
            _id: botMessage._id,
            chatId,
            senderType: "bot",
            sender: null,
            text: botText,
            createdAt: botMessage.createdAt,
            // Send quick replies only on first bot response
            quickReplies: QUICK_REPLIES,
          });

          // If the user wants a human, mark chat as pending for admin attention
          if (requiresHuman(text)) {
            await Chat.findByIdAndUpdate(chatId, {
              $set: { status: "pending" },
            });
            io.to("admin_room").emit("human_requested", {
              chatId,
              userId: user?._id,
              username: user?.username,
            });
          }
        }, 1000);
      }
    } catch (err) {
      socket.emit("error", { message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // EVENT: typing
  // Broadcast typing indicator to the other party
  // ────────────────────────────────────────────────────────────────────────
  socket.on("typing", ({ chatId, isTyping }) => {
    const isAdmin = user?.role === "admin";
    const senderType = isAdmin ? "support" : "user";
    socket.to(`chat_${chatId}`).emit("typing", { senderType, isTyping });
  });

  // ────────────────────────────────────────────────────────────────────────
  // EVENT: read_messages  (Admin marks messages as read)
  // ────────────────────────────────────────────────────────────────────────
  socket.on("read_messages", async ({ chatId }) => {
    try {
      if (user?.role === "admin") {
        await Message.updateMany(
          { chat: chatId, senderType: "user", read: false },
          { $set: { read: true } },
        );
        await Chat.findByIdAndUpdate(chatId, { $set: { unreadBySupport: 0 } });
        socket.to(`chat_${chatId}`).emit("messages_read", { chatId });
      } else if (user) {
        await Message.updateMany(
          {
            chat: chatId,
            senderType: { $in: ["support", "bot"] },
            read: false,
          },
          { $set: { read: true } },
        );
        await Chat.findByIdAndUpdate(chatId, { $set: { unreadByUser: 0 } });
      }
    } catch (err) {
      console.error("Read messages error:", err.message);
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // EVENT: close_chat
  // ────────────────────────────────────────────────────────────────────────
  socket.on("close_chat", async ({ chatId }) => {
    try {
      await Chat.findByIdAndUpdate(chatId, { $set: { status: "closed" } });
      io.to(`chat_${chatId}`).emit("chat_closed", { chatId });
    } catch (err) {
      socket.emit("error", { message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Disconnect
  // ────────────────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (user) console.log(`🔌 ${user.username} disconnected`);
  });
});

// ── Start Server ───────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`\n🚀 LynqStar API running on port ${PORT}`);
    console.log(`📡 Environment : ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
  });
};

start();

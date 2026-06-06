const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const {
  errorMiddleware,
  notFoundMiddleware,
} = require("./middlewares/error.middleware");

const app = express();

// ── Security ───────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "⭐ LynqStar API is running",
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

app.use("/api/users", require("./routes/user.routes"));
// (Placeholders — add as you build each module)
app.use("/api/celebrities", require("./routes/celebrity.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/chat", require("./routes/chat.routes"));
// app.use('/api/donations',     require('./routes/donation.routes'));

// ── 404 & Error Handlers ───────────────────────────────────────────────────
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;

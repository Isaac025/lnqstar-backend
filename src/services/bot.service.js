/**
 * LynqStar Support Bot
 * Handles the initial greeting and common FAQ replies
 * before a human support agent takes over.
 */

const BOT_NAME = "LynqStar Support";

// ── Welcome message (sent on every new chat session) ─────────────────────
const WELCOME_MESSAGE = `Welcome! 👋 Whether you have a specific question or need assistance, we're here for you. 😉\n\nWhat would you like to know?`;

// ── Quick reply options shown to the user ─────────────────────────────────
const QUICK_REPLIES = [
  { id: "booking", label: "📅 How do I book a celebrity?" },
  { id: "payment", label: "💳 Accepted payment methods" },
  { id: "cancel", label: "❌ How to cancel a booking" },
  { id: "fancard", label: "🎫 What is a Fan Card?" },
  { id: "human", label: "🧑‍💼 Speak to a human agent" },
];

// ── FAQ responses keyed by trigger words / quick reply IDs ───────────────
const FAQ_RESPONSES = {
  booking: {
    triggers: ["book", "booking", "how to book", "reserve", "schedule"],
    reply: `📅 *How to Book a Celebrity*\n\nSimply browse our celebrities, click *Book Now* on the celebrity card, fill in your event details, and proceed to payment. Your booking is confirmed once payment is received.\n\nNeed help with a specific celebrity? Just ask! 🌟`,
  },
  payment: {
    triggers: [
      "pay",
      "payment",
      "crypto",
      "bitcoin",
      "btc",
      "how to pay",
      "accepted",
    ],
    reply: `💳 *Payment Methods*\n\nLynqStar accepts crypto payments including:\n• Bitcoin (BTC)\n• Ethereum (ETH)\n• USDT, USDC\n• Litecoin (LTC)\n• BNB\n\nAfter booking, you'll receive a wallet address and exact crypto amount to send. Your booking confirms automatically once payment is detected on-chain. 🔒`,
  },
  cancel: {
    triggers: ["cancel", "cancellation", "refund", "undo booking"],
    reply: `❌ *Cancellation Policy*\n\nYou can cancel a booking from your *My Bookings* dashboard — as long as the event is more than 24 hours away.\n\nFor cancellations within 24 hours or refund requests, please reach out to our support team and we'll assist you right away.`,
  },
  fancard: {
    triggers: ["fan card", "fancard", "fan membership", "fan"],
    reply: `🎫 *What is a Fan Card?*\n\nA Fan Card is your exclusive membership to a celebrity's inner circle! It gives you:\n• Priority access to bookings\n• Exclusive behind-the-scenes content\n• Special discounts on future bookings\n• A unique digital fan badge\n\nYou can get a Fan Card directly from the celebrity's profile page.`,
  },
  donate: {
    triggers: ["donat", "tip", "support celebrity"],
    reply: `🎁 *Donations*\n\nYou can send a donation directly to any celebrity from their profile page using the *Donate* button. Donations are processed via crypto and go directly to the celebrity.`,
  },
  contact: {
    triggers: ["contact", "email", "phone", "reach you", "support email"],
    reply: `📩 *Contact Us*\n\nYou can reach our support team at *support@lynqstar.com* or continue chatting here and a human agent will be with you shortly.`,
  },
  human: {
    triggers: [
      "human",
      "agent",
      "real person",
      "speak to someone",
      "person",
      "staff",
    ],
    reply: `🧑‍💼 *Connecting you to an agent...*\n\nA member of our support team will be with you shortly. Our support hours are *Mon–Fri, 9am–6pm WAT*.\n\nIn the meantime, feel free to ask me anything — I'll do my best to help! 😊`,
  },
};

// ── Get bot reply for a given user message ────────────────────────────────
const getBotReply = (userMessage) => {
  const lower = userMessage.toLowerCase().trim();

  // Check each FAQ category
  for (const [, faq] of Object.entries(FAQ_RESPONSES)) {
    if (faq.triggers.some((trigger) => lower.includes(trigger))) {
      return faq.reply;
    }
  }

  // Default fallback
  return `Thanks for your message! 😊 I'm still learning, but a human support agent will follow up shortly.\n\nIn the meantime, you can also email us at *support@lynqstar.com*.`;
};

// ── Should a human agent be escalated? ───────────────────────────────────
const requiresHuman = (userMessage) => {
  const lower = userMessage.toLowerCase();
  const escalationTriggers = [
    "human",
    "agent",
    "real person",
    "speak to someone",
    "urgent",
    "complaint",
    "scam",
    "fraud",
  ];
  return escalationTriggers.some((t) => lower.includes(t));
};

module.exports = {
  WELCOME_MESSAGE,
  QUICK_REPLIES,
  getBotReply,
  requiresHuman,
  BOT_NAME,
};

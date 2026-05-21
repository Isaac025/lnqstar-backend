const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: process.env.EMAIL_PORT === "465",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Base HTML wrapper ──────────────────────────────────────────────────────
const baseTemplate = (content) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { margin: 0; padding: 0; background: #0a0a0a; font-family: 'Helvetica Neue', Arial, sans-serif; color: #ffffff; }
      .wrapper { max-width: 600px; margin: 40px auto; background: #111; border-radius: 12px; overflow: hidden; }
      .header  { background: linear-gradient(135deg, #c8a96e, #f0d080); padding: 32px; text-align: center; }
      .header h1 { margin: 0; font-size: 28px; color: #0a0a0a; letter-spacing: 2px; }
      .body    { padding: 40px 32px; }
      .body p  { color: #ccc; line-height: 1.7; font-size: 15px; }
      .btn     { display: inline-block; margin: 24px 0; padding: 14px 36px; background: linear-gradient(135deg, #c8a96e, #f0d080); color: #0a0a0a; font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none; letter-spacing: 1px; }
      .code    { display: inline-block; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px 28px; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #c8a96e; margin: 20px 0; }
      .footer  { padding: 20px 32px; border-top: 1px solid #222; text-align: center; }
      .footer p { color: #555; font-size: 12px; margin: 4px 0; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header"><h1>⭐ LYNQSTAR</h1></div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} LynqStar. All rights reserved.</p>
        <p>You're receiving this because you signed up at lynqstar.com</p>
      </div>
    </div>
  </body>
  </html>
`;

// ── Send Email Verification ────────────────────────────────────────────────
const sendVerificationEmail = async (user, verificationUrl) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.fullName}</strong>,</p>
    <p>Welcome to <strong>LynqStar</strong> — your exclusive gateway to booking the world's biggest celebrities. 🌟</p>
    <p>Please verify your email address to activate your account:</p>
    <div style="text-align:center">
      <a href="${verificationUrl}" class="btn">VERIFY MY EMAIL</a>
    </div>
    <p>This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
  `);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "✅ Verify Your LynqStar Account",
    html,
  });
};

// ── Send Password Reset Email ──────────────────────────────────────────────
const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.fullName}</strong>,</p>
    <p>We received a request to reset your LynqStar password.</p>
    <p>Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.</p>
    <div style="text-align:center">
      <a href="${resetUrl}" class="btn">RESET MY PASSWORD</a>
    </div>
    <p>If you didn't request a password reset, please ignore this email — your account is safe.</p>
  `);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "🔐 Reset Your LynqStar Password",
    html,
  });
};

// ── Send Welcome Email (after verification) ────────────────────────────────
const sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.fullName}</strong>,</p>
    <p>Your email has been verified. Welcome to <strong>LynqStar</strong>! 🎉</p>
    <p>You can now:</p>
    <ul style="color:#ccc; line-height:2">
      <li>🌟 Browse and book your favourite celebrities</li>
      <li>💬 Chat with our support team in real time</li>
      <li>🎫 Get exclusive fan cards</li>
      <li>🪙 Make secure crypto payments</li>
    </ul>
    <div style="text-align:center">
      <a href="${process.env.CLIENT_URL}/celebrities" class="btn">EXPLORE CELEBRITIES</a>
    </div>
  `);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "🌟 Welcome to LynqStar!",
    html,
  });
};

// ── Send Password Change Confirmation ─────────────────────────────────────
const sendPasswordChangedEmail = async (user) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.fullName}</strong>,</p>
    <p>Your LynqStar password was successfully changed.</p>
    <p>If you did not make this change, please <a href="${process.env.CLIENT_URL}/auth/forgot-password" style="color:#c8a96e">reset your password immediately</a> or contact our support team.</p>
  `);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "🔒 Your LynqStar Password Was Changed",
    html,
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
};

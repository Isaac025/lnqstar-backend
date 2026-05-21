const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = "https://api.nowpayments.io/v1";
const headers = () => ({
  "x-api-key": process.env.NOWPAYMENTS_API_KEY,
  "Content-Type": "application/json",
});

/**
 * Create a crypto payment invoice for a booking
 */
const createPayment = async ({ amountUSD, currency = "btc", bookingRef }) => {
  const response = await axios.post(
    `${BASE_URL}/payment`,
    {
      price_amount: amountUSD,
      price_currency: "usd",
      pay_currency: currency.toLowerCase(),
      order_id: bookingRef,
      order_description: `LynqStar Booking - ${bookingRef}`,
      ipn_callback_url: `${process.env.SERVER_URL || "https://api.lynqstar.com"}/api/payments/webhook`,
      success_url: `${process.env.CLIENT_URL}/bookings?status=success`,
      cancel_url: `${process.env.CLIENT_URL}/bookings?status=cancelled`,
    },
    { headers: headers() },
  );
  return response.data;
};

/**
 * Get estimated crypto amount for a USD price
 */
const getEstimate = async (amountUSD, currency = "btc") => {
  const response = await axios.get(`${BASE_URL}/estimate`, {
    headers: headers(),
    params: {
      amount: amountUSD,
      currency_from: "usd",
      currency_to: currency.toLowerCase(),
    },
  });
  return response.data;
};

/**
 * Get payment status from NOWPayments
 */
const getPaymentStatus = async (paymentId) => {
  const response = await axios.get(`${BASE_URL}/payment/${paymentId}`, {
    headers: headers(),
  });
  return response.data;
};

/**
 * Get available currencies
 */
const getCurrencies = async () => {
  const response = await axios.get(`${BASE_URL}/currencies`, {
    headers: headers(),
  });
  return response.data;
};

/**
 * Verify IPN webhook HMAC-SHA512 signature from NOWPayments
 */
const verifyWebhookSignature = (payload, signature) => {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  const sorted = JSON.stringify(
    Object.keys(payload)
      .sort()
      .reduce((acc, k) => {
        acc[k] = payload[k];
        return acc;
      }, {}),
  );
  const expected = crypto
    .createHmac("sha512", secret)
    .update(sorted)
    .digest("hex");
  return expected === signature;
};

/**
 * Map NOWPayments status to internal status
 */
const mapStatus = (nowStatus) => {
  const map = {
    waiting: "waiting",
    confirming: "confirming",
    confirmed: "confirmed",
    sending: "confirming",
    partially_paid: "confirming",
    finished: "confirmed",
    failed: "failed",
    refunded: "refunded",
    expired: "expired",
  };
  return map[nowStatus] || "waiting";
};

module.exports = {
  createPayment,
  getEstimate,
  getPaymentStatus,
  getCurrencies,
  verifyWebhookSignature,
  mapStatus,
};

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 1899;
const MERCHANT_ID = process.env.MERCHANT_ID;
const MERCHANT_SECRET = process.env.MERCHANT_SECRET;

// ─── Middleware ────────────────────────────────────────────────────────────────

// Allow requests from the React dev server
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  })
);

// Global JSON parser (for all routes except the webhook)
app.use(express.json());

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the uppercase MD5 hash of the given string.
 */
const md5Upper = (str) =>
  crypto.createHash("md5").update(str).digest("hex").toUpperCase();

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /calculate-hash
 *
 * Query params: order_id, amount, currency
 *
 * Returns: { hash }
 *
 * Formula:
 *   hash = strtoupper(md5(
 *            merchant_id + order_id + amount(2dp) + currency + strtoupper(md5(merchant_secret))
 *          ))
 */
app.get("/calculate-hash", (req, res) => {
  const { order_id, amount, currency } = req.query;

  if (!order_id || !amount || !currency) {
    return res
      .status(400)
      .json({ error: "order_id, amount, and currency are required." });
  }

  if (!MERCHANT_ID || !MERCHANT_SECRET) {
    return res
      .status(500)
      .json({ error: "Merchant credentials are not configured on the server." });
  }

  // Format amount to exactly 2 decimal places (PayHere requirement)
  const formattedAmount = parseFloat(amount).toFixed(2);

  // Step 1: Hash the merchant secret
  const hashedSecret = md5Upper(MERCHANT_SECRET);

  // Step 2: Build and hash the full string
  const hashInput = `${MERCHANT_ID}${order_id}${formattedAmount}${currency}${hashedSecret}`;
  const hash = md5Upper(hashInput);

  console.log(`[hash] order_id=${order_id} amount=${formattedAmount} hash=${hash}`);

  return res.json({ hash });
});

/**
 * POST /api/payments/webhook
 *
 * PayHere sends notifications as application/x-www-form-urlencoded.
 * We apply the URL-encoded body parser ONLY to this route.
 *
 * Verification formula:
 *   local_md5sig = strtoupper(md5(
 *                    merchant_id + order_id + payhere_amount + payhere_currency
 *                    + status_code + strtoupper(md5(merchant_secret))
 *                  ))
 *
 * Always respond 200 OK to prevent PayHere retry loops.
 */
app.post(
  "/api/payments/webhook",
  express.urlencoded({ extended: true }), // URL-encoded parser scoped to this route only
  (req, res) => {
    console.log("\n[webhook] Notification received:");
    console.log(req.body);

    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = req.body;

    // Always return 200 first so PayHere doesn't retry endlessly
    res.sendStatus(200);

    // ── Verification ──────────────────────────────────────────────────────────
    if (!md5sig) {
      console.warn("[webhook] ⚠️  No md5sig in request body — skipping verification.");
      return;
    }

    const hashedSecret = md5Upper(MERCHANT_SECRET);
    const hashInput = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`;
    const local_md5sig = md5Upper(hashInput);

    if (local_md5sig !== md5sig) {
      console.error(
        `[webhook] ❌ Signature mismatch! Expected: ${local_md5sig}, Got: ${md5sig}`
      );
      return;
    }

    console.log("[webhook] ✅ Signature verified.");

    // ── Status Handling ───────────────────────────────────────────────────────
    const statusMessages = {
      "2": "✅ Payment Successful",
      "0": "⏳ Payment Pending",
      "-1": "❌ Payment Cancelled",
      "-2": "❌ Payment Failed",
      "-3": "❌ Chargedback",
    };

    const statusMsg = statusMessages[String(status_code)] || `Unknown status: ${status_code}`;
    console.log(`[webhook] Status: ${statusMsg}`);

    if (String(status_code) === "2") {
      // TODO: Mark the order as paid in your database here
      console.log(`[webhook] ✅ Payment Successful — Order ID: ${order_id}, Amount: ${payhere_amount} ${payhere_currency}`);
    }
  }
);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "PayHere backend is running 🚀" });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   MERCHANT_ID     : ${MERCHANT_ID || "⚠️  NOT SET"}`);
  console.log(`   MERCHANT_SECRET : ${MERCHANT_SECRET ? "****" + MERCHANT_SECRET.slice(-4) : "⚠️  NOT SET"}`);
  console.log(`   CORS origin     : ${process.env.CLIENT_URL || "http://localhost:5173"}\n`);
});

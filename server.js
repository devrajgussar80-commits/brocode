import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import Razorpay from "razorpay";

const app = express();
const port = Number(process.env.PORT || 4174);
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
const orders = new Map();

app.post("/api/razorpay/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!webhookSecret) return res.status(503).send("Webhook is not configured");
  const received = req.header("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.status(400).send("Invalid signature");
  const event = JSON.parse(req.body.toString("utf8"));
  if (event.event === "order.paid") {
    const order = event.payload?.order?.entity;
    if (order?.id && orders.has(order.id)) orders.get(order.id).status = "paid";
  }
  res.json({ ok: true });
});

app.use(express.json({ limit: "20kb" }));

app.get("/api/payment/config", (_req, res) => res.json({ configured: Boolean(razorpay), keyId: keyId || null, mode: keyId?.startsWith("rzp_live_") ? "live" : "test" }));

app.post("/api/payment/order", async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ error: "Razorpay Test Mode keys configure karein." });
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return res.status(400).json({ error: "Amount ₹1 se ₹1,00,000 ke beech hona chahiye." });
    const receipt = `nivesh_${Date.now()}`;
    const order = await razorpay.orders.create({ amount: amount * 100, currency: "INR", receipt, notes: { source: "nivesh_recharge" } });
    orders.set(order.id, { amount, receipt, status: "created" });
    res.json({ id: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (error) {
    res.status(502).json({ error: error?.error?.description || "Razorpay order create nahi hua." });
  }
});

app.post("/api/payment/verify", async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const localOrder = orders.get(orderId);
  if (!razorpay || !localOrder || !orderId || !paymentId || !signature) return res.status(400).json({ verified: false, error: "Invalid payment response." });
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(400).json({ verified: false, error: "Payment signature invalid hai." });
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.order_id !== orderId || payment.amount !== localOrder.amount * 100 || payment.currency !== "INR" || payment.status !== "captured") return res.status(409).json({ verified: false, error: "Payment abhi captured nahi hai." });
    localOrder.status = "paid";
    res.json({ verified: true, amount: localOrder.amount, paymentId });
  } catch {
    res.status(502).json({ verified: false, error: "Payment status verify nahi hua." });
  }
});

app.listen(port, "127.0.0.1", () => console.log(`Payment API: http://127.0.0.1:${port}`));

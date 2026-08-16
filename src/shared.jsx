/* Shared module: constants, helpers and the customer-facing components.
 * Imported by both entry points. The admin bundle tree-shakes the customer
 * components it does not use; the customer bundle never sees admin code at all.
 */
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Home,
  Layers3,
  Wallet,
  WalletCards,
  UserRound,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  ChevronRight,
  X,
  IndianRupee,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Building2,
  Headphones,
  PackageCheck,
  FileText,
  Users,
  UserPlus,
  RefreshCw,
  LogOut,
  Search,
  LockKeyhole,
  Moon,
  Sun,
  Image as ImageIcon,
  UploadCloud,
  ArrowUp,
  ArrowDown,
  Gift,
  Rocket,
  Mail,
  Globe2,
  MousePointerClick,
  TrendingUp,
  LayoutDashboard,
  AlertTriangle,
  ExternalLink,
  Clock3,
  Activity,
  Zap,
  Trash2,
} from "lucide-react";
// styles.css is imported by the customer entry (main.jsx), not here: the admin
// bundle also imports this module and must not inherit the customer theme.

/* Cross-origin API base.
 *
 * In local dev the Vite proxy forwards /api to the backend, so this stays empty
 * and requests are same-origin. On Vercel there is no proxy: the customer app
 * runs on one host and the API on another, so VITE_API_BASE_URL must point at
 * the deployed backend (for example https://brocode-api.onrender.com).
 * The admin bundle is served by that same backend, so it never needs a base.
 */
export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const defaultPlans = [
    { id: "p1", days: 1, amount: 100, totalReturn: 180, limit: 5 },
    { id: "p9", days: 14, amount: 570, totalReturn: 1680, dailyEarning: 120, payoutMode: "daily", limit: 1 },
    { id: "p2", days: 2, amount: 300, totalReturn: 765, limit: 5 },
    { id: "p3", days: 5, amount: 1000, totalReturn: 1895, limit: 5 },
    { id: "p4", days: 7, amount: 5000, totalReturn: 11476, dailyEarning: 925, payoutMode: "daily", limit: 1 },
    { id: "p5", days: 180, amount: 7500, totalReturn: 33500, limit: 1 },
    { id: "p6", days: 15, amount: null, totalReturn: null, limit: 0, comingSoon: true },
    { id: "p7", days: 30, amount: null, totalReturn: null, limit: 0, comingSoon: true },
    { id: "p8", days: 365, amount: null, totalReturn: null, limit: 0, comingSoon: true },
  ],
  COMPANY_NAME = "BroCode",
  DEFAULT_TELEGRAM_URL = "https://t.me/BajjajFinanceDigitalService",
  KEY = "nivesh.bank.v1",
  TOKEN_KEY = "nivesh.auth.v1",
  INITIAL_REFERRAL_CODE = (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase().slice(0, 16),
  QR_VALIDITY_MS = 5 * 60 * 1000,
  QR_ROTATION_SLOT_MS = 5 * 60 * 1000,
  DEFAULT_RECHARGE_PRESETS = [100, 570, 1000, 1970, 5000],
  WITHDRAWAL_FEE_PERCENT = 5,
  QR_ROTATION_KEY = "speedcredit.payment.qr.next.v2",
  VISITOR_ID_KEY = "meta.money.visitor.v1",
  VISIT_SESSION_KEY = "meta.money.visit.session.v1",
  moneyFormatter = new Intl.NumberFormat("en-IN"),
  money = (n) => moneyFormatter.format(n);
export const durationLabel = (value, unit = "days") => `${value} ${unit === "hours" ? "Hour" : "Day"}${Number(value) === 1 ? "" : "s"}`;
export const readCustomerSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const saved = JSON.parse(storage.getItem(TOKEN_KEY) || "null");
      if (saved?.token) return saved;
    } catch {}
  }
  return null;
};
export const storeCustomerSession = (data, rememberLogin) => {
  const target = rememberLogin ? localStorage : sessionStorage;
  const other = rememberLogin ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  target.setItem(TOKEN_KEY, JSON.stringify(data));
};
export const clearCustomerSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};
// Plan artwork is stored in the database and served from /api/plan-images.
// No artwork ships with the bundle.
export const PLAN_ARTWORK_BY_AMOUNT = {};
export const PLAN_ARTWORK_BY_ID = {};
export const cryptoAssetLabel = (coin) => coin?.startsWith("USDT") ? "USDT" : coin;
export const newRequestKey = (prefix) => {
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${unique}`.replaceAll("-", "_");
};
export const apiErrorMessage = (detail, fallback) => {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => typeof item === "string" ? item : item?.msg || item?.message).filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  if (detail && typeof detail === "object") return detail.message || detail.msg || fallback;
  return fallback;
};
export const generateAdminPasswordSuggestion = () => {
  const random = new Uint32Array(14);
  globalThis.crypto?.getRandomValues?.(random);
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = `${upper}${lower}${digits}${symbols}`;
  const pick = (characters, index) => characters[random[index] % characters.length];
  const characters = [pick(upper, 0), pick(lower, 1), pick(digits, 2), pick(symbols, 3)];
  for (let index = 4; index < random.length; index += 1) characters.push(pick(all, index));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = random[index] % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
};
export function anonymousTrackingId(storage, key, prefix) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    const value = `${prefix}_${unique}`.replaceAll("-", "_");
    storage.setItem(key, value);
    return value;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
}
export function trackVisitorStage(stage) {
  const visitorId = anonymousTrackingId(localStorage, VISITOR_ID_KEY, "visitor");
  fetch(API_BASE + "/api/analytics/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitor_id: visitorId, stage }),
    keepalive: true,
  }).catch(() => {});
}
export function qrRotationStorageKey(method, customerId = "guest") {
  return `${QR_ROTATION_KEY}.${customerId}.${method === "manual" ? "manual-uploaded" : "auto-generated"}`;
}
export function paymentQrPriority(qr) {
  const label = `${qr.adminLabel || ""} ${qr.payee || ""}`.toLowerCase();
  if (label.includes("devraj")) return 0;
  if (label.includes("jayesh")) return 1;
  return 2;
}
export function orderedPaymentQrs(rows) {
  return [...rows].sort((left, right) => paymentQrPriority(left) - paymentQrPriority(right) || Number(left.id) - Number(right.id));
}
export function currentPaymentQrIndex(qrCount, method = "auto", customerId = "guest") {
  if (!qrCount) return 0;
  try {
    const key = qrRotationStorageKey(method, customerId);
    const stored = Number.parseInt(localStorage.getItem(key) || "0", 10);
    const startedAt = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (startedAt !== stored) localStorage.setItem(key, String(startedAt));
    return Math.floor(Math.max(0, Date.now() - startedAt) / QR_ROTATION_SLOT_MS) % qrCount;
  } catch {
    return 0;
  }
}
export function BroCodeMark({ className = "bc-mark" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="presentation" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round">
        <path d="M56.5 13.1A37.5 37.5 0 0 1 85.2 62.8" />
        <path d="M78.7 74.1A37.5 37.5 0 0 1 21.3 74.1" />
        <path d="M14.8 62.8A37.5 37.5 0 0 1 43.5 13.1" />
      </g>
    </svg>
  );
}
export function CompanyLogo({ className = "", name = COMPANY_NAME }) {
  // The supplied lockup already contains the wordmark, so it stands alone.
  // A custom company name set from the admin panel falls back to mark + text.
  if (/^\s*bro\s*code\.?\s*$/i.test(name || "")) {
    return (
      <div className={`company-logo brand-lockup ${className}`.trim()}>
        <img src="/brand/brocode-logo.png" alt="BroCode" width="175" height="47" />
      </div>
    );
  }
  return (
    <div className={`company-logo ${className}`.trim()}>
      <BroCodeMark />
      <b>{name}</b>
    </div>
  );
}
export function Modal({ type, onClose, onAdd, onRechargeStarted, onPendingRecharge, onCryptoRecharge, bank, paymentQrs, cryptoWallets, minimumRecharge = 100, rechargePresets = DEFAULT_RECHARGE_PRESETS, minimumWithdrawal = 1000, withdrawalAvailable = true, withdrawalMessage = "", customerId = "guest", assignedManualQrId = null }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [upiUrl, setUpiUrl] = useState("");
  const [utr, setUtr] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [qrIndex, setQrIndex] = useState(0);
  const [qrExpiresAt, setQrExpiresAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [step, setStep] = useState("amount");
  const [payoutMethod, setPayoutMethod] = useState(bank ? "bank" : "upi");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [rechargeChannel, setRechargeChannel] = useState("qr");
  const [cryptoCoin, setCryptoCoin] = useState(cryptoWallets[0]?.coin || "");
  const [cryptoTxid, setCryptoTxid] = useState("");
  const allUploadedPaymentQrs = orderedPaymentQrs(paymentQrs.filter((qr) => qr.source === "uploaded" && qr.imageUrl));
  const jayeshRajPaymentQr = allUploadedPaymentQrs.find((qr) => `${qr.adminLabel || ""} ${qr.payee || ""}`.toLowerCase().includes("jayesh"));
  const uploadedPaymentQrs = jayeshRajPaymentQr ? [jayeshRajPaymentQr] : allUploadedPaymentQrs.slice(0, 1);
  const qrMethod = "manual";
  const activePaymentQrs = uploadedPaymentQrs;
  const [withdrawalRequestKey] = useState(() => newRequestKey("wd"));
  const selectedCrypto = cryptoWallets.find((wallet) => wallet.coin === cryptoCoin);
  const withdrawalAmount = Number(amount) || 0;
  const withdrawalTooLow = type === "withdraw" && withdrawalAmount > 0 && withdrawalAmount < minimumWithdrawal;
  const withdrawalFee = Math.floor((withdrawalAmount * WITHDRAWAL_FEE_PERCENT + 50) / 100);
  const withdrawalPayout = Math.max(0, withdrawalAmount - withdrawalFee);
  useEffect(() => () => setQrUrl(""), []);
  useEffect(() => {
    if (step !== "payment") return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  const secondsLeft = Math.max(0, Math.ceil((qrExpiresAt - clock) / 1000));
  const qrExpired = step === "payment" && qrExpiresAt > 0 && secondsLeft === 0;
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const manualPaymentQr = true;
  const activateQr = async (nextIndex, value, reference = paymentReference, qrList = activePaymentQrs) => {
    const selected = qrList[nextIndex];
    if (!selected) throw new Error("No payment QR is active");
    if (!selected.imageUrl) throw new Error("The uploaded manual payment QR is unavailable. Contact support.");
    setQrIndex(nextIndex);
    setUpiUrl("");
    setQrUrl(selected.imageUrl);
    setClock(Date.now());
    setQrExpiresAt(0);
  };
  const generateNextQr = async () => {
    setBusy(true);
    setError("");
    const nextIndex = currentPaymentQrIndex(activePaymentQrs.length, qrMethod, customerId);
    try {
      await activateQr(nextIndex, Number(amount));
    } catch (err) {
      setError(err.message || "Could not generate the next payment QR.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return;
    if (type === "withdraw") {
      if (!withdrawalAvailable) {
        setError(withdrawalMessage || "Withdrawal access is locked.");
        return;
      }
      if (value < minimumWithdrawal) {
        setError("");
        return;
      }
      if (payoutMethod === "bank" && !bank) {
        setError("Add a bank account or choose UPI ID.");
        return;
      }
      const cleanUpi = withdrawUpi.trim();
      if (payoutMethod === "upi" && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(cleanUpi)) {
        setError("Enter a valid UPI ID, for example name@bank.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await onAdd({ amount: value, payoutMethod, upiId: payoutMethod === "upi" ? cleanUpi : null, requestKey: withdrawalRequestKey });
        onClose();
      } catch (err) {
        setError(err.message || "Withdrawal request failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const activeMinimumRecharge = rechargeChannel === "crypto" ? 2 : minimumRecharge;
    if (!Number.isInteger(value) || value < activeMinimumRecharge || value > 100000) {
      setError(rechargeChannel === "crypto"
        ? "Minimum crypto deposit is 2 USDT. Enter a whole amount."
        : `Choose a recharge amount of INR ${money(minimumRecharge)} or more.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (rechargeChannel === "crypto") {
        if (!selectedCrypto) throw new Error("No crypto recharge address is active. Please contact support.");
        if (!/^[A-Za-z0-9:_+/=-]{8,180}$/.test(cryptoTxid.trim())) throw new Error("Enter a valid transaction ID without spaces.");
        await onCryptoRecharge({ coin: selectedCrypto.coin, amount: value, txid: cryptoTxid.trim() });
        onClose();
        return;
      }
      if (!activePaymentQrs.length) throw new Error("No manual payment QR has been uploaded. Contact support.");
      const nextIndex = currentPaymentQrIndex(activePaymentQrs.length, qrMethod, customerId);
      const draft = await onRechargeStarted({ amount: value, upiId: activePaymentQrs[nextIndex].upiId, paymentQrId: null });
      const reference = `MMR${String(draft.id).padStart(8, "0")}${Date.now().toString().slice(-6)}`;
      setPaymentReference(reference);
      await activateQr(nextIndex, value, reference);
      setDraftId(draft.id);
      setStep("payment");
    } catch (err) {
      setError(err.message || "Could not generate the payment QR.");
    } finally {
      setBusy(false);
    }
  };
  const submitUtr = async (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(utr))
      return setError("Enter a valid 12-digit UTR number.");
    setBusy(true);
    setError("");
    try {
      await onPendingRecharge({ amount: Number(amount), utr, upiId: activePaymentQrs[qrIndex].upiId, paymentQrId: null, draftId });
      onClose();
    } catch (err) {
      setError(err.message || "Could not submit the UTR.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className={`modal ${step === "payment" ? "payment-step" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          <X />
        </button>
        <div className="modal-icon">
          <IndianRupee />
        </div>
        <h2>
          {type === "recharge" ? "Wallet Recharge" : "Withdraw Funds"}
        </h2>
        <p>
          {type === "withdraw"
            ? payoutMethod === "bank"
              ? bank ? `${bank.beneficiary} • A/c ending ${bank.account.slice(-4)}` : "No bank account saved. Choose UPI ID instead."
              : "Enter the UPI ID where you want to receive the withdrawal."
            : rechargeChannel === "crypto" ? "Minimum deposit is 2 USDT. Send crypto to the selected network, then submit its Transaction ID for admin verification." : `Minimum recharge is ₹${money(minimumRecharge)}. Choose one of the recharge amounts below.`}
        </p>
        <form onSubmit={submit}>
          {type === "recharge" ? <div className="recharge-channels" role="group" aria-label="Recharge channel">
            <button type="button" className={rechargeChannel === "qr" ? "active" : ""} onClick={() => { setRechargeChannel("qr"); setError(""); }}>UPI</button>
            <button type="button" className={rechargeChannel === "crypto" ? "active" : ""} onClick={() => { setRechargeChannel("crypto"); setError(""); }}>Crypto Recharge</button>
          </div> : null}
          {type === "recharge" && rechargeChannel === "qr" ? <div className="manual-qr-only"><ImageIcon /><span><b>Manual QR Payment</b><small>Scan the uploaded QR and enter the amount manually</small></span></div> : null}
          {type === "withdraw" ? <>
            <div className="withdraw-methods" role="group" aria-label="Withdrawal method">
              <button type="button" disabled={!bank} className={payoutMethod === "bank" ? "active" : ""} onClick={() => { setPayoutMethod("bank"); setError(""); }}>Bank Account</button>
              <button type="button" className={payoutMethod === "upi" ? "active" : ""} onClick={() => { setPayoutMethod("upi"); setError(""); }}>UPI ID</button>
            </div>
            {payoutMethod === "upi" ? <>
              <label>UPI ID</label>
              <div className="input"><input autoFocus type="text" inputMode="email" autoCapitalize="none" spellCheck="false" placeholder="name@bank" value={withdrawUpi} onChange={(e) => setWithdrawUpi(e.target.value.replace(/\s/g, ""))} /></div>
            </> : null}
          </> : null}
          {type === "withdraw" || rechargeChannel === "crypto" ? <><label>Amount</label>
            <div className="input">
              <span>{type === "recharge" && rechargeChannel === "crypto" ? "$" : "₹"}</span>
              <input
                autoFocus={type !== "withdraw" || payoutMethod === "bank"}
                type="number"
                min={type === "withdraw" ? String(minimumWithdrawal) : "2"}
                max={type === "recharge" ? "100000" : undefined}
                step="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={type === "withdraw" && !withdrawalAvailable}
              />
            </div></> : null}
          {withdrawalTooLow ? <div className="form-error">Minimum withdrawal is ₹{money(minimumWithdrawal)}.</div> : null}
          {type === "withdraw" ? <div className="withdrawal-fee-note"><b>A 5% withdrawal fee will be deducted.</b>{withdrawalAmount > 0 ? <span>Fee: ₹{money(withdrawalFee)} • You will receive: ₹{money(withdrawalPayout)}</span> : <span>The final payout amount will be shown here.</span>}</div> : null}
          {type === "recharge" && rechargeChannel === "qr" ? <div className="recharge-presets" role="group" aria-label="Quick recharge amounts">
            {rechargePresets.map((preset, index) => <button type="button" key={`${preset}-${index}`} disabled={preset < minimumRecharge} className={Number(amount) === preset ? "active" : ""} aria-label={`Use ₹${money(preset)} recharge amount`} onClick={() => { setAmount(String(preset)); setError(""); }}>₹{money(preset)}</button>)}
          </div> : null}
          {type === "recharge" && rechargeChannel === "crypto" ? <div className="crypto-recharge-form">
            {cryptoWallets.length ? <>
              <label>Cryptocurrency & Network</label>
              <div className="crypto-coin-grid">{cryptoWallets.map((wallet) => <button type="button" key={wallet.coin} className={cryptoCoin === wallet.coin ? "active" : ""} onClick={() => { setCryptoCoin(wallet.coin); setError(""); }}><b>{wallet.label || cryptoAssetLabel(wallet.coin)}</b><span>{wallet.network}</span></button>)}</div>
              {selectedCrypto ? <div className="crypto-address"><span>Send only USDT on {selectedCrypto.network}</span><code>{selectedCrypto.address}</code><button type="button" onClick={() => navigator.clipboard?.writeText(selectedCrypto.address)}>Copy Address</button></div> : null}
              <label>Transaction ID</label>
              <div className="input"><input type="text" autoCapitalize="none" spellCheck="false" placeholder="Paste blockchain transaction ID" value={cryptoTxid} onChange={(event) => setCryptoTxid(event.target.value.replace(/\s/g, ""))} /></div>
              <div className="pending-note">Crypto transfers cannot be reversed. Check the network and address carefully. Admin will verify the blockchain transaction and claimed INR amount before wallet credit.</div>
            </> : <div className="form-error">No crypto recharge address is active. Please contact support.</div>}
          </div> : null}
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary" disabled={busy || (type === "withdraw" && !withdrawalAvailable) || (type === "recharge" && rechargeChannel === "qr" && (!rechargePresets.includes(Number(amount)) || Number(amount) < minimumRecharge))}>
            {busy
              ? "Please wait…"
              : type === "recharge"
                ? rechargeChannel === "crypto" ? "Submit Crypto Transaction" : "Continue"
                : "Request Withdrawal"}
          </button>
        </form>
        {step === "payment" ? (
          <form onSubmit={submitUtr} className="qr-payment">
            <div className="qr-modern-heading">
              <span><ShieldCheck /> Manual UPI Payment</span>
              <h2>₹{money(Number(amount))}</h2>
              <p>{`Scan this QR and manually enter ₹${money(Number(amount))} in your UPI app`}</p>
            </div>
            <div className="manual-qr-notice"><AlertTriangle /> Amount is not pre-filled. Enter the recharge amount manually before paying.</div>
            <div className="qr-payment-card">
              <div className={`qr-box ${qrExpired ? "qr-box-expired" : ""}`}>
                <img src={qrUrl} alt={`₹${amount} payment QR ${qrIndex + 1}`} />
              </div>
              <div className="qr-fast-credit-line">Manual amount payment • UTR submission required</div>
            </div>
            {!qrExpired ? <div className="qr-actions">
              {upiUrl ? <a className="primary" href={upiUrl}><ExternalLink /> Open UPI App</a> : null}
              <a className="save-qr" href={qrUrl} download={`meta-money-${amount}-qr-${qrIndex + 1}.png`}><ArrowDown /> Save QR</a>
            </div> : <button className="primary" type="button" disabled={busy} onClick={generateNextQr}>{busy ? "Generating…" : "Generate Next QR"}</button>}
            {!qrExpired && activePaymentQrs.length > 1 ? <div className="alternate-qr-instruction">Manual payment QR rotation is active.</div> : null}
            {qrExpired ? <div className="alternate-qr-instruction">If you already paid, submit the UTR below. Otherwise generate the next QR.</div> : null}
            <div className="utr-submit-card">
              <div className="utr-submit-title"><CheckCircle2 /><span><b>Payment completed?</b><small>UTR is mandatory. Enter the 12-digit UTR from your payment app.</small></span></div>
              <label>UTR Number</label>
              <div className="input"><input inputMode="numeric" maxLength="12" placeholder="1234 5678 9012" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} /></div>
              <div className="pending-note">Your wallet is credited after secure manual verification.</div>
              {error ? <div className="form-error">{error}</div> : null}
              <button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit Payment UTR"}</button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function ResultModal({ result, onClose }) {
  const copy = {
    recharge: { title: "Recharge Submitted", message: "Your recharge will be added to your wallet within 1 hour." },
    crypto: { title: "Crypto Recharge Submitted", message: "Under Review. Your wallet will be credited only after the admin verifies the blockchain transaction." },
    withdrawal: { title: "Withdrawal Submitted", message: `Your withdrawal will be sent to your ${result.payoutMethod === "upi" ? "UPI ID" : "bank account"} within 24 hours.` },
    plan: { title: "Plan Orders Purchased", message: `${result.quantity} order${result.quantity > 1 ? "s" : ""} purchased successfully.` },
  }[result.type];
  return <div className="backdrop result-backdrop" onMouseDown={onClose}><div className="result-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose}><X /></button>
    <div className="result-check"><CheckCircle2 /></div>
    <h2>{copy.title}</h2><p>{copy.message}</p>
    <div className="reference-box"><span>Reference Number</span><b>{result.reference}</b></div>
    {result.type === "withdrawal" ? <div className="result-earnings withdrawal-result"><span>Requested amount <b>₹{money(result.amount)}</b></span><span>Withdrawal fee (5%) <b>−₹{money(result.feeAmount)}</b></span><span>Final payout <b>₹{money(result.payoutAmount)}</b></span></div> : null}
    {result.type === "plan" ? <div className="result-earnings"><span>Total investment <b>₹{money(result.totalCost)}</b></span><span>Combined daily earning <b>₹{money(result.dailyEarning)}</b></span></div> : null}
    <button className="primary" onClick={onClose}>Done</button>
  </div></div>;
}

export function TelegramJoinModal({ onClose, companyName, telegramUrl = DEFAULT_TELEGRAM_URL }) {
  const href = /^https:\/\//i.test(telegramUrl || "") ? telegramUrl : DEFAULT_TELEGRAM_URL;
  return <div className="backdrop telegram-join-backdrop" onMouseDown={onClose}>
    <div className="telegram-join-modal" role="dialog" aria-modal="true" aria-labelledby="telegram-join-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" type="button" aria-label="Close Telegram channel popup" onClick={onClose}><X /></button>
      <div className="telegram-join-icon">✈</div>
      <h2 id="telegram-join-title">Join Our Telegram Channel</h2>
      <p>Join the {companyName} channel for the latest updates and announcements.</p>
      <a className="primary telegram-join-button" href={href} target="_blank" rel="noopener noreferrer">Join Telegram Channel</a>
      <button className="telegram-skip" type="button" onClick={onClose}>Continue without joining</button>
    </div>
  </div>;
}

export function NotificationPanel({ notifications, onClose, onMarkAll }) {
  return <div className="notification-backdrop" onMouseDown={onClose}><section className="notification-panel" aria-label="Notifications" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><p>Latest updates</p><h2>Notifications</h2></div><button className="close" type="button" aria-label="Close notifications" onClick={onClose}><X /></button></header>
    {notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={item.isRead ? "" : "unread"} key={item.id}><span className="notification-dot" /><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("en-IN")}</small></div></article>)}</div> : <div className="empty">No notifications yet.</div>}
    {notifications.some((item) => !item.isRead) ? <button className="primary" type="button" onClick={onMarkAll}>Mark all as read</button> : null}
  </section></div>;
}

export function PlanPurchaseModal({ plan, bought, onClose, onConfirm }) {
  const remaining = plan.limit - bought;
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestKey] = useState(() => newRequestKey("plan"));
  const dailyPerOrder = plan.durationUnit === "hours" ? plan.totalReturn - plan.amount : plan.dailyEarning ?? Math.round((plan.totalReturn - plan.amount) / plan.days);
  const confirm = async () => {
    setBusy(true); setError("");
    try { await onConfirm(plan, quantity, requestKey); }
    catch (err) { setError(err.message || "Plan purchase failed."); setBusy(false); }
  };
  return <div className="backdrop" onMouseDown={onClose}><div className="plan-purchase-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose}><X /></button>
    <p className="modal-kicker">{plan.name || `${durationLabel(plan.days, plan.durationUnit)} Plan`}</p><h2>How many orders?</h2><p>You can purchase together now or buy the remaining orders separately later.</p>
    <div className="quantity-control"><button type="button" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)}>−</button><strong>{quantity}</strong><button type="button" disabled={quantity === remaining} onClick={() => setQuantity((value) => value + 1)}>+</button></div>
    <small>{remaining} order{remaining === 1 ? "" : "s"} available for this plan</small>
    <div className="purchase-summary"><span>Total investment<b>₹{money(plan.amount * quantity)}</b></span><span>{plan.durationUnit === "hours" ? "Plan earning" : "Daily earning"}<b>₹{money(dailyPerOrder * quantity)}</b></span><span>Total projected return<b>₹{money(plan.totalReturn * quantity)}</b></span><span>Orders<b>{quantity}</b></span></div>
    {error ? <div className="form-error">{error}</div> : null}
    <button className="primary" disabled={busy} onClick={confirm}>{busy ? "Purchasing…" : `Purchase ${quantity} Order${quantity > 1 ? "s" : ""}`}</button>
  </div></div>;
}

export function BankForm({ bank, onSave }) {
  const [f, setF] = useState(() =>
      bank
        ? { ...bank, confirm: bank.account }
        : { beneficiary: "", ifsc: "", account: "", confirm: "" },
    ),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (e) =>
    setF((x) => ({ ...x, [e.target.name]: e.target.value.toUpperCase() }));
  const save = async (e) => {
    e.preventDefault();
    if (!f.beneficiary.trim()) return setErr("Beneficiary name is required.");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc))
      return setErr("Enter a valid 11-character IFSC code.");
    if (!/^\d{9,18}$/.test(f.account))
      return setErr("Enter a valid account number.");
    if (f.account !== f.confirm)
      return setErr("Account numbers do not match.");
    setBusy(true);
    setErr("");
    try {
      await onSave({
        beneficiary: f.beneficiary.trim(),
        ifsc: f.ifsc,
        account: f.account,
      });
    } catch (error) {
      setErr(error.message || "Could not save the bank account.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="bank-form" onSubmit={save}>
      <h3>{bank ? "Bank Account" : "Add Bank Account"}</h3>
      <p>Save a bank account to receive withdrawals.</p>
      {[
        ["beneficiary", "Beneficiary Name", "Account holder name"],
        ["ifsc", "IFSC Code", "SBIN0001234"],
        ["account", "Account Number", "Account number"],
        ["confirm", "Re-enter Account Number", "Enter the account number again"],
      ].map(([n, l, p]) => (
        <label key={n}>
          {l}
          <input
            name={n}
            value={f[n]}
            onChange={change}
            maxLength={n === "ifsc" ? 11 : 18}
            inputMode={
              n === "account" || n === "confirm" ? "numeric" : undefined
            }
            placeholder={p}
          />
        </label>
      ))}
      {err ? <div className="form-error">{err}</div> : null}
      <button className="primary" disabled={busy}>
        {busy ? "Saving..." : bank ? "Update Bank Account" : "Save Bank Account"}
      </button>
      {bank ? (
        <div className="saved-bank">
          <CheckCircle2 /> Saved • A/c ending {bank.account.slice(-4)}
        </div>
      ) : null}
    </form>
  );
}
export function initialAuthMode() {
  return "register";
}

export function WelcomePopup({ companyName, settings, onClose }) {
  const features = [
    [ShieldCheck, "Protected access", "Sign in securely with your registered details."],
    [Rocket, "Fast setup", "Create an account in a few simple steps."],
    [Gift, "Referral rewards", "Use an eligible referral code during registration."],
    [Headphones, "Customer support", "Get help from the support section whenever needed."],
  ];
  return <div className="welcome-popup-backdrop" role="presentation">
    <section className="welcome-popup" role="dialog" aria-modal="true" aria-labelledby="welcome-popup-title">
      <button className="welcome-popup-close" type="button" aria-label="Close welcome message" onClick={onClose}><X /></button>
      <CompanyLogo className="welcome-popup-brand" name={companyName} />
      <div className="welcome-popup-copy">
        <span>WELCOME</span>
        <h1 id="welcome-popup-title">{settings.title}</h1>
        <p>{settings.message}</p>
      </div>
      <div className="welcome-popup-features">
        {features.map(([Icon, title, detail]) => <article key={title}><i><Icon /></i><div><b>{title}</b><small>{detail}</small></div></article>)}
      </div>
      <div className="welcome-popup-art" aria-hidden="true"><div className="welcome-phone"><ShieldCheck /></div><div className="welcome-growth"><ArrowUp /></div></div>
      <button className="welcome-popup-continue" type="button" onClick={onClose}>{settings.buttonText}<ChevronRight /></button>
      <small className="welcome-popup-note">Review the applicable terms and information before using any service.</small>
    </section>
  </div>;
}

export function AuthScreen({ onAuthenticated, companyName, welcomePopup }) {
  const [mode, setMode] = useState(initialAuthMode),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [password, setPassword] = useState(""),
    [showWelcome, setShowWelcome] = useState(welcomePopup?.enabled !== false);
  useEffect(() => {
    if (!welcomePopup?.enabled) {
      setShowWelcome(false);
      trackVisitorStage("auth_viewed");
    }
  }, [welcomePopup?.enabled]);
  const closeWelcome = () => {
    setShowWelcome(false);
    trackVisitorStage("auth_viewed");
  };
  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setShowPassword(false);
    setPassword("");
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.email = payload.email.trim().toLowerCase();
    payload.visitor_id = anonymousTrackingId(localStorage, VISITOR_ID_KEY, "visitor");
    if (mode === "register" && payload.password !== payload.confirmPassword) {
      setBusy(false);
      setError("Passwords do not match.");
      return;
    }
    delete payload.confirmPassword;
    try {
      const response = await fetch(API_BASE + `/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error("Email or password is incorrect. New users must create an account first.");
        throw new Error(data.detail || "Authentication failed. Please try again.");
      }
      onAuthenticated(data);
    } catch (err) {
      setError(err instanceof TypeError ? "Cannot connect to the server. Please try again." : err.message);
    } finally { setBusy(false); }
  };
  const rules = [
    ["At least 8 characters", password.length >= 8],
    ["One number", /\d/.test(password)],
    ["One uppercase letter", /[A-Z]/.test(password)],
  ];
  return <main className="auth-page auth-page-v2">
    {showWelcome && welcomePopup?.enabled ? <WelcomePopup companyName={companyName} settings={welcomePopup} onClose={closeWelcome} /> : null}
    <section className="auth-card">
      <CompanyLogo className="auth-brand" name={companyName} />
      <div className="auth-heading">
        <h1>{mode === "login" ? "Welcome Back" : "Create Your Account"}</h1>
        <p>{mode === "login" ? "Sign in to continue to your account." : "Complete the form to create your account."}</p>
      </div>
      <div className="auth-security-note"><ShieldCheck /><span>Your connection is protected</span></div>
      <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Sign Up</button>
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Login</button>
      </div>
      <form className="auth-form auth-form-v2" onSubmit={submit}>
        {mode === "register" ? <label>Full Name<div className="auth-input-wrap"><UserRound /><input name="name" required minLength="2" autoComplete="name" placeholder="Enter your full name" /></div></label> : null}
        <label>Email Address<div className="auth-input-wrap"><Mail /><input name="email" required type="email" autoComplete="email" placeholder="Enter your email address" /></div></label>
        <label>Password<div className="password-input auth-input-wrap"><LockKeyhole /><input name="password" required type={showPassword ? "text" : "password"} minLength="8" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Enter your password" : "Create a strong password"} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {mode === "register" ? <div className="password-rules">{rules.map(([label, passed]) => <span className={passed ? "passed" : ""} key={label}><CheckCircle2 />{label}</span>)}</div> : null}
        {mode === "register" ? <label>Confirm Password<div className="auth-input-wrap"><LockKeyhole /><input name="confirmPassword" required type={showPassword ? "text" : "password"} minLength="8" autoComplete="new-password" placeholder="Repeat your password" /></div></label> : null}
        {mode === "register" ? <label>Have a referral code? <small>(Optional)</small><div className="auth-input-wrap"><Gift /><input name="referral_code" defaultValue={INITIAL_REFERRAL_CODE} maxLength="16" autoCapitalize="characters" placeholder="Enter referral code" /></div></label> : null}
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Login Securely" : "Create Free Account"}<ChevronRight /></button>
      </form>
      <p className="auth-switch-copy">{mode === "login" ? "New here?" : "Already have an account?"}<button className="auth-switch" type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Login"}</button></p>
      <div className="auth-privacy"><LockKeyhole /><div><b>We respect your privacy</b><small>Your account information is used only to provide and secure the requested services.</small></div></div>
    </section>
    <footer className="auth-trust-strip"><span><ShieldCheck />Protected connection</span><span><CheckCircle2 />Account verification</span><span><Headphones />Customer support</span></footer>
  </main>;
}
export function ReferralDetails({ referral, embedded = false }) {
  const [shareStatus, setShareStatus] = useState("");
  const referralLink = referral ? `${window.location.origin}/?ref=${referral.code}` : "";
  const shareReferral = async () => {
    if (!referral) return;
    const text = `Join BroCode with my referral code ${referral.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "BroCode Referral", text, url: referralLink });
      else await navigator.clipboard.writeText(referralLink);
      setShareStatus(navigator.share ? "Shared" : "Link copied");
    } catch (error) {
      if (error?.name !== "AbortError") setShareStatus("Could not share. Copy the code manually.");
    }
  };
  if (!referral) return <div className="empty">Referral information is loading.</div>;
  if (referral.unlocked === false) return <div className={`${embedded ? "profile-panel " : ""}referral-panel referral-locked`}>
    <div className="referral-lock-icon"><LockKeyhole /></div>
    <h3>Refer & Earn is locked</h3>
    <p>{referral.locked_message || "Make your first deposit to unlock Refer & Earn."}</p>
    <small>After your deposit is approved, your referral code and sharing options will appear here.</small>
  </div>;
  return <div className={`${embedded ? "profile-panel " : ""}referral-panel`}>
    <p>Earn ₹{money(referral.bonus)} after your referred friend makes an approved deposit and the admin approves the commission. One bonus per friend.</p>
    <section className="referral-commission-levels" aria-label="Referral commission levels">
      <div className="referral-level-heading"><span><Layers3 /> Commission Levels</span><small>Earn commission according to your referral level.</small></div>
      <div className="referral-level-grid">
        <article className="level-one"><span>Level 1</span><strong>10%</strong><small>Commission</small></article>
        <article className="level-two"><span>Level 2</span><strong>15%</strong><small>Commission</small></article>
        <article className="level-three"><span>Level 3</span><strong>25%</strong><small>Commission</small></article>
      </div>
    </section>
    <div className="referral-code"><span>Your referral code</span><b>{referral.code}</b></div>
    <div className="referral-stats"><span>Invited<b>{referral.invited_count}</b></span><span>Qualified<b>{referral.qualified_count ?? referral.rewarded_count}</b></span><span>Earned<b>₹{money(referral.earned)}</b></span></div>
    <button className="primary" type="button" onClick={shareReferral}>Share Referral Link</button>
    {shareStatus ? <small className="share-status">{shareStatus}</small> : null}
  </div>;
}

export function ReferralPage({ referral }) {
  return <section className="page referral-page">
    <h1>Refer & Earn</h1>
    <p className="referral-page-intro">Invite friends with your personal code and track every qualified referral here.</p>
    <ReferralDetails referral={referral} />
  </section>;
}

export const applicationStatus = {
  pending: { label: "Under Review", tone: "review" },
  requested: { label: "Under Review", tone: "review" },
  approved: { label: "Success", tone: "success" },
  paid: { label: "Success", tone: "success" },
  rejected: { label: "Rejected", tone: "rejected" },
};

export const withdrawalDateTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
};

export function ApplicationRecords({ records }) {
  const [filter, setFilter] = useState("all");
  const filteredRecords = filter === "all" ? records : records.filter((record) => record.type === filter);
  const visibleRecords = filter === "withdrawal" ? [...filteredRecords].sort((a, b) => b.receiptOrder - a.receiptOrder) : filteredRecords;
  return <div className="profile-panel application-records">
    <div className="application-filters" role="group" aria-label="Filter application records">
      {[['all', 'All'], ['recharge', 'Recharge'], ['withdrawal', 'Withdrawal']].map(([id, label]) => (
        <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>
      ))}
    </div>
    <div className="application-list">
      {visibleRecords.length ? visibleRecords.map((record) => {
        const status = applicationStatus[record.status] || { label: record.status, tone: "review" };
        const displayedAmount = record.type === "withdrawal" ? (record.receiptAmount ?? record.payoutAmount ?? record.amount) : record.amount;
        return <article className="application-card" key={record.id}>
          <div className="application-card-head"><b>{record.label || (record.type === "recharge" ? "Recharge" : "Withdrawal")}</b><span className={`application-status ${status.tone}`}>{status.label}</span></div>
          <div className="application-detail">
            <span>{record.currency ? <WalletCards /> : <IndianRupee />} {record.type === "withdrawal" ? "Amount after 5% fee" : "Amount"}</span>
            <b>{record.currency ? `${money(displayedAmount)} ${record.currency}` : `₹${money(displayedAmount)}`}</b>
          </div>
          {record.currency && record.feeInr != null ? <div className="application-detail"><span><IndianRupee /> Fee (15%)</span><b>₹{money(record.feeInr)}</b></div> : null}
          {record.currency && record.creditedInr != null ? <div className="application-detail"><span><WalletCards /> {record.status === "approved" ? "Wallet Credit" : "Expected Wallet Credit"}</span><b>₹{money(record.creditedInr)}</b></div> : null}
          <div className="application-detail"><span><FileText /> Reference</span><code>{record.reference}</code></div>
          <div className="application-detail"><span><CalendarDays /> {record.type === "withdrawal" ? "Receipt Date & Time" : "Application Date"}</span><b>{record.type === "withdrawal" ? withdrawalDateTime(record.receiptAt || record.createdAt) : new Date(record.createdAt).toLocaleString("en-IN")}</b></div>
        </article>;
      }) : <div className="empty compact">No {filter === "all" ? "application" : filter} records yet.</div>}
    </div>
  </div>;
}

export const supportTopics = [
  { id: "withdrawal", label: "Withdrawal Issue", answer: "Withdrawal requests remain Under Review until approved by the admin. Most requests are processed within 24 hours. Check Wallet > Application Records and keep your withdrawal reference number ready." },
  { id: "deposit", label: "Deposit Issue", answer: "For QR recharge, enter the correct 12-digit UTR after payment. For USDT recharge, submit the blockchain Transaction ID. QR recharges are normally reviewed within 1 hour; crypto deposits are credited after admin verification." },
  { id: "plans", label: "Plan Information", answer: "Open the Plans page to see price, duration, total return and purchase limit. The required amount must be available in your wallet. When an active plan completes, its applicable return is credited to the wallet." },
  { id: "pending", label: "Payment Pending", answer: "Do not submit the same UTR or crypto Transaction ID again. Open Wallet > Application Records to check the status. Under Review means the payment is waiting for admin verification; Success means it has been approved." },
  { id: "account", label: "Account & Login Help", answer: "Use the same registered email and password every time you sign in. Your 5-digit Customer ID is visible in Profile. Never share your password or verification details with anyone." },
  { id: "faqs", label: "FAQs", answer: "Minimum QR recharge is ₹100 and minimum USDT deposit is 2 USDT. A 15% conversion fee applies to USDT deposits." },
];

export function SupportChat() {
  const [messages, setMessages] = useState([{ from: "bot", text: "Hello! Choose an option below and I will help you instantly." }]);
  const selectTopic = (topic) => setMessages((current) => [...current, { from: "user", text: topic.label }, { from: "bot", text: topic.answer }]);
  return <div className="profile-panel support-chat">
    <div className="support-chat-head"><span className="support-agent"><Headphones /></span><div><b>Automatic Support</b><small>Online • Instant answers</small></div></div>
    <div className="support-messages" aria-live="polite">
      {messages.map((message, index) => <div className={`support-message ${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}
    </div>
    <div className="support-topics" aria-label="Support topics">
      {supportTopics.map((topic) => <button type="button" key={topic.id} onClick={() => selectTopic(topic)}>{topic.label}</button>)}
    </div>
  </div>;
}

export function HumanSupportChat({ api }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoData, setPhotoData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = React.useRef(null);
  const load = useCallback(async (silent = false) => {
    try {
      const data = await api("/api/support/chat");
      setMessages(data.messages || []);
      if (!silent) setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Human support chat could not load.");
    }
  }, [api]);
  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(true); }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);
  const send = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !photoData) || busy) return;
    setBusy(true); setError("");
    try {
      const sent = await api("/api/support/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, image_data: photoData || null, image_name: photo?.name || null }) });
      setMessages((current) => [...current, sent]);
      setDraft("");
      setPhoto(null);
      setPhotoData("");
    } catch (err) {
      setError(err.message || "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  };
  // Group messages by calendar day so the thread reads like a normal messenger.
  const dayLabel = (value) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(date, today)) return "Today";
    if (same(date, yesterday)) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  const clock = (value) => new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  let lastDay = null;

  return <div className="profile-panel support-chat human-support-chat">
    <div className="support-chat-head">
      <span className="support-agent human"><Headphones /></span>
      <div>
        <b>BroCode Support</b>
        <small>{busy ? "sending…" : "typically replies within a few hours"}</small>
      </div>
    </div>
    <div className="support-messages chat-thread" aria-live="polite">
      {!messages.length ? <div className="support-human-empty"><Headphones /><b>Start a conversation</b><span>Explain your issue and the admin team will reply here.</span></div> : null}
      {messages.map((message) => {
        const mine = message.sender === "user";
        const day = dayLabel(message.created_at);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <React.Fragment key={message.id}>
            {showDay ? <div className="chat-day"><span>{day}</span></div> : null}
            <div className={`chat-row ${mine ? "mine" : "theirs"}`}>
              <div className="chat-bubble">
                {message.image_data ? <img className="support-message-photo" src={message.image_data} alt={message.image_name || "Support attachment"} /> : null}
                {message.message ? <p>{message.message}</p> : null}
                <span className="chat-meta">
                  {clock(message.created_at)}
                  {mine ? <CheckCheck className={message.read_at ? "chat-read" : "chat-sent"} /> : null}
                </span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
    {error ? <div className="support-chat-error">{error}</div> : null}
    <form className="support-compose" onSubmit={send}>{photoData ? <div className="support-photo-preview"><img src={photoData} alt="Selected support attachment" /><span>{photo?.name}</span><button type="button" aria-label="Remove selected photo" onClick={() => { setPhoto(null); setPhotoData(""); }}><X /></button></div> : null}<div className="support-compose-row"><label className="support-photo-button" title="Attach photo"><ImageIcon /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError("Photo must be 2 MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => { setPhoto(file); setPhotoData(String(reader.result || "")); setError(""); }; reader.onerror = () => setError("Photo could not be opened."); reader.readAsDataURL(file); }} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1000" placeholder="Type your message for human support..." aria-label="Message for human support" /><button type="submit" disabled={busy || (!draft.trim() && !photoData)}>{busy ? "Sending..." : "Send"}</button></div></form>
  </div>;
}

export function FloatingDock({ api, unreadCount = 0, onOpenNotifications }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return <div className="floating-dock">
    {open ? <div className="support-dock" role="dialog" aria-label="Human support chat">
      <div className="support-dock-head">
        <span><Headphones /> Human Support</span>
        <button type="button" aria-label="Close support chat" onClick={() => setOpen(false)}><X /></button>
      </div>
      <HumanSupportChat api={api} />
    </div> : null}
    <div className="floating-dock-buttons">
      <button
        className="dock-fab notification-fab"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={onOpenNotifications}
      >
        <Bell />
        {unreadCount ? <span>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>
      <button
        className={`dock-fab support-fab${open ? " open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close support chat" : "Chat with human support"}
        onClick={() => setOpen((shown) => !shown)}
      >
        {open ? <X /> : <Headphones />}
      </button>
    </div>
  </div>;
}

export function SupportPage({ api, onBack }) {
  const [supportMode, setSupportMode] = useState(null);
  return <section className="page support-page">
    <div className="support-page-title">
      <button type="button" aria-label="Back to Profile" onClick={onBack}><ChevronRight /></button>
      <div><h1>Customer Support</h1><p>Choose instant answers or chat directly with the admin team</p></div>
    </div>
    {!supportMode ? <div className="support-mode-grid">
      <button type="button" onClick={() => setSupportMode("auto")}><span className="support-mode-icon auto"><Zap /></span><span><b>Auto Support</b><small>Instant answers for common account, payment and plan questions.</small></span><ChevronRight /></button>
      <button type="button" onClick={() => setSupportMode("human")}><span className="support-mode-icon human"><UserRound /></span><span><b>Human Support</b><small>Send a private message and receive replies from the admin dashboard.</small></span><ChevronRight /></button>
    </div> : <>
      <button className="support-change-mode" type="button" onClick={() => setSupportMode(null)}><ChevronRight /> Choose another support option</button>
      {supportMode === "auto" ? <SupportChat /> : <HumanSupportChat api={api} />}
    </>}
  </section>;
}

export const receiptFileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Could not read the selected receipt."));
  reader.readAsDataURL(file);
});

export const normalizePlanImageToDataUrl = (file) => new Promise((resolve, reject) => {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const width = 1536;
      const height = 1024;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image fitting is not supported in this browser.");
      canvas.width = width;
      canvas.height = height;

      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = 1;
      colorCanvas.height = 1;
      const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
      colorContext.drawImage(image, 0, 0, 1, 1);
      const [red, green, blue] = colorContext.getImageData(0, 0, 1, 1).data;
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(0, 0, width, height);

      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = Math.round(image.naturalWidth * scale);
      const drawHeight = Math.round(image.naturalHeight * scale);
      const drawX = Math.round((width - drawWidth) / 2);
      const drawY = Math.round((height - drawHeight) / 2);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/webp", 0.92));
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(sourceUrl);
    reject(new Error("The selected plan image could not be opened."));
  };
  image.src = sourceUrl;
});

export function WithdrawalBlogPage({ api, onBack }) {
  const [blog, setBlog] = useState({ posts: [], eligible_withdrawals: [] });
  const [applicationReceiptFile, setApplicationReceiptFile] = useState(null);
  const [successReceiptFile, setSuccessReceiptFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadBlog = useCallback(async () => {
    const data = await api("/api/withdrawal-blog");
    setBlog(data);
  }, [api]);
  useEffect(() => { loadBlog().catch((requestError) => setError(requestError.message)); }, [loadBlog]);
  const uploadReceipt = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    const linkedWithdrawalId = blog.eligible_withdrawals[0]?.id;
    if (!linkedWithdrawalId || !applicationReceiptFile || !successReceiptFile) { setError("A completed payment and both receipt images are required."); return; }
    if ([applicationReceiptFile, successReceiptFile].some((file) => file.size > 4 * 1024 * 1024)) { setError("Each receipt image must be 4 MB or smaller."); return; }
    setBusy(true);
    try {
      const [applicationImageData, successImageData] = await Promise.all([
        receiptFileToDataUrl(applicationReceiptFile),
        receiptFileToDataUrl(successReceiptFile),
      ]);
      await api("/api/withdrawal-blog", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ withdrawal_id: linkedWithdrawalId, application_image_data: applicationImageData, success_image_data: successImageData, caption }),
      });
      setApplicationReceiptFile(null); setSuccessReceiptFile(null); setCaption("");
      setMessage("Receipt published successfully.");
      await loadBlog();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const deletePost = async (postId) => {
    setDeletingId(postId); setError(""); setMessage("");
    try {
      await api(`/api/withdrawal-blog/${postId}/delete`, { method: "POST" });
      setDeleteConfirmId(null); setMessage("Blog post deleted successfully.");
      await loadBlog();
    } catch (requestError) { setError(requestError.message); }
    finally { setDeletingId(null); }
  };
  return <section className="page withdrawal-blog-page">
    <div className="support-page-title">
      <button type="button" aria-label="Back to Profile" onClick={onBack}><ChevronRight /></button>
      <div><h1>Blog</h1><p>Share your payment receipt</p></div>
    </div>
    <div className="receipt-privacy-note"><ShieldCheck /><span><b>Protect your privacy</b> Hide bank account, UPI ID, phone number, and transaction details before uploading. Published receipts are visible to signed-in users.</span></div>
    {blog.eligible_withdrawals.length ? <form className="receipt-upload-card" onSubmit={uploadReceipt}>
      <h2>Upload Receipts</h2>
      <label className="receipt-file-picker"><UploadCloud /><span><b>{applicationReceiptFile?.name || "Withdrawal application receipt"}</b><small>Receipt shown after submitting the application</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setApplicationReceiptFile(event.target.files?.[0] || null)} /></label>
      <label className="receipt-file-picker"><UploadCloud /><span><b>{successReceiptFile?.name || "Payment received receipt"}</b><small>Final payment proof • Maximum 4 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSuccessReceiptFile(event.target.files?.[0] || null)} /></label>
      <label>Caption (optional)</label>
      <input className="receipt-caption" value={caption} maxLength={140} onChange={(event) => setCaption(event.target.value)} placeholder="Received successfully" />
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="receipt-success">{message}</div> : null}
      <button className="primary" disabled={busy}>{busy ? "Publishing..." : "Publish Receipt"}</button>
    </form> : <div className="empty receipt-empty">Receipts can be uploaded after payment is completed.</div>}
    {error && !blog.eligible_withdrawals.length ? <div className="form-error blog-load-error">{error}</div> : null}
    <div className="blog-section-title"><h2>Community Receipts</h2><span>{blog.posts.length} post{blog.posts.length === 1 ? "" : "s"}</span></div>
    <div className="withdrawal-blog-feed">
      {blog.posts.length ? blog.posts.map((post) => <article className="withdrawal-blog-card" key={post.id}>
        <div className="blog-author"><span className="blog-avatar">{post.name.slice(0, 2).toUpperCase()}</span><span><b>{post.name}</b><small>Customer #{post.public_id} • {new Date(post.created_at).toLocaleDateString("en-IN")}</small></span></div>
        <div className={`receipt-pair${post.application_image_url ? "" : " single"}`}>
          {post.application_image_url ? <figure><figcaption>Withdrawal Application</figcaption><img src={post.application_image_url} alt={`Withdrawal application receipt from ${post.name}`} loading="lazy" /></figure> : null}
          <figure><figcaption>Payment Received</figcaption><img src={post.success_image_url} alt={`Payment receipt from ${post.name}`} loading="lazy" /></figure>
        </div>
        {post.caption ? <p>{post.caption}</p> : null}
        <div className="blog-card-footer"><small className="blog-reference">WD-{String(post.withdrawal_id).padStart(6, "0")}</small>{post.is_owner ? (deleteConfirmId === post.id ? <span className="blog-delete-confirm"><button type="button" onClick={() => setDeleteConfirmId(null)}>Cancel</button><button className="danger" type="button" disabled={deletingId === post.id} onClick={() => deletePost(post.id)}>{deletingId === post.id ? "Deleting..." : "Delete now"}</button></span> : <button className="blog-delete" type="button" onClick={() => setDeleteConfirmId(post.id)}>Delete</button>) : null}</div>
      </article>) : <div className="empty">No receipts have been published yet.</div>}
    </div>
  </section>;
}

export function Profile({ bank, onSave, onAction, onSupport, onBlog, user, balance, onLogout, activity, activePlans, referral, companyName }) {
  const [openPanel, setOpenPanel] = useState(null);
  const togglePanel = (panel) => setOpenPanel((current) => current === panel ? null : panel);
  const saveBankAndClose = async (data) => {
    await onSave(data);
    setOpenPanel(null);
  };
  return (
    <section className="page profile-page">
      {/* Identity, balance and quick stats are merged into one card so the page
          opens with a single focal block instead of three stacked bands. */}
      <section className="profile-card">
        <div className="profile-card-top">
          <div className="avatar">{user?.name?.slice(0, 2).toUpperCase()}</div>
          <div className="profile-identity">
            <h2>{user?.name}</h2>
            <p>{user?.email || "Telegram account connected"}</p>
          </div>
          {user?.public_id ? <span className="profile-id-chip">ID {user.public_id}</span> : null}
        </div>
        <div className="profile-balance-strip">
          <span>Available Balance</span>
          <strong>₹{money(balance)}</strong>
        </div>
        <div className="profile-quickstats">
          <div><b>{activePlans?.filter((p) => p.status === "active").length || 0}</b><small>Active plans</small></div>
          <div><b>{referral?.invited_count || 0}</b><small>Invited</small></div>
          <div><b>₹{money(referral?.earned || 0)}</b><small>Referral earned</small></div>
        </div>
      </section>
      <div className="actions actions-stacked">
        <button className="action-recharge" onClick={() => onAction("recharge")}>
          <ArrowDownToLine />
          Recharge
        </button>
        <button className="action-withdraw" onClick={() => onAction("withdraw")}>
          <ArrowUpFromLine />
          Withdraw
        </button>
      </div>
      {/* Two-up card grid. The expandable panels are rendered below the grid
          rather than inline, so opening one never splits a pair of cards. */}
      <div className="settings-grid">
        {[
          {
            key: "referral", icon: <Users />, title: "Refer & Earn",
            sub: referral ? (referral.unlocked === false ? "Deposit to unlock referrals" : `${referral.invited_count} invited • ₹${money(referral.earned)} earned`) : "Invite friends and earn",
          },
          {
            key: "bank", icon: <WalletCards />, title: "Bank Account",
            sub: bank ? `${bank.beneficiary} •••• ${bank.account.slice(-4)}` : "Add for withdrawal",
          },
          {
            key: "transactions", icon: <History />, title: "Transaction Records",
            sub: activity.length ? `${activity.length} record${activity.length === 1 ? "" : "s"}` : "No records yet",
          },
          {
            key: "plans", icon: <PackageCheck />, title: "Purchased Plans",
            sub: activePlans.length ? `${activePlans.length} purchased plan${activePlans.length === 1 ? "" : "s"}` : "No purchased plans yet",
          },
          { key: "blog", icon: <ImageIcon />, title: "Blog", sub: "Upload and view payment receipts", onClick: onBlog },
          { key: "company", icon: <Building2 />, title: "Company", sub: companyName },
          { key: "support", icon: <Headphones />, title: "Customer Support", sub: "Automatic help and quick answers", onClick: onSupport },
          { key: "policy", icon: <FileText />, title: "Recharge and Return Policy", sub: "Review recharge terms and financial risks" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`settings-card${openPanel === item.key ? " open" : ""}`}
            aria-expanded={item.onClick ? undefined : openPanel === item.key}
            onClick={item.onClick || (() => togglePanel(item.key))}
          >
            <i className="settings-card-icon">{item.icon}</i>
            <b>{item.title}</b>
            <small>{item.sub}</small>
            <ChevronRight className="settings-card-chevron" />
          </button>
        ))}
      </div>

      <div className="settings-panels">
        {openPanel === "referral" ? <ReferralDetails referral={referral} embedded /> : null}
        {openPanel === "bank" ? <BankForm bank={bank} onSave={saveBankAndClose} /> : null}
        {openPanel === "transactions" ? (
          <div className="profile-panel">
            {activity.length ? activity.map((item, index) => (
              <div className="profile-record" key={`${item.name}-${item.time}-${index}`}>
                <span><b>{item.name}</b><small>{item.time}</small></span>
                <strong>{item.amount ? `INR ${money(Math.abs(item.amount))}` : "--"}</strong>
              </div>
            )) : <div className="empty compact">No transaction records yet.</div>}
          </div>
        ) : null}
        {openPanel === "plans" ? (
          <div className="profile-panel purchased-preview">
            {activePlans.length ? activePlans.map((plan) => (
              <article key={plan.id} className="profile-plan">
                <div><b>{plan.name}</b><span className="profile-plan-status"><small>{plan.purchasedAt} - {plan.status === "completed" ? "Return Credited" : "Active"}</small>{plan.payoutMode === "daily" ? <em className="daily-withdrawal-badge">Daily Withdrawal</em> : null}</span></div>
                <span>Invested <b>INR {money(plan.invested)}</b></span>
                <span>Total Return <b>INR {money(plan.totalReturn)}</b></span>
              </article>
            )) : <div className="empty compact">Purchased plans will appear here.</div>}
          </div>
        ) : null}
        {openPanel === "company" ? (
          <div className="profile-panel company-preview">
            <b>{companyName}</b>
            <p>A digital platform for previewing wallet and fixed-duration plan experiences.</p>
          </div>
        ) : null}
        {openPanel === "policy" ? (
          <div className="profile-panel policy-panel">
            <h3>Recharge and Return Policy</h3>
            <p>All users must recharge only after carefully reviewing and understanding the platform's terms, conditions, risks, and service details.</p>
            <p>Any recharge or payment made on the platform is done entirely at the user's own risk and discretion. The platform does not guarantee any fixed profit, income, return, reward, or recovery of the recharged amount.</p>
            <p>Returns, rewards, bonuses, or benefits, if offered, may depend on the applicable plan, platform rules, eligibility conditions, market conditions, system availability, and successful completion of required activities.</p>
            <p>Users are solely responsible for checking all information before making a recharge. The platform, its owners, employees, partners, and representatives shall not be responsible for any financial loss, delayed return, reduced reward, account restriction, technical issue, or other loss arising from a user's decision to recharge.</p>
            <p>Once a recharge has been successfully processed, it may be non-refundable unless a refund is specifically required under applicable law or expressly permitted under the platform's refund policy.</p>
            <p>By making a recharge, the user confirms that:</p>
            <ol>
              <li>The recharge is being made voluntarily.</li>
              <li>The user understands the financial risks involved.</li>
              <li>No guaranteed return or profit has been promised.</li>
              <li>The user will not hold the platform responsible for any loss.</li>
              <li>The user has read and accepted all applicable terms and conditions.</li>
            </ol>
            <div className="policy-warning"><b>Important Notice:</b> Recharge only with an amount that you can afford to lose. Do not borrow money or use emergency funds to make a recharge.</div>
          </div>
        ) : null}
      </div>
      <div className="notice">
        <b>Important information</b>
        <p>Recharge requests are credited only after payment verification.</p>
      </div>
      <button className="logout" onClick={onLogout}>Sign Out</button>
    </section>
  );
}
export function WalletPage({ balance, activity, applications, onAction }) {
  const credited = activity.filter((a) => Number(a.amount) > 0).reduce((sum, a) => sum + Number(a.amount), 0);
  const debited = activity.filter((a) => Number(a.amount) < 0).reduce((sum, a) => sum + Math.abs(Number(a.amount)), 0);
  const pending = applications.filter((r) => r.status === "pending" || r.status === "awaiting_utr").length;
  return (
    <section className="page wallet-page">
      <h1>Wallet</h1>

      <section className="wallet-hero">
        <div className="wallet-hero-top">
          <span className="wallet-hero-label"><Wallet /> Available Balance</span>
          <span className="wallet-hero-chip">INR</span>
        </div>
        <strong className="wallet-hero-amount">₹{money(balance)}</strong>
        <div className="wallet-hero-meta">
          <span><ArrowDownToLine /> In ₹{money(credited)}</span>
          <span><ArrowUpFromLine /> Out ₹{money(debited)}</span>
        </div>
      </section>

      <div className="actions actions-stacked">
        <button className="action-recharge" onClick={() => onAction("recharge")}>
          <ArrowDownToLine />
          Recharge
        </button>
        <button className="action-withdraw" onClick={() => onAction("withdraw")}>
          <ArrowUpFromLine />
          Withdraw
        </button>
      </div>

      <div className="wallet-stats">
        <div className="wallet-stat">
          <i className="wallet-stat-in"><ArrowDownToLine /></i>
          <span>Total In<b>₹{money(credited)}</b></span>
        </div>
        <div className="wallet-stat">
          <i className="wallet-stat-out"><ArrowUpFromLine /></i>
          <span>Total Out<b>₹{money(debited)}</b></span>
        </div>
        <div className="wallet-stat">
          <i className="wallet-stat-pending"><Clock3 /></i>
          <span>Pending<b>{pending}</b></span>
        </div>
      </div>

      <section className="wallet-applications">
        <div className="section-title">
          <h2>Application Records</h2>
          <span>{applications.length} record{applications.length === 1 ? "" : "s"}</span>
        </div>
        <ApplicationRecords records={applications} />
      </section>

      <section className="wallet-history">
        <div className="section-title">
          <h2>Wallet Activity</h2>
          <span>{activity.length} entr{activity.length === 1 ? "y" : "ies"}</span>
        </div>
        {activity.length ? (
          <div className="wallet-ledger">
            {activity.map((a, i) => {
              const amount = Number(a.amount) || 0;
              return (
                <div className={`wallet-ledger-row ${amount < 0 ? "is-out" : "is-in"}`} key={i}>
                  <i>{amount < 0 ? <ArrowUpFromLine /> : <ArrowDownToLine />}</i>
                  <span>
                    <b>{a.name}</b>
                    <small>{a.time}</small>
                  </span>
                  <strong>{amount ? `${amount < 0 ? "−" : "+"}₹${money(Math.abs(amount))}` : "—"}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">No wallet activity yet.</div>
        )}
      </section>
    </section>
  );
}
export function StablePlanArtwork({ src, alt }) {
  const [ready, setReady] = useState(false);
  return <>
    {!ready ? <span className="plan-artwork-loading" aria-hidden="true"><i /></span> : null}
    <img
      className={`plan-artwork-image${ready ? " is-loaded" : ""}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setReady(true)}
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = "true";
          event.currentTarget.closest(".plan-visual")?.classList.add("plan-visual-empty");
        } else {
          setReady(true);
        }
      }}
    />
  </>;
}

export function Plan({ p, bought, onBuy, demo, companyName, vipActive = false, vipActivationPurchased = false }) {
  const remaining = Math.max(0, p.limit - bought);
  const limitExceeded = remaining === 0;
  const planLocked = Boolean(p.planLocked);
  const vipLocked = p.category === "vip" && p.vipLocked && !vipActive;
  const hasAmount = p.amount !== null && p.amount !== undefined && Number.isFinite(Number(p.amount));
  const hasTotalReturn = p.totalReturn !== null && p.totalReturn !== undefined && Number.isFinite(Number(p.totalReturn));
  const hasDailyEarning = p.dailyEarning !== null && p.dailyEarning !== undefined && Number.isFinite(Number(p.dailyEarning));
  const netGain = hasAmount && hasTotalReturn
    ? Number(p.totalReturn) - Number(p.amount)
    : null;
  const planGainPercent = netGain !== null && Number(p.amount) > 0
    ? Math.round((netGain / Number(p.amount)) * 100)
    : null;
  const planArtwork = PLAN_ARTWORK_BY_ID[p.id] || PLAN_ARTWORK_BY_AMOUNT[Number(p.amount)] || "";
  const hasUploadedArtwork = Boolean(
    p.imageUrl
    
    && (!planArtwork || p.imageAutoFit === true)
  );
  const planImageSource = hasUploadedArtwork ? p.imageUrl : planArtwork || "";
  const artworkClass = hasUploadedArtwork ? " uploaded-plan-art" : planArtwork ? " supplied-plan-art" : "";
  return (
    <article className={`plan-card professional-plan-card${p.comingSoon ? " coming-soon-plan" : ""}${planLocked ? " locked-plan" : ""}`}>
      <div className={`plan-visual plan-visual-${p.id}${artworkClass}`}>
        {planImageSource ? <StablePlanArtwork
          key={planImageSource}
          src={planImageSource}
          alt={`${companyName} plan growth illustration`}
        /> : null}
        <span className="plan-company">{companyName}</span>
        <span className="plan-verified"><ShieldCheck /> Plan details</span>
        <b className="plan-duration-badge">{durationLabel(p.days, p.durationUnit)}</b>
        {planGainPercent !== null ? <strong className="plan-gain-badge"><TrendingUp /> +{planGainPercent}% Plan gain</strong> : null}
      </div>
      <div className="plan-top">
        <div className="calendar">
          <CalendarDays />
        </div>
        <div>
          <h3>{p.name || `${durationLabel(p.days, p.durationUnit)} Plan`}</h3>
          <p>
            {planLocked
              ? "Locked • Temporarily unavailable"
              : vipLocked
              ? vipActivationPurchased ? "Locked • Awaiting admin VIP activation" : "Locked • Purchase the VIP Activation Plan first"
              : p.vipActivation
              ? "Activates access to locked VIP plans"
              : p.comingSoon
              ? "New plan launching soon"
              : p.payoutMode === "daily"
              ? `₹${money(p.dailyEarning)} credited daily • Daily withdrawal`
              : p.limit === 5
              ? `Up to 5 purchases • ${remaining} remaining`
              : "One-time plan"}
          </p>
        </div>
      </div>
      <div className="metrics">
        <div className="plan-metric plan-metric-invest">
          <i><WalletCards /></i>
          <span>Invest Amount<b>{hasAmount ? `₹${money(p.amount)}` : "To Be Announced"}</b></span>
        </div>
        <div className="plan-metric plan-metric-return">
          <i><TrendingUp /></i>
          <span>Total Return<b>{hasTotalReturn ? `₹${money(p.totalReturn)}` : "To Be Announced"}</b></span>
        </div>
        <div className="plan-metric plan-metric-revenue">
          <i><Layers3 /></i>
          <span>{p.payoutMode === "daily" ? "Daily Earning" : "Net Revenue"}<b>{p.payoutMode === "daily" ? (hasDailyEarning ? `₹${money(p.dailyEarning)}` : "To Be Announced") : (netGain !== null ? `₹${money(netGain)}` : "To Be Announced")}</b></span>
        </div>
        <div className="plan-metric plan-metric-duration">
          <i><Clock3 /></i>
          <span>Duration<b>{durationLabel(p.days, p.durationUnit)}</b></span>
        </div>
      </div>
      <div className="plan-assurance">
        <span><Clock3 /> Fixed duration</span>
        <span><Activity /> Track in Profile</span>
        <span><PackageCheck /> {p.limit === 5 ? `${remaining} of 5 available` : p.limit > 0 ? `${remaining} available` : "Plan update soon"}</span>
      </div>
      <button
        className="primary"
        disabled={planLocked || p.comingSoon || limitExceeded || demo || vipLocked}
        onClick={() => onBuy(p)}
      >
        {demo ? "Demo Preview" : planLocked ? "Plan Locked" : vipLocked ? vipActivationPurchased ? "VIP Approval Pending" : "VIP Locked" : p.comingSoon ? "Coming Soon" : limitExceeded ? "Limit Exceeded" : "Purchase Plan"}{" "}
        {planLocked || vipLocked ? <LockKeyhole /> : <ChevronRight />}
      </button>
    </article>
  );
}

export function PlansHub({ activePlans }) {
  const activeCount = activePlans.filter((plan) => plan.status === "active").length;
  return <section className="page plans-hub">
    <h1>My Earnings</h1>
    <section className="my-earnings plans-earnings">
      <div className="section-title"><h2>My Earnings</h2><span>{activeCount} Active</span></div>
      {activePlans.length ? activePlans.map((plan) => <article className="earning-card" key={plan.id}>
        <div><b>{plan.name}</b><div className="earning-card-status"><small>{plan.purchasedAt} • {plan.status === "completed" ? "Return Credited" : "Active"}</small>{plan.payoutMode === "daily" ? <span className="daily-withdrawal-badge">Daily Withdrawal</span> : null}</div></div>
        <div className="earning-grid"><span>Invested<b>₹{money(plan.invested)}</b></span><span>{plan.durationUnit === "hours" ? "Plan Earning" : "Daily Earning"}<b>₹{money(plan.durationUnit === "hours" ? plan.totalReturn - plan.invested : plan.dailyEarning)}</b></span><span>Total Return<b>₹{money(plan.totalReturn)}</b></span><span>Duration<b>{durationLabel(plan.days, plan.durationUnit)}</b></span></div>
      </article>) : <div className="empty">Purchased plans and earnings will appear here.</div>}
    </section>
  </section>;
}

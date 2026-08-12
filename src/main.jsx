import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Home,
  Layers3,
  WalletCards,
  UserRound,
  Plus,
  ArrowUpFromLine,
  ShieldCheck,
  ChevronRight,
  X,
  IndianRupee,
  CalendarDays,
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
import "./styles.css";
const defaultPlans = [
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
const durationLabel = (value, unit = "days") => `${value} ${unit === "hours" ? "Hour" : "Day"}${Number(value) === 1 ? "" : "s"}`;
const readCustomerSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const saved = JSON.parse(storage.getItem(TOKEN_KEY) || "null");
      if (saved?.token) return saved;
    } catch {}
  }
  return null;
};
const storeCustomerSession = (data, rememberLogin) => {
  const target = rememberLogin ? localStorage : sessionStorage;
  const other = rememberLogin ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  target.setItem(TOKEN_KEY, JSON.stringify(data));
};
const clearCustomerSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};
const PLAN_ARTWORK_BY_AMOUNT = {
  100: "/assets/plan-starter-wealth-mobile-fast.jpg",
  300: "/assets/plan-quick-growth-mobile-fast.jpg",
  570: "/assets/plan-elite-vip-wealth-mobile-fast.jpg",
  1000: "/assets/plan-smart-income-mobile-fast.jpg",
  1250: "/assets/power-hour-wealth-plan.png",
  5000: "/assets/plan-prime-wealth-mobile-fast.jpg",
  7500: "/assets/plan-ultimate-wealth-mobile-fast.jpg",
};
const PLAN_ARTWORK_BY_ID = {
  p1: "/assets/plan-starter-wealth-mobile-fast.jpg",
  p9: "/assets/plan-elite-vip-wealth-mobile-fast.jpg",
  p2: "/assets/plan-quick-growth-mobile-fast.jpg",
  p3: "/assets/plan-smart-income-mobile-fast.jpg",
  p4: "/assets/plan-prime-wealth-mobile-fast.jpg",
  p5: "/assets/plan-ultimate-wealth-mobile-fast.jpg",
  p16: "/assets/plan-royale-wealth-mobile-fast.jpg",
};
const cryptoAssetLabel = (coin) => coin?.startsWith("USDT") ? "USDT" : coin;
const newRequestKey = (prefix) => {
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${unique}`.replaceAll("-", "_");
};
const apiErrorMessage = (detail, fallback) => {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => typeof item === "string" ? item : item?.msg || item?.message).filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  if (detail && typeof detail === "object") return detail.message || detail.msg || fallback;
  return fallback;
};
const generateAdminPasswordSuggestion = () => {
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
function anonymousTrackingId(storage, key, prefix) {
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
function trackVisitorStage(stage) {
  const visitorId = anonymousTrackingId(localStorage, VISITOR_ID_KEY, "visitor");
  fetch("/api/analytics/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitor_id: visitorId, stage }),
    keepalive: true,
  }).catch(() => {});
}
function qrRotationStorageKey(method, customerId = "guest") {
  return `${QR_ROTATION_KEY}.${customerId}.${method === "manual" ? "manual-uploaded" : "auto-generated"}`;
}
function paymentQrPriority(qr) {
  const label = `${qr.adminLabel || ""} ${qr.payee || ""}`.toLowerCase();
  if (label.includes("devraj")) return 0;
  if (label.includes("jayesh")) return 1;
  return 2;
}
function orderedPaymentQrs(rows) {
  return [...rows].sort((left, right) => paymentQrPriority(left) - paymentQrPriority(right) || Number(left.id) - Number(right.id));
}
function currentPaymentQrIndex(qrCount, method = "auto", customerId = "guest") {
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
function BroCodeMark({ className = "bc-mark" }) {
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
function CompanyLogo({ className = "", name = COMPANY_NAME }) {
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
function Modal({ type, onClose, onAdd, onRechargeStarted, onPendingRecharge, onCryptoRecharge, bank, paymentQrs, cryptoWallets, minimumRecharge = 100, rechargePresets = DEFAULT_RECHARGE_PRESETS, minimumWithdrawal = 1000, withdrawalAvailable = true, withdrawalMessage = "", customerId = "guest", assignedManualQrId = null }) {
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

function ResultModal({ result, onClose }) {
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

function TelegramJoinModal({ onClose, companyName, telegramUrl = DEFAULT_TELEGRAM_URL }) {
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

function NotificationPanel({ notifications, onClose, onMarkAll }) {
  return <div className="notification-backdrop" onMouseDown={onClose}><section className="notification-panel" aria-label="Notifications" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><p>Latest updates</p><h2>Notifications</h2></div><button className="close" type="button" aria-label="Close notifications" onClick={onClose}><X /></button></header>
    {notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={item.isRead ? "" : "unread"} key={item.id}><span className="notification-dot" /><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("en-IN")}</small></div></article>)}</div> : <div className="empty">No notifications yet.</div>}
    {notifications.some((item) => !item.isRead) ? <button className="primary" type="button" onClick={onMarkAll}>Mark all as read</button> : null}
  </section></div>;
}

function PlanPurchaseModal({ plan, bought, onClose, onConfirm }) {
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

function BankForm({ bank, onSave }) {
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
function initialAuthMode() {
  return "register";
}

function WelcomePopup({ companyName, settings, onClose }) {
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

function AuthScreen({ onAuthenticated, companyName, welcomePopup }) {
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
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
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
function ReferralDetails({ referral, embedded = false }) {
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

function ReferralPage({ referral }) {
  return <section className="page referral-page">
    <h1>Refer & Earn</h1>
    <p className="referral-page-intro">Invite friends with your personal code and track every qualified referral here.</p>
    <ReferralDetails referral={referral} />
  </section>;
}

const applicationStatus = {
  pending: { label: "Under Review", tone: "review" },
  requested: { label: "Under Review", tone: "review" },
  approved: { label: "Success", tone: "success" },
  paid: { label: "Success", tone: "success" },
  rejected: { label: "Rejected", tone: "rejected" },
};

const withdrawalDateTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
};

function ApplicationRecords({ records }) {
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

const supportTopics = [
  { id: "withdrawal", label: "Withdrawal Issue", answer: "Withdrawal requests remain Under Review until approved by the admin. Most requests are processed within 24 hours. Check Wallet > Application Records and keep your withdrawal reference number ready." },
  { id: "deposit", label: "Deposit Issue", answer: "For QR recharge, enter the correct 12-digit UTR after payment. For USDT recharge, submit the blockchain Transaction ID. QR recharges are normally reviewed within 1 hour; crypto deposits are credited after admin verification." },
  { id: "plans", label: "Plan Information", answer: "Open the Plans page to see price, duration, total return and purchase limit. The required amount must be available in your wallet. When an active plan completes, its applicable return is credited to the wallet." },
  { id: "pending", label: "Payment Pending", answer: "Do not submit the same UTR or crypto Transaction ID again. Open Wallet > Application Records to check the status. Under Review means the payment is waiting for admin verification; Success means it has been approved." },
  { id: "account", label: "Account & Login Help", answer: "Use the same registered email and password every time you sign in. Your 5-digit Customer ID is visible in Profile. Never share your password or verification details with anyone." },
  { id: "faqs", label: "FAQs", answer: "Minimum QR recharge is ₹100 and minimum USDT deposit is 2 USDT. A 15% conversion fee applies to USDT deposits." },
];

function SupportChat() {
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

function HumanSupportChat({ api }) {
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
  return <div className="profile-panel support-chat human-support-chat">
    <div className="support-chat-head"><span className="support-agent human"><UserRound /></span><div><b>Human Support</b><small>Admin team • Replies appear here</small></div></div>
    <div className="support-messages" aria-live="polite">
      {!messages.length ? <div className="support-human-empty"><Headphones /><b>Start a conversation</b><span>Explain your issue and the admin team will reply here.</span></div> : null}
      {messages.map((message) => <div className={`support-message ${message.sender === "user" ? "user" : "bot human-admin"}`} key={message.id}>{message.image_data ? <img className="support-message-photo" src={message.image_data} alt={message.image_name || "Support attachment"} /> : null}{message.message ? <span>{message.message}</span> : null}<small>{new Date(message.created_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "2-digit", month: "short" })}</small></div>)}
      <div ref={bottomRef} />
    </div>
    {error ? <div className="support-chat-error">{error}</div> : null}
    <form className="support-compose" onSubmit={send}>{photoData ? <div className="support-photo-preview"><img src={photoData} alt="Selected support attachment" /><span>{photo?.name}</span><button type="button" aria-label="Remove selected photo" onClick={() => { setPhoto(null); setPhotoData(""); }}><X /></button></div> : null}<div className="support-compose-row"><label className="support-photo-button" title="Attach photo"><ImageIcon /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError("Photo must be 2 MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => { setPhoto(file); setPhotoData(String(reader.result || "")); setError(""); }; reader.onerror = () => setError("Photo could not be opened."); reader.readAsDataURL(file); }} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1000" placeholder="Type your message for human support..." aria-label="Message for human support" /><button type="submit" disabled={busy || (!draft.trim() && !photoData)}>{busy ? "Sending..." : "Send"}</button></div></form>
  </div>;
}

function FloatingDock({ api, unreadCount = 0, onOpenNotifications }) {
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

function SupportPage({ api, onBack }) {
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

const receiptFileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Could not read the selected receipt."));
  reader.readAsDataURL(file);
});

const normalizePlanImageToDataUrl = (file) => new Promise((resolve, reject) => {
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

function WithdrawalBlogPage({ api, onBack }) {
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

function Profile({ bank, onSave, onAction, onSupport, onBlog, user, balance, onLogout, activity, activePlans, referral, companyName }) {
  const [openPanel, setOpenPanel] = useState(null);
  const togglePanel = (panel) => setOpenPanel((current) => current === panel ? null : panel);
  const saveBankAndClose = async (data) => {
    await onSave(data);
    setOpenPanel(null);
  };
  return (
    <section className="page">
      <h1>Profile</h1>
      <div className="profile-head">
        <div className="avatar">{user?.name?.slice(0, 2).toUpperCase()}</div>
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.email || "Telegram account connected"}</p>
          {user?.public_id ? <span className="customer-id">Customer ID: <b>{user.public_id}</b></span> : null}
        </div>
      </div>
      <section className="balance profile-balance">
        <div>
          <span>Available Balance</span>
          <strong>₹{money(balance)}</strong>
          <small>Available wallet balance</small>
        </div>
        <WalletCards />
      </section>
      <div className="actions">
        <button onClick={() => onAction("recharge")}>
          <Plus />
          Recharge
        </button>
        <button onClick={() => onAction("withdraw")}>
          <ArrowUpFromLine />
          Withdraw
        </button>
      </div>
      <div className="settings">
        <button className="settings-row" type="button" onClick={() => togglePanel("referral")} aria-expanded={openPanel === "referral"}>
          <Users />
          <span><b>Refer & Earn</b><small>{referral ? referral.unlocked === false ? "Deposit to unlock referrals" : `${referral.invited_count} invited • ₹${money(referral.earned)} earned` : "Invite friends and earn"}</small></span>
          <ChevronRight className={openPanel === "referral" ? "row-chevron open" : "row-chevron"} />
        </button>
        {openPanel === "referral" ? <ReferralDetails referral={referral} embedded /> : null}
        <button className="settings-row" type="button" onClick={() => togglePanel("bank")} aria-expanded={openPanel === "bank"}>
          <WalletCards />
          <span>
            <b>Bank Account</b>
            <small>
              {bank
                ? `${bank.beneficiary} •••• ${bank.account.slice(-4)}`
                : "Add for withdrawal"}
            </small>
          </span>
          <ChevronRight className={openPanel === "bank" ? "row-chevron open" : "row-chevron"} />
        </button>
        {openPanel === "bank" ? <BankForm bank={bank} onSave={saveBankAndClose} /> : null}
        <button className="settings-row" type="button" onClick={() => togglePanel("transactions")} aria-expanded={openPanel === "transactions"}>
          <History />
          <span><b>Transaction Records</b><small>{activity.length ? `${activity.length} record${activity.length === 1 ? "" : "s"}` : "No records yet"}</small></span>
          <ChevronRight className={openPanel === "transactions" ? "row-chevron open" : "row-chevron"} />
        </button>
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
        <button className="settings-row" type="button" onClick={() => togglePanel("plans")} aria-expanded={openPanel === "plans"}>
          <PackageCheck />
          <span><b>Purchased Plans</b><small>{activePlans.length ? `${activePlans.length} purchased plan${activePlans.length === 1 ? "" : "s"}` : "No purchased plans yet"}</small></span>
          <ChevronRight className={openPanel === "plans" ? "row-chevron open" : "row-chevron"} />
        </button>
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
        <button className="settings-row" type="button" onClick={onBlog}>
          <ImageIcon />
          <span><b>Blog</b><small>Upload and view payment receipts</small></span>
          <ChevronRight />
        </button>
        <button className="settings-row" type="button" onClick={() => togglePanel("company")} aria-expanded={openPanel === "company"}>
          <Building2 />
          <span><b>Company</b><small>{companyName}</small></span>
          <ChevronRight className={openPanel === "company" ? "row-chevron open" : "row-chevron"} />
        </button>
        {openPanel === "company" ? (
          <div className="profile-panel company-preview">
            <b>{companyName}</b>
            <p>A digital platform for previewing wallet and fixed-duration plan experiences.</p>
          </div>
        ) : null}
        <button className="settings-row" type="button" onClick={onSupport}>
          <Headphones />
          <span><b>Customer Support</b><small>Automatic help and quick answers</small></span>
          <ChevronRight />
        </button>
        <button className="settings-row" type="button" onClick={() => togglePanel("policy")} aria-expanded={openPanel === "policy"}>
          <FileText />
          <span><b>Recharge and Return Policy</b><small>Review recharge terms and financial risks</small></span>
          <ChevronRight className={openPanel === "policy" ? "row-chevron open" : "row-chevron"} />
        </button>
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
function WalletPage({ balance, activity, applications, onAction }) {
  return (
    <section className="page wallet-page">
      <h1>Wallet</h1>
      <section className="balance">
        <div>
          <span>Available Balance</span>
          <strong>₹{money(balance)}</strong>
          <small>Available wallet balance</small>
        </div>
        <WalletCards />
      </section>
      <div className="actions">
        <button onClick={() => onAction("recharge")}>
          <Plus />
          Recharge
        </button>
        <button onClick={() => onAction("withdraw")}>
          <ArrowUpFromLine />
          Withdraw
        </button>
      </div>
      <section className="wallet-applications">
        <div className="section-title">
          <h2>Application Records</h2>
          <span>{applications.length} record{applications.length === 1 ? "" : "s"}</span>
        </div>
        <ApplicationRecords records={applications} />
      </section>
      <section className="recent">
        <div className="section-title">
          <h2>Wallet Activity</h2>
        </div>
        {activity.length ? (
          activity.map((a, i) => (
            <div className="activity" key={i}>
              <CheckCircle2 />
              <span>
                <b>{a.name}</b>
                <small>{a.time}</small>
              </span>
              <strong>
                {a.amount ? `₹${money(Math.abs(a.amount))}` : "—"}
              </strong>
            </div>
          ))
        ) : (
          <div className="empty">No wallet activity yet.</div>
        )}
      </section>
    </section>
  );
}
function StablePlanArtwork({ src, alt }) {
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
          event.currentTarget.src = "/assets/nivesh-plan-banner.webp";
        } else {
          setReady(true);
        }
      }}
    />
  </>;
}

function Plan({ p, bought, onBuy, demo, companyName, vipActive = false, vipActivationPurchased = false }) {
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
    && p.imageUrl !== "/assets/nivesh-plan-banner.webp"
    && (!planArtwork || p.imageAutoFit === true)
  );
  const planImageSource = hasUploadedArtwork ? p.imageUrl : planArtwork || "/assets/nivesh-plan-banner.webp";
  const artworkClass = hasUploadedArtwork ? " uploaded-plan-art" : planArtwork ? " supplied-plan-art" : "";
  return (
    <article className={`plan-card professional-plan-card${p.comingSoon ? " coming-soon-plan" : ""}${planLocked ? " locked-plan" : ""}`}>
      <div className={`plan-visual plan-visual-${p.id}${artworkClass}`}>
        <StablePlanArtwork
          key={planImageSource}
          src={planImageSource}
          alt={`${companyName} plan growth illustration`}
        />
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

function PlansHub({ activePlans }) {
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
const ADMIN_TOKEN_KEY = "nivesh.admin.session.v1";
const ADMIN_THEME_KEY = "nivesh.admin.theme.v1";
const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN") : "Never";
const INDIA_TIME_ZONE = "Asia/Kolkata";
const USER_REPORTING_START_DATE = "2026-07-12";
const indiaDateKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: INDIA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const indiaDateLabelFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: INDIA_TIME_ZONE, weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const indiaDateKey = (value) => {
  const parts = Object.fromEntries(indiaDateKeyFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const indiaDateLabel = (dateKey) => indiaDateLabelFormatter.format(new Date(`${dateKey}T12:00:00+05:30`));

function AdminUserTable({ users, busy, onAction }) {
  return <table className="admin-user-table"><thead><tr><th>Status</th><th>Customer ID</th><th>User</th><th>VIP Access</th><th>Referred by</th><th>System ID</th><th>Balance</th><th>Created</th><th>Last seen</th><th>Password</th><th>Login Access</th><th>Withdrawal Access</th><th>Account Control</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}>
    <td><span className={`status ${u.is_disabled ? "rejected" : u.is_online ? "online" : "offline"}`}>{u.is_disabled ? "Disabled" : u.is_online ? "Online" : "Offline"}</span></td>
    <td><span className="public-id">{u.public_id}</span></td>
    <td><b>{u.name}</b><small>{u.email || "No email"}</small></td>
    <td>{u.vip_approved_at ? <div className="vip-access-control"><span className="status approved">VIP Active</span><small>{u.vip_activation_purchased ? "Activation plan purchased" : "Manually approved by admin"}</small><button className="vip-deactivate" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/vip-deactivate`)}>Deactivate VIP</button></div> : <div className="vip-access-control"><span className={`status ${u.vip_activation_purchased ? "pending" : "offline"}`}>{u.vip_activation_purchased ? "Plan purchased" : "Not purchased"}</span><small>{u.vip_activation_purchased ? "Ready for your approval" : "Check manually before activation"}</small><button className="vip-activate" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/vip-activate`)}>Activate VIP</button></div>}</td>
    <td>{u.referrer_public_id ? <span className="public-id">SC{u.referrer_public_id}</span> : <small>Direct</small>}</td><td><code>{u.id}</code></td><td>₹{money(u.balance)}</td><td>{dateTime(u.created_at)}</td><td>{dateTime(u.last_seen_at)}</td><td><span className="secure-password"><LockKeyhole /> Encrypted</span></td>
    <td><div className="login-access-control"><span className={`status ${u.remember_login ? "approved" : "pending"}`}>{u.remember_login ? "Auto Login ON" : "Login Required"}</span><small>{u.remember_login ? "Opens automatically after one login" : "Login again after browser closes"}</small><button className={u.remember_login ? "require-login" : "allow-login"} disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/persistent-login/${u.remember_login ? "disable" : "enable"}`)}>{u.remember_login ? "Require Login" : "Allow Auto Login"}</button></div></td>
    <td><div className="withdrawal-access-control"><span className={`status ${u.withdrawal_enabled ? "approved" : "rejected"}`}>{u.withdrawal_enabled ? "Withdrawal ON" : "Withdrawal OFF"}</span><small>{u.withdrawal_enabled ? "User can request ₹1,000 or more" : "Admin can enable access directly"}</small>{u.withdrawal_enabled ? <button className="withdrawal-disable" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/withdrawal/disable`)}>Turn Withdrawal OFF</button> : <button className="withdrawal-enable" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/withdrawal/enable`)}>Turn Withdrawal ON</button>}</div></td>
    <td><div className="row-actions">{u.is_disabled ? <button className="approve" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/enable`)}>Enable</button> : <button className="reject" disabled={busy} onClick={() => onAction(`/api/admin/users/${u.id}/disable`)}>Disable</button>}<button className="delete" disabled={busy} onClick={() => { if (window.confirm("Delete this fake account from the dashboard? Users with financial records can only be disabled.")) onAction(`/api/admin/users/${u.id}/archive`); }}>Delete ID</button></div></td>
  </tr>)}</tbody></table>;
}

function AdminDailyUsers({ users, allUsers, busy, onAction, hasSearch }) {
  const todayKey = indiaDateKey(Date.now());
  const validUsers = users.filter((user) => Number.isFinite(new Date(user.created_at).getTime()));
  const validAllUsers = allUsers.filter((user) => Number.isFinite(new Date(user.created_at).getTime()));
  const oldestKey = validAllUsers.reduce((oldest, user) => {
    const key = indiaDateKey(user.created_at);
    return key < oldest ? key : oldest;
  }, USER_REPORTING_START_DATE);
  const days = [];
  for (let offset = 0; ; offset += 1) {
    const dateKey = indiaDateKey(Date.now() - offset * 24 * 60 * 60 * 1000);
    days.push(dateKey);
    if (dateKey <= oldestKey) break;
  }
  const groupedUsers = new Map(days.map((dateKey) => [dateKey, []]));
  validUsers.forEach((user) => groupedUsers.get(indiaDateKey(user.created_at))?.push(user));
  return <div className="admin-daily-users">
    <div className="admin-daily-users-intro"><div><b>Daily User Registrations</b><small>India time (IST) • one table for every date</small></div><span>{days.length} days</span></div>
    {days.map((dateKey, index) => {
      const dayUsers = groupedUsers.get(dateKey) || [];
      const relativeLabel = index === 0 ? "Today" : index === 1 ? "Yesterday" : "";
      return <details className="admin-user-day" key={dateKey} open={index === 0}>
        <summary><div><ChevronRight /><span><b>{relativeLabel ? `${relativeLabel} • ` : ""}{indiaDateLabel(dateKey)}</b><small>{dateKey}</small></span></div><div className="admin-user-day-actions"><strong>{dayUsers.length} {dayUsers.length === 1 ? "user" : "users"}</strong><span className="admin-table-toggle-label"><i>View Table</i><em>Hide Table</em></span></div></summary>
        <div className="admin-user-day-table">{dayUsers.length ? <AdminUserTable users={dayUsers} busy={busy} onAction={onAction} /> : <div className="admin-user-day-empty">{hasSearch ? "No matching users registered on this date." : "No new users registered on this date."}</div>}</div>
      </details>;
    })}
  </div>;
}

function AdminBalanceControl({ users, allUsers, adjustments, busy, onAdjust }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Bonus");
  const selectedUser = allUsers.find((user) => user.id === selectedUserId);
  useEffect(() => {
    if (!selectedUserId && users.length) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);
  const submit = async (operation) => {
    const value = Number(amount);
    if (!selectedUser || !Number.isInteger(value) || value < 1 || note.trim().length < 2) return;
    if (operation === "debit" && !window.confirm(`Deduct ₹${money(value)} from ${selectedUser.name}?`)) return;
    await onAdjust(selectedUser.id, { operation, amount: value, note: note.trim() });
    setAmount("");
  };
  return <div className="admin-balance-control">
    <section className="admin-balance-editor">
      <header><div><span><IndianRupee /></span><div><b>Balance Control</b><small>Add bonuses or deduct money from any customer wallet.</small></div></div><em>Every change is recorded in Activity</em></header>
      {selectedUser ? <div className="admin-selected-wallet"><div><span>Selected customer</span><b>{selectedUser.name} <small>#{selectedUser.public_id}</small></b><code>{selectedUser.email || selectedUser.id}</code></div><div><span>Current balance</span><strong>₹{money(selectedUser.balance)}</strong></div></div> : <div className="admin-balance-empty">Search and select a customer below.</div>}
      <div className="admin-balance-form">
        <label>Amount<input type="number" min="1" max="2000000000" step="1" placeholder="Enter any amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Reason / note<input maxLength="120" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bonus, correction, refund..." /></label>
        <button className="admin-credit-button" type="button" disabled={busy || !selectedUser || !(Number(amount) > 0) || note.trim().length < 2} onClick={() => submit("credit")}><Plus /> Add Amount</button>
        <button className="admin-debit-button" type="button" disabled={busy || !selectedUser || !(Number(amount) > 0) || note.trim().length < 2} onClick={() => submit("debit")}><ArrowDown /> Deduct Amount</button>
      </div>
    </section>
    <section className="admin-balance-users"><header><div><b>Choose Customer</b><small>Use the search bar above to find by name, email, customer code or system ID.</small></div><span>{users.length} users</span></header>
      {users.length ? <table><thead><tr><th>Customer</th><th>Customer ID</th><th>Current Balance</th><th>Status</th><th>Select</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className={selectedUserId === user.id ? "selected" : ""}><td><b>{user.name}</b><small>{user.email || user.id}</small></td><td><span className="public-id">#{user.public_id}</span></td><td><b>₹{money(user.balance)}</b></td><td><span className={`status ${user.is_disabled ? "rejected" : user.is_online ? "online" : "offline"}`}>{user.is_disabled ? "Disabled" : user.is_online ? "Online" : "Offline"}</span></td><td><button type="button" onClick={() => setSelectedUserId(user.id)}>{selectedUserId === user.id ? "Selected" : "Manage Balance"}</button></td></tr>)}</tbody></table> : <div className="admin-balance-empty">No matching customer found.</div>}
    </section>
    <section className="admin-balance-history"><header><div><b>Recent Admin Adjustments</b><small>Latest bonuses and deductions made from this control.</small></div><span>{adjustments.length} records</span></header>
      {adjustments.length ? <table><thead><tr><th>User</th><th>Change</th><th>Reason / Reference</th><th>Date</th></tr></thead><tbody>{adjustments.map((item) => <tr key={item.id}><td><b>{item.name} <span className="inline-public-id">#{item.public_id}</span></b><small>{item.email}</small></td><td className={item.amount >= 0 ? "amount-positive" : "amount-negative"}>{item.amount >= 0 ? "+" : "−"}₹{money(Math.abs(item.amount))}</td><td><code>{item.reference}</code></td><td>{dateTime(item.created_at)}</td></tr>)}</tbody></table> : <div className="admin-balance-empty">No admin balance changes yet.</div>}
    </section>
  </div>;
}

const receiptEditorValue = (value) => {
  const date = new Date(value || Date.now());
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { date: `${parts.day}/${parts.month}/${parts.year}`, time: `${parts.hour}:${parts.minute}` };
};

const parseReceiptEditorValue = (dateValue, timeValue) => {
  const match = dateValue.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match || !/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T${timeValue}:00+05:30`);
  if (!Number.isFinite(parsed.getTime())) return null;
  const normalized = receiptEditorValue(parsed);
  return normalized.date === `${day}/${month}/${year}` && normalized.time === timeValue ? parsed : null;
};
const formatReceiptDateInput = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
};

function AdminWithdrawalReceiptTimeRow({ withdrawal, busy, onSave, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const initialReceiptAt = receiptEditorValue(withdrawal.receipt_at || withdrawal.created_at);
  const [receiptDate, setReceiptDate] = useState(initialReceiptAt.date);
  const [receiptTime, setReceiptTime] = useState(initialReceiptAt.time);
  const [receiptAmount, setReceiptAmount] = useState(withdrawal.receipt_amount ?? withdrawal.payout_amount ?? withdrawal.amount);
  const [receiptReference, setReceiptReference] = useState(withdrawal.receipt_reference || withdrawal.reference || `WD-${String(withdrawal.id).padStart(6, "0")}`);
  useEffect(() => {
    const next = receiptEditorValue(withdrawal.receipt_at || withdrawal.created_at);
    setReceiptDate(next.date);
    setReceiptTime(next.time);
  }, [withdrawal.receipt_at, withdrawal.created_at]);
  useEffect(() => setReceiptAmount(withdrawal.receipt_amount ?? withdrawal.payout_amount ?? withdrawal.amount), [withdrawal.receipt_amount, withdrawal.payout_amount, withdrawal.amount]);
  useEffect(() => setReceiptReference(withdrawal.receipt_reference || withdrawal.reference || `WD-${String(withdrawal.id).padStart(6, "0")}`), [withdrawal.receipt_reference, withdrawal.reference, withdrawal.id]);
  const save = () => {
    const parsed = parseReceiptEditorValue(receiptDate, receiptTime);
    if (!parsed || !receiptReference.trim() || !Number.isInteger(Number(receiptAmount)) || Number(receiptAmount) < 0) return;
    onSave(withdrawal.id, parsed.toISOString(), Number(receiptAmount), receiptReference.trim());
  };
  const validReceiptDateTime = Boolean(parseReceiptEditorValue(receiptDate, receiptTime));
  return <tr><td><code>{withdrawal.receipt_reference || withdrawal.reference}</code></td><td><b>{withdrawal.name} <span className="inline-public-id">#{withdrawal.public_id}</span></b><small>{withdrawal.email}</small></td><td><small>Original: ₹{money(withdrawal.payout_amount ?? withdrawal.amount)}</small></td><td><span className={`status ${withdrawal.status}`}>{withdrawal.status}</span></td><td><small>Original: {withdrawalDateTime(withdrawal.created_at)}</small></td><td><div className="admin-receipt-edit-fields"><label className="receipt-reference-field">Reference Number<input type="text" maxLength="80" placeholder="Enter receipt reference" value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} /></label><label>Receipt Amount<input type="number" min="0" max="2000000000" step="1" value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} /></label><label>Date (DD/MM/YYYY)<input type="text" inputMode="numeric" maxLength="10" placeholder="DD/MM/YYYY" value={receiptDate} onChange={(event) => setReceiptDate(formatReceiptDateInput(event.target.value))} /></label><label>Time<input type="time" value={receiptTime} onChange={(event) => setReceiptTime(event.target.value)} /></label></div></td><td><div className="admin-receipt-row-actions"><button className="approve" type="button" disabled={busy || !validReceiptDateTime || !receiptReference.trim() || !(Number(receiptAmount) >= 0)} onClick={save}>Save This Receipt</button><button type="button" disabled={busy || !canMoveUp} onClick={onMoveUp}><ArrowUp /> Move Up</button><button type="button" disabled={busy || !canMoveDown} onClick={onMoveDown}><ArrowDown /> Move Down</button><button className="delete-receipt" type="button" disabled={busy} onClick={() => onDelete(withdrawal)}><Trash2 /> Delete Receipt</button></div></td></tr>;
}

function AdminWithdrawalReceiptTime({ allWithdrawals, users, busy, onSave, onDelete, onReorder, onAdjustBalance }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("Receipt balance adjustment");
  const visibleWithdrawals = allWithdrawals.filter((withdrawal) => !withdrawal.receipt_hidden_at);
  const allCustomers = [...new Map(visibleWithdrawals.map((withdrawal) => [withdrawal.user_id, { id: withdrawal.user_id, name: withdrawal.name, publicId: withdrawal.public_id, email: withdrawal.email }])).values()];
  const normalizedSearch = customerSearch.trim().toLowerCase().replace(/^#/, "");
  const customers = allCustomers.filter((customer) => !normalizedSearch || [customer.name, customer.email, customer.publicId, customer.id, `sc${customer.publicId}`].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)));
  const [selectedUserId, setSelectedUserId] = useState(customers[0]?.id || "");
  useEffect(() => {
    if (!customers.some((customer) => customer.id === selectedUserId)) setSelectedUserId(customers[0]?.id || "");
  }, [customerSearch, allWithdrawals, selectedUserId]);
  const selectedCustomer = allCustomers.find((customer) => customer.id === selectedUserId);
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedReceipts = visibleWithdrawals.filter((withdrawal) => withdrawal.user_id === selectedUserId).sort((a, b) => (Number(b.receipt_sort_order) || b.id) - (Number(a.receipt_sort_order) || a.id));
  const moveReceipt = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedReceipts.length) return;
    const next = [...selectedReceipts];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onReorder(selectedUserId, next.map((receipt) => receipt.id));
  };
  const adjustSelectedWallet = async (operation) => {
    const amount = Number(walletAmount);
    if (!selectedUser || !Number.isInteger(amount) || amount < 1 || walletNote.trim().length < 2) return;
    if (operation === "debit" && !window.confirm(`Deduct ₹${money(amount)} from ${selectedUser.name}'s wallet?`)) return;
    await onAdjustBalance(selectedUser.id, { operation, amount, note: walletNote.trim() });
    setWalletAmount("");
  };
  return <div className="admin-receipt-time-control">
    <header><div><span><CalendarDays /></span><div><b>Withdrawal Receipt Date & Time</b><small>Select one customer to see all of their receipts, then change each receipt separately.</small></div></div><em>{selectedReceipts.length} receipts</em></header>
    <div className="admin-receipt-customer-search"><Search /><input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search user by name, customer code, email or ID..." /><span>{customers.length} matching users</span></div>
    {customers.length ? <div className="admin-receipt-customer-picker"><label>Matching customer<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} • #{customer.publicId} • {customer.email}</option>)}</select></label>{selectedCustomer ? <div><span>Showing all withdrawal receipts for</span><b>{selectedCustomer.name} <small>#{selectedCustomer.publicId}</small></b><code>{selectedCustomer.email}</code></div> : null}</div> : <div className="admin-balance-empty">No user found with this name or customer code.</div>}
    {selectedUser ? <section className="admin-receipt-wallet-control"><div className="admin-receipt-wallet-summary"><span>Selected User Wallet Balance</span><b>{selectedUser.name} <small>#{selectedUser.public_id}</small></b><strong>₹{money(selectedUser.balance)}</strong></div><div className="admin-receipt-wallet-form"><label>Amount<input type="number" min="1" max="2000000000" step="1" placeholder="Enter amount" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} /></label><label>Reason<input type="text" maxLength="120" value={walletNote} onChange={(event) => setWalletNote(event.target.value)} /></label><button className="wallet-credit" type="button" disabled={busy || !(Number(walletAmount) > 0) || walletNote.trim().length < 2} onClick={() => adjustSelectedWallet("credit")}><Plus /> Add to Wallet</button><button className="wallet-debit" type="button" disabled={busy || !(Number(walletAmount) > 0) || walletNote.trim().length < 2} onClick={() => adjustSelectedWallet("debit")}><ArrowDown /> Deduct from Wallet</button></div></section> : null}
    {selectedReceipts.length ? <table><thead><tr><th>Receipt</th><th>Customer</th><th>Original Amount</th><th>Status</th><th>Original Request Time</th><th>Receipt Amount, Date & Time</th><th>Action & Order</th></tr></thead><tbody>{selectedReceipts.map((withdrawal, index) => <AdminWithdrawalReceiptTimeRow key={withdrawal.id} withdrawal={withdrawal} busy={busy} onSave={onSave} onDelete={onDelete} canMoveUp={index > 0} canMoveDown={index < selectedReceipts.length - 1} onMoveUp={() => moveReceipt(index, -1)} onMoveDown={() => moveReceipt(index, 1)} />)}</tbody></table> : <div className="admin-balance-empty">Search for a customer above to show all of their withdrawal receipts.</div>}
  </div>;
}

function AdminVisitorAnalytics({ visitors, recentVisits, daily, stats }) {
  const maxVisits = Math.max(1, ...daily.map((item) => item.visits || 0));
  const visitorStage = (visitor) => {
    if (visitor.last_action === "logged_in") return ["Logged in", "approved"];
    if (visitor.last_action === "registered") return ["Registered", "approved"];
    if (visitor.last_action === "auth_viewed") return ["Account page viewed", "pending"];
    return ["Popup only / Not registered", "offline"];
  };
  return <div className="admin-visitor-analytics">
    <div className="visitor-summary-grid">
      <article><Globe2 /><span>Unique visitors</span><strong>{stats?.unique_visitors || 0}</strong><small>Anonymous browsers since tracking started</small></article>
      <article><MousePointerClick /><span>Total visits</span><strong>{stats?.total_visits || 0}</strong><small>New browser sessions</small></article>
      <article><Users /><span>Today</span><strong>{stats?.unique_today || 0}</strong><small>{stats?.visits_today || 0} visits today (IST)</small></article>
      <article><TrendingUp /><span>Signup conversion</span><strong>{stats?.signup_conversion_percent || 0}%</strong><small>{stats?.users || 0} registered accounts</small></article>
    </div>
    <section className="visitor-daily-panel">
      <header><div><b>Last 30 Days</b><small>Daily visits and unique visitors in India time (IST)</small></div><span>{stats?.visits_24h || 0} visits in last 24 hours</span></header>
      <div className="visitor-chart">{daily.map((item) => <article key={item.date}><div><span style={{ width: `${Math.max(item.visits ? 4 : 0, (item.visits / maxVisits) * 100)}%` }} /></div><b>{item.visits}</b><small>{indiaDateLabel(item.date)}</small><em>{item.unique_visitors} unique</em></article>)}</div>
    </section>
    <section className="visitor-recent-panel">
      <header><div><b>Visitor Records</b><small>Every browser receives a permanent sequential VIS code, including popup-only visitors.</small></div><span>{visitors.length} visitors</span></header>
      {visitors.length ? <table><thead><tr><th>Visitor code</th><th>Journey status</th><th>Linked user</th><th>Visits</th><th>Source</th><th>First seen</th><th>Last seen</th></tr></thead><tbody>{visitors.map((visitor) => {
        const [stageLabel, stageClass] = visitorStage(visitor);
        return <tr key={visitor.id}><td><code className="visitor-code">{visitor.visitor_code}</code></td><td><span className={`status ${stageClass}`}>{stageLabel}</span></td><td>{visitor.registered_user_id ? <><b>{visitor.name}</b><small>{visitor.email}<br />Customer ID #{visitor.public_id}</small></> : <><b>Unregistered visitor</b><small>No email submitted</small></>}</td><td><b>{visitor.visit_count}</b></td><td>{visitor.first_referrer || "Direct link"}</td><td>{dateTime(visitor.first_seen_at)}</td><td>{dateTime(visitor.last_seen_at)}</td></tr>;
      })}</tbody></table> : <div className="admin-empty">No visitors recorded yet. The next website visitor will receive VIS1 automatically.</div>}
    </section>
    <section className="visitor-recent-panel">
      <header><div><b>Recent Visit Sessions</b><small>Latest website entries linked to their permanent VIS code.</small></div><span>{recentVisits.length} shown</span></header>
      {recentVisits.length ? <table><thead><tr><th>Visitor code</th><th>Page reached</th><th>Source</th><th>Visit time</th></tr></thead><tbody>{recentVisits.map((visit) => <tr key={visit.id}><td><code>{visit.visitor_code}</code></td><td>{visit.path === "/" ? "Website entry / welcome popup" : visit.path}</td><td>{visit.referrer || "Direct link"}</td><td>{dateTime(visit.created_at)}</td></tr>)}</tbody></table> : <div className="admin-empty">No visit sessions recorded yet.</div>}
    </section>
  </div>;
}

function AdminOverview({ data, busy, onNavigate, onRefresh }) {
  const stats = data?.stats || {};
  const users = data?.users || [];
  const visitors = data?.visitors || [];
  const pendingRecharges = (data?.recharges || []).filter((item) => ["pending", "awaiting_utr"].includes(item.status));
  const pendingWithdrawals = (data?.withdrawals || []).filter((item) => item.status === "requested");
  const pendingCrypto = (data?.crypto_recharges || []).filter((item) => item.status === "pending");
  const pendingReferrals = (data?.referrals || []).filter((item) => item.status === "pending");
  const todayKey = indiaDateKey(Date.now());
  const todayUsers = users.filter((user) => user.created_at && indiaDateKey(user.created_at) === todayKey).length;
  const unregisteredVisitors = visitors.filter((visitor) => !visitor.registered_user_id).length;
  const attentionTotal = pendingRecharges.length + pendingWithdrawals.length + pendingCrypto.length + pendingReferrals.length;
  const latestActivity = [
    ...(data?.recharges || []).map((item) => ({ id: `recharge-${item.id}`, type: "Recharge", label: item.reference || `Recharge #${item.id}`, person: item.name || item.email || "Customer", amount: item.amount, status: item.status, time: item.created_at, section: "recharges" })),
    ...(data?.withdrawals || []).map((item) => ({ id: `withdrawal-${item.id}`, type: "Withdrawal", label: item.reference || `Withdrawal #${item.id}`, person: item.name || item.email || "Customer", amount: item.payout_amount ?? item.amount, status: item.status, time: item.created_at, section: "withdrawals" })),
    ...users.map((item) => ({ id: `user-${item.id}`, type: "New user", label: `Customer #${item.public_id}`, person: item.name || item.email || "New account", status: item.is_disabled ? "disabled" : "active", time: item.created_at, section: "users" })),
  ].filter((item) => Number.isFinite(new Date(item.time).getTime())).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
  const priorityCards = [
    { id: "recharges", label: "Recharge review", count: pendingRecharges.length, detail: `${stats.awaiting_utr || 0} awaiting UTR`, tone: "green", icon: IndianRupee },
    { id: "withdrawals", label: "Withdrawal review", count: pendingWithdrawals.length, detail: "Payment decisions pending", tone: "purple", icon: WalletCards },
    { id: "crypto", label: "Crypto review", count: pendingCrypto.length, detail: "Transaction IDs to verify", tone: "blue", icon: ShieldCheck },
    { id: "referrals", label: "Referral review", count: pendingReferrals.length, detail: "Rewards awaiting approval", tone: "amber", icon: Gift },
  ];
  const quickTools = [
    ["visitors", "Visitor intelligence", "Track VIS codes and journeys", Globe2],
    ["users", "User management", "VIP access and account control", Users],
    ["payment_qrs", "Payment QR control", "Add, update, or remove QR codes", ImageIcon],
    ["plan_catalog", "Plan settings", "Manage plans, images, and order", Layers3],
    ["notifications", "Send an update", "Notify every registered user", Bell],
    ["app_settings", "App settings", "Company name and welcome popup", Building2],
  ];
  return <div className="admin-overview">
    <section className="overview-command-hero">
      <div>
        <span className="overview-eyebrow"><Activity /> Operations Command Center</span>
        <h2>Everything important, in one place.</h2>
        <p>Review pending work, monitor growth, and reach every admin control without searching through the dashboard.</p>
      </div>
      <div className="overview-hero-actions">
        <span className={attentionTotal ? "needs-attention" : "all-clear"}><i /> {attentionTotal ? `${attentionTotal} items need attention` : "All queues are clear"}</span>
        <button onClick={onRefresh} disabled={busy}><RefreshCw className={busy ? "spin" : ""} /> Refresh data</button>
      </div>
    </section>

    <div className="overview-section-heading"><div><span>Priority queue</span><h3>Work requiring your approval</h3></div><small>Open a card to review its full records</small></div>
    <section className="overview-priority-grid">
      {priorityCards.map((card) => {
        const Icon = card.icon;
        return <button className={`overview-priority-card ${card.tone}`} key={card.id} onClick={() => onNavigate(card.id)}>
          <i><Icon /></i><div><span>{card.label}</span><strong>{card.count}</strong><small>{card.detail}</small></div><ChevronRight />
        </button>;
      })}
    </section>

    <section className="overview-metric-grid">
      <article><span>Visitors today</span><strong>{stats.visits_today || 0}</strong><small>{stats.unique_today || 0} unique browsers</small><Globe2 /></article>
      <article><span>New users today</span><strong>{todayUsers}</strong><small>{users.length} total accounts</small><UserPlus /></article>
      <article><span>Signup conversion</span><strong>{stats.signup_conversion_percent || 0}%</strong><small>{unregisteredVisitors} unregistered visitors</small><TrendingUp /></article>
      <article><span>Approved recharges</span><strong>₹{money(stats.approved_recharge_amount || 0)}</strong><small>All-time approved value</small><IndianRupee /></article>
      <article><span>Online now</span><strong>{stats.online || 0}</strong><small>Live customer sessions</small><Zap /></article>
    </section>

    <section className="overview-main-grid">
      <div className="overview-card overview-activity">
        <header><div><span>Live feed</span><h3>Recent activity</h3></div><button onClick={() => onNavigate("activity")}>View all <ChevronRight /></button></header>
        <div className="overview-activity-list">{latestActivity.length ? latestActivity.map((item) => <button key={item.id} onClick={() => onNavigate(item.section)}>
          <i className={`activity-dot ${item.type.toLowerCase().replace(" ", "-")}`} />
          <div><b>{item.type}</b><span>{item.person} · {item.label}</span></div>
          <div className="activity-meta">{item.amount != null ? <strong>₹{money(item.amount)}</strong> : null}<small>{dateTime(item.time)}</small></div>
          <span className={`status ${item.status}`}>{item.status}</span>
        </button>) : <div className="overview-empty">Recent activity will appear here.</div>}</div>
      </div>
      <div className="overview-side-column">
        <div className="overview-card overview-quick-tools">
          <header><div><span>Shortcuts</span><h3>Quick tools</h3></div></header>
          <div>{quickTools.map(([id, title, copy, Icon]) => <button key={id} onClick={() => onNavigate(id)}><i><Icon /></i><span><b>{title}</b><small>{copy}</small></span><ChevronRight /></button>)}</div>
        </div>
        <div className="overview-card overview-system-status">
          <header><div><span>System</span><h3>Service status</h3></div><span className="system-healthy"><i /> Healthy</span></header>
          <div><span><ShieldCheck /> Backend connection</span><b>Connected</b></div>
          <div><span><Clock3 /> Automatic refresh</span><b>Every 20 sec</b></div>
          <div><span><RefreshCw /> Last synced</span><b>{dateTime(data?.generated_at)}</b></div>
        </div>
      </div>
    </section>
  </div>;
}

function AdminQrPreview({ upiId, payee, imageUrl = "" }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (imageUrl) { setSrc(imageUrl); return undefined; }
    let cancelled = false;
    const id = setTimeout(async () => {
      if (!upiId.trim() || !payee.trim()) { setSrc(""); return; }
      try {
        const { default: QRCode } = await import("qrcode");
        const paymentUrl = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payee.trim())}&cu=INR`;
        const next = await QRCode.toDataURL(paymentUrl, { width: 220, margin: 2, errorCorrectionLevel: "M" });
        if (!cancelled) setSrc(next);
      } catch { if (!cancelled) setSrc(""); }
    }, 150);
    return () => { cancelled = true; clearTimeout(id); };
  }, [upiId, payee, imageUrl]);
  return <div className="admin-qr-preview">{src ? <img src={src} alt="Payment QR preview" /> : <span>QR preview</span>}</div>;
}

function readUpiPaymentQr(rawValue) {
  const value = String(rawValue || "").trim();
  if (!/^upi:\/\/pay\?/i.test(value)) throw new Error("This is not a UPI payment QR. Upload the original UPI receive-payment QR.");
  const parsed = new URL(value);
  const upiId = (parsed.searchParams.get("pa") || "").trim();
  const payee = (parsed.searchParams.get("pn") || "").trim();
  if (!/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(upiId)) throw new Error("The uploaded QR does not contain a valid UPI ID.");
  return { upiId, payee: payee || "UPI Payment" };
}

function automaticPayeeName(upiId, adminLabel = "", payee = "") {
  const savedName = String(payee || "").trim();
  if (savedName) return savedName;
  const caption = String(adminLabel || "").trim();
  if (caption) return caption;
  const handle = String(upiId || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return handle || "UPI Payment";
}

async function decodeUpiQrImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose a PNG, JPG or WebP QR image.");
  if (file.size > 4 * 1024 * 1024) throw new Error("QR image must be 4 MB or smaller.");
  const imageData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("QR image could not be read."));
    reader.readAsDataURL(file);
  });
  let upiId = "manualqr@payment", payee = "Manual QR", decoded = false;
  if (!("BarcodeDetector" in window)) return { upiId, payee, decoded, imageData, imageName: file.name };
  const bitmap = await createImageBitmap(file);
  try {
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(bitmap);
    if (codes.length) {
      try {
        const details = readUpiPaymentQr(codes[0].rawValue);
        upiId = details.upiId;
        payee = details.payee;
        decoded = true;
      } catch { /* The original uploaded QR is still valid for manual display. */ }
    }
    return { upiId, payee, decoded, imageData, imageName: file.name };
  } finally {
    bitmap.close?.();
  }
}

function AdminQrUpload({ disabled, compact = false, onDecoded }) {
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const chooseQr = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReading(true);
    setFailed(false);
    setNotice("Reading QR image…");
    try {
      const decoded = await decodeUpiQrImage(file);
      onDecoded(decoded);
      setNotice(decoded.decoded ? `QR uploaded • ${decoded.upiId}` : "QR uploaded • original image will be shown directly");
    } catch (err) {
      setFailed(true);
      setNotice(err.message || "QR image could not be read.");
    } finally {
      setReading(false);
    }
  };
  return <div className={`admin-qr-upload ${compact ? "compact" : ""} ${failed ? "failed" : ""}`}>
    <label className={disabled || reading ? "disabled" : ""}>
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || reading} onChange={chooseQr} />
      <UploadCloud />
      <span><b>{reading ? "Reading uploaded QR…" : compact ? "Replace using QR image" : "Upload existing UPI QR image"}</b><small>{compact ? "UPI details will be filled automatically" : "The image is read on this device; the old QR system stays active"}</small></span>
    </label>
    {notice ? <p>{notice}</p> : null}
  </div>;
}

function AdminQrRow({ qr, busy, onSave, onRemove }) {
  const [upiId, setUpiId] = useState(qr.upi_id);
  const [payee, setPayee] = useState(qr.payee);
  const [adminLabel, setAdminLabel] = useState(qr.admin_label || qr.payee);
  const [replacementImage, setReplacementImage] = useState("");
  useEffect(() => { setUpiId(qr.upi_id); setPayee(qr.payee); setAdminLabel(qr.admin_label || qr.payee); setReplacementImage(""); }, [qr.upi_id, qr.payee, qr.admin_label, qr.image_url]);
  const resolvedPayee = automaticPayeeName(upiId, adminLabel, payee);
  return <form className="admin-qr-card" onSubmit={(event) => { event.preventDefault(); onSave(qr.id, { upi_id: upiId, payee: resolvedPayee, admin_label: adminLabel, source: qr.source || "manual", image_data: replacementImage || null }); }}>
    <div className="admin-qr-card-head"><div><div className="admin-qr-number">QR {qr.id}</div><b>{adminLabel || "Unnamed QR"}</b><small>Admin only</small></div><AdminQrPreview upiId={upiId} payee={resolvedPayee} imageUrl={(qr.source === "uploaded" && (replacementImage || qr.image_url)) || ""} /></div>
    {qr.source === "uploaded" ? <AdminQrUpload compact disabled={busy} onDecoded={(decoded) => { setUpiId(decoded.upiId); setPayee(decoded.payee); setReplacementImage(decoded.imageData); }} /> : null}
    <label>Internal caption / owner name<input value={adminLabel} onChange={(event) => setAdminLabel(event.target.value)} required maxLength="80" /></label>
    <label>UPI ID<input value={upiId} onChange={(event) => setUpiId(event.target.value)} required /></label>
    <label>Payee name (optional)<input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder={`Automatic: ${automaticPayeeName(upiId, adminLabel)}`} /></label>
    <div className="admin-qr-actions"><button className="approve" disabled={busy}>Save Changes</button><button className="reject" type="button" disabled={busy} onClick={() => onRemove(qr.id)}>Remove QR</button></div>
  </form>;
}

function AdminQrManager({ qrs, busy, onSave, onRemove }) {
  const [uploadedUpiId, setUploadedUpiId] = useState("");
  const [uploadedPayee, setUploadedPayee] = useState("");
  const [uploadedLabel, setUploadedLabel] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const addUploadedQr = async (event) => {
    event.preventDefault();
    const saved = await onSave(null, { upi_id: uploadedUpiId, payee: automaticPayeeName(uploadedUpiId, uploadedLabel, uploadedPayee), admin_label: uploadedLabel, source: "uploaded", image_data: uploadedImage });
    if (saved) { setUploadedUpiId(""); setUploadedPayee(""); setUploadedLabel(""); setUploadedImage(""); }
  };
  const uploadedQrs = qrs.filter((qr) => qr.source === "uploaded");
  return <div className="admin-qr-manager">
    <div className="admin-qr-intro"><b>Manual Recharge QR Management</b><p>Auto-generated amount QR is disabled. Customers only see their assigned uploaded manual QR.</p></div>
    <section className="admin-qr-system selected">
      <header><div><b>Manual Payment QR System</b><p>The original uploaded QR is shown directly. Customers enter the amount manually and submit UTR.</p></div><span>Only Active System</span></header>
      <AdminQrUpload disabled={busy} onDecoded={(decoded) => { setUploadedUpiId(decoded.upiId); setUploadedPayee(decoded.payee); setUploadedImage(decoded.imageData); setUploadedLabel((current) => current || decoded.payee); }} />
      <form className="admin-qr-add uploaded" onSubmit={addUploadedQr}>
        <input placeholder="Internal caption / owner name" value={uploadedLabel} onChange={(event) => setUploadedLabel(event.target.value)} required maxLength="80" />
        <input placeholder="UPI ID read from image" value={uploadedUpiId} readOnly required />
        <input placeholder="Payee name (automatic)" value={uploadedPayee} readOnly />
        <button className="primary" disabled={busy || !uploadedImage}>Add Manual Payment QR</button>
      </form>
      <div className="admin-qr-grid">{uploadedQrs.map((qr) => <AdminQrRow key={qr.id} qr={qr} busy={busy} onSave={onSave} onRemove={onRemove} />)}</div>
    </section>
  </div>;
}

function AdminCryptoWallet({ wallet, busy, onSave, onRemove }) {
  const [address, setAddress] = useState(wallet.address || "");
  useEffect(() => setAddress(wallet.address || ""), [wallet.address]);
  return <form className="admin-crypto-wallet" onSubmit={(event) => { event.preventDefault(); onSave(wallet.coin, address); }}>
    <div><b>{wallet.label || cryptoAssetLabel(wallet.coin)}</b><span>{wallet.network}</span></div>
    <input value={address} onChange={(event) => setAddress(event.target.value.replace(/\s/g, ""))} placeholder={`${wallet.label || cryptoAssetLabel(wallet.coin)} receiving address`} required minLength="8" />
    <button className="approve" disabled={busy}>Save</button>
    <button className="reject" type="button" disabled={busy || !wallet.address} onClick={() => onRemove(wallet.coin)}>Remove</button>
  </form>;
}

function AdminCryptoManager({ wallets, requests, busy, onSave, onRemove, onAction }) {
  return <div className="admin-crypto-manager">
    <div className="admin-qr-intro"><b>Crypto Recharge Management</b><p>Configure one receiving address for each supported network. Customer applications and Transaction IDs appear below for manual verification.</p></div>
    <div className="admin-crypto-wallets">{wallets.map((wallet) => <AdminCryptoWallet key={wallet.coin} wallet={wallet} busy={busy} onSave={onSave} onRemove={onRemove} />)}</div>
    <div className="admin-crypto-requests">
      <h3>Crypto Applications</h3>
      {requests.length ? requests.map((request) => <article className="admin-crypto-request" key={request.id}>
        <div><b>{request.name} <span className="inline-public-id">#{request.public_id}</span></b><small>{request.email}<br /><code>{request.user_id}</code></small></div>
        <div><span>Coin / Network</span><b>{cryptoAssetLabel(request.coin)} · {request.network}</b></div>
        <div><span>Deposited Amount</span><b>{money(request.amount_inr)} {cryptoAssetLabel(request.coin)}</b></div>
        {request.gross_inr != null ? <div><span>Gross INR Conversion</span><b>₹{money(request.gross_inr)}</b></div> : null}
        {request.fee_inr != null ? <div><span>Conversion Fee (15%)</span><b>−₹{money(request.fee_inr)}</b></div> : null}
        {request.credited_inr != null ? <div><span>Wallet Credit</span><b>₹{money(request.credited_inr)}</b></div> : null}
        <div className="crypto-long-value"><span>Transaction ID</span><code>{request.txid}</code></div>
        <div className="crypto-long-value"><span>Receiving address used</span><code>{request.address}</code></div>
        <div><span>Submitted</span><b>{dateTime(request.created_at)}</b></div>
        <div>{request.status === "pending" ? <div className="row-actions"><button className="approve" disabled={busy} onClick={() => onAction(`/api/admin/crypto-recharges/${request.id}/approve`)}>Approve & Credit{request.credited_inr != null ? ` ₹${money(request.credited_inr)}` : ""}</button><button className="reject" disabled={busy} onClick={() => onAction(`/api/admin/crypto-recharges/${request.id}/reject`)}>Reject</button></div> : <span className={`status ${request.status}`}>{request.status}</span>}</div>
      </article>) : <div className="admin-empty">No crypto applications yet.</div>}
    </div>
  </div>;
}

function AdminRequestFilters({ section, timeRange, status, customFrom, customTo, rows, pendingRows, selectableRows, selectedCount, selectedPendingCount, selectedDeleteCount, busy, onSectionChange, onTimeRangeChange, onStatusChange, onCustomFromChange, onCustomToChange, onToggleAll, onBulkAction, bulkConfirm, onCancelBulk, onConfirmBulk }) {
  const statuses = section === "recharges"
    ? [["all", "All statuses"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["awaiting_utr", "Awaiting UTR"]]
    : [["all", "All statuses"], ["requested", "Pending"], ["paid", "Approved / Paid"], ["rejected", "Rejected"]];
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length;
  const actionLabel = bulkConfirm === "approve" ? (section === "withdrawals" ? "Mark paid" : "Approve") : bulkConfirm === "reject" ? "Reject" : "Delete";
  const confirmCount = bulkConfirm === "archive" ? selectedDeleteCount : selectedPendingCount;
  return <section className="admin-request-filters">
    <div className="admin-filter-grid">
      <label>Request type<select value={section} onChange={(event) => onSectionChange(event.target.value)}><option value="recharges">Recharge requests</option><option value="withdrawals">Withdrawal requests</option></select></label>
      <label>Time period<select value={timeRange} onChange={(event) => onTimeRangeChange(event.target.value)}><option value="all">All time</option>{Array.from({ length: 24 }, (_, index) => index + 1).map((hours) => <option key={hours} value={`${hours}h`}>Last {hours} hour{hours === 1 ? "" : "s"}</option>)}<option value="48h">Last 48 hours</option><option value="72h">Last 72 hours</option><option value="7d">Last 7 days</option><option value="custom">Custom date & time</option></select></label>
      <label>Status<select value={status} onChange={(event) => onStatusChange(event.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {timeRange === "custom" ? <div className="admin-custom-dates"><label>From<input type="datetime-local" value={customFrom} onChange={(event) => onCustomFromChange(event.target.value)} /></label><label>To<input type="datetime-local" value={customTo} onChange={(event) => onCustomToChange(event.target.value)} /></label></div> : null}
    <div className="admin-filter-summary"><span><b>{rows.length}</b> matching requests</span><span><b>₹{money(totalAmount)}</b> total amount</span><span><b>{pendingRows.length}</b> pending actions</span></div>
    <div className="admin-bulk-toolbar">
      <button type="button" onClick={onToggleAll} disabled={!selectableRows.length || busy}>{allSelected ? "Clear selection" : "Select all shown"}</button>
      <span>{selectedCount} selected</span>
      <button type="button" className="approve" onClick={() => onBulkAction("approve")} disabled={!selectedPendingCount || busy}>{section === "withdrawals" ? `Mark paid (${selectedPendingCount})` : `Approve (${selectedPendingCount})`}</button>
      <button type="button" className="reject" onClick={() => onBulkAction("reject")} disabled={!selectedPendingCount || busy}>{section === "withdrawals" ? `Reject + refund (${selectedPendingCount})` : `Reject (${selectedPendingCount})`}</button>
      <button type="button" className="delete" onClick={() => onBulkAction("archive")} disabled={!selectedDeleteCount || busy}>Delete ({selectedDeleteCount})</button>
    </div>
    {bulkConfirm ? <div className="admin-bulk-confirm" role="alertdialog" aria-label="Confirm bulk action"><div><b>Confirm bulk {actionLabel.toLowerCase()}</b><small>{bulkConfirm === "archive" ? `This will remove ${confirmCount} selected request${confirmCount === 1 ? "" : "s"} from the dashboard. Submitted recharge audit entries remain safely archived.` : `This will update ${confirmCount} pending ${section === "recharges" ? "recharge" : "withdrawal"} request${confirmCount === 1 ? "" : "s"}.`}</small></div><button type="button" onClick={onCancelBulk} disabled={busy}>Cancel</button><button type="button" className={bulkConfirm === "approve" ? "approve" : bulkConfirm === "archive" ? "delete" : "reject"} onClick={onConfirmBulk} disabled={busy}>{busy ? "Processing…" : `${actionLabel} ${confirmCount}`}</button></div> : null}
  </section>;
}

function AdminPlanEditor({ plan, defaultCategory = "plan", busy, onSave, onRemove, onUploadImage, onRemoveImage, onMove, canMoveUp = false, canMoveDown = false }) {
  const makeDraft = () => ({ name: plan?.name || (plan ? `${durationLabel(plan.days, plan.duration_unit)} Plan` : "New Plan"), category: plan?.category || defaultCategory, days: plan?.days || 1, duration_unit: plan?.duration_unit || "days", amount: plan?.amount ?? "", total_return: plan?.total_return ?? "", daily_earning: plan?.daily_earning ?? "", payout_mode: plan?.payout_mode || "maturity", purchase_limit: plan?.purchase_limit ?? 1, coming_soon: Boolean(plan?.coming_soon), plan_locked: Boolean(plan?.plan_locked), vip_locked: Boolean(plan?.vip_locked), vip_activation: Boolean(plan?.vip_activation) });
  const [draft, setDraft] = useState(makeDraft);
  useEffect(() => setDraft(makeDraft()), [plan, defaultCategory]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event) => { event.preventDefault(); onSave(plan?.id || null, { name: draft.name.trim(), category: draft.category, days: Number(draft.days), duration_unit: draft.duration_unit, amount: draft.amount === "" ? null : Number(draft.amount), total_return: draft.total_return === "" ? null : Number(draft.total_return), daily_earning: draft.daily_earning === "" ? null : Number(draft.daily_earning), payout_mode: draft.duration_unit === "hours" ? "maturity" : draft.payout_mode, purchase_limit: Number(draft.purchase_limit), coming_soon: draft.coming_soon, plan_locked: draft.plan_locked, vip_locked: draft.category === "vip" && draft.vip_locked && !draft.vip_activation, vip_activation: draft.category === "vip" && draft.vip_activation }); };
  return <form className="admin-plan-editor" onSubmit={submit}>
    <div className="admin-plan-title"><b>{plan ? `Plan ${plan.id}` : "Add New Plan"}</b>{plan ? <div className="admin-plan-order"><button type="button" disabled={busy || !canMoveUp} onClick={() => onMove(plan.id, -1)} aria-label={`Move ${draft.name} up`}><ArrowUp /> Move up</button><button type="button" disabled={busy || !canMoveDown} onClick={() => onMove(plan.id, 1)} aria-label={`Move ${draft.name} down`}><ArrowDown /> Move down</button></div> : null}<label><input type="checkbox" checked={draft.coming_soon} onChange={(event) => update("coming_soon", event.target.checked)} /> Coming soon</label><label><input type="checkbox" checked={draft.plan_locked} onChange={(event) => update("plan_locked", event.target.checked)} /> Lock plan</label></div>
    {plan ? <div className="admin-plan-photo"><img src={plan.image_name ? `/api/plan-images/${plan.id}?v=${encodeURIComponent(plan.image_updated_at || plan.updated_at || "")}` : "/assets/nivesh-plan-banner.webp"} alt={`${draft.name} preview`} /><label className="admin-plan-photo-upload"><UploadCloud /> {plan.image_name ? "Replace & Auto-fit" : "Upload & Auto-fit"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadImage(plan.id, file); event.target.value = ""; }} disabled={busy} /></label>{plan.image_name ? <button className="admin-plan-photo-remove" type="button" disabled={busy} onClick={() => onRemoveImage(plan.id)}>Remove Photo</button> : null}</div> : <div className="admin-plan-photo-hint">Add the plan first, then upload its photo.</div>}
    <label>Plan name<input type="text" minLength="2" maxLength="80" value={draft.name} onChange={(event) => update("name", event.target.value)} required /></label>
    <label>Category<select value={draft.category} onChange={(event) => { const category = event.target.value; setDraft((current) => ({ ...current, category, vip_locked: category === "vip" ? current.vip_locked : false, vip_activation: category === "vip" ? current.vip_activation : false })); }}><option value="plan">Plan</option><option value="benefit">Benefit</option><option value="vip">VIP</option></select></label>
    <label>Duration<input type="number" min="1" max={draft.duration_unit === "hours" ? "12" : "3650"} value={draft.days} onChange={(event) => update("days", event.target.value)} required /></label>
    <label>Duration unit<select value={draft.duration_unit} onChange={(event) => { const durationUnit = event.target.value; setDraft((current) => ({ ...current, duration_unit: durationUnit, days: durationUnit === "hours" ? Math.min(12, Math.max(1, Number(current.days) || 1)) : current.days, payout_mode: durationUnit === "hours" ? "maturity" : current.payout_mode })); }}><option value="days">Days</option><option value="hours">Hours (1–12)</option></select></label>
    <label>Amount<input type="number" min="1" value={draft.amount} onChange={(event) => update("amount", event.target.value)} required={!draft.coming_soon} /></label>
    <label>Total return<input type="number" min="1" value={draft.total_return} onChange={(event) => update("total_return", event.target.value)} required={!draft.coming_soon} /></label>
    <label>Daily earning<input type="number" min="0" value={draft.daily_earning} onChange={(event) => update("daily_earning", event.target.value)} /></label>
    <label>Payout<select value={draft.duration_unit === "hours" ? "maturity" : draft.payout_mode} disabled={draft.duration_unit === "hours"} onChange={(event) => update("payout_mode", event.target.value)}><option value="maturity">At maturity</option><option value="daily">Daily</option></select></label>
    <label>Purchase limit<input type="number" min="0" max="100" value={draft.purchase_limit} onChange={(event) => update("purchase_limit", event.target.value)} required /></label>
    {draft.category === "vip" ? <div className="admin-vip-controls"><label><input type="checkbox" checked={draft.vip_activation} onChange={(event) => setDraft((current) => ({ ...current, vip_activation: event.target.checked, vip_locked: event.target.checked ? false : current.vip_locked }))} /> VIP Activation Plan</label><label><input type="checkbox" checked={draft.vip_locked} disabled={draft.vip_activation} onChange={(event) => update("vip_locked", event.target.checked)} /> Lock until VIP activated</label></div> : null}
    <div className="admin-plan-actions"><button className="approve" disabled={busy}>{plan ? "Save Plan" : "Add Plan"}</button>{plan ? <button className="reject" type="button" disabled={busy} onClick={() => onRemove(plan.id)}>Delete Plan</button> : null}</div>
  </form>;
}

function AdminPlanManager({ plans, busy, onSave, onRemove, onUploadImage, onRemoveImage, onMove }) {
  const [category, setCategory] = useState("plan");
  const categoryPlans = plans.filter((plan) => (plan.category || "plan") === category);
  const categoryLabel = category === "vip" ? "VIP" : category === "benefit" ? "Benefit" : "Plan";
  return <div className="admin-plan-manager"><div className="admin-qr-intro"><b>Plan Management</b><p>Manage Plan, Benefit and VIP offers. Uploaded photos are automatically fitted to the clean 3:2 mobile card without cropping.</p></div><div className="admin-plan-category-tabs" role="tablist" aria-label="Admin plan categories">{[["plan","Plan"],["benefit","Benefit"],["vip","VIP"]].map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={category === id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{label}<span>{plans.filter((plan) => (plan.category || "plan") === id).length}</span></button>)}</div><AdminPlanEditor defaultCategory={category} busy={busy} onSave={onSave} onRemove={onRemove} onUploadImage={onUploadImage} onRemoveImage={onRemoveImage} />{categoryPlans.length ? categoryPlans.map((plan, index) => <AdminPlanEditor key={plan.id} plan={plan} defaultCategory={category} busy={busy} onSave={onSave} onRemove={onRemove} onUploadImage={onUploadImage} onRemoveImage={onRemoveImage} onMove={onMove} canMoveUp={index > 0} canMoveDown={index < categoryPlans.length - 1} />) : <div className="admin-plan-category-empty">No {categoryLabel} plans yet. Use the form above to add one.</div>}</div>;
}

function AdminNotificationManager({ notifications, busy, onSend, onRemove }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const sent = await onSend({ title: title.trim(), message: message.trim() });
    if (!sent) return;
    setTitle(""); setMessage("");
  };
  return <div className="admin-notification-manager"><form onSubmit={submit}><div><b>Send User Notification</b><p>This message will appear in every user's Bell notifications.</p></div><label>Title<input value={title} minLength="2" maxLength="80" onChange={(event) => setTitle(event.target.value)} placeholder="Update title" required /></label><label>Message<textarea value={message} minLength="2" maxLength="500" onChange={(event) => setMessage(event.target.value)} placeholder="Write the update for all users" required /></label><button className="primary" disabled={busy}>{busy ? "Sending…" : "Send to All Users"}</button></form><div className="admin-notification-list">{notifications.length ? notifications.map((item) => <article key={item.id}><div><b>{item.title}</b><p>{item.message}</p><small>{dateTime(item.created_at)} • Read by {item.read_count || 0} users</small></div><button type="button" className="reject" disabled={busy} onClick={() => onRemove(item.id)}>Delete</button></article>) : <div className="admin-plan-category-empty">No notifications sent yet.</div>}</div></div>;
}

function AdminSupportInbox({ conversations, users, token, onRefresh }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const bottomRef = React.useRef(null);
  const contacts = React.useMemo(() => {
    const conversationByUser = new Map(conversations.map((item) => [item.user_id, item]));
    return users.map((user) => ({
      ...user,
      user_id: user.id,
      ...(conversationByUser.get(user.id) || {}),
      last_message: conversationByUser.get(user.id)?.last_message || "No messages yet — start a chat",
      updated_at: conversationByUser.get(user.id)?.updated_at || user.created_at,
    })).sort((left, right) => Number(Boolean(conversationByUser.get(right.user_id))) - Number(Boolean(conversationByUser.get(left.user_id))) || new Date(right.updated_at) - new Date(left.updated_at));
  }, [conversations, users]);
  const filteredContacts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    const cleanCode = query.replace(/^#/, "").replace(/^sc/, "");
    return contacts.filter((item) => {
      const publicId = String(item.public_id || "").toLowerCase();
      return String(item.name || "").toLowerCase().includes(query)
        || publicId.includes(cleanCode)
        || String(item.user_id || "").toLowerCase().includes(query);
    });
  }, [contacts, searchQuery]);
  useEffect(() => {
    if (!selectedUserId && contacts.length) setSelectedUserId((contacts.find((item) => item.unread_count > 0) || contacts[0]).user_id);
    if (selectedUserId && !contacts.some((item) => item.user_id === selectedUserId)) setSelectedUserId(contacts[0]?.user_id || "");
  }, [contacts, selectedUserId]);
  const loadThread = useCallback(async (silent = false) => {
    if (!selectedUserId) return;
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selectedUserId)}`, { headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(body.detail, "Support chat could not load"));
      setThread(body);
      if (!silent) setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Support chat could not load");
    }
  }, [selectedUserId, token]);
  useEffect(() => {
    setThread(null);
    loadThread();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") loadThread(true); }, 3000);
    return () => window.clearInterval(timer);
  }, [loadThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread?.messages?.length]);
  const sendReply = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selectedUserId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selectedUserId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ message }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(body.detail, "Reply could not be sent"));
      setThread((current) => current ? { ...current, messages: [...(current.messages || []), body] } : current);
      setDraft("");
      onRefresh?.();
    } catch (err) {
      setError(err.message || "Reply could not be sent");
    } finally {
      setBusy(false);
    }
  };
  const selectedSummary = contacts.find((item) => item.user_id === selectedUserId);
  return <div className="admin-support-inbox">
    <aside className="admin-support-list">
      <header><div><Headphones /><span><b>Human Support</b><small>{conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)} unread messages</small></span></div></header>
      <label className="admin-support-search"><Search /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name or customer code" /></label>
      <div>{filteredContacts.length ? filteredContacts.map((item) => <button type="button" key={item.user_id} className={selectedUserId === item.user_id ? "active" : ""} onClick={() => setSelectedUserId(item.user_id)}><span className="admin-support-avatar">{(item.name || "U")[0].toUpperCase()}</span><span><b>{item.name} <i>#{item.public_id}</i></b><small>{item.last_sender === "admin" ? "You: " : ""}{item.last_message}</small><time>{dateTime(item.updated_at)}</time></span>{item.unread_count ? <em>{item.unread_count}</em> : null}</button>) : <div className="admin-support-empty"><Search /><b>No matching user</b><span>Try another name or customer code.</span></div>}</div>
    </aside>
    <section className="admin-support-thread">
      {selectedUserId ? <>
        <header><span className="admin-support-avatar">{(thread?.user?.name || selectedSummary?.name || "U")[0].toUpperCase()}</span><div><b>{thread?.user?.name || selectedSummary?.name}</b><small>Customer #{thread?.user?.public_id || selectedSummary?.public_id} • {thread?.user?.email || selectedSummary?.email}</small></div><span className="admin-support-live"><i /> Live chat</span></header>
        <div className="admin-support-messages">{thread?.messages?.length ? thread.messages.map((message) => <div key={message.id} className={`admin-support-message ${message.sender}`}>{message.image_data ? <button type="button" className="admin-support-photo-card" onClick={() => setPreviewPhoto({ src: message.image_data, name: message.image_name || "Customer support photo" })}><img className="admin-support-photo" src={message.image_data} alt={message.image_name || "Customer support attachment"} /><span><Eye /> View full photo</span></button> : null}{message.message ? <span>{message.message}</span> : null}<small>{dateTime(message.created_at)}</small></div>) : thread ? <div className="admin-support-loading">No messages yet. Send the first message to this user.</div> : <div className="admin-support-loading">Loading conversation…</div>}<div ref={bottomRef} /></div>
        {error ? <div className="admin-support-error">{error}</div> : null}
        <form onSubmit={sendReply}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1000" placeholder="Reply to this customer…" required /><button className="primary" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send Reply"}</button></form>
      </> : <div className="admin-support-empty large"><Headphones /><b>Select a customer chat</b><span>Open a conversation to read messages and reply.</span></div>}
    </section>
    {previewPhoto ? <div className="admin-support-photo-viewer" onMouseDown={() => setPreviewPhoto(null)}><div onMouseDown={(event) => event.stopPropagation()}><button type="button" className="close" aria-label="Close photo" onClick={() => setPreviewPhoto(null)}><X /></button><img src={previewPhoto.src} alt={previewPhoto.name} /><b>{previewPhoto.name}</b><a href={previewPhoto.src} download={previewPhoto.name}><ArrowDown /> Download Photo</a></div></div> : null}
  </div>;
}

function AdminCompanySettings({ companyName, busy, onSave }) {
  const [name, setName] = useState(companyName || "BroCode");
  useEffect(() => setName(companyName || "BroCode"), [companyName]);
  return <form className="admin-company-settings" onSubmit={(event) => { event.preventDefault(); onSave(name); }}><div><b>Company Name</b><small>This name will appear on login, home, profile and plan cards.</small></div><input value={name} onChange={(event) => setName(event.target.value)} minLength="3" maxLength="80" required /><button className="primary" disabled={busy}>Save Company Name</button></form>;
}

function AdminTelegramSettings({ settings, busy, onSave }) {
  const stored = settings?.telegram_url || DEFAULT_TELEGRAM_URL;
  const [url, setUrl] = useState(stored);
  useEffect(() => setUrl(stored), [stored]);
  const valid = /^https:\/\/\S{4,}$/i.test(url.trim());
  return <form className="admin-telegram-settings" onSubmit={(event) => { event.preventDefault(); onSave(url.trim()); }}>
    <div><b>Telegram Channel Link</b><small>Used by the “Join Telegram Channel” popup shown to customers.</small></div>
    <input value={url} onChange={(event) => setUrl(event.target.value)} type="url" inputMode="url" placeholder="https://t.me/yourchannel" minLength="12" maxLength="300" required />
    {url.trim() && !valid ? <p className="admin-telegram-invalid">Link must start with https://</p> : null}
    <div className="admin-telegram-actions">
      <button className="primary" disabled={busy || !valid}>Save Telegram Link</button>
      <a className="admin-telegram-test" href={valid ? url.trim() : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!valid}>Test link</a>
    </div>
  </form>;
}

function AdminRechargeSettings({ settings, busy, onSave }) {
  const [minimumRecharge, setMinimumRecharge] = useState(Number(settings?.minimum_recharge) || 100);
  const [firstRechargeAmount, setFirstRechargeAmount] = useState(Number(settings?.first_recharge_amount) || 100);
  useEffect(() => {
    setMinimumRecharge(Number(settings?.minimum_recharge) || 100);
    setFirstRechargeAmount(Number(settings?.first_recharge_amount) || 100);
  }, [settings?.minimum_recharge, settings?.first_recharge_amount]);
  return <form className="admin-company-settings" onSubmit={(event) => { event.preventDefault(); onSave({ minimum_recharge: Number(minimumRecharge), first_recharge_amount: Number(firstRechargeAmount) }); }}>
    <div><b>Recharge Amount Settings</b><small>Control the minimum recharge and the first quick-amount box shown to every customer.</small></div>
    <label>Minimum recharge<input type="number" min="1" max="100000" step="1" value={minimumRecharge} onChange={(event) => setMinimumRecharge(event.target.value)} required /></label>
    <label>First recharge box<input type="number" min={minimumRecharge || 1} max="100000" step="1" value={firstRechargeAmount} onChange={(event) => setFirstRechargeAmount(event.target.value)} required /></label>
    <button className="primary" disabled={busy}>{busy ? "Saving..." : "Save Recharge Settings"}</button>
  </form>;
}

function AdminWelcomePopupSettings({ settings, busy, onSave }) {
  const popupSettings = {
    enabled: settings?.welcome_popup_enabled !== "0",
    title: settings?.welcome_popup_title || "Welcome to BroCode",
    message: settings?.welcome_popup_message || "Create your account, review the available services, and manage your wallet from one place.",
    buttonText: settings?.welcome_popup_button || "Continue",
  };
  const [enabled, setEnabled] = useState(popupSettings.enabled);
  const [title, setTitle] = useState(popupSettings.title);
  const [message, setMessage] = useState(popupSettings.message);
  const [buttonText, setButtonText] = useState(popupSettings.buttonText);
  useEffect(() => {
    setEnabled(popupSettings.enabled);
    setTitle(popupSettings.title);
    setMessage(popupSettings.message);
    setButtonText(popupSettings.buttonText);
  }, [settings?.welcome_popup_enabled, settings?.welcome_popup_title, settings?.welcome_popup_message, settings?.welcome_popup_button]);
  return <form className="admin-welcome-settings" onSubmit={(event) => { event.preventDefault(); onSave({ enabled, title: title.trim(), message: message.trim(), button_text: buttonText.trim() }); }}>
    <div className="admin-welcome-heading"><div><b>Website Welcome Popup</b><small>Customize the message shown before the create-account page opens.</small></div><label className="admin-popup-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>{enabled ? "Enabled" : "Disabled"}</span></label></div>
    <label>Popup title<input value={title} minLength="2" maxLength="100" onChange={(event) => setTitle(event.target.value)} required /></label>
    <label>Popup message<textarea value={message} minLength="2" maxLength="700" onChange={(event) => setMessage(event.target.value)} required /></label>
    <label>Continue button text<input value={buttonText} minLength="2" maxLength="40" onChange={(event) => setButtonText(event.target.value)} required /></label>
    <button className="primary" disabled={busy}>{busy ? "Saving..." : "Save Welcome Popup"}</button>
  </form>;
}

function AdminHomeBannerSettings({ settings, busy, onUpload, onRemove }) {
  const imageUrl = settings?.home_banner_name ? `/api/home-banner?v=${encodeURIComponent(settings.home_banner_updated_at || "")}` : "/assets/nivesh-plan-banner.webp";
  return <section className="admin-home-banner-settings">
    <div className="admin-home-banner-copy"><div><b>Home Photo</b><small>This photo replaces the Available Balance card on the customer home screen after login.</small></div><span>{settings?.home_banner_name ? "Custom photo active" : "Default photo active"}</span></div>
    <div className="admin-home-banner-preview"><img src={imageUrl} alt="Current customer home" /></div>
    <div className="admin-home-banner-actions">
      <label className="primary"><UploadCloud />{busy ? "Uploading..." : settings?.home_banner_name ? "Replace Photo" : "Upload Photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} /></label>
      {settings?.home_banner_name ? <button type="button" disabled={busy} onClick={onRemove}>Remove Photo</button> : null}
    </div>
    <small className="admin-home-banner-note">Use a landscape JPEG, PNG, or WebP image up to 4 MB. It will crop neatly on mobile screens.</small>
  </section>;
}

function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [draftToken, setDraftToken] = useState("");
  const [data, setData] = useState(null);
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem(ADMIN_THEME_KEY) === "dark" ? "dark" : "light");
  const [requestTimeRange, setRequestTimeRange] = useState("all");
  const [requestStatus, setRequestStatus] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [adminNotice, setAdminNotice] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [suggestedAdminPassword, setSuggestedAdminPassword] = useState(generateAdminPasswordSuggestion);
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const pendingAdminCredential = React.useRef("");

  const toggleAdminTheme = () => {
    setAdminTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(ADMIN_THEME_KEY, next);
      return next;
    });
  };

  const load = useCallback(async (adminToken = token, silent = false) => {
    if (!adminToken) return;
    if (!silent) setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dashboard", { headers: { "X-Admin-Token": adminToken } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(body.detail, "Admin access denied"));
      setData(body);
      if (pendingAdminCredential.current === adminToken && window.PasswordCredential && navigator.credentials?.store) {
        navigator.credentials.store(new window.PasswordCredential({ id: "admin", name: "BroCode Admin", password: adminToken })).catch(() => {});
        pendingAdminCredential.current = "";
      }
    } catch (err) {
      if (!silent) setData(null);
      if (!silent) pendingAdminCredential.current = "";
      setError(err.message || "Could not load admin dashboard");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [token]);

  useEffect(() => { if (token) load(token); }, [token, load]);
  useEffect(() => {
    if (!token) return undefined;
    const refresh = () => { if (document.visibilityState === "visible") load(token, true); };
    const interval = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [token, load]);

  const login = (event) => {
    event.preventDefault();
    const nextToken = String(event.currentTarget.elements.password?.value || draftToken).trim();
    if (!nextToken) return;
    pendingAdminCredential.current = nextToken;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, nextToken);
    setToken(nextToken);
    setDraftToken("");
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setData(null);
    setError("");
    setShowPasswordForm(false);
    setPasswordMessage("");
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (newAdminPassword.length < 12) return setPasswordMessage("Use at least 12 characters.");
    if (newAdminPassword !== confirmAdminPassword) return setPasswordMessage("New passwords do not match.");
    setBusy(true);
    setPasswordMessage("");
    try {
      const response = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ new_password: newAdminPassword }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Password change failed");
      sessionStorage.setItem(ADMIN_TOKEN_KEY, newAdminPassword);
      setToken(newAdminPassword);
      setNewAdminPassword("");
      setConfirmAdminPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordMessage(err.message || "Password change failed");
    } finally {
      setBusy(false);
    }
  };

  const recoverPassword = async (event) => {
    event.preventDefault();
    if (recoveryPassword.length < 12) return setRecoveryMessage("Use at least 12 characters for the new password.");
    setBusy(true);
    setRecoveryMessage("");
    try {
      const response = await fetch("/api/admin/recover-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recovery_code: recoveryCode.trim(), new_password: recoveryPassword }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(body.detail, "Password recovery failed"));
      sessionStorage.setItem(ADMIN_TOKEN_KEY, recoveryPassword);
      setToken(recoveryPassword);
      setRecoveryCode("");
      setRecoveryPassword("");
      setRecoveryMode(false);
    } catch (err) {
      setRecoveryMessage(err.message || "Password recovery failed");
    } finally {
      setBusy(false);
    }
  };

  const generateRecoveryCode = async () => {
    setBusy(true);
    setError("");
    setPasswordMessage("");
    try {
      const response = await fetch("/api/admin/recovery-code", { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Recovery code could not be generated");
      setGeneratedRecoveryCode(body.recovery_code);
      setPasswordMessage("New one-time recovery code generated. Save it somewhere private now.");
    } catch (err) {
      setPasswordMessage(err.message || "Recovery code could not be generated");
    } finally {
      setBusy(false);
    }
  };

  const adminAction = async (path) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Action failed");
      await load();
    } catch (err) {
      setError(err.message || "Action failed");
      setBusy(false);
    }
  };

  const adjustUserBalance = async (userId, adjustment) => {
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/balance`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(adjustment) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Balance adjustment failed");
      await load();
      setAdminNotice(`${adjustment.operation === "credit" ? "Added" : "Deducted"} ₹${money(adjustment.amount)} successfully. New wallet balance: ₹${money(body.balance)}.`);
    } catch (err) { setError(err.message || "Balance adjustment failed"); setBusy(false); }
  };

  const saveWithdrawalReceiptTime = async (withdrawalId, receiptAt, receiptAmount, receiptReference) => {
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}/receipt-time`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ receipt_at: receiptAt, receipt_amount: receiptAmount, receipt_reference: receiptReference }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Receipt date and time update failed");
      await load();
      setAdminNotice(`Only withdrawal receipt ${receiptReference} reference, amount, date and time were updated.`);
    } catch (err) { setError(err.message || "Receipt date and time update failed"); setBusy(false); }
  };

  const saveWithdrawalReceiptOrder = async (userId, withdrawalIds) => {
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/withdrawal-receipts/order`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ withdrawal_ids: withdrawalIds }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Receipt order update failed");
      await load(); setAdminNotice("Withdrawal receipt moved successfully. Customer history order is updated.");
    } catch (err) { setError(err.message || "Receipt order update failed"); setBusy(false); }
  };

  const deleteWithdrawalReceipt = async (withdrawal) => {
    if (!window.confirm(`Delete ${withdrawal.reference} for ${withdrawal.name}? It will also disappear from this user's app.`)) return;
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawal.id}/receipt-delete`, { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Receipt delete failed");
      await load();
      setAdminNotice(`${withdrawal.reference} was deleted from Receipt Date & Time and the customer's app.`);
    } catch (err) { setError(err.message || "Receipt delete failed"); setBusy(false); }
  };

  const bulkReview = async (requestIds = selectedRequestIds) => {
    if (!bulkConfirm || !requestIds.length || !["recharges", "withdrawals"].includes(section)) return;
    setBusy(true);
    setError("");
    setAdminNotice("");
    try {
      const isArchive = bulkConfirm === "archive";
      const reviewIds = section === "recharges" ? requestIds.map((key) => Number(String(key).split("-").pop())) : requestIds;
      const archivePayload = section === "recharges" ? { keys: requestIds } : { ids: requestIds };
      const response = await fetch(`/api/admin/${section}/${isArchive ? "bulk-archive" : "bulk-review"}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(isArchive ? archivePayload : { ids: reviewIds, action: bulkConfirm }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Bulk action failed");
      const skipped = Number(body.skipped_count || 0);
      setAdminNotice(`${body.processed_count || 0} request(s) ${isArchive ? "deleted from the dashboard" : "updated"}${skipped ? `; ${skipped} unavailable request(s) skipped` : ""}.`);
      setSelectedRequestIds([]);
      setBulkConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || "Bulk action failed");
      setBusy(false);
    }
  };

  const paymentQrAction = async (id, payload) => {
    setBusy(true);
    setError("");
    try {
      const path = id ? `/api/admin/payment-qrs/${id}` : "/api/admin/payment-qrs";
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "QR update failed");
      await load();
      return true;
    } catch (err) {
      setError(err.message || "QR update failed");
      setBusy(false);
      return false;
    }
  };

  const paymentQrModeAction = async (mode) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payment-qr-mode", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ mode }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "QR system switch failed");
      await load();
    } catch (err) {
      setError(err.message || "QR system switch failed");
      setBusy(false);
    }
  };

  const removePaymentQr = async (id) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payment-qrs/${id}/remove`, { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "QR removal failed");
      await load();
    } catch (err) {
      setError(err.message || "QR removal failed");
      setBusy(false);
    }
  };

  const cryptoWalletAction = async (coin, address) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/crypto-wallets/${coin}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ address }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Crypto address update failed");
      await load();
    } catch (err) { setError(err.message || "Crypto address update failed"); setBusy(false); }
  };

  const removeCryptoWallet = async (coin) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/crypto-wallets/${coin}/remove`, { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Crypto address removal failed");
      await load();
    } catch (err) { setError(err.message || "Crypto address removal failed"); setBusy(false); }
  };

  const planAction = async (id, payload) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(id ? `/api/admin/plans/${id}` : "/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Plan update failed");
      await load(); setAdminNotice(id ? "Plan updated." : "New plan added.");
    } catch (err) { setError(err.message || "Plan update failed"); setBusy(false); }
  };

  const sendNotification = async (payload) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Notification could not be sent");
      await load(); setAdminNotice("Notification sent to all users.");
      return true;
    } catch (err) { setError(err.message || "Notification could not be sent"); setBusy(false); return false; }
  };

  const removeNotification = async (id) => {
    if (!window.confirm("Delete this notification for all users?")) return;
    await adminAction(`/api/admin/notifications/${id}/remove`);
  };

  const removePlan = async (id) => {
    if (!window.confirm(`Delete plan ${id} from the customer app?`)) return;
    await adminAction(`/api/admin/plans/${id}/remove`);
  };

  const movePlan = async (id, direction) => {
    const plans = data?.plan_catalog || [];
    const currentIndex = plans.findIndex((plan) => plan.id === id);
    if (currentIndex < 0) return;
    const category = plans[currentIndex].category || "plan";
    const categoryPlans = plans.filter((plan) => (plan.category || "plan") === category);
    const categoryIndex = categoryPlans.findIndex((plan) => plan.id === id);
    const nextCategoryIndex = categoryIndex + direction;
    if (nextCategoryIndex < 0 || nextCategoryIndex >= categoryPlans.length) return;
    const nextIndex = plans.findIndex((plan) => plan.id === categoryPlans[nextCategoryIndex].id);
    const reordered = [...plans];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch("/api/admin/plans/reorder", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ plan_ids: reordered.map((plan) => plan.id) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Plan order update failed");
      setData((current) => ({ ...current, plan_catalog: reordered }));
      setAdminNotice("Plan order updated in the customer app.");
    } catch (err) { setError(err.message || "Plan order update failed"); }
    finally { setBusy(false); }
  };

  const uploadPlanImage = async (id, file) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choose a JPEG, PNG, or WebP plan image.");
    if (file.size > 4 * 1024 * 1024) return setError("The plan image must be 4 MB or smaller.");
    setBusy(true); setError("");
    try {
      const imageData = await normalizePlanImageToDataUrl(file);
      const response = await fetch(`/api/admin/plans/${id}/image`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ image_data: imageData }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Plan photo upload failed");
      await load(); setAdminNotice("Plan photo auto-fitted to the 3:2 mobile card and updated.");
    } catch (err) { setError(err.message || "Plan photo upload failed"); setBusy(false); }
  };

  const removePlanImage = async (id) => {
    if (!window.confirm("Remove this plan photo and restore the default image?")) return;
    await adminAction(`/api/admin/plans/${id}/remove-image`);
  };

  const saveCompanyName = async (companyName) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/settings/company-name", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ company_name: companyName }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Company name update failed");
      await load(); setAdminNotice("Company name updated across the customer app.");
    } catch (err) { setError(err.message || "Company name update failed"); setBusy(false); }
  };

  const saveTelegramUrl = async (telegramUrl) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/settings/telegram-url", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ telegram_url: telegramUrl }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(body.detail, "Telegram link update failed"));
      await load(); setAdminNotice("Telegram channel link updated for all customers.");
    } catch (err) { setError(err.message || "Telegram link update failed"); setBusy(false); }
  };

  const saveRechargeSettings = async (rechargeSettings) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/settings/recharge", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(rechargeSettings) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Recharge settings update failed");
      await load(); setAdminNotice("Recharge minimum and first amount box updated for all customers.");
    } catch (err) { setError(err.message || "Recharge settings update failed"); setBusy(false); }
  };

  const saveWelcomePopup = async (popupSettings) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/settings/welcome-popup", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(popupSettings) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Welcome popup update failed");
      await load(); setAdminNotice("Welcome popup updated across the customer website.");
    } catch (err) { setError(err.message || "Welcome popup update failed"); setBusy(false); }
  };

  const uploadHomeBanner = async (file) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choose a JPEG, PNG, or WebP home photo.");
    if (file.size > 4 * 1024 * 1024) return setError("The home photo must be 4 MB or smaller.");
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const imageData = await receiptFileToDataUrl(file);
      const response = await fetch("/api/admin/settings/home-banner", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify({ image_data: imageData }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Home photo upload failed");
      await load(); setAdminNotice("Home photo updated for all customers.");
    } catch (err) { setError(err.message || "Home photo upload failed"); setBusy(false); }
  };

  const removeHomeBanner = async () => {
    if (!window.confirm("Remove the custom home photo and restore the default image?")) return;
    setBusy(true); setError(""); setAdminNotice("");
    try {
      const response = await fetch("/api/admin/settings/home-banner/remove", { method: "POST", headers: { "X-Admin-Token": token } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Home photo removal failed");
      await load(); setAdminNotice("Default home photo restored.");
    } catch (err) { setError(err.message || "Home photo removal failed"); setBusy(false); }
  };

  if (!token || (!data && !busy)) {
    return <main className="admin-login">
      <div className="admin-login-card">
        <div className="admin-lock"><LockKeyhole /></div>
        <p className="admin-kicker">BroCode Control</p>
        <h1>{recoveryMode ? "Recover Admin Access" : "Admin Dashboard"}</h1>
        <p>{recoveryMode ? "Use your saved one-time recovery code, then create a new admin password." : "Enter your private admin password. Customer passwords remain encrypted and are never displayed."}</p>
        {recoveryMode ? <form className="admin-recovery-form" onSubmit={recoverPassword}>
          <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
          <label>Recovery code<input value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())} autoComplete="off" placeholder="MLF-XXXXXX-XXXXXX-XXXXXX-XXXXXX" required /></label>
          <div className="admin-password-suggestion">
            <span>Suggested strong password</span>
            <code>{suggestedAdminPassword}</code>
            <div><button type="button" onClick={() => setRecoveryPassword(suggestedAdminPassword)}>Use this password</button><button type="button" onClick={() => { navigator.clipboard?.writeText(suggestedAdminPassword); setRecoveryMessage("Suggested password copied."); }}><FileText /> Copy</button><button type="button" onClick={() => setSuggestedAdminPassword(generateAdminPasswordSuggestion())}><RefreshCw /> New</button></div>
          </div>
          <label>Create new admin password<input type="password" name="new-password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} autoComplete="new-password" minLength="12" required /></label>
          {recoveryMessage ? <div className="form-error">{recoveryMessage}</div> : null}
          <button className="primary" disabled={busy}>{busy ? "Changing password..." : "Change Password & Open Admin"}</button>
        </form> : <form className="admin-login-form" action="/admin" method="post" autoComplete="on" onSubmit={login}>
          <input className="admin-password-manager-username" type="text" name="username" autoComplete="username" defaultValue="admin" tabIndex={-1} aria-hidden="true" />
          <label htmlFor="admin-current-password">Admin password<input id="admin-current-password" type="password" name="password" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} onInput={(e) => setDraftToken(e.currentTarget.value)} autoComplete="current-password" autoCapitalize="none" spellCheck="false" autoFocus required /></label>
          <small className="admin-password-manager-note">Your browser can suggest a saved admin password in this field.</small>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary">Open Dashboard</button>
        </form>}
        <button className="admin-forgot-button" type="button" onClick={() => { setRecoveryMode((current) => !current); setRecoveryMessage(""); setError(""); setSuggestedAdminPassword(generateAdminPasswordSuggestion()); }}>{recoveryMode ? "Back to admin sign in" : "Forgot password? Create a new one"}</button>
        <a href="/">Back to customer app</a>
      </div>
    </main>;
  }

  const sections = [
    ["overview", "Overview", (data?.stats?.pending_recharges || 0) + (data?.stats?.pending_withdrawals || 0) + (data?.stats?.pending_referrals || 0) + (data?.crypto_recharges || []).filter((item) => item.status === "pending").length],
    ["visitors", "Visitors", data?.stats?.total_visits || 0],
    ["users", "Users", data?.users?.length || 0],
    ["balance_control", "Balance Control", (data?.activity || []).filter((item) => item.kind === "admin_credit" || item.kind === "admin_debit").length],
    ["recharges", "Recharges", data?.recharges?.length || 0],
    ["withdrawals", "Withdrawals", data?.withdrawals?.length || 0],
    ["withdrawal_receipt_time", "Receipt Date & Time", data?.withdrawals?.length || 0],
    ["active_plans", "Plans", data?.active_plans?.length || 0],
    ["activity", "Activity", data?.activity?.length || 0],
    ["payment_qrs", "QR Codes", data?.payment_qrs?.length || 0],
    ["crypto", "Crypto", data?.crypto_recharges?.length || 0],
    ["referrals", "Referral Info", data?.referrals?.length || 0],
    ["signup_bonuses", "Signup Bonuses", data?.signup_bonuses?.length || 0],
    ["notifications", "Notifications", data?.notifications?.length || 0],
    ["support_conversations", "Support", data?.stats?.unread_support || 0],
    ["plan_catalog", "Plan Settings", data?.plan_catalog?.length || 0],
    ["app_settings", "App Settings", 3],
  ];
  const searchedRows = (section === "crypto" ? data?.crypto_recharges || [] : section === "balance_control" ? data?.users || [] : section === "withdrawal_receipt_time" ? data?.withdrawals || [] : ["overview", "app_settings"].includes(section) ? [] : data?.[section] || []).filter((row) =>
    !query || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase())),
  );
  const isRequestSection = section === "recharges" || section === "withdrawals";
  const generatedAt = new Date(data?.generated_at || Date.now()).getTime();
  const selectedRangeHours = requestTimeRange === "7d" ? 168 : requestTimeRange.endsWith("h") ? Number.parseInt(requestTimeRange, 10) : 0;
  const rows = searchedRows.filter((row) => {
    if (!isRequestSection) return true;
    if (requestStatus !== "all" && row.status !== requestStatus) return false;
    const createdAt = new Date(row.created_at).getTime();
    if (!Number.isFinite(createdAt)) return requestTimeRange === "all";
    if (requestTimeRange === "custom") {
      const from = customFrom ? new Date(customFrom).getTime() : -Infinity;
      const to = customTo ? new Date(customTo).getTime() : Infinity;
      return createdAt >= from && createdAt <= to;
    }
    return !selectedRangeHours || createdAt >= generatedAt - selectedRangeHours * 60 * 60 * 1000;
  });
  const requestSelectionKey = (row) => section === "recharges" ? row.record_key : row.id;
  const selectableRows = isRequestSection ? rows : [];
  const selectableIds = selectableRows.map(requestSelectionKey);
  const selectableIdSet = new Set(selectableIds);
  const selectedIds = selectedRequestIds.filter((id) => selectableIdSet.has(id));
  const selectedIdSet = new Set(selectedIds);
  const pendingRows = selectableRows.filter((row) => section === "recharges" ? row.status === "pending" : row.status === "requested");
  const pendingIdSet = new Set(pendingRows.map(requestSelectionKey));
  const selectedPendingIds = selectedIds.filter((id) => pendingIdSet.has(id));
  const selectedReviewedIds = selectedIds.filter((id) => !pendingIdSet.has(id));
  const selectedDeleteIds = section === "recharges" ? selectedIds : selectedReviewedIds;
  const navigateAdmin = (nextSection) => {
    setSection(nextSection);
    setQuery("");
    if (nextSection === "recharges" || nextSection === "withdrawals") setRequestStatus("all");
    setSelectedRequestIds([]);
    setBulkConfirm(null);
    setAdminNotice("");
  };
  const changeRequestSection = (nextSection) => { setSection(nextSection); setRequestStatus("all"); setSelectedRequestIds([]); setBulkConfirm(null); setAdminNotice(""); };
  const resetRequestSelection = (setter) => (value) => { setter(value); setSelectedRequestIds([]); setBulkConfirm(null); };
  const toggleRequest = (id) => setSelectedRequestIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAllRequests = () => setSelectedRequestIds(selectedIds.length === selectableIds.length && selectableIds.length ? [] : selectableIds);
  return <div className={`admin-shell ${adminTheme === "dark" ? "admin-dark" : ""}`}>
    <header className="admin-header">
      <div className="admin-brand-lockup"><div className="admin-brand-mark"><ShieldCheck /></div><div><p className="admin-kicker">{data?.settings?.company_name || "BroCode"} Control</p><h1>Admin Dashboard</h1><small><span className="admin-live-indicator"><i /> Live operations</span>Last updated {dateTime(data?.generated_at)}</small></div></div>
      <div className="admin-header-actions">
        <a className="admin-open-app" href="/" target="_blank" rel="noreferrer"><ExternalLink /> Open customer app</a>
        <button className="admin-theme-toggle" onClick={toggleAdminTheme} aria-label={`Switch to ${adminTheme === "dark" ? "light" : "dark"} theme`} aria-pressed={adminTheme === "dark"}>{adminTheme === "dark" ? <Sun /> : <Moon />} {adminTheme === "dark" ? "Light theme" : "Dark theme"}</button>
        <button onClick={() => load()} disabled={busy}><RefreshCw className={busy ? "spin" : ""} /> Refresh</button>
        <button onClick={() => { setShowPasswordForm((shown) => !shown); setPasswordMessage(""); setGeneratedRecoveryCode(""); }}><LockKeyhole /> Security center</button>
        <button onClick={logout}><LogOut /> Sign out</button>
      </div>
    </header>
    {error ? <div className="admin-error">{error}</div> : null}
    {adminNotice ? <div className="admin-notice">{adminNotice}</div> : null}
    {showPasswordForm ? <section className="admin-security-center">
      <header><div><span><ShieldCheck /> Security Center</span><b>Protect and recover your admin access</b><small>Change the current password or create a one-time recovery code for emergencies.</small></div><button type="button" onClick={() => setShowPasswordForm(false)} aria-label="Close security center"><X /></button></header>
      <div className="admin-security-grid">
      <form className="admin-password-panel" onSubmit={changePassword}>
      <div><b>Change Admin Password</b><small>Use at least 12 characters. Your current session switches immediately.</small></div>
      <input type="password" autoComplete="new-password" placeholder="New password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required />
      <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} required />
      <button className="primary" disabled={busy}>{busy ? "Updating…" : "Update Password"}</button>
      </form>
      <div className="admin-recovery-card">
        <div><b>Emergency Recovery Code</b><small>This resets a forgotten password. Only the newest code works, and it expires after one use.</small></div>
        {generatedRecoveryCode ? <div className="admin-generated-code"><code>{generatedRecoveryCode}</code><button type="button" onClick={() => navigator.clipboard?.writeText(generatedRecoveryCode)}><FileText /> Copy</button></div> : <div className="admin-recovery-placeholder"><LockKeyhole /><span>The recovery code is shown only once after generation.</span></div>}
        <button className="admin-generate-recovery" type="button" disabled={busy} onClick={generateRecoveryCode}>{generatedRecoveryCode ? "Replace Recovery Code" : "Generate Recovery Code"}</button>
      </div>
      </div>
      {passwordMessage ? <div className={passwordMessage.startsWith("New one-time") ? "admin-security-message" : "form-error"}>{passwordMessage}</div> : null}
    </section> : null}
    <section className="admin-stats">
      <article className="admin-stat-visitors"><span>Visitors today</span><strong>{data?.stats.visits_today || 0}</strong><small>{data?.stats.unique_today || 0} unique browsers (IST)</small><div className="admin-stat-icon"><Globe2 /></div></article>
      <article className="admin-stat-unique"><span>Total unique visitors</span><strong>{data?.stats.unique_visitors || 0}</strong><small>{data?.stats.total_visits || 0} total visits tracked</small><div className="admin-stat-icon"><MousePointerClick /></div></article>
      <article className="admin-stat-users"><span>Total users</span><strong>{data?.stats.users || 0}</strong><small>Registered accounts</small><div className="admin-stat-icon"><Users /></div></article>
      <article className="admin-stat-online"><span>Online now</span><strong>{data?.stats.online || 0}</strong><small>Active sessions</small><div className="admin-stat-icon"><UserRound /></div></article>
      <article className="admin-stat-recharge"><span>Recharge attention</span><strong>{data?.stats.pending_recharges || 0}</strong><small>{data?.stats.awaiting_utr || 0} awaiting UTR • ₹{money(data?.stats.approved_recharge_amount || 0)} approved</small><div className="admin-stat-icon"><IndianRupee /></div></article>
      <article className="admin-stat-withdraw"><span>Pending withdrawals</span><strong>{data?.stats.pending_withdrawals || 0}</strong><small>₹{money(data?.stats.withdrawal_amount || 0)} total</small><div className="admin-stat-icon"><WalletCards /></div></article>
    </section>
    <section className="admin-panel">
      <div className="admin-tabs">{sections.map(([id, label, count]) => <button key={id} className={section === id ? "active" : ""} onClick={() => navigateAdmin(id)}>{id === "overview" ? <LayoutDashboard className="admin-tab-icon" /> : null}{label}<span>{count}</span></button>)}</div>
      {!["overview", "support_conversations", "withdrawal_receipt_time"].includes(section) ? <div className="admin-toolbar"><div><Search /><input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedRequestIds([]); setBulkConfirm(null); }} placeholder="Search name, email, ID, UTR..." /></div><small>{rows.length} records</small></div> : null}
      {isRequestSection ? <AdminRequestFilters section={section} timeRange={requestTimeRange} status={requestStatus} customFrom={customFrom} customTo={customTo} rows={rows} pendingRows={pendingRows} selectableRows={selectableRows} selectedCount={selectedIds.length} selectedPendingCount={selectedPendingIds.length} selectedDeleteCount={selectedDeleteIds.length} busy={busy} onSectionChange={changeRequestSection} onTimeRangeChange={resetRequestSelection(setRequestTimeRange)} onStatusChange={resetRequestSelection(setRequestStatus)} onCustomFromChange={resetRequestSelection(setCustomFrom)} onCustomToChange={resetRequestSelection(setCustomTo)} onToggleAll={toggleAllRequests} onBulkAction={setBulkConfirm} bulkConfirm={bulkConfirm} onCancelBulk={() => setBulkConfirm(null)} onConfirmBulk={() => bulkReview(bulkConfirm === "archive" ? selectedDeleteIds : selectedPendingIds)} /> : null}
      <div className="admin-table-wrap">
        {section === "overview" ? <AdminOverview data={data} busy={busy} onNavigate={navigateAdmin} onRefresh={() => load()} /> : null}
        {section === "visitors" ? <AdminVisitorAnalytics visitors={rows} recentVisits={data?.recent_visits || []} daily={data?.visitor_daily || []} stats={data?.stats || {}} /> : null}
        {section === "users" ? <AdminDailyUsers users={rows} allUsers={data?.users || []} busy={busy} onAction={adminAction} hasSearch={Boolean(query)} /> : null}
        {section === "balance_control" ? <AdminBalanceControl users={rows} allUsers={data?.users || []} adjustments={(data?.activity || []).filter((item) => item.kind === "admin_credit" || item.kind === "admin_debit")} busy={busy} onAdjust={adjustUserBalance} /> : null}
        {section === "recharges" ? <table><thead><tr><th>Select</th><th>Reference</th><th>User</th><th>Amount</th><th>UTR</th><th>UPI</th><th>Payment QR</th><th>Started</th><th>Status / Action</th></tr></thead><tbody>{rows.map((r) => {
          const selectionKey = r.record_key || `recharge-${r.id}`;
          const deletePath = r.status === "awaiting_utr" ? `/api/admin/recharge-drafts/${r.id}/delete` : `/api/admin/recharges/${r.id}/archive`;
          return <tr key={selectionKey}><td><input className="admin-row-checkbox" type="checkbox" aria-label={`Select recharge ${r.id}`} checked={selectedIdSet.has(selectionKey)} disabled={busy} onChange={() => toggleRequest(selectionKey)} /></td><td><code>{r.reference}</code></td><td><b>{r.name} <span className="inline-public-id">#{r.public_id}</span></b><small>{r.email}<br /><code>{r.user_id}</code></small></td><td><b>₹{money(r.amount)}</b></td><td><code>{r.utr || "Awaiting UTR"}</code></td><td>{r.upi_id}</td><td><span className="payment-qr-name">{r.payment_qr_name || "Not recorded"}</span></td><td>{dateTime(r.created_at)}</td><td><div className="row-actions">{r.status === "pending" ? <><button className="approve" disabled={busy} onClick={() => adminAction(`/api/admin/recharges/${r.id}/approve`)}>Approve</button><button className="reject" disabled={busy} onClick={() => adminAction(`/api/admin/recharges/${r.id}/reject`)}>Reject</button></> : r.status === "awaiting_utr" ? <><span className="status awaiting_utr">Awaiting UTR</span><button className="approve" disabled={busy} onClick={() => { if (window.confirm(`Approve ₹${money(r.amount)} for ${r.name} without a UTR? Only continue after you have verified the payment.`)) adminAction(`/api/admin/recharge-drafts/${r.id}/approve`); }}>Approve without UTR</button></> : <span className={`status ${r.status}`}>{r.status}</span>}<button className="delete" disabled={busy} onClick={() => { if (window.confirm(`Delete ${r.reference} from the recharge dashboard?`)) adminAction(deletePath); }}>Delete</button></div></td></tr>;
        })}</tbody></table> : null}
        {section === "withdrawals" ? <table><thead><tr><th>Select</th><th>Reference</th><th>User</th><th>Requested</th><th>Fee (5%)</th><th>Send Amount</th><th>Payout details</th><th>Submitted</th><th>Status / Action</th></tr></thead><tbody>{rows.map((w) => {
          const selectable = true;
          return <tr key={w.id}><td><input className="admin-row-checkbox" type="checkbox" aria-label={`Select withdrawal ${w.id}`} checked={selectable && selectedIdSet.has(w.id)} disabled={!selectable || busy} onChange={() => toggleRequest(w.id)} /></td><td><code>{w.reference}</code></td><td><b>{w.name} <span className="inline-public-id">#{w.public_id}</span></b><small>{w.email}<br /><code>{w.user_id}</code></small></td><td><b>₹{money(w.amount)}</b></td><td className="amount-negative">−₹{money(w.fee_amount)}</td><td className="amount-positive"><b>₹{money(w.payout_amount)}</b><small>Pay this amount</small></td><td>{w.payout_method === "upi" ? <><b><span className="payout-method">UPI</span> {w.upi_id}</b><small>Send payment to this UPI ID</small></> : <><b><span className="payout-method">Bank</span> {w.beneficiary || "Not available"}</b>{w.account_number ? <code className="full-account-number">A/C {w.account_number}</code> : <strong className="bank-details-missing">Full account unavailable — ask user to save bank details again</strong>}<small>IFSC: {w.ifsc || "Not available"}</small></>}</td><td>{dateTime(w.created_at)}</td><td>{w.status === "requested" ? <div className="row-actions"><button className="approve" disabled={busy} onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/approve`)}>Mark paid</button><button className="reject" disabled={busy} onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/reject`)}>Reject + refund</button></div> : <span className={`status ${w.status}`}>{w.status}</span>}</td></tr>;
        })}</tbody></table> : null}
        {section === "withdrawal_receipt_time" ? <AdminWithdrawalReceiptTime allWithdrawals={data?.withdrawals || []} users={data?.users || []} busy={busy} onSave={saveWithdrawalReceiptTime} onDelete={deleteWithdrawalReceipt} onReorder={saveWithdrawalReceiptOrder} onAdjustBalance={adjustUserBalance} /> : null}
        {section === "active_plans" ? <table><thead><tr><th>User</th><th>Plan</th><th>Invested</th><th>Total return</th><th>Duration</th><th>Purchased</th><th>Status</th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td><b>{p.name} <span className="inline-public-id">#{p.public_id}</span></b><small>{p.email}<br /><code>{p.user_id}</code></small></td><td><code>{p.plan_id}</code></td><td>₹{money(p.invested)}</td><td>₹{money(p.total_return)}</td><td>{durationLabel(p.duration_days, p.duration_unit)}</td><td>{dateTime(p.purchased_at)}</td><td><span className={`status ${p.status}`}>{p.status}</span></td></tr>)}</tbody></table> : null}
        {section === "activity" ? <table><thead><tr><th>User</th><th>Type</th><th>Purchased Plan</th><th>Amount</th><th>Reference</th><th>Date</th></tr></thead><tbody>{rows.map((a) => <tr key={a.id}><td><b>{a.name} <span className="inline-public-id">#{a.public_id}</span></b><small>{a.email}<br /><code>{a.user_id}</code></small></td><td>{a.kind.replaceAll("_", " ")}</td><td>{a.kind === "plan_purchase" ? <><b>{a.purchased_plan_name || "Purchased plan"}</b><small>{a.purchased_plan_id ? <>Plan ID: <code>{a.purchased_plan_id}</code></> : "Plan details unavailable"}{a.purchased_plan_quantity > 1 ? ` • ${a.purchased_plan_quantity} orders` : ""}</small></> : <span className="status offline">—</span>}</td><td className={a.amount >= 0 ? "amount-positive" : "amount-negative"}>{a.amount >= 0 ? "+" : "-"}₹{money(Math.abs(a.amount))}</td><td><code>{a.reference || "—"}</code></td><td>{dateTime(a.created_at)}</td></tr>)}</tbody></table> : null}
        {section === "payment_qrs" ? <AdminQrManager qrs={rows} busy={busy} mode={data?.settings?.payment_qr_mode || "manual"} onMode={paymentQrModeAction} onSave={paymentQrAction} onRemove={removePaymentQr} /> : null}
        {section === "crypto" ? <AdminCryptoManager wallets={data?.crypto_wallets || []} requests={rows} busy={busy} onSave={cryptoWalletAction} onRemove={removeCryptoWallet} onAction={adminAction} /> : null}
        {section === "referrals" ? <table><thead><tr><th>Referred User</th><th>Referred By</th><th>Referral Code</th><th>Registered</th><th>First Approved Recharge</th><th>Reward</th><th>Status / Action</th></tr></thead><tbody>{rows.map((r) => <tr key={r.referred_user_id}><td><b>{r.referred_name} <span className="inline-public-id">#{r.referred_public_id}</span></b><small>{r.referred_email}<br /><code>{r.referred_user_id}</code></small></td><td><b>{r.referrer_name} <span className="inline-public-id">#{r.referrer_public_id}</span></b><small>{r.referrer_email}<br /><code>{r.referrer_user_id}</code></small></td><td><span className="public-id">SC{r.referrer_public_id}</span></td><td>{dateTime(r.referred_created_at)}</td><td>{r.first_recharge_amount != null ? <><b>₹{money(r.first_recharge_amount)}</b><small>{dateTime(r.first_recharge_approved_at)}</small></> : <small>No approved recharge yet</small>}</td><td><b>₹{money(r.reward_amount)}</b><small>Credits to referrer</small></td><td>{r.status === "pending" ? <div className="row-actions"><button className="approve" disabled={busy} onClick={() => adminAction(`/api/admin/referrals/${r.referred_user_id}/approve`)}>Approve ₹{money(r.reward_amount)}</button></div> : r.status === "referrer_locked" ? <><span className="status rejected">Locked</span><small>Referrer must deposit first</small></> : r.status === "awaiting_deposit" ? <><span className="status awaiting_utr">Waiting</span><small>Referred user has not deposited</small></> : <><span className="status approved">Approved</span><small>{dateTime(r.rewarded_at)}</small></>}</td></tr>)}</tbody></table> : null}
        {section === "signup_bonuses" ? <table><thead><tr><th>User</th><th>Customer ID</th><th>Bonus</th><th>Reference</th><th>Signup Date</th></tr></thead><tbody>{rows.map((bonus) => <tr key={bonus.id}><td><b>{bonus.name}</b><small>{bonus.email}<br /><code>{bonus.user_id}</code></small></td><td><span className="public-id">#{bonus.public_id}</span></td><td className="amount-positive"><b>+₹{money(bonus.amount)}</b><small>Credited instantly</small></td><td><code>{bonus.reference}</code></td><td>{dateTime(bonus.created_at)}</td></tr>)}</tbody></table> : null}
        {section === "notifications" ? <AdminNotificationManager notifications={rows} busy={busy} onSend={sendNotification} onRemove={removeNotification} /> : null}
        {section === "support_conversations" ? <AdminSupportInbox conversations={data?.support_conversations || []} users={data?.users || []} token={token} onRefresh={() => load(token, true)} /> : null}
        {section === "plan_catalog" ? <AdminPlanManager plans={data?.plan_catalog || []} busy={busy} onSave={planAction} onRemove={removePlan} onUploadImage={uploadPlanImage} onRemoveImage={removePlanImage} onMove={movePlan} /> : null}
        {section === "app_settings" ? <div className="admin-app-settings"><AdminRechargeSettings settings={data?.settings} busy={busy} onSave={saveRechargeSettings} /><AdminHomeBannerSettings settings={data?.settings} busy={busy} onUpload={uploadHomeBanner} onRemove={removeHomeBanner} /><AdminCompanySettings companyName={data?.settings?.company_name} busy={busy} onSave={saveCompanyName} /><AdminTelegramSettings settings={data?.settings} busy={busy} onSave={saveTelegramUrl} /><AdminWelcomePopupSettings settings={data?.settings} busy={busy} onSave={saveWelcomePopup} /></div> : null}
        {!rows.length && !["overview", "visitors", "users", "crypto", "app_settings", "plan_catalog", "notifications", "support_conversations"].includes(section) ? <div className="admin-empty">No matching records found.</div> : null}
      </div>
    </section>
  </div>;
}

function App() {
  const [auth, setAuth] = useState(readCustomerSession),
    [balance, setBalance] = useState(0),
    [modal, setModal] = useState(null),
    [tab, setTab] = useState("home"),
    [activity, setActivity] = useState([]),
    [purchases, setPurchases] = useState({}),
    [activePlans, setActivePlans] = useState([]),
    [applications, setApplications] = useState([]),
    [paymentQrs, setPaymentQrs] = useState([]),
    [cryptoWallets, setCryptoWallets] = useState([]),
    [bank, setBank] = useState(null),
    [referral, setReferral] = useState(null),
    [vipActive, setVipActive] = useState(false),
    [vipActivationPurchased, setVipActivationPurchased] = useState(false),
    [notifications, setNotifications] = useState([]),
    [showNotifications, setShowNotifications] = useState(false);
  const [withdrawalAvailable, setWithdrawalAvailable] = useState(false);
  const [withdrawalMessage, setWithdrawalMessage] = useState("Complete a recharge and wait for admin approval to unlock withdrawal.");
  const [assignedManualQrId, setAssignedManualQrId] = useState(null);
  const [minimumRecharge, setMinimumRecharge] = useState(100);
  const [firstRechargeAmount, setFirstRechargeAmount] = useState(100);
  const [customerPlans, setCustomerPlans] = useState(defaultPlans);
  const [companyName, setCompanyName] = useState(COMPANY_NAME);
  const [telegramUrl, setTelegramUrl] = useState(DEFAULT_TELEGRAM_URL);
  const [homeBannerUrl, setHomeBannerUrl] = useState("/assets/nivesh-plan-banner.webp");
  const [welcomePopup, setWelcomePopup] = useState({
    enabled: true,
    title: "Welcome to BroCode",
    message: "Create your account, review the available services, and manage your wallet from one place.",
    buttonText: "Continue",
  });
  const [planModal, setPlanModal] = useState(null);
  const [resultModal, setResultModal] = useState(null);
  const [showTelegramJoin, setShowTelegramJoin] = useState(false);
  const [homePlanCategory, setHomePlanCategory] = useState("plan");
  const [homePlanView, setHomePlanView] = useState("list");
  useEffect(() => {
    const visitorId = anonymousTrackingId(localStorage, VISITOR_ID_KEY, "visitor");
    const sessionId = anonymousTrackingId(sessionStorage, VISIT_SESSION_KEY, "session");
    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).hostname : ""; } catch { referrer = ""; }
    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, session_id: sessionId, path: window.location.pathname || "/", referrer }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  const loadPaymentQrs = useCallback(async () => {
    const response = await fetch("/api/payment-qrs", { cache: "no-store" });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error("Could not load payment QR settings");
    const nextQrs = rows.map((row) => ({ id: row.id, upiId: row.upi_id, payee: row.payee, adminLabel: row.admin_label || "", source: row.source || "manual", imageUrl: row.image_url || "", preferred: Boolean(row.preferred) }));
    setPaymentQrs(nextQrs);
    return nextQrs;
  }, []);
  const loadCryptoWallets = useCallback(async () => {
    const response = await fetch("/api/crypto-wallets", { cache: "no-store" });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error("Could not load crypto recharge settings");
    setCryptoWallets(rows);
    return rows;
  }, []);
  const refreshConfig = useCallback(async () => {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh app settings");
    const config = await response.json();
      if (config.company_name) setCompanyName(config.company_name);
      if (config.telegram_url) setTelegramUrl(config.telegram_url);
      if (Number(config.minimum_recharge) > 0) setMinimumRecharge(Number(config.minimum_recharge));
      if (Number(config.first_recharge_amount) > 0) setFirstRechargeAmount(Number(config.first_recharge_amount));
      if (config.home_banner_url) setHomeBannerUrl(config.home_banner_url);
      if (config.welcome_popup) setWelcomePopup(config.welcome_popup);
      if (Array.isArray(config.plans) && config.plans.length) setCustomerPlans(config.plans);
      if (Array.isArray(config.payment_qrs)) setPaymentQrs(config.payment_qrs.map((row) => ({ id: row.id, upiId: row.upi_id, payee: row.payee, adminLabel: row.admin_label || "", source: row.source || "manual", imageUrl: row.image_url || "", preferred: Boolean(row.preferred) })));
      if (Array.isArray(config.crypto_wallets)) setCryptoWallets(config.crypto_wallets);
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") refreshConfig().catch(() => {}); };
    refresh();
    const interval = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshConfig]);
  const handleAuthenticated = useCallback((data) => {
    const rememberLogin = data.remember_login !== false;
    const savedAuth = { ...data, remember_login: rememberLogin };
    storeCustomerSession(savedAuth, rememberLogin);
    setTab("home");
    setModal(null);
    setShowTelegramJoin(true);
    setAuth(savedAuth);
  }, []);
  const oldUpdate = (n) => {
    if (n < 0 && balance < Math.abs(n)) {
      setActivity((a) => [
        {
          name: "Withdraw failed",
          amount: 0,
          time: "Insufficient balance",
        },
        ...a,
      ]);
      return;
    }
    setBalance((b) => b + n);
    setActivity((a) => [
      {
        name: n > 0 ? "Recharge" : "Withdrawal",
        amount: n,
        time: "Just now",
      },
      ...a,
    ]);
  };
  const oldBuyPlan = (p) => {
    const bought = purchases[p.id] || 0;
    if (bought >= p.limit) return;
    if (balance < p.amount) {
      setActivity((a) => [
        {
          name: `${durationLabel(p.days, p.durationUnit)} Plan failed`,
          amount: 0,
          time: "Insufficient balance",
        },
        ...a,
      ]);
      return;
    }
    setBalance((b) => b - p.amount);
    setPurchases((x) => ({ ...x, [p.id]: bought + 1 }));
    setActivePlans((items) => [
      {
        id: `${p.id}-${Date.now()}`,
        name: `${durationLabel(p.days, p.durationUnit)} Plan`,
        invested: p.amount,
        dailyEarning: p.dailyEarning ?? Math.round((p.totalReturn - p.amount) / p.days),
        totalReturn: p.totalReturn,
        days: p.days,
        durationUnit: p.durationUnit || "days",
        payoutMode: p.payoutMode || "maturity",
        creditedDays: 0,
        purchasedAt: "Just now",
      },
      ...items,
    ]);
    setActivity((a) => [
      {
        name: `${durationLabel(p.days, p.durationUnit)} Plan purchased`,
        amount: -p.amount,
        time: `${bought + 1}/${p.limit} purchase`,
      },
      ...a,
    ]);
  };
  const oldRechargeWithRazorpay = async (amount) => {
    const orderResponse = await fetch("/api/payment/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok)
      throw new Error(order.error || "Could not create the payment order.");
    await loadRazorpay();
    await new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "BroCode",
        description: "Wallet Recharge",
        order_id: order.id,
        theme: { color: "#0b2d63" },
        handler: async (payment) => {
          try {
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payment),
            });
            const result = await verifyResponse.json();
            if (!verifyResponse.ok || !result.verified)
              throw new Error(result.error || "Payment could not be verified.");
            update(result.amount);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancel kar diya gaya.")),
        },
      });
      checkout.on("payment.failed", (response) =>
        reject(new Error(response.error?.description || "Payment failed.")),
      );
      checkout.open();
    });
  };
  const api = useCallback(async (url, options) => {
    const response = await fetch(url, { ...options, headers: { ...options?.headers, ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "The server could not complete this request.");
    return data;
  }, [auth?.token]);
  const loadNotifications = useCallback(async () => {
    const data = await api("/api/notifications");
    setNotifications((data.notifications || []).map((item) => ({ id: item.id, title: item.title, message: item.message, createdAt: item.created_at, isRead: Boolean(item.is_read) })));
  }, [api]);
  // Pop the panel open as soon as an admin pushes something the user has not
  // read yet - both on the poll that first sees it and on a fresh app open.
  const seenNotificationIds = React.useRef(new Set());
  useEffect(() => {
    const unseenUnread = notifications.some((item) => !item.isRead && !seenNotificationIds.current.has(item.id));
    notifications.forEach((item) => seenNotificationIds.current.add(item.id));
    if (unseenUnread) setShowNotifications(true);
  }, [notifications]);
  const markAllNotificationsRead = async () => {
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    try { await api("/api/notifications/read-all", { method: "POST" }); }
    catch { loadNotifications().catch(() => {}); }
  };
  const loadDashboard = useCallback(async () => {
    const data = await api(`/api/dashboard?_=${Date.now()}`, { cache: "no-store" });
    const rememberLogin = data.remember_login !== false;
    setAuth((current) => {
      if (!current) return current;
      const savedAuth = { ...current, user: { ...current.user, ...data.user }, remember_login: rememberLogin };
      storeCustomerSession(savedAuth, rememberLogin);
      return current.remember_login === rememberLogin ? current : savedAuth;
    });
    setBalance(data.user.balance);
    setAssignedManualQrId(data.manual_payment_qr_id || null);
    setWithdrawalAvailable(Boolean(data.withdrawal_available));
    setWithdrawalMessage(data.withdrawal_message || "");
    setVipActive(Boolean(data.vip_active));
    setVipActivationPurchased(Boolean(data.vip_activation_purchased));
    setNotifications((data.notifications || []).map((item) => ({ id: item.id, title: item.title, message: item.message, createdAt: item.created_at, isRead: Boolean(item.is_read) })));
    setReferral(data.referral);
    setBank(data.bank ? { beneficiary: data.bank.beneficiary, ifsc: data.bank.ifsc, account: data.bank.account_last4 } : null);
    setActivePlans(data.active_plans.map((p) => ({
      id: p.id, name: `${durationLabel(p.duration_days, p.duration_unit)} Plan`, invested: p.invested,
      dailyEarning: p.daily_earning, totalReturn: p.total_return,
      planId: p.plan_id, days: p.duration_days, durationUnit: p.duration_unit || "days", status: p.status, payoutMode: p.payout_mode || "maturity", creditedDays: p.credited_days || 0, purchasedAt: new Date(p.purchased_at).toLocaleDateString("en-IN"),
    })));
    setPurchases(data.active_plans.reduce((counts, p) => ({ ...counts, [p.plan_id]: (counts[p.plan_id] || 0) + 1 }), {}));
    setApplications([
      ...data.recharges.map((record) => ({
        id: `recharge-${record.id}`, type: "recharge", amount: record.amount, status: record.status,
        reference: `RCG-${String(record.id).padStart(6, "0")}`, createdAt: record.created_at,
      })),
      ...(data.crypto_recharges || []).map((record) => ({
        id: `crypto-${record.id}`, type: "recharge", label: `Crypto Recharge (${cryptoAssetLabel(record.coin)})`, amount: record.amount_inr, currency: cryptoAssetLabel(record.coin), feeInr: record.fee_inr, creditedInr: record.credited_inr, status: record.status,
        reference: `CRYPTO-${String(record.id).padStart(6, "0")}`, createdAt: record.created_at,
      })),
      ...data.withdrawals.map((record) => ({
        id: `withdrawal-${record.id}`, type: "withdrawal", amount: record.amount, feeAmount: record.fee_amount, payoutAmount: record.payout_amount, status: record.status,
        reference: record.receipt_reference || `WD-${String(record.id).padStart(6, "0")}`, createdAt: record.created_at, receiptAt: record.receipt_at || record.created_at, receiptAmount: record.receipt_amount, receiptOrder: Number(record.receipt_sort_order) || record.id,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    const pending = data.recharges.filter((r) => r.status === "pending").map((r) => ({
      name: "Recharge verification pending", amount: r.amount, time: `UTR ••••${r.utr.slice(-4)}`,
    }));
    const names = { recharge: "Recharge approved", crypto_recharge: "Crypto recharge approved", withdrawal: "Withdrawal requested", plan_purchase: "Plan purchased", plan_return: "Plan return credited", plan_daily_earning: "Daily plan earning credited", referral_bonus: "Referral bonus", signup_bonus: "New account signup bonus", admin_credit: "Bonus / amount added by admin", admin_debit: "Amount adjusted by admin" };
    setActivity([...pending, ...data.transactions.map((t) => ({
      name: names[t.kind] || t.kind, amount: t.amount, time: new Date(t.created_at).toLocaleString("en-IN"),
    }))]);
  }, [api]);
  useEffect(() => {
    if (!auth?.token) return undefined;
    loadDashboard().catch((error) => {
      if (error.message === "Authentication required" || error.message.includes("disabled by the administrator")) { clearCustomerSession(); setAuth(null); }
      else setActivity([{ name: "Backend connection failed", amount: 0, time: error.message }]);
    });
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDashboard().catch(() => {});
    }, 30000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadDashboard().catch(() => {});
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [auth?.token, loadDashboard]);
  const update = async (request) => {
    if (typeof request === "number" && request >= 0) return;
    const withdrawal = typeof request === "number"
      ? { amount: Math.abs(request), payoutMethod: "bank", upiId: null }
      : request;
    const result = await api("/api/withdrawals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: withdrawal.amount, payout_method: withdrawal.payoutMethod, upi_id: withdrawal.upiId, request_key: withdrawal.requestKey }),
    });
    const submittedRecord = {
      id: `withdrawal-${result.id}`,
      type: "withdrawal",
      amount: result.amount,
      feeAmount: result.fee_amount,
      payoutAmount: result.payout_amount,
      status: result.status || "requested",
      reference: result.reference || `WD-${String(result.id).padStart(6, "0")}`,
      createdAt: new Date().toISOString(),
      receiptAt: new Date().toISOString(),
      receiptAmount: null,
      receiptOrder: Number(result.id) || Date.now(),
    };
    const showSubmittedWithdrawal = (current) => current.some((item) => item.id === submittedRecord.id) ? current : [submittedRecord, ...current];
    setApplications(showSubmittedWithdrawal);
    await loadDashboard();
    setApplications(showSubmittedWithdrawal);
    setResultModal({ type: "withdrawal", reference: result.reference, payoutMethod: result.payout_method, amount: result.amount, feeAmount: result.fee_amount, payoutAmount: result.payout_amount });
  };
  const buyPlan = async (p, quantity, requestKey) => {
    const result = await api("/api/plans/purchase", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan_id: p.id, quantity, request_key: requestKey }),
    });
    await loadDashboard();
    setPlanModal(null);
    setResultModal({ type: "plan", reference: result.reference, quantity: result.quantity, dailyEarning: result.daily_earning, totalCost: result.total_cost });
  };
  const action = (t) => {
    setModal(t);
    if (t === "recharge" && (!paymentQrs.length || !cryptoWallets.length)) Promise.allSettled([loadPaymentQrs(), loadCryptoWallets()]);
  };
  const saveBank = async (d) => {
    const saved = await api("/api/bank", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
    setBank({ beneficiary: saved.beneficiary, ifsc: saved.ifsc, account: saved.account_last4 });
  };
  const startRecharge = async (request) => api("/api/recharge-drafts", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: request.amount, upi_id: request.upiId, payment_qr_id: request.paymentQrId }),
  });
  const addPendingRecharge = async (request) => {
    const result = await api("/api/recharges", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: request.amount, utr: request.utr, upi_id: request.upiId, payment_qr_id: request.paymentQrId, draft_id: request.draftId }),
    });
    await loadDashboard();
    setResultModal({ type: "recharge", reference: result.reference });
  };
  const addCryptoRecharge = async (request) => {
    const result = await api("/api/crypto-recharges", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ coin: request.coin, amount_inr: request.amount, txid: request.txid }),
    });
    await loadDashboard();
    setResultModal({ type: "crypto", reference: result.reference });
  };
  if (!auth?.token) return <div className="app auth-app"><AuthScreen onAuthenticated={handleAuthenticated} companyName={companyName} welcomePopup={welcomePopup} /></div>;
  const logout = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    clearCustomerSession();
    setTab("home");
    setModal(null);
    setPlanModal(null);
    setResultModal(null);
    setShowTelegramJoin(false);
    setBalance(0);
    setActivity([]);
    setPurchases({});
    setActivePlans([]);
    setApplications([]);
    setBank(null);
    setReferral(null);
    setVipActive(false);
    setVipActivationPurchased(false);
    setNotifications([]);
    setShowNotifications(false);
    setAuth(null);
  };
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;
  return (
    <div className="app public-demo">
      <main>
        {tab === "support" ? (
          <SupportPage api={api} onBack={() => setTab("profile")} />
        ) : tab === "blog" ? (
          <WithdrawalBlogPage api={api} onBack={() => setTab("profile")} />
        ) : tab === "profile" ? (
            <Profile bank={bank} onSave={saveBank} onAction={action} onSupport={() => setTab("support")} onBlog={() => setTab("blog")} user={auth.user} balance={balance} onLogout={logout} activity={activity} activePlans={activePlans} referral={referral} companyName={companyName} />
        ) : tab === "plans" ? (
          <PlansHub activePlans={activePlans} />
        ) : tab === "wallet" ? (
          <WalletPage balance={balance} activity={activity} applications={applications} onAction={action} />
        ) : tab === "referral" ? (
          <ReferralPage referral={referral} />
        ) : (
          <>
            <header>
              <div>
                <CompanyLogo className="brand" name={companyName} />
                <p>Welcome, {auth.user.name}!</p>
              </div>
            </header>
            <button className="kyc" onClick={() => setTab("profile")}>
              <span className="kyc-icon">
                <UserRound />
              </span>
              <span>
                <b>KYC Status</b>
                <small>Secure account</small>
              </span>
              <em>Protected</em>
              <ChevronRight />
            </button>
            <section className="home-photo-banner" aria-label="Featured home photo">
              <img src={homeBannerUrl} alt="Featured customer home" />
            </section>
            <div className="actions">
              <button onClick={() => action("recharge")}>
                <Plus />
                Recharge
              </button>
              <button onClick={() => action("withdraw")}>
                <ArrowUpFromLine />
                Withdraw
              </button>
            </div>
            <p className="demo-note">
              <ShieldCheck /> All financial actions are protected by your session.
            </p>
            <section className="plans">
              <div className="section-title plan-section-title">
                <h2>All Plans</h2>
                <div className="plan-view-toggle" role="group" aria-label="Plan view">
                  <button type="button" className={homePlanView === "list" ? "active" : ""} aria-label="Show plans in list view" aria-pressed={homePlanView === "list"} onClick={() => setHomePlanView("list")}><Layers3 /></button>
                  <button type="button" className={homePlanView === "gallery" ? "active" : ""} aria-label="Show plans in gallery view" aria-pressed={homePlanView === "gallery"} onClick={() => setHomePlanView("gallery")}><LayoutDashboard /></button>
                </div>
              </div>
              <div className="plan-category-tabs" role="tablist" aria-label="Plan categories">
                {[['plan', 'Plan'], ['benefit', 'Benefit'], ['vip', 'VIP']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={homePlanCategory === id} className={homePlanCategory === id ? "active" : ""} onClick={() => setHomePlanCategory(id)}>{label}</button>)}
              </div>
              {customerPlans.some((plan) => (plan.category || "plan") === homePlanCategory)
                ? <div className={`plan-list ${homePlanView === "gallery" ? "gallery-view" : "list-view"}`}>{customerPlans.filter((plan) => (plan.category || "plan") === homePlanCategory).map((plan) => <Plan key={plan.id} p={plan} bought={purchases[plan.id] || 0} onBuy={setPlanModal} demo={false} companyName={companyName} vipActive={vipActive} vipActivationPurchased={vipActivationPurchased} />)}</div>
                : <div className="plan-category-empty"><b>{homePlanCategory === "vip" ? "VIP" : homePlanCategory === "benefit" ? "Benefit" : "Plan"} plans</b><span>Coming soon</span></div>}
            </section>
            <section className="recent">
              <div className="section-title">
                <h2>Recent Activity</h2>
              </div>
              {activity.length ? (
                activity.map((a, i) => (
                  <div className="activity" key={i}>
                    <CheckCircle2 />
                    <span>
                      <b>{a.name}</b>
                      <small>{a.time}</small>
                    </span>
                    <strong>
                      {a.amount ? `₹${money(Math.abs(a.amount))}` : "—"}
                    </strong>
                  </div>
                ))
              ) : (
                <div className="empty">No activity yet.</div>
              )}
            </section>
          </>
        )}
      </main>
      <nav>
        {[
          ["home", Home, "Home"],
          ["plans", Layers3, "Plans"],
          ["wallet", WalletCards, "Wallet"],
          ["referral", UserPlus, "Referral"],
          ["profile", UserRound, "Profile"],
        ].map(([id, I, l]) => (
          <button
            key={id}
            className={tab === id || (["support", "blog"].includes(tab) && id === "profile") ? "selected" : ""}
            onClick={() => {
              setTab(id);
              if (id === "wallet") loadDashboard().catch(() => {});
            }}
          >
            <I />
            <span>{l}</span>
          </button>
        ))}
      </nav>
      {modal ? (
        <Modal
          type={modal}
          bank={bank}
          onClose={() => setModal(null)}
          onAdd={update}
          onRechargeStarted={startRecharge}
          onPendingRecharge={addPendingRecharge}
          onCryptoRecharge={addCryptoRecharge}
          paymentQrs={paymentQrs}
          cryptoWallets={cryptoWallets}
          minimumRecharge={minimumRecharge}
          rechargePresets={[firstRechargeAmount, ...DEFAULT_RECHARGE_PRESETS.slice(1)]}
          minimumWithdrawal={1000}
          withdrawalAvailable={withdrawalAvailable}
          withdrawalMessage={withdrawalMessage}
          customerId={auth.user.id}
          assignedManualQrId={assignedManualQrId}
        />
      ) : null}
      {planModal ? <PlanPurchaseModal plan={planModal} bought={purchases[planModal.id] || 0} onClose={() => setPlanModal(null)} onConfirm={buyPlan} /> : null}
      {resultModal ? <ResultModal result={resultModal} onClose={() => setResultModal(null)} /> : null}
      {showTelegramJoin ? <TelegramJoinModal onClose={() => setShowTelegramJoin(false)} companyName={companyName} telegramUrl={telegramUrl} /> : null}
      {showNotifications ? <NotificationPanel notifications={notifications} onClose={() => setShowNotifications(false)} onMarkAll={markAllNotificationsRead} /> : null}
      <FloatingDock api={api} unreadCount={unreadNotificationCount} onOpenNotifications={() => setShowNotifications(true)} />
    </div>
  );
}
// Cache the root so hot reloads re-render instead of calling createRoot twice.
const rootElement = document.getElementById("root");
const reactRoot = (rootElement.__brocodeRoot ||= createRoot(rootElement));
reactRoot.render(window.location.pathname.replace(/\/$/, "") === "/admin" ? <AdminDashboard /> : <App />);

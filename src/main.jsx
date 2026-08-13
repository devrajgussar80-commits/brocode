/* Customer application entry point.
 * The admin dashboard is deliberately NOT imported here, so no admin code is
 * shipped to customers. The admin UI is served separately by the backend.
 */
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine, ArrowUpFromLine, ChevronRight, CircleUser, Gift, House,
  Layers3, LayoutDashboard, ShieldCheck, TrendingUp, Wallet,
} from "lucide-react";
import {
  AuthScreen, COMPANY_NAME, CompanyLogo, DEFAULT_TELEGRAM_URL, FloatingDock, Modal,
  NotificationPanel, Plan, PlanPurchaseModal, PlansHub, Profile, ReferralPage,
  ResultModal, SupportPage, TelegramJoinModal, VISITOR_ID_KEY, VISIT_SESSION_KEY, WalletPage,
  WithdrawalBlogPage, anonymousTrackingId, clearCustomerSession, cryptoAssetLabel, defaultPlans, durationLabel,
  money, readCustomerSession, storeCustomerSession, API_BASE, DEFAULT_RECHARGE_PRESETS,
} from "./shared.jsx";

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
  const [homeBannerUrl, setHomeBannerUrl] = useState("/assets/brocode-plan-banner.webp");
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
    fetch(API_BASE + "/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, session_id: sessionId, path: window.location.pathname || "/", referrer }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  const loadPaymentQrs = useCallback(async () => {
    const response = await fetch(API_BASE + "/api/payment-qrs", { cache: "no-store" });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error("Could not load payment QR settings");
    const nextQrs = rows.map((row) => ({ id: row.id, upiId: row.upi_id, payee: row.payee, adminLabel: row.admin_label || "", source: row.source || "manual", imageUrl: row.image_url || "", preferred: Boolean(row.preferred) }));
    setPaymentQrs(nextQrs);
    return nextQrs;
  }, []);
  const loadCryptoWallets = useCallback(async () => {
    const response = await fetch(API_BASE + "/api/crypto-wallets", { cache: "no-store" });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error("Could not load crypto recharge settings");
    setCryptoWallets(rows);
    return rows;
  }, []);
  const refreshConfig = useCallback(async () => {
    const response = await fetch(API_BASE + "/api/config", { cache: "no-store" });
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
            <section className="home-photo-banner" aria-label="Featured home photo">
              <img src={homeBannerUrl} alt="Featured customer home" />
            </section>
            <div className="actions actions-stacked">
              <button className="action-recharge" onClick={() => action("recharge")}>
                <ArrowDownToLine />
                Recharge
              </button>
              <button className="action-withdraw" onClick={() => action("withdraw")}>
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
          </>
        )}
      </main>
      <nav>
        {[
          ["home", House, "Home"],
          ["plans", TrendingUp, "Invest"],
          ["wallet", Wallet, "Wallet"],
          ["referral", Gift, "Invite"],
          ["profile", CircleUser, "Account"],
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

const rootElement = document.getElementById("root");
const reactRoot = (rootElement.__brocodeRoot ||= createRoot(rootElement));
reactRoot.render(<App />);

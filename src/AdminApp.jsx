/* Admin dashboard. Served only by the backend at /admin - this module is never
 * part of the customer bundle deployed to Vercel.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Bell, Building2, CalendarDays,
  ChevronRight, Clock3, ExternalLink, Eye, FileText, Gift,
  Globe2, Headphones, Home, Image as ImageIcon, IndianRupee, Layers3, LayoutDashboard,
  LockKeyhole, LogOut, Moon, MousePointerClick, Plus, RefreshCw,
  Search, ShieldCheck, Sun, Trash2, TrendingUp, UploadCloud,
  UserPlus, UserRound, Users, WalletCards, X, Zap,
} from "lucide-react";
import {
  DEFAULT_TELEGRAM_URL, Plan, apiErrorMessage, cryptoAssetLabel, durationLabel, generateAdminPasswordSuggestion,
  money, normalizePlanImageToDataUrl, receiptFileToDataUrl, withdrawalDateTime,
} from "./shared.jsx";
// Original project stylesheet, copied in verbatim so the admin renders exactly
// as it did before the redesign. Loaded after the customer styles.css.
import "./admin-legacy.css";
// Loaded after shared.jsx (and therefore after styles.css) so the admin theme
// overrides the customer app's black/gold palette. Everything in it is scoped
// under .admin-shell, so the two themes cannot bleed into each other.
import "./admin.css";

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
    {plan ? <div className="admin-plan-photo"><img src={plan.image_name ? `/api/plan-images/${plan.id}?v=${encodeURIComponent(plan.image_updated_at || plan.updated_at || "")}` : "/assets/brocode-plan-banner.webp"} alt={`${draft.name} preview`} /><label className="admin-plan-photo-upload"><UploadCloud /> {plan.image_name ? "Replace & Auto-fit" : "Upload & Auto-fit"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadImage(plan.id, file); event.target.value = ""; }} disabled={busy} /></label>{plan.image_name ? <button className="admin-plan-photo-remove" type="button" disabled={busy} onClick={() => onRemoveImage(plan.id)}>Remove Photo</button> : null}</div> : <div className="admin-plan-photo-hint">Add the plan first, then upload its photo.</div>}
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
  const imageUrl = settings?.home_banner_name ? `/api/home-banner?v=${encodeURIComponent(settings.home_banner_updated_at || "")}` : "/assets/brocode-plan-banner.webp";
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

export default AdminDashboard;

import base64, binascii, hashlib, hmac, json, os, re, secrets
from urllib.request import Request, urlopen
from contextlib import contextmanager

import db as database
from db import IntegrityError, add_column, db
from schema import INDEXES, SCHEMA
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet, InvalidToken

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("NIVESH_DB_PATH", BASE_DIR / "nivesh.db"))
RECEIPT_DIR = Path(os.getenv("NIVESH_RECEIPT_DIR", DB_PATH.parent / "withdrawal_receipts"))
PLAN_IMAGE_DIR = Path(os.getenv("NIVESH_PLAN_IMAGE_DIR", DB_PATH.parent / "plan_images"))
HOME_BANNER_DIR = Path(os.getenv("NIVESH_HOME_BANNER_DIR", DB_PATH.parent / "home_banner"))
BANK_DATA_KEY_FILE = Path(os.getenv("NIVESH_BANK_DATA_KEY_FILE", DB_PATH.parent / "bank_data_key"))
ADMIN_TOKEN = os.getenv("NIVESH_ADMIN_TOKEN", "dev-admin-change-me")
_admin_token_file = os.getenv("NIVESH_ADMIN_TOKEN_FILE", "").strip()
ADMIN_TOKEN_FILE = Path(_admin_token_file) if _admin_token_file else None
if ADMIN_TOKEN_FILE and ADMIN_TOKEN_FILE.exists():
    _persisted_admin_token = ADMIN_TOKEN_FILE.read_text(encoding="utf-8").strip()
    if _persisted_admin_token:
        ADMIN_TOKEN = _persisted_admin_token
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "https://speedaccountingdevraj.pythonanywhere.com/").strip()
DEFAULT_TELEGRAM_URL = "https://t.me/BajjajFinanceDigitalService"
REFERRAL_BONUS = 50
SIGNUP_BONUS = 50
WITHDRAWAL_FEE_PERCENT = 5
INDIA_TIME_ZONE = timezone(timedelta(hours=5, minutes=30))
CRYPTO_FEE_PERCENT = 15
USDT_NET_INR_PER_UNIT = 92.5
CRYPTO_NETWORKS = {
    "USDT_ETH": "ERC20 (Ethereum)",
    "USDT_BNB": "BEP20 (BNB Smart Chain)",
    "USDT_TRX": "TRC20 (TRON)",
    "USDT_TON": "TON Jetton",
    "USDT": "Unassigned",
}
CUSTOMER_CRYPTO_NETWORKS = ("USDT_ETH", "USDT_BNB", "USDT_TRX", "USDT_TON")
CRYPTO_LABELS = {coin: "USDT" for coin in CRYPTO_NETWORKS}
PLANS = {
    "p1": {"days": 1, "amount": 100, "total_return": 180, "limit": 5},
    "p9": {"days": 14, "amount": 570, "total_return": 1680, "daily_earning": 120, "payout_mode": "daily", "limit": 1},
    "p2": {"days": 2, "amount": 300, "total_return": 765, "limit": 5},
    "p3": {"days": 5, "amount": 1000, "total_return": 1895, "limit": 5},
    "p4": {"days": 7, "amount": 5000, "total_return": 11476, "daily_earning": 925, "payout_mode": "daily", "limit": 1},
    "p5": {"days": 180, "amount": 7500, "total_return": 33500, "limit": 1},
    "p6": {"days": 15, "amount": None, "total_return": None, "limit": 0, "coming_soon": True},
    "p7": {"days": 30, "amount": None, "total_return": None, "limit": 0, "coming_soon": True},
    "p8": {"days": 365, "amount": None, "total_return": None, "limit": 0, "coming_soon": True},
}

def now(): return datetime.now(timezone.utc)
def now_iso(): return now().isoformat()

def withdrawal_blocked_today(con, user_id):
    latest = con.execute("SELECT purchased_at FROM active_plans WHERE user_id=? ORDER BY id DESC LIMIT 1", (user_id,)).fetchone()
    if not latest or not latest["purchased_at"]:
        return False
    purchased_at = datetime.fromisoformat(latest["purchased_at"])
    if purchased_at.tzinfo is None:
        purchased_at = purchased_at.replace(tzinfo=timezone.utc)
    return purchased_at.astimezone(INDIA_TIME_ZONE).date() == now().astimezone(INDIA_TIME_ZONE).date()

def user_has_approved_deposit(con, user_id):
    return bool(con.execute("""
        SELECT EXISTS(SELECT 1 FROM recharges WHERE user_id=? AND status='approved')
            OR EXISTS(SELECT 1 FROM crypto_recharges WHERE user_id=? AND status='approved')
    """, (user_id, user_id)).fetchone()[0])

def assigned_manual_payment_qr(con, user_id):
    if not con.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
        return None
    return con.execute("""
        SELECT id,admin_label
        FROM payment_qrs
        WHERE source='uploaded'
          AND image_blob IS NOT NULL
          AND lower(trim(admin_label || ' ' || payee)) LIKE '%jayesh%'
        ORDER BY id
        LIMIT 1
    """).fetchone()

def validate_payment_qr_for_user(con, user_id, payment_qr_id):
    if payment_qr_id is None:
        assigned = assigned_manual_payment_qr(con, user_id)
        return assigned["id"] if assigned else None
    qr = con.execute("SELECT id,source FROM payment_qrs WHERE id=? AND source='uploaded' AND image_blob IS NOT NULL", (payment_qr_id,)).fetchone()
    if not qr:
        raise HTTPException(409, "Only an uploaded manual payment QR can be used")
    assigned = assigned_manual_payment_qr(con, user_id)
    if not assigned or assigned["id"] != payment_qr_id:
        raise HTTPException(409, "This manual payment QR is not assigned to your account")
    return payment_qr_id

def load_bank_cipher():
    configured_key = os.getenv("NIVESH_BANK_DATA_KEY", "").strip()
    if configured_key:
        return Fernet(configured_key.encode())
    BANK_DATA_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not BANK_DATA_KEY_FILE.exists():
        key = Fernet.generate_key()
        try:
            BANK_DATA_KEY_FILE.write_bytes(key)
            os.chmod(BANK_DATA_KEY_FILE, 0o600)
        except FileExistsError:
            pass
    return Fernet(BANK_DATA_KEY_FILE.read_bytes().strip())

BANK_CIPHER = load_bank_cipher()

def encrypt_bank_account(account): return BANK_CIPHER.encrypt(account.encode()).decode()
def decrypt_bank_account(encrypted):
    if not encrypted: return None
    try: return BANK_CIPHER.decrypt(encrypted.encode()).decode()
    except (InvalidToken, ValueError): return None

def usdt_to_inr(amount_usdt):
    credited_inr = round(amount_usdt * USDT_NET_INR_PER_UNIT)
    gross_inr = round(credited_inr / (1 - CRYPTO_FEE_PERCENT / 100))
    fee_inr = gross_inr - credited_inr
    return gross_inr, fee_inr, credited_inr

def withdrawal_breakdown(amount):
    fee_amount = (amount * WITHDRAWAL_FEE_PERCENT + 50) // 100
    return fee_amount, amount - fee_amount

def init_db():
    """Create the schema, then run the data seeds and backfills.

    The SQLite version grew its schema incrementally with ~50 add_column calls and
    two table-rebuild migrations. Postgres gets the finished shape in one pass from
    schema.py, so only the seeding and backfill work below is still needed.
    """
    with db() as con:
        for statement in database.split_statements(SCHEMA):
            con.execute(statement)
        for statement in database.split_statements(INDEXES):
            con.execute(statement)
        con.execute("UPDATE withdrawals SET receipt_sort_order=id WHERE receipt_sort_order=0")
        con.execute("UPDATE plan_catalog SET is_active=0,updated_at=? WHERE category='welfare' AND is_active=1", (now_iso(),))
        con.execute("UPDATE plan_catalog SET category='plan',vip_locked=0,vip_activation=0 WHERE category NOT IN ('plan','benefit','vip') OR category IS NULL")
        con.execute("UPDATE plan_catalog SET vip_locked=0,vip_activation=0 WHERE category!='vip'")
        con.execute("UPDATE plan_catalog SET vip_locked=0 WHERE vip_activation=1")
        con.execute("UPDATE plan_catalog SET duration_unit='days' WHERE duration_unit NOT IN ('hours','days') OR duration_unit IS NULL")
        con.execute("UPDATE plan_catalog SET image_updated_at=updated_at WHERE image_name IS NOT NULL AND image_updated_at IS NULL")
        con.execute("UPDATE active_plans SET duration_unit='days' WHERE duration_unit NOT IN ('hours','days') OR duration_unit IS NULL")
        con.execute("UPDATE payment_qrs SET admin_label=payee WHERE trim(admin_label)='' ")
        uploaded_qr_ids = [row["id"] for row in con.execute("SELECT id FROM payment_qrs WHERE source='uploaded' AND image_blob IS NOT NULL ORDER BY id LIMIT 2")]
        for qr_id, label in zip(uploaded_qr_ids, ("Devraj QR", "Jayesh QR")):
            con.execute("UPDATE payment_qrs SET admin_label=? WHERE id=? AND lower(trim(admin_label)) IN ('','manual qr','uploaded qr')", (label,qr_id))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('company_name','BroCode',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('welcome_popup_enabled','1',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('welcome_popup_title','Welcome to BroCode',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('welcome_popup_message','Create your account, review the available services, and manage your wallet from one place.',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('welcome_popup_button','Continue',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('telegram_url',?,?)", (DEFAULT_TELEGRAM_URL,now_iso()))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('minimum_recharge','100',?)", (now_iso(),))
        con.execute("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('first_recharge_amount','100',?)", (now_iso(),))
        con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('payment_qr_mode','uploaded',?) ON CONFLICT(key) DO UPDATE SET value='uploaded',updated_at=excluded.updated_at", (now_iso(),))
        if con.execute("SELECT COUNT(*) FROM plan_catalog").fetchone()[0] == 0:
            for sort_order, (plan_id, plan) in enumerate(PLANS.items()):
                con.execute("INSERT INTO plan_catalog(id,name,days,amount,total_return,daily_earning,payout_mode,purchase_limit,coming_soon,is_active,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)", (plan_id,f"{plan['days']} Day Plan",plan['days'],plan.get('amount'),plan.get('total_return'),plan.get('daily_earning'),plan.get('payout_mode','maturity'),plan.get('limit',1),1 if plan.get('coming_soon') else 0,sort_order,now_iso()))
        con.execute("UPDATE plan_catalog SET name=days||' Day Plan' WHERE name IS NULL OR trim(name)='' ")
        con.execute("UPDATE withdrawals SET payout_amount=amount WHERE payout_amount=0 AND fee_amount=0")
        add_column(con, "transactions", "request_key TEXT")
        con.execute("UPDATE active_plans SET payout_mode='daily',daily_earning=925 WHERE plan_id='p4' AND status='active' AND payout_mode='maturity'")
        for row in con.execute("SELECT id FROM users WHERE public_id IS NULL OR length(public_id)!=5").fetchall():
            while True:
                public_id = str(10000 + secrets.randbelow(90000))
                if not con.execute("SELECT 1 FROM users WHERE public_id=?", (public_id,)).fetchone():
                    con.execute("UPDATE users SET public_id=? WHERE id=?", (public_id, row["id"]))
                    break
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id) WHERE public_id IS NOT NULL")
        con.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_recharges_user_status ON recharges(user_id,status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_recharges_status ON recharges(status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_recharge_drafts_user_status ON recharge_drafts(user_id,status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id,status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_active_plans_user_status ON active_plans(user_id,status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_active_plans_status ON active_plans(status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_referral_rewards_inviter ON referral_rewards(inviter_id,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_crypto_recharges_user_status ON crypto_recharges(user_id,status,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_crypto_recharges_status ON crypto_recharges(status,id)")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_request_key ON withdrawals(user_id,request_key) WHERE request_key IS NOT NULL")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_request_key ON transactions(user_id,request_key) WHERE request_key IS NOT NULL")
        con.execute("CREATE INDEX IF NOT EXISTS idx_withdrawal_receipts_created ON withdrawal_receipts(id DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_plan_catalog_category_sort ON plan_catalog(category,is_active,sort_order,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(id DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id,notification_id)")
        for visitor in con.execute("""SELECT e.visitor_id,MIN(e.created_at) AS first_seen_at,MAX(e.created_at) AS last_seen_at,
                                             COUNT(*) AS visit_count,
                                             COALESCE((SELECT first_event.referrer FROM visitor_events first_event WHERE first_event.visitor_id=e.visitor_id ORDER BY first_event.id LIMIT 1),'') AS first_referrer,
                                             COALESCE((SELECT last_event.path FROM visitor_events last_event WHERE last_event.visitor_id=e.visitor_id ORDER BY last_event.id DESC LIMIT 1),'/') AS last_path
                                      FROM visitor_events e
                                      LEFT JOIN visitor_profiles p ON p.visitor_id=e.visitor_id
                                      WHERE p.id IS NULL GROUP BY e.visitor_id ORDER BY MIN(e.id)""").fetchall():
            cur = con.execute("INSERT INTO visitor_profiles(visitor_id,visitor_code,first_seen_at,last_seen_at,visit_count,first_referrer,last_path) VALUES(?,?,?,?,?,?,?)", (visitor["visitor_id"],None,visitor["first_seen_at"],visitor["last_seen_at"],visitor["visit_count"],visitor["first_referrer"],visitor["last_path"]))
            con.execute("UPDATE visitor_profiles SET visitor_code=? WHERE id=?", (f"VIS{cur.lastrowid}",cur.lastrowid))
        con.execute("UPDATE visitor_profiles SET last_action='popup_seen' WHERE last_action='visited'")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_profiles_code ON visitor_profiles(visitor_code)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_visitor_profiles_seen ON visitor_profiles(last_seen_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_visitor_profiles_user ON visitor_profiles(registered_user_id)")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_events_session_path ON visitor_events(session_id,path)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON visitor_events(created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor ON visitor_events(visitor_id,created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_support_conversations_updated ON support_conversations(updated_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id,id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(sender,read_at,user_id)")
        if con.execute("SELECT COUNT(*) FROM payment_qrs").fetchone()[0] == 0:
            timestamp = now_iso()
            con.executemany("INSERT INTO payment_qrs(upi_id,payee,admin_label,created_at,updated_at) VALUES(?,?,?,?,?)", [
                ("38gusar600@fam", "FamPay Wallet", "FamPay QR", timestamp, timestamp),
                ("neogen@slc", "Payment Wallet", "Slice QR", timestamp, timestamp),
                ("ravi24gusar78@yesfam", "Payment Wallet", "SBI QR", timestamp, timestamp),
            ])
        timestamp = now_iso()
        legacy_usdt = con.execute("SELECT network,address FROM crypto_wallets WHERE coin='USDT'").fetchone()
        con.executemany("INSERT OR IGNORE INTO crypto_wallets(coin,network,address,updated_at) VALUES(?,?,?,?)", [(coin, network, "", timestamp) for coin, network in CRYPTO_NETWORKS.items()])
        if legacy_usdt and legacy_usdt["network"].upper() in {"TRC20", "TRON"} and legacy_usdt["address"].strip():
            con.execute("UPDATE crypto_wallets SET address=?,updated_at=? WHERE coin='USDT_TRX' AND trim(address)=''", (legacy_usdt["address"], timestamp))
        con.execute("UPDATE crypto_wallets SET network='Unassigned',address='',updated_at=? WHERE coin='USDT' AND network!='Unassigned'", (timestamp,))
        placeholders = ",".join("?" for _ in CRYPTO_NETWORKS)
        con.execute(f"DELETE FROM crypto_wallets WHERE coin NOT IN ({placeholders})", tuple(CRYPTO_NETWORKS))

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210000).hex()
    return f"{salt}${digest}"

def verify_password(password, stored):
    if not stored or "$" not in stored: return False
    salt, _ = stored.split("$", 1)
    return hmac.compare_digest(password_hash(password, salt), stored)

def session_for(con, user_id):
    token = secrets.token_urlsafe(32)
    user = con.execute("SELECT remember_login FROM users WHERE id=?", (user_id,)).fetchone()
    session_days = 365 if user and user["remember_login"] else 1
    con.execute("INSERT INTO sessions VALUES(?,?,?)", (token, user_id, (now()+timedelta(days=session_days)).isoformat()))
    return token

def new_public_id(con):
    while True:
        public_id = str(10000 + secrets.randbelow(90000))
        if not con.execute("SELECT 1 FROM users WHERE public_id=?", (public_id,)).fetchone():
            return public_id

def settle_matured_plans(con, user_id=None):
    query = "SELECT * FROM active_plans WHERE status='active'"
    args = ()
    if user_id:
        query += " AND user_id=?"
        args = (user_id,)
    settled = 0
    current_time = now()
    for plan in con.execute(query, args).fetchall():
        purchased_at = datetime.fromisoformat(plan["purchased_at"])
        if purchased_at.tzinfo is None: purchased_at = purchased_at.replace(tzinfo=timezone.utc)
        duration_unit = plan["duration_unit"] if plan["duration_unit"] in {"hours", "days"} else "days"
        if plan["payout_mode"] == "daily":
            if duration_unit != "days":
                continue
            elapsed_days = min(plan["duration_days"], max(0, int((current_time - purchased_at).total_seconds() // 86400)))
            due_days = elapsed_days - plan["credited_days"]
            if due_days > 0:
                daily_credit = plan["daily_earning"] * due_days
                credited_at = now_iso()
                con.execute("UPDATE users SET balance=balance+? WHERE id=?", (daily_credit, plan["user_id"]))
                con.execute("UPDATE active_plans SET credited_days=? WHERE id=?", (elapsed_days, plan["id"]))
                con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (plan["user_id"], "plan_daily_earning", daily_credit, f"PLAN-DAILY-{plan['id']:06d}-{elapsed_days:02d}", credited_at))
                completion_credit = max(0, plan["total_return"] - plan["daily_earning"] * plan["duration_days"]) if elapsed_days >= plan["duration_days"] else 0
                if completion_credit:
                    con.execute("UPDATE users SET balance=balance+? WHERE id=?", (completion_credit, plan["user_id"]))
                    con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (plan["user_id"], "plan_return", completion_credit, f"PLAN-COMPLETION-{plan['id']:06d}", credited_at))
                settled += due_days
            if elapsed_days >= plan["duration_days"]:
                con.execute("UPDATE active_plans SET status='completed' WHERE id=? AND status='active'", (plan["id"],))
            continue
        duration_delta = timedelta(hours=plan["duration_days"]) if duration_unit == "hours" else timedelta(days=plan["duration_days"])
        if current_time < purchased_at + duration_delta: continue
        updated = con.execute("UPDATE active_plans SET status='completed' WHERE id=? AND status='active'", (plan["id"],))
        if updated.rowcount != 1: continue
        credited_at = now_iso()
        con.execute("UPDATE users SET balance=balance+? WHERE id=?", (plan["total_return"], plan["user_id"]))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (plan["user_id"], "plan_return", plan["total_return"], f"PLAN-RETURN-{plan['id']:06d}", credited_at))
        settled += 1
    return settled

def telegram_api(method, payload):
    if not TELEGRAM_BOT_TOKEN:
        return False
    body = json.dumps(payload).encode()
    request = Request(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode())
            return bool(result.get("ok"))
    except Exception:
        return False

def current_user(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    with db() as con:
        row = con.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?", (token, now_iso())).fetchone()
        if not row: raise HTTPException(401, "Authentication required")
        if row["is_disabled"] or row["archived_at"]: raise HTTPException(403, "This account has been disabled by the administrator")
        seen_at = now_iso()
        seen_cutoff = (now() - timedelta(minutes=1)).isoformat()
        con.execute("UPDATE users SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)", (seen_at, row["id"], seen_cutoff))
        return dict(row)

def require_admin(x_admin_token: str = Header(default="")):
    if not hmac.compare_digest(x_admin_token, ADMIN_TOKEN): raise HTTPException(401, "Invalid admin token")

class Credentials(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str
    password: str = Field(min_length=8, max_length=128)
    referral_code: str | None = Field(default=None, max_length=16)
    visitor_id: str | None = Field(default=None, min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
class Login(BaseModel):
    email: str
    password: str
    visitor_id: str | None = Field(default=None, min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
class TelegramLogin(BaseModel): init_data: str
class RechargeDraft(BaseModel): amount: int = Field(ge=1, le=100000); upi_id: str = "38gusar600@fam"; payment_qr_id: int | None = Field(default=None, gt=0)
class Recharge(BaseModel): amount: int = Field(ge=1, le=100000); utr: str; upi_id: str = "38gusar600@fam"; draft_id: int | None = None; payment_qr_id: int | None = Field(default=None, gt=0)
class Withdrawal(BaseModel):
    amount: int = Field(ge=1000)
    payout_method: str = "bank"
    upi_id: str | None = Field(default=None, max_length=320)
    request_key: str | None = Field(default=None, min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
class AdminPasswordChange(BaseModel): new_password: str = Field(min_length=12, max_length=128)
class AdminPasswordRecovery(BaseModel):
    recovery_code: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)
class SupportMessageInput(BaseModel):
    message: str = Field(default="", max_length=1000)
    image_data: str | None = Field(default=None, max_length=3000000)
    image_name: str | None = Field(default=None, max_length=120)
class Purchase(BaseModel):
    plan_id: str
    quantity: int = Field(default=1, ge=1, le=5)
    request_key: str | None = Field(default=None, min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
class Bank(BaseModel): beneficiary: str; ifsc: str; account: str
class PaymentQrInput(BaseModel):
    upi_id: str = Field(min_length=5, max_length=320)
    payee: str = Field(min_length=2, max_length=80)
    admin_label: str = Field(min_length=2, max_length=80)
    source: str = Field(default="manual", pattern=r"^(manual|uploaded)$")
    image_data: str | None = Field(default=None, max_length=5_700_000)
class PaymentQrModeInput(BaseModel):
    mode: str = Field(pattern=r"^(manual|uploaded)$")
class CryptoWalletInput(BaseModel): address: str = Field(min_length=8, max_length=256)
class CryptoRechargeInput(BaseModel):
    coin: str = Field(min_length=2, max_length=8)
    amount_inr: int = Field(ge=2, le=100000)
    txid: str = Field(min_length=8, max_length=180)
class WithdrawalReceiptInput(BaseModel):
    withdrawal_id: int = Field(gt=0)
    application_image_data: str = Field(min_length=32, max_length=5_700_000)
    success_image_data: str = Field(min_length=32, max_length=5_700_000)
    caption: str = Field(default="", max_length=140)
class AdminBulkReview(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)
    action: str = Field(pattern=r"^(approve|reject)$")
class AdminBulkArchive(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)
class AdminRechargeBulkArchive(BaseModel):
    keys: list[str] = Field(min_length=1, max_length=200)
class AdminPlanInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str = Field(default="plan", pattern=r"^(plan|benefit|vip)$")
    days: int = Field(ge=1, le=3650)
    amount: int | None = Field(default=None, ge=1, le=10_000_000)
    total_return: int | None = Field(default=None, ge=1, le=100_000_000)
    daily_earning: int | None = Field(default=None, ge=0, le=10_000_000)
    payout_mode: str = Field(default="maturity", pattern=r"^(maturity|daily)$")
    purchase_limit: int = Field(default=1, ge=0, le=100)
    coming_soon: bool = False
    plan_locked: bool = False
    vip_locked: bool = False
    vip_activation: bool = False
    duration_unit: str = Field(default="days", pattern=r"^(hours|days)$")
class AdminPlanOrderInput(BaseModel):
    plan_ids: list[str] = Field(min_length=1, max_length=100)
class CompanyNameInput(BaseModel):
    company_name: str = Field(min_length=3, max_length=80)
class TelegramUrlInput(BaseModel):
    telegram_url: str = Field(min_length=8, max_length=300)
class AdminRechargeSettingsInput(BaseModel):
    minimum_recharge: int = Field(ge=1, le=100000)
    first_recharge_amount: int = Field(ge=1, le=100000)
class AdminBalanceAdjustmentInput(BaseModel):
    operation: str = Field(pattern=r"^(credit|debit)$")
    amount: int = Field(ge=1, le=2_000_000_000)
    note: str = Field(min_length=2, max_length=120)
class AdminWithdrawalReceiptTimeInput(BaseModel):
    receipt_at: datetime
    receipt_amount: int = Field(ge=0, le=2_000_000_000)
    receipt_reference: str = Field(min_length=1, max_length=80)
class AdminWithdrawalReceiptOrderInput(BaseModel):
    withdrawal_ids: list[int] = Field(min_length=1, max_length=1000)
class WelcomePopupInput(BaseModel):
    enabled: bool = True
    title: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=2, max_length=700)
    button_text: str = Field(min_length=2, max_length=40)
class VisitorEventInput(BaseModel):
    visitor_id: str = Field(min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    session_id: str = Field(min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    path: str = Field(default="/", min_length=1, max_length=120)
    referrer: str = Field(default="", max_length=120)
class VisitorStageInput(BaseModel):
    visitor_id: str = Field(min_length=16, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    stage: str = Field(pattern=r"^(popup_seen|auth_viewed)$")
class AdminNotificationInput(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    message: str = Field(min_length=2, max_length=500)
class AdminPlanImageInput(BaseModel):
    image_data: str = Field(min_length=32, max_length=5_700_000)

app = FastAPI(title="Nivesh API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173").split(","), allow_methods=["GET","POST"], allow_headers=["Content-Type","Authorization","X-Admin-Token"])
app.add_middleware(GZipMiddleware, minimum_size=1000)
init_db()

@app.on_event("shutdown")
def close_pool():
    """Release Neon connections before the interpreter tears down, otherwise the
    pool's finalizer tries to join its worker threads during shutdown."""
    if database._pool is not None:
        database._pool.close()
        database._pool = None

@app.get("/api/health")
def health():
    with db() as con:
        con.execute("SELECT 1")
    return {"ok": True, "version": "2.0.0", "database": "postgres"}

def ensure_visitor_profile(con, visitor_id: str, path: str = "/", referrer: str = "", seen_at: str | None = None):
    profile = con.execute("SELECT * FROM visitor_profiles WHERE visitor_id=?", (visitor_id,)).fetchone()
    if profile: return profile
    timestamp = seen_at or now_iso()
    cur = con.execute("INSERT INTO visitor_profiles(visitor_id,visitor_code,first_seen_at,last_seen_at,visit_count,first_referrer,last_path) VALUES(?,?,?,?,0,?,?)", (visitor_id,None,timestamp,timestamp,referrer,path))
    con.execute("UPDATE visitor_profiles SET visitor_code=? WHERE id=?", (f"VIS{cur.lastrowid}",cur.lastrowid))
    return con.execute("SELECT * FROM visitor_profiles WHERE id=?", (cur.lastrowid,)).fetchone()

@app.post("/api/analytics/visit", status_code=201)
def record_visit(p: VisitorEventInput, request: Request):
    user_agent = request.headers.get("user-agent", "")
    if re.search(r"(bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp)", user_agent, re.I):
        return {"recorded":False}
    path = "/" + p.path.strip().lstrip("/")
    if not re.fullmatch(r"/[A-Za-z0-9/_-]*", path): path = "/"
    referrer = re.sub(r"[^A-Za-z0-9._:-]", "", p.referrer.strip().lower())[:120]
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        visited_at = now_iso()
        profile = ensure_visitor_profile(con,p.visitor_id,path,referrer,visited_at)
        cur = con.execute("INSERT OR IGNORE INTO visitor_events(visitor_id,session_id,path,referrer,created_at) VALUES(?,?,?,?,?)", (p.visitor_id,p.session_id,path,referrer,visited_at))
        if cur.rowcount == 1:
            con.execute("UPDATE visitor_profiles SET last_seen_at=?,visit_count=visit_count+1,last_path=? WHERE id=?", (visited_at,path,profile["id"]))
        return {"recorded":cur.rowcount == 1,"visitor_code":profile["visitor_code"]}

@app.post("/api/analytics/stage")
def record_visitor_stage(p: VisitorStageInput):
    with db() as con:
        changed_at = now_iso()
        profile = ensure_visitor_profile(con,p.visitor_id,seen_at=changed_at)
        if profile["registered_user_id"] is None:
            con.execute("UPDATE visitor_profiles SET last_action=?,last_seen_at=? WHERE id=?", (p.stage,changed_at,profile["id"]))
        return {"visitor_code":profile["visitor_code"],"stage":p.stage}

@app.get("/api/config")
def public_config(response: Response):
    response.headers["Cache-Control"] = "no-store"
    with db() as con:
        settings = {row["key"]: row["value"] for row in con.execute("SELECT key,value FROM app_settings WHERE key NOT LIKE 'admin_recovery_%'")}
        plan_rows = con.execute("SELECT * FROM plan_catalog WHERE is_active=1 AND category IN ('plan','benefit','vip') ORDER BY sort_order,id").fetchall()
        qr_rows = [dict(row) for row in con.execute("SELECT id,upi_id,payee,admin_label,source,CASE WHEN image_blob IS NOT NULL THEN 1 ELSE 0 END AS has_image,1 AS preferred FROM payment_qrs WHERE source='uploaded' AND image_blob IS NOT NULL ORDER BY CASE WHEN lower(admin_label || ' ' || payee) LIKE '%devraj%' THEN 0 WHEN lower(admin_label || ' ' || payee) LIKE '%jayesh%' THEN 1 ELSE 2 END,id ASC")]
        for row in qr_rows: row["image_url"] = f"/api/payment-qrs/{row['id']}/image" if row.pop("has_image") else None
        wallet_rows = {row["coin"]:dict(row) for row in con.execute("SELECT coin,network,address FROM crypto_wallets WHERE trim(address)!=''")}
        wallets = [{**wallet_rows[coin],"label":CRYPTO_LABELS[coin]} for coin in CUSTOMER_CRYPTO_NETWORKS if coin in wallet_rows]
        welcome_popup = {
            "enabled": settings.get("welcome_popup_enabled", "1") != "0",
            "title": settings.get("welcome_popup_title", "Welcome to BroCode"),
            "message": settings.get("welcome_popup_message", "Create your account and manage your wallet from one place."),
            "buttonText": settings.get("welcome_popup_button", "Continue"),
        }
        home_banner_url = f"/api/home-banner?v={settings.get('home_banner_updated_at', '')}" if settings.get("home_banner_name") else "/assets/brocode-plan-banner.webp"
        return {"company_name": settings.get("company_name", "BroCode"), "telegram_url": settings.get("telegram_url", DEFAULT_TELEGRAM_URL), "minimum_recharge":int(settings.get("minimum_recharge", "100")), "first_recharge_amount":int(settings.get("first_recharge_amount", "100")), "home_banner_url":home_banner_url, "welcome_popup":welcome_popup, "plans": [{"id":row["id"],"name":row["name"],"category":row["category"],"days":row["days"],"durationUnit":row["duration_unit"],"amount":row["amount"],"totalReturn":row["total_return"],"dailyEarning":row["daily_earning"],"payoutMode":row["payout_mode"],"limit":row["purchase_limit"],"comingSoon":bool(row["coming_soon"]),"planLocked":bool(row["plan_locked"]),"vipLocked":bool(row["vip_locked"]),"vipActivation":bool(row["vip_activation"]),"imageAutoFit":bool(row["image_auto_fit"]),"imageUrl":f"/api/plan-images/{row['id']}?v={row['image_updated_at'] or row['updated_at']}" if row["image_name"] else "/assets/brocode-plan-banner.webp"} for row in plan_rows],"payment_qrs":qr_rows,"crypto_wallets":wallets}

@app.get("/api/home-banner", include_in_schema=False)
def home_banner():
    with db() as con:
        settings = {row["key"]:row["value"] for row in con.execute("SELECT key,value FROM app_settings WHERE key IN ('home_banner_name','home_banner_mime')")}
    image_name = Path(settings.get("home_banner_name", "")).name
    if not image_name: raise HTTPException(404, "Home photo not found")
    image_path = HOME_BANNER_DIR / image_name
    if not image_path.is_file(): raise HTTPException(404, "Home photo not found")
    return FileResponse(image_path, media_type=settings.get("home_banner_mime", "image/jpeg"), headers={"Cache-Control":"public, max-age=3600"})

@app.get("/api/plan-images/{plan_id}", include_in_schema=False)
def plan_image(plan_id: str):
    with db() as con: plan = con.execute("SELECT image_name,image_mime FROM plan_catalog WHERE id=? AND is_active=1", (plan_id,)).fetchone()
    if not plan or not plan["image_name"]: raise HTTPException(404, "Plan image not found")
    image_path = PLAN_IMAGE_DIR / Path(plan["image_name"]).name
    if not image_path.is_file(): raise HTTPException(404, "Plan image not found")
    return FileResponse(image_path, media_type=plan["image_mime"], headers={"Cache-Control":"public, max-age=3600"})

@app.get("/api/payment-qrs")
def payment_qrs():
    with db() as con:
        rows = [dict(item) for item in con.execute("SELECT id,upi_id,payee,admin_label,source,CASE WHEN image_blob IS NOT NULL THEN 1 ELSE 0 END AS has_image,1 AS preferred FROM payment_qrs WHERE source='uploaded' AND image_blob IS NOT NULL ORDER BY CASE WHEN lower(admin_label || ' ' || payee) LIKE '%devraj%' THEN 0 WHEN lower(admin_label || ' ' || payee) LIKE '%jayesh%' THEN 1 ELSE 2 END,id ASC")]
        for item in rows: item["image_url"] = f"/api/payment-qrs/{item['id']}/image" if item.pop("has_image") else None
        return rows

@app.get("/api/payment-qrs/{qid}/image", include_in_schema=False)
def payment_qr_image(qid: int):
    with db() as con: row = con.execute("SELECT image_blob,image_mime FROM payment_qrs WHERE id=? AND source='uploaded'", (qid,)).fetchone()
    if not row or not row["image_blob"]: raise HTTPException(404, "Uploaded payment QR not found")
    return Response(content=bytes(row["image_blob"]), media_type=row["image_mime"] or "image/png", headers={"Cache-Control":"no-store"})

@app.get("/api/crypto-wallets")
def crypto_wallets():
    with db() as con:
        wallets = {row["coin"]: dict(row) for row in con.execute("SELECT coin,network,address FROM crypto_wallets WHERE trim(address)!=''")}
        return [{**wallets[coin], "label": CRYPTO_LABELS[coin]} for coin in CUSTOMER_CRYPTO_NETWORKS if coin in wallets]

@app.post("/api/auth/register", status_code=201)
def register(p: Credentials):
    email = p.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email): raise HTTPException(400, "Enter a valid email address")
    referral_code = (p.referral_code or "").strip().upper()
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        referrer_id = None
        if referral_code:
            if not re.fullmatch(r"SC\d{5}", referral_code): raise HTTPException(400, "Enter a valid referral code")
            referrer = con.execute("SELECT id FROM users WHERE public_id=?", (referral_code[2:],)).fetchone()
            if not referrer: raise HTTPException(400, "Referral code not found")
            if not user_has_approved_deposit(con, referrer["id"]): raise HTTPException(400, "This referral code is not active yet")
            referrer_id = referrer["id"]
        try:
            uid = "usr_" + secrets.token_hex(8)
            public_id = new_public_id(con)
            registered_at = now_iso()
            manual_qr_slot = con.execute("SELECT COUNT(*) FROM users WHERE manual_qr_slot IS NOT NULL").fetchone()[0] % 2
            con.execute("INSERT INTO users(id,name,balance,created_at,email,password_hash,public_id,referred_by_user_id,manual_qr_slot) VALUES(?,?,?,?,?,?,?,?,?)", (uid,p.name.strip(),SIGNUP_BONUS,registered_at,email,password_hash(p.password),public_id,referrer_id,manual_qr_slot))
            con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (uid,"signup_bonus",SIGNUP_BONUS,f"SIGNUP-{public_id}",registered_at))
            if p.visitor_id:
                ensure_visitor_profile(con,p.visitor_id,seen_at=registered_at)
                con.execute("UPDATE visitor_profiles SET registered_user_id=?,last_action='registered',last_seen_at=? WHERE visitor_id=?", (uid,registered_at,p.visitor_id))
        except IntegrityError: raise HTTPException(409, "An account already exists for this email")
        return {"token": session_for(con,uid), "remember_login":True, "user":{"id":uid,"public_id":public_id,"name":p.name.strip(),"email":email}, "signup_bonus":SIGNUP_BONUS}

@app.post("/api/auth/login")
def login(p: Login):
    with db() as con:
        user=con.execute("SELECT * FROM users WHERE email=?",(p.email.strip().lower(),)).fetchone()
        if not user or not verify_password(p.password,user["password_hash"]): raise HTTPException(401,"Invalid email or password")
        if user["is_disabled"] or user["archived_at"]: raise HTTPException(403,"This account has been disabled by the administrator")
        if p.visitor_id:
            logged_in_at = now_iso()
            ensure_visitor_profile(con,p.visitor_id,seen_at=logged_in_at)
            con.execute("UPDATE visitor_profiles SET registered_user_id=?,last_action='logged_in',last_seen_at=? WHERE visitor_id=?", (user["id"],logged_in_at,p.visitor_id))
        return {"token":session_for(con,user["id"]),"remember_login":bool(user["remember_login"]),"user":{"id":user["id"],"public_id":user["public_id"],"name":user["name"],"email":user["email"]}}

@app.post("/api/auth/telegram")
def telegram_login(p: TelegramLogin):
    raise HTTPException(410, "Register or sign in with your email and password")

@app.post("/api/telegram/webhook")
def telegram_webhook(update: dict, x_telegram_bot_api_secret_token: str = Header(default="")):
    if not TELEGRAM_WEBHOOK_SECRET or not hmac.compare_digest(x_telegram_bot_api_secret_token, TELEGRAM_WEBHOOK_SECRET):
        raise HTTPException(401, "Invalid Telegram webhook secret")
    message = update.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    text = (message.get("text") or "").split("@", 1)[0].strip()
    if chat_id and text == "/start":
        with db() as con:
            setting = con.execute("SELECT value FROM app_settings WHERE key='company_name'").fetchone()
            company_name = setting["value"] if setting else "BroCode"
        return {
            "method": "sendMessage",
            "chat_id": chat_id,
            "text": f"Welcome to {company_name}.",
            "reply_markup": {"inline_keyboard": [[{
                "text": f"Open {company_name}",
                "web_app": {"url": PUBLIC_APP_URL},
            }]]},
        }
    return {"ok": True}

@app.post("/api/auth/logout")
def logout(authorization: str=Header(default=""), user=Depends(current_user)):
    with db() as con: con.execute("DELETE FROM sessions WHERE token=?",(authorization.removeprefix("Bearer ").strip(),))
    return {"ok":True}

@app.get("/api/dashboard")
def dashboard(user=Depends(current_user)):
    uid=user["id"]
    with db() as con:
        settle_matured_plans(con, uid)
        fresh_balance = con.execute("SELECT balance FROM users WHERE id=?", (uid,)).fetchone()["balance"]
        bank=con.execute("SELECT beneficiary,ifsc,account_last4 FROM bank_accounts WHERE user_id=?",(uid,)).fetchone()
        rows=lambda q:[dict(x) for x in con.execute(q,(uid,))]
        referral = con.execute("SELECT COUNT(*) AS invited_count FROM users WHERE referred_by_user_id=?", (uid,)).fetchone()
        rewards = con.execute("SELECT COUNT(*) AS rewarded_count,COALESCE(SUM(amount),0) AS earned FROM referral_rewards WHERE inviter_id=?", (uid,)).fetchone()
        qualified_referrals = con.execute("""SELECT COUNT(*) FROM users referred WHERE referred.referred_by_user_id=? AND (
            EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=referred.id AND r.status='approved') OR
            EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=referred.id AND c.status='approved'))""", (uid,)).fetchone()[0]
        referral_unlocked = user_has_approved_deposit(con, uid)
        manual_payment_qr = assigned_manual_payment_qr(con, uid)
        vip_activation_purchased = bool(con.execute("""SELECT 1 FROM active_plans a JOIN plan_catalog p ON p.id=a.plan_id
            WHERE a.user_id=? AND p.vip_activation=1 LIMIT 1""", (uid,)).fetchone())
        vip_active = bool(user.get("vip_approved_at"))
        notifications = [dict(row) for row in con.execute("""SELECT n.id,n.title,n.message,n.created_at,
            CASE WHEN nr.notification_id IS NULL THEN 0 ELSE 1 END AS is_read
            FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=?
            ORDER BY n.id DESC LIMIT 50""", (uid,))]
        has_approved_deposit = user_has_approved_deposit(con, uid)
        withdrawal_enabled = bool(con.execute("SELECT withdrawal_enabled FROM users WHERE id=?", (uid,)).fetchone()["withdrawal_enabled"])
        withdrawal_available = withdrawal_enabled
        withdrawal_message = "" if withdrawal_available else "Withdrawal access is awaiting admin activation."
        return {"user":{"id":uid,"public_id":user.get("public_id"),"name":user["name"],"email":user.get("email"),"balance":fresh_balance},"remember_login":bool(user.get("remember_login")),"manual_payment_qr_id":manual_payment_qr["id"] if manual_payment_qr else None,"manual_payment_qr_name":manual_payment_qr["admin_label"] if manual_payment_qr else None,"withdrawal_available":withdrawal_available,"withdrawal_message":withdrawal_message,"has_approved_deposit":has_approved_deposit,"vip_active":vip_active,"vip_activation_purchased":vip_activation_purchased,"notifications":notifications,"referral":{"code":f"SC{user['public_id']}","bonus":REFERRAL_BONUS,"unlocked":referral_unlocked,"locked_message":"Make your first deposit to unlock Refer & Earn.","invited_count":referral["invited_count"],"qualified_count":qualified_referrals,"pending_count":max(0, qualified_referrals - rewards["rewarded_count"]),"rewarded_count":rewards["rewarded_count"],"earned":rewards["earned"]},"bank":dict(bank) if bank else None,"active_plans":rows("SELECT * FROM active_plans WHERE user_id=? ORDER BY id DESC"),"transactions":rows("SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 50"),"withdrawals":rows("SELECT * FROM withdrawals WHERE user_id=? AND receipt_hidden_at IS NULL ORDER BY receipt_sort_order DESC,id DESC LIMIT 50"),"recharges":rows("SELECT * FROM recharges WHERE user_id=? ORDER BY id DESC LIMIT 50"),"crypto_recharges":rows("SELECT * FROM crypto_recharges WHERE user_id=? ORDER BY id DESC LIMIT 50")}

@app.get("/api/notifications")
def user_notifications(user=Depends(current_user)):
    with db() as con:
        records = [dict(row) for row in con.execute("""SELECT n.id,n.title,n.message,n.created_at,
            CASE WHEN nr.notification_id IS NULL THEN 0 ELSE 1 END AS is_read
            FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=?
            ORDER BY n.id DESC LIMIT 50""", (user["id"],))]
        return {"notifications": records, "unread_count": sum(1 for row in records if not row["is_read"])}

@app.post("/api/notifications/read-all")
def read_all_notifications(user=Depends(current_user)):
    read_at = now_iso()
    with db() as con:
        con.execute("""INSERT OR IGNORE INTO notification_reads(notification_id,user_id,read_at)
            SELECT id,?,? FROM notifications""", (user["id"], read_at))
    return {"read": True}

@app.get("/api/withdrawal-blog")
def withdrawal_blog(user=Depends(current_user)):
    with db() as con:
        posts = [dict(row) for row in con.execute("""
            SELECT r.id,r.withdrawal_id,r.user_id,r.application_image_name,r.caption,COALESCE(w.receipt_at,r.created_at) AS created_at,u.name,u.public_id,COALESCE(w.receipt_amount,w.payout_amount) AS payout_amount
            FROM withdrawal_receipts r
            JOIN users u ON u.id=r.user_id
            JOIN withdrawals w ON w.id=r.withdrawal_id
            ORDER BY r.id DESC LIMIT 50
        """)]
        eligible = [dict(row) for row in con.execute("""
            SELECT w.id,w.payout_amount,w.reviewed_at
            FROM withdrawals w
            LEFT JOIN withdrawal_receipts r ON r.withdrawal_id=w.id
            WHERE w.user_id=? AND w.status='paid' AND r.id IS NULL
            ORDER BY w.id DESC
        """, (user["id"],))]
        for post in posts:
            post["is_owner"] = post.pop("user_id") == user["id"]
            post["application_image_url"] = f"/api/withdrawal-blog/{post['id']}/image/application" if post.pop("application_image_name") else None
            post["success_image_url"] = f"/api/withdrawal-blog/{post['id']}/image/success"
        return {"posts": posts, "eligible_withdrawals": eligible}

@app.get("/api/withdrawal-blog/{receipt_id}/image", include_in_schema=False)
def withdrawal_receipt_image(receipt_id: int):
    return withdrawal_receipt_image_by_kind(receipt_id, "success")

@app.get("/api/withdrawal-blog/{receipt_id}/image/{kind}", include_in_schema=False)
def withdrawal_receipt_image_by_kind(receipt_id: int, kind: str):
    if kind not in {"application", "success"}: raise HTTPException(404, "Receipt image not found")
    name_column = "application_image_name" if kind == "application" else "image_name"
    mime_column = "application_mime_type" if kind == "application" else "mime_type"
    with db() as con:
        receipt = con.execute(f"SELECT {name_column} AS image_name,{mime_column} AS mime_type FROM withdrawal_receipts WHERE id=?", (receipt_id,)).fetchone()
    if not receipt: raise HTTPException(404, "Receipt not found")
    if not receipt["image_name"]: raise HTTPException(404, "Receipt image not found")
    image_path = RECEIPT_DIR / receipt["image_name"]
    if not image_path.is_file(): raise HTTPException(404, "Receipt image not found")
    return FileResponse(image_path, media_type=receipt["mime_type"], headers={"Cache-Control": "public, max-age=86400"})

def decode_receipt_image(image_data: str):
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)", image_data)
    if not match: raise HTTPException(400, "Upload JPEG, PNG, or WebP receipt images")
    mime_type, encoded = match.groups()
    try: image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError): raise HTTPException(400, "A receipt image is invalid")
    if not image_bytes or len(image_bytes) > 4 * 1024 * 1024: raise HTTPException(400, "Each receipt image must be 4 MB or smaller")
    signatures = {
        "image/jpeg": image_bytes.startswith(b"\xff\xd8\xff"),
        "image/png": image_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP",
    }
    if not signatures[mime_type]: raise HTTPException(400, "A receipt file does not match its image type")
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime_type]
    return image_bytes, mime_type, extension

def decode_plan_image(image_data: str):
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)", image_data)
    if not match: raise HTTPException(400, "Upload a JPEG, PNG, or WebP plan image")
    mime_type, encoded = match.groups()
    try: image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError): raise HTTPException(400, "The plan image is invalid")
    if not image_bytes or len(image_bytes) > 4 * 1024 * 1024: raise HTTPException(400, "The plan image must be 4 MB or smaller")
    signatures = {
        "image/jpeg": image_bytes.startswith(b"\xff\xd8\xff"),
        "image/png": image_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP",
    }
    if not signatures[mime_type]: raise HTTPException(400, "The plan file does not match its image type")
    extension = {"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp"}[mime_type]
    return image_bytes, mime_type, extension

@app.post("/api/withdrawal-blog", status_code=201)
def upload_withdrawal_receipt(p: WithdrawalReceiptInput, user=Depends(current_user)):
    application_bytes, application_mime, application_extension = decode_receipt_image(p.application_image_data)
    success_bytes, success_mime, success_extension = decode_receipt_image(p.success_image_data)
    application_image_name = f"{secrets.token_urlsafe(24)}.{application_extension}"
    success_image_name = f"{secrets.token_urlsafe(24)}.{success_extension}"
    caption = " ".join(p.caption.strip().split())
    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    application_path = RECEIPT_DIR / application_image_name
    success_path = RECEIPT_DIR / success_image_name
    with db() as con:
        withdrawal = con.execute("SELECT id FROM withdrawals WHERE id=? AND user_id=? AND status='paid'", (p.withdrawal_id, user["id"])).fetchone()
        if not withdrawal: raise HTTPException(409, "Only a successful withdrawal receipt can be uploaded")
        if con.execute("SELECT 1 FROM withdrawal_receipts WHERE withdrawal_id=?", (p.withdrawal_id,)).fetchone():
            raise HTTPException(409, "A receipt has already been uploaded for this withdrawal")
        try:
            application_path.write_bytes(application_bytes)
            success_path.write_bytes(success_bytes)
            cur = con.execute("INSERT INTO withdrawal_receipts(withdrawal_id,user_id,image_name,mime_type,caption,created_at,application_image_name,application_mime_type) VALUES(?,?,?,?,?,?,?,?)", (p.withdrawal_id,user["id"],success_image_name,success_mime,caption,now_iso(),application_image_name,application_mime))
        except IntegrityError:
            application_path.unlink(missing_ok=True); success_path.unlink(missing_ok=True)
            raise HTTPException(409, "A receipt has already been uploaded for this withdrawal")
        except OSError as exc:
            application_path.unlink(missing_ok=True); success_path.unlink(missing_ok=True)
            raise HTTPException(500, "Could not save the receipt image") from exc
        return {"id": cur.lastrowid, "uploaded": True}

@app.post("/api/withdrawal-blog/{receipt_id}/delete")
def delete_withdrawal_receipt(receipt_id: int, user=Depends(current_user)):
    with db() as con:
        receipt = con.execute("SELECT image_name,application_image_name FROM withdrawal_receipts WHERE id=? AND user_id=?", (receipt_id,user["id"])).fetchone()
        if not receipt: raise HTTPException(404, "Blog post not found")
        con.execute("DELETE FROM withdrawal_receipts WHERE id=? AND user_id=?", (receipt_id,user["id"]))
    for image_name in (receipt["image_name"], receipt["application_image_name"]):
        if image_name and Path(image_name).name == image_name:
            try: (RECEIPT_DIR / image_name).unlink(missing_ok=True)
            except OSError: pass
    return {"deleted": True}

@app.post("/api/crypto-recharges", status_code=201)
def crypto_recharge(p: CryptoRechargeInput, user=Depends(current_user)):
    coin = p.coin.strip().upper()
    txid = p.txid.strip()
    if coin not in CUSTOMER_CRYPTO_NETWORKS: raise HTTPException(400, "Choose a supported USDT network")
    if not re.fullmatch(r"[A-Za-z0-9:_+/=-]{8,180}", txid): raise HTTPException(400, "Enter a valid transaction ID without spaces")
    with db() as con:
        existing = con.execute("SELECT * FROM crypto_recharges WHERE txid=?", (txid,)).fetchone()
        if existing:
            if existing["user_id"] != user["id"] or existing["coin"] != coin or existing["amount_inr"] != p.amount_inr:
                raise HTTPException(409, "This transaction ID has already been submitted with different details")
            return {"id":existing["id"],"status":existing["status"],"reference":f"CRYPTO-{existing['id']:06d}","gross_inr":existing["gross_inr"],"fee_inr":existing["fee_inr"],"credited_inr":existing["credited_inr"],"duplicate":True}
        wallet = con.execute("SELECT * FROM crypto_wallets WHERE coin=? AND trim(address)!=''", (coin,)).fetchone()
        if not wallet: raise HTTPException(409, "This crypto recharge network is not active")
        gross_inr, fee_inr, credited_inr = usdt_to_inr(p.amount_inr)
        try:
            cur = con.execute("INSERT INTO crypto_recharges(user_id,coin,network,address,txid,amount_inr,gross_inr,fee_inr,credited_inr,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',?)", (user["id"],coin,wallet["network"],wallet["address"],txid,p.amount_inr,gross_inr,fee_inr,credited_inr,now_iso()))
        except IntegrityError: raise HTTPException(409, "This transaction ID has already been submitted")
        return {"id":cur.lastrowid,"status":"pending","reference":f"CRYPTO-{cur.lastrowid:06d}","gross_inr":gross_inr,"fee_inr":fee_inr,"credited_inr":credited_inr}

@app.post("/api/bank")
def save_bank(p: Bank,user=Depends(current_user)):
    if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}",p.ifsc.upper()): raise HTTPException(400,"Enter a valid IFSC code")
    if not re.fullmatch(r"\d{9,18}",p.account): raise HTTPException(400,"Enter a valid account number")
    digest=hashlib.sha256((p.account+ADMIN_TOKEN).encode()).hexdigest()
    encrypted_account = encrypt_bank_account(p.account)
    with db() as con: con.execute("INSERT INTO bank_accounts(user_id,beneficiary,ifsc,account_last4,account_hash,updated_at,account_encrypted) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET beneficiary=excluded.beneficiary,ifsc=excluded.ifsc,account_last4=excluded.account_last4,account_hash=excluded.account_hash,updated_at=excluded.updated_at,account_encrypted=excluded.account_encrypted",(user["id"],p.beneficiary.strip(),p.ifsc.upper(),p.account[-4:],digest,now_iso(),encrypted_account))
    return {"beneficiary":p.beneficiary.strip(),"ifsc":p.ifsc.upper(),"account_last4":p.account[-4:]}

@app.post("/api/recharge-drafts", status_code=201)
def start_recharge(p: RechargeDraft, user=Depends(current_user)):
    with db() as con:
        minimum_row = con.execute("SELECT value FROM app_settings WHERE key='minimum_recharge'").fetchone()
        minimum_recharge = int(minimum_row["value"]) if minimum_row else 100
        if p.amount < minimum_recharge: raise HTTPException(400, f"Minimum recharge is INR {minimum_recharge}")
        payment_qr_id = validate_payment_qr_for_user(con, user["id"], p.payment_qr_id)
        cur = con.execute("INSERT INTO recharge_drafts(user_id,amount,upi_id,payment_qr_id,status,created_at) VALUES(?,?,?,?,'awaiting_utr',?)", (user["id"], p.amount, p.upi_id, payment_qr_id, now_iso()))
        return {"id": cur.lastrowid, "status": "awaiting_utr"}

@app.post("/api/recharges",status_code=201)
def recharge(p:Recharge,user=Depends(current_user)):
    utr=p.utr.strip()
    if not re.fullmatch(r"\d{12}",utr): raise HTTPException(400,"UTR must be exactly 12 digits")
    with db() as con:
        existing = con.execute("SELECT * FROM recharges WHERE utr=?", (utr,)).fetchone()
        if existing:
            if existing["user_id"] != user["id"] or existing["amount"] != p.amount or existing["upi_id"] != p.upi_id or (p.payment_qr_id is not None and existing["payment_qr_id"] != p.payment_qr_id):
                raise HTTPException(409, "This UTR has already been submitted with different details")
            return {"id":existing["id"],"status":existing["status"],"reference":f"RCG-{existing['id']:06d}","duplicate":True}
        minimum_row = con.execute("SELECT value FROM app_settings WHERE key='minimum_recharge'").fetchone()
        minimum_recharge = int(minimum_row["value"]) if minimum_row else 100
        if p.amount < minimum_recharge: raise HTTPException(400, f"Minimum recharge is INR {minimum_recharge}")
        payment_qr_id = validate_payment_qr_for_user(con, user["id"], p.payment_qr_id)
        if p.draft_id is not None:
            draft = con.execute("SELECT * FROM recharge_drafts WHERE id=? AND user_id=? AND status='awaiting_utr'", (p.draft_id, user["id"])).fetchone()
            if not draft: raise HTTPException(409, "Recharge draft not found or already submitted")
            payment_qr_id = payment_qr_id or draft["payment_qr_id"]
        try: cur=con.execute("INSERT INTO recharges(user_id,amount,utr,upi_id,payment_qr_id,status,created_at) VALUES(?,?,?,?,?, 'pending',?)",(user["id"],p.amount,utr,p.upi_id,payment_qr_id,now_iso()))
        except IntegrityError: raise HTTPException(409,"This UTR has already been submitted")
        if p.draft_id is not None:
            con.execute("UPDATE recharge_drafts SET status='submitted',submitted_at=?,recharge_id=?,payment_qr_id=? WHERE id=?", (now_iso(), cur.lastrowid, payment_qr_id, p.draft_id))
        return {"id":cur.lastrowid,"status":"pending","reference":f"RCG-{cur.lastrowid:06d}"}

@app.post("/api/withdrawals",status_code=201)
def withdraw(p:Withdrawal,user=Depends(current_user)):
    payout_method = p.payout_method.strip().lower()
    if payout_method not in {"bank", "upi"}: raise HTTPException(400, "Choose Bank Account or UPI ID")
    upi_id = (p.upi_id or "").strip()
    if payout_method == "upi" and not re.fullmatch(r"[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}", upi_id):
        raise HTTPException(400, "Enter a valid UPI ID")
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        if p.request_key:
            existing = con.execute("SELECT * FROM withdrawals WHERE user_id=? AND request_key=?", (user["id"], p.request_key)).fetchone()
            if existing:
                expected_upi = upi_id if payout_method == "upi" else None
                if existing["amount"] != p.amount or existing["payout_method"] != payout_method or existing["upi_id"] != expected_upi:
                    raise HTTPException(409, "This request was already used with different withdrawal details")
                return {"id":existing["id"],"status":existing["status"],"reference":f"WD-{existing['id']:06d}","payout_method":existing["payout_method"],"amount":existing["amount"],"fee_amount":existing["fee_amount"],"payout_amount":existing["payout_amount"],"duplicate":True}
        settle_matured_plans(con, user["id"]); bank=con.execute("SELECT account_encrypted FROM bank_accounts WHERE user_id=?",(user["id"],)).fetchone(); fresh=con.execute("SELECT balance FROM users WHERE id=?",(user["id"],)).fetchone()
        withdrawal_access = con.execute("SELECT withdrawal_enabled FROM users WHERE id=?", (user["id"],)).fetchone()
        if not withdrawal_access or not withdrawal_access["withdrawal_enabled"]: raise HTTPException(409, "Withdrawal access is awaiting admin activation")
        minimum_withdrawal = 1000
        if p.amount < minimum_withdrawal: raise HTTPException(400, f"Minimum withdrawal is INR {minimum_withdrawal}")
        if payout_method == "bank" and not bank: raise HTTPException(409,"Add a bank account before choosing bank withdrawal")
        if payout_method == "bank" and not decrypt_bank_account(bank["account_encrypted"]): raise HTTPException(409,"Update and save your bank account again before requesting a bank withdrawal")
        if fresh["balance"]<p.amount: raise HTTPException(409,"Insufficient balance")
        fee_amount, payout_amount = withdrawal_breakdown(p.amount)
        requested_at = now_iso()
        con.execute("UPDATE users SET balance=balance-? WHERE id=?",(p.amount,user["id"]))
        cur=con.execute("INSERT INTO withdrawals(user_id,amount,fee_amount,payout_amount,status,created_at,payout_method,upi_id,request_key) VALUES(?,?,?,?,'requested',?,?,?,?)",(user["id"],p.amount,fee_amount,payout_amount,requested_at,payout_method,upi_id if payout_method == "upi" else None,p.request_key))
        con.execute("UPDATE withdrawals SET receipt_sort_order=? WHERE id=?", (cur.lastrowid,cur.lastrowid))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at,request_key) VALUES(?,?,?,?,?,?)",(user["id"],"withdrawal",-p.amount,f"WD-{cur.lastrowid}",requested_at,None))
        return {"id":cur.lastrowid,"status":"requested","reference":f"WD-{cur.lastrowid:06d}","payout_method":payout_method,"amount":p.amount,"fee_amount":fee_amount,"payout_amount":payout_amount}

@app.post("/api/plans/purchase",status_code=201)
def purchase(p:Purchase,user=Depends(current_user)):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT * FROM plan_catalog WHERE id=? AND is_active=1", (p.plan_id,)).fetchone()
        if not row: raise HTTPException(404,"Plan not found")
        if row["plan_locked"]: raise HTTPException(409,"This plan is currently locked")
        if row["coming_soon"] or row["amount"] is None or row["total_return"] is None: raise HTTPException(409,"This plan is coming soon")
        if row["category"] == "vip" and row["vip_locked"]:
            activation_purchased = con.execute("""SELECT 1 FROM active_plans a JOIN plan_catalog activation ON activation.id=a.plan_id
                WHERE a.user_id=? AND activation.vip_activation=1 LIMIT 1""", (user["id"],)).fetchone()
            if not user.get("vip_approved_at"): raise HTTPException(403,"VIP access is awaiting admin activation" if activation_purchased else "Ask the administrator to activate VIP access")
        plan = {"days":row["days"],"duration_unit":row["duration_unit"],"amount":row["amount"],"total_return":row["total_return"],"daily_earning":row["daily_earning"],"payout_mode":row["payout_mode"],"limit":row["purchase_limit"]}
        daily=plan.get("daily_earning", round((plan["total_return"]-plan["amount"])/plan["days"]))
        if daily is None: daily=round((plan["total_return"]-plan["amount"])/plan["days"])
        total_cost=plan["amount"]*p.quantity
        if p.request_key:
            existing = con.execute("SELECT * FROM transactions WHERE user_id=? AND request_key=?", (user["id"], p.request_key)).fetchone()
            if existing:
                if existing["kind"] != "plan_purchase" or existing["amount"] != -total_cost:
                    raise HTTPException(409, "This request was already used with different plan details")
                return {"ids":[],"quantity":p.quantity,"status":"active","reference":existing["reference"],"daily_earning":daily*p.quantity,"total_cost":total_cost,"duplicate":True}
        settle_matured_plans(con, user["id"]); fresh=con.execute("SELECT balance FROM users WHERE id=?",(user["id"],)).fetchone(); count=con.execute("SELECT COUNT(*) c FROM active_plans WHERE user_id=? AND plan_id=?",(user["id"],p.plan_id)).fetchone()["c"]
        if count+p.quantity>plan["limit"]: raise HTTPException(409,f"Only {plan['limit']-count} more order(s) can be purchased")
        if fresh["balance"]<total_cost: raise HTTPException(409,"Insufficient balance")
        payout_mode=plan.get("payout_mode", "maturity")
        con.execute("UPDATE users SET balance=balance-? WHERE id=?",(total_cost,user["id"]))
        order_ids=[]
        purchased_at=now_iso()
        for _ in range(p.quantity):
            cur=con.execute("INSERT INTO active_plans(user_id,plan_id,invested,total_return,daily_earning,duration_days,status,purchased_at,payout_mode,credited_days,duration_unit) VALUES(?,?,?,?,?,?, 'active',?,?,0,?)",(user["id"],p.plan_id,plan["amount"],plan["total_return"],daily,plan["days"],purchased_at,payout_mode,plan["duration_unit"]))
            order_ids.append(cur.lastrowid)
        reference=f"PLAN-{order_ids[0]:06d}-{p.quantity}X"
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at,request_key) VALUES(?,?,?,?,?,?)",(user["id"],"plan_purchase",-total_cost,reference,purchased_at,p.request_key))
        return {"ids":order_ids,"quantity":p.quantity,"status":"active","reference":reference,"daily_earning":daily*p.quantity,"total_cost":total_cost}

def support_image_fields(image_data: str | None, image_name: str | None):
    if not image_data:
        return None, None, None
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", image_data)
    if not match:
        raise HTTPException(400, "Choose a valid JPEG, PNG, or WebP support photo")
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Support photo is invalid")
    if len(decoded) > 2 * 1024 * 1024:
        raise HTTPException(413, "Support photo must be 2 MB or smaller")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(image_name or "support-photo").name)[:120]
    return image_data, match.group(1), safe_name or "support-photo"

@app.get("/api/support/chat")
def support_chat(user=Depends(current_user)):
    timestamp = now_iso()
    with db() as con:
        con.execute(
            """INSERT INTO support_conversations(user_id,status,created_at,updated_at,user_read_at)
               VALUES(?,'open',?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET user_read_at=excluded.user_read_at""",
            (user["id"],timestamp,timestamp,timestamp),
        )
        con.execute("UPDATE support_messages SET read_at=? WHERE user_id=? AND sender='admin' AND read_at IS NULL", (timestamp,user["id"]))
        messages = [dict(row) for row in con.execute(
            "SELECT id,sender,message,image_data,image_mime,image_name,created_at,read_at FROM support_messages WHERE user_id=? ORDER BY id DESC LIMIT 200",
            (user["id"],),
        ).fetchall()]
        messages.reverse()
        return {"conversation":{"status":"open","user_id":user["id"]},"messages":messages}

@app.post("/api/support/chat/messages", status_code=201)
def send_support_message(p: SupportMessageInput, user=Depends(current_user)):
    message = " ".join(p.message.split())
    image_data, image_mime, image_name = support_image_fields(p.image_data, p.image_name)
    if not message and not image_data: raise HTTPException(400, "Write a message or attach a photo")
    timestamp = now_iso()
    with db() as con:
        con.execute(
            """INSERT INTO support_conversations(user_id,status,created_at,updated_at,user_read_at)
               VALUES(?,'open',?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET status='open',updated_at=excluded.updated_at,user_read_at=excluded.user_read_at""",
            (user["id"],timestamp,timestamp,timestamp),
        )
        cur = con.execute("INSERT INTO support_messages(user_id,sender,message,image_data,image_mime,image_name,created_at) VALUES(?,'user',?,?,?,?,?)", (user["id"],message,image_data,image_mime,image_name,timestamp))
        return {"id":cur.lastrowid,"sender":"user","message":message,"image_data":image_data,"image_mime":image_mime,"image_name":image_name,"created_at":timestamp}

@app.get("/api/admin/support", dependencies=[Depends(require_admin)])
def admin_support_conversations():
    with db() as con:
        return [dict(row) for row in con.execute("""
            SELECT c.user_id,c.status,c.created_at,c.updated_at,u.public_id,u.name,u.email,
                   (SELECT CASE WHEN trim(m.message)!='' THEN m.message WHEN m.image_data IS NOT NULL THEN 'Photo attachment' ELSE 'New conversation' END FROM support_messages m WHERE m.user_id=c.user_id ORDER BY m.id DESC LIMIT 1) AS last_message,
                   (SELECT m.sender FROM support_messages m WHERE m.user_id=c.user_id ORDER BY m.id DESC LIMIT 1) AS last_sender,
                   (SELECT COUNT(*) FROM support_messages m WHERE m.user_id=c.user_id AND m.sender='user' AND m.read_at IS NULL) AS unread_count
            FROM support_conversations c JOIN users u ON u.id=c.user_id
            WHERE u.archived_at IS NULL ORDER BY c.updated_at DESC LIMIT 500
        """).fetchall()]

@app.get("/api/admin/support/{user_id}", dependencies=[Depends(require_admin)])
def admin_support_chat(user_id: str):
    timestamp = now_iso()
    with db() as con:
        user = con.execute("SELECT id,public_id,name,email FROM users WHERE id=? AND archived_at IS NULL", (user_id,)).fetchone()
        if not user: raise HTTPException(404, "Customer not found")
        conversation = con.execute("SELECT * FROM support_conversations WHERE user_id=?", (user_id,)).fetchone()
        if not conversation:
            return {"user":dict(user),"conversation":{"status":"new","user_id":user_id},"messages":[]}
        con.execute("UPDATE support_messages SET read_at=? WHERE user_id=? AND sender='user' AND read_at IS NULL", (timestamp,user_id))
        con.execute("UPDATE support_conversations SET admin_read_at=? WHERE user_id=?", (timestamp,user_id))
        messages = [dict(row) for row in con.execute(
            "SELECT id,sender,message,image_data,image_mime,image_name,created_at,read_at FROM support_messages WHERE user_id=? ORDER BY id DESC LIMIT 300",
            (user_id,),
        ).fetchall()]
        messages.reverse()
        return {"user":dict(user),"conversation":dict(conversation),"messages":messages}

@app.post("/api/admin/support/{user_id}/messages", status_code=201, dependencies=[Depends(require_admin)])
def admin_send_support_message(user_id: str, p: SupportMessageInput):
    message = " ".join(p.message.split())
    if not message: raise HTTPException(400, "Write a reply")
    timestamp = now_iso()
    with db() as con:
        user = con.execute("SELECT id FROM users WHERE id=? AND archived_at IS NULL", (user_id,)).fetchone()
        if not user: raise HTTPException(404, "Customer not found")
        con.execute(
            """INSERT INTO support_conversations(user_id,status,created_at,updated_at,admin_read_at)
               VALUES(?,'open',?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET status='open',updated_at=excluded.updated_at,admin_read_at=excluded.admin_read_at""",
            (user_id,timestamp,timestamp,timestamp),
        )
        cur = con.execute("INSERT INTO support_messages(user_id,sender,message,created_at) VALUES(?,'admin',?,?)", (user_id,message,timestamp))
        return {"id":cur.lastrowid,"sender":"admin","message":message,"created_at":timestamp}

@app.get("/api/admin/recharges",dependencies=[Depends(require_admin)])
def admin_recharges(status:str="pending"):
    if status not in {"pending","approved","rejected","all"}: raise HTTPException(400,"Invalid status")
    with db() as con:
        q="SELECT r.*,u.name FROM recharges r JOIN users u ON u.id=r.user_id"; args=() if status=="all" else (status,); q += "" if status=="all" else " WHERE r.status=?"
        records = [dict(r) for r in con.execute(q+" ORDER BY r.id DESC",args)]
        for record in records: record["reference"] = f"RCG-{record['id']:06d}"
        return records

@app.get("/api/admin/dashboard", dependencies=[Depends(require_admin)])
def admin_dashboard():
    online_cutoff = (now() - timedelta(minutes=5)).isoformat()
    india_tz = timezone(timedelta(hours=5, minutes=30))
    today_india = now().astimezone(india_tz).date()
    today_start_utc = datetime.combine(today_india, datetime.min.time(), india_tz).astimezone(timezone.utc).isoformat()
    last_24h = (now() - timedelta(hours=24)).isoformat()
    reporting_start = (now() - timedelta(days=30)).isoformat()
    with db() as con:
        settle_matured_plans(con)
        stats = {
            "users": con.execute("SELECT COUNT(*) FROM users WHERE archived_at IS NULL").fetchone()[0],
            "online": con.execute("SELECT COUNT(*) FROM users WHERE archived_at IS NULL AND is_disabled=0 AND last_seen_at>=?", (online_cutoff,)).fetchone()[0],
            "pending_recharges": con.execute("SELECT (SELECT COUNT(*) FROM recharges WHERE status='pending') + (SELECT COUNT(*) FROM recharge_drafts WHERE status='awaiting_utr') + (SELECT COUNT(*) FROM crypto_recharges WHERE status='pending')").fetchone()[0],
            "awaiting_utr": con.execute("SELECT COUNT(*) FROM recharge_drafts WHERE status='awaiting_utr'").fetchone()[0],
            "pending_withdrawals": con.execute("SELECT COUNT(*) FROM withdrawals WHERE status='requested'").fetchone()[0],
            "pending_referrals": con.execute("""SELECT COUNT(*) FROM users referred JOIN users inviter ON inviter.id=referred.referred_by_user_id
                LEFT JOIN referral_rewards rr ON rr.referred_user_id=referred.id WHERE rr.id IS NULL
                AND (EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=inviter.id AND r.status='approved') OR EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=inviter.id AND c.status='approved'))
                AND (EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=referred.id AND r.status='approved') OR EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=referred.id AND c.status='approved'))""").fetchone()[0],
            "unread_support": con.execute("SELECT COUNT(*) FROM support_messages WHERE sender='user' AND read_at IS NULL").fetchone()[0],
            "approved_recharge_amount": con.execute("SELECT COALESCE(SUM(amount),0) FROM recharges WHERE status='approved' AND archived_at IS NULL").fetchone()[0],
            "withdrawal_amount": con.execute("SELECT COALESCE(SUM(amount),0) FROM withdrawals WHERE status IN ('requested','paid') AND archived_at IS NULL").fetchone()[0],
            "total_visits": con.execute("SELECT COUNT(*) FROM visitor_events").fetchone()[0],
            "unique_visitors": con.execute("SELECT COUNT(*) FROM visitor_profiles").fetchone()[0],
            "visits_today": con.execute("SELECT COUNT(*) FROM visitor_events WHERE created_at>=?", (today_start_utc,)).fetchone()[0],
            "unique_today": con.execute("SELECT COUNT(DISTINCT visitor_id) FROM visitor_events WHERE created_at>=?", (today_start_utc,)).fetchone()[0],
            "visits_24h": con.execute("SELECT COUNT(*) FROM visitor_events WHERE created_at>=?", (last_24h,)).fetchone()[0],
        }
        stats["signup_conversion_percent"] = round((stats["users"] / stats["unique_visitors"]) * 100, 1) if stats["unique_visitors"] else 0
        users = [dict(row) for row in con.execute("""
            SELECT u.id,u.public_id,u.name,u.email,u.balance,u.created_at,u.last_seen_at,u.is_disabled,u.disabled_at,u.vip_approved_at,u.remember_login,u.withdrawal_enabled,
                   referrer.public_id AS referrer_public_id,
                   (EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=u.id AND r.status='approved') OR EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=u.id AND c.status='approved')) AS has_approved_deposit,
                   CASE WHEN u.last_seen_at>=? THEN 1 ELSE 0 END AS is_online,
                   CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password,
                   EXISTS(SELECT 1 FROM active_plans a JOIN plan_catalog activation ON activation.id=a.plan_id
                          WHERE a.user_id=u.id AND activation.vip_activation=1) AS vip_activation_purchased
            FROM users u
            LEFT JOIN users referrer ON referrer.id=u.referred_by_user_id
            WHERE u.archived_at IS NULL
            ORDER BY u.created_at DESC
        """, (online_cutoff,))]
        recharges = [dict(row) for row in con.execute("""
            SELECT r.*,u.public_id,u.name,u.email,COALESCE(q.admin_label,q.payee,'Not recorded') AS payment_qr_name FROM recharges r
            JOIN users u ON u.id=r.user_id LEFT JOIN payment_qrs q ON q.id=r.payment_qr_id WHERE r.archived_at IS NULL ORDER BY r.id DESC LIMIT 500
        """)]
        for row in recharges:
            row["record_key"] = f"recharge-{row['id']}"
            row["reference"] = f"RCG-{row['id']:06d}"
        drafts = [dict(row) for row in con.execute("""
            SELECT d.*,NULL AS utr,NULL AS reviewed_at,u.public_id,u.name,u.email,COALESCE(q.admin_label,q.payee,'Not recorded') AS payment_qr_name
            FROM recharge_drafts d JOIN users u ON u.id=d.user_id
            LEFT JOIN payment_qrs q ON q.id=d.payment_qr_id
            WHERE d.status='awaiting_utr' ORDER BY d.id DESC LIMIT 500
        """)]
        for row in drafts:
            row["record_key"] = f"draft-{row['id']}"
            row["reference"] = f"DRAFT-{row['id']:06d}"
        recharges = sorted(recharges + drafts, key=lambda row: row["created_at"], reverse=True)[:500]
        withdrawals = [dict(row) for row in con.execute("""
            SELECT w.*,u.public_id,u.name,u.email,b.beneficiary,b.ifsc,b.account_last4,b.account_encrypted
            FROM withdrawals w JOIN users u ON u.id=w.user_id
            LEFT JOIN bank_accounts b ON b.user_id=w.user_id
            WHERE w.archived_at IS NULL ORDER BY w.id DESC LIMIT 500
        """)]
        for withdrawal in withdrawals:
            withdrawal["reference"] = f"WD-{withdrawal['id']:06d}"
            withdrawal["account_number"] = decrypt_bank_account(withdrawal.pop("account_encrypted", None)) if withdrawal["payout_method"] == "bank" else None
        active_plans = [dict(row) for row in con.execute("""
            SELECT p.*,u.public_id,u.name,u.email FROM active_plans p
            JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 500
        """)]
        activity = [dict(row) for row in con.execute("""
            SELECT t.*,u.public_id,u.name,u.email,
                   purchased.plan_id AS purchased_plan_id,
                   catalog.name AS purchased_plan_name,
                   CASE
                       WHEN t.kind='plan_purchase' AND t.reference LIKE 'PLAN-______-%X'
                       THEN CAST(replace(substr(t.reference, 13), 'X', '') AS INTEGER)
                       ELSE NULL
                   END AS purchased_plan_quantity
            FROM transactions t
            JOIN users u ON u.id=t.user_id
            LEFT JOIN active_plans purchased
              ON t.kind='plan_purchase'
             -- Postgres evaluates this for every row and will not coerce a
             -- non-numeric substring, so guard the cast instead of relying on
             -- SQLite's lenient CAST-to-0 behaviour.
             AND purchased.id=CASE WHEN t.reference ~ '^PLAN-[0-9]{6}'
                                   THEN CAST(substr(t.reference, 6, 6) AS INTEGER) END
            LEFT JOIN plan_catalog catalog ON catalog.id=purchased.plan_id
            ORDER BY t.id DESC LIMIT 500
        """)]
        signup_bonuses = [dict(row) for row in con.execute("""
            SELECT t.id,t.user_id,t.amount,t.reference,t.created_at,u.public_id,u.name,u.email
            FROM transactions t JOIN users u ON u.id=t.user_id
            WHERE t.kind='signup_bonus' ORDER BY t.id DESC LIMIT 500
        """)]
        payment_qrs = [dict(row) for row in con.execute("SELECT id,upi_id,payee,admin_label,source,CASE WHEN image_blob IS NOT NULL THEN 1 ELSE 0 END AS has_image,created_at,updated_at FROM payment_qrs ORDER BY id")]
        for payment_qr in payment_qrs: payment_qr["image_url"] = f"/api/payment-qrs/{payment_qr['id']}/image?v={payment_qr['updated_at']}" if payment_qr.pop("has_image") else None
        wallet_rows = {row["coin"]: dict(row) for row in con.execute("SELECT coin,network,address,updated_at FROM crypto_wallets")}
        crypto_wallets = [{**wallet_rows[coin], "label": CRYPTO_LABELS[coin]} for coin in CRYPTO_NETWORKS if coin in wallet_rows]
        crypto_recharges = [dict(row) for row in con.execute("""SELECT c.*,u.public_id,u.name,u.email FROM crypto_recharges c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC LIMIT 500""")]
        plan_catalog = [dict(row) for row in con.execute("SELECT * FROM plan_catalog WHERE is_active=1 AND category IN ('plan','benefit','vip') ORDER BY sort_order,id")]
        notifications = [dict(row) for row in con.execute("""SELECT n.*,
            (SELECT COUNT(*) FROM notification_reads nr WHERE nr.notification_id=n.id) AS read_count
            FROM notifications n ORDER BY n.id DESC LIMIT 100""")]
        support_conversations = [dict(row) for row in con.execute("""
            SELECT c.user_id,c.status,c.created_at,c.updated_at,u.public_id,u.name,u.email,
                   (SELECT CASE WHEN trim(m.message)!='' THEN m.message WHEN m.image_data IS NOT NULL THEN 'Photo attachment' ELSE 'New conversation' END FROM support_messages m WHERE m.user_id=c.user_id ORDER BY m.id DESC LIMIT 1) AS last_message,
                   (SELECT m.sender FROM support_messages m WHERE m.user_id=c.user_id ORDER BY m.id DESC LIMIT 1) AS last_sender,
                   (SELECT COUNT(*) FROM support_messages m WHERE m.user_id=c.user_id AND m.sender='user' AND m.read_at IS NULL) AS unread_count
            FROM support_conversations c JOIN users u ON u.id=c.user_id
            WHERE u.archived_at IS NULL ORDER BY c.updated_at DESC LIMIT 500
        """)]
        settings = {row["key"]: row["value"] for row in con.execute("SELECT key,value FROM app_settings WHERE key NOT LIKE 'admin_recovery_%'")}
        visitors = [dict(row) for row in con.execute("""SELECT p.id,p.visitor_code,p.visitor_id,p.first_seen_at,p.last_seen_at,p.visit_count,
                   p.first_referrer,p.last_path,p.last_action,p.registered_user_id,
                   u.public_id,u.name,u.email
            FROM visitor_profiles p LEFT JOIN users u ON u.id=p.registered_user_id
            ORDER BY p.id DESC LIMIT 500""")]
        recent_visits = [dict(row) for row in con.execute("""SELECT e.id,p.visitor_code,e.path,e.referrer,e.created_at
            FROM visitor_events e JOIN visitor_profiles p ON p.visitor_id=e.visitor_id
            ORDER BY e.id DESC LIMIT 500""")]
        visitor_period_rows = con.execute("SELECT visitor_id,created_at FROM visitor_events WHERE created_at>=? ORDER BY created_at", (reporting_start,)).fetchall()
        daily_visitors = {}
        for event in visitor_period_rows:
            date_key = datetime.fromisoformat(event["created_at"]).astimezone(india_tz).date().isoformat()
            bucket = daily_visitors.setdefault(date_key, {"date":date_key,"visits":0,"visitor_ids":set()})
            bucket["visits"] += 1
            bucket["visitor_ids"].add(event["visitor_id"])
        visitor_daily = []
        for offset in range(30):
            date_key = (today_india - timedelta(days=offset)).isoformat()
            bucket = daily_visitors.get(date_key, {"visits":0,"visitor_ids":set()})
            visitor_daily.append({"date":date_key,"visits":bucket["visits"],"unique_visitors":len(bucket["visitor_ids"])})
        referrals = [dict(row) for row in con.execute("""
            SELECT referred.id AS referred_user_id,referred.public_id AS referred_public_id,
                   referred.name AS referred_name,referred.email AS referred_email,
                   referred.created_at AS referred_created_at,
                   inviter.id AS referrer_user_id,inviter.public_id AS referrer_public_id,
                   inviter.name AS referrer_name,inviter.email AS referrer_email,
                   rr.id AS reward_id,COALESCE(rr.amount,?) AS reward_amount,
                   rr.created_at AS rewarded_at,
                   CASE WHEN rr.id IS NOT NULL THEN 'approved'
                        WHEN NOT (EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=inviter.id AND r.status='approved') OR EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=inviter.id AND c.status='approved')) THEN 'referrer_locked'
                        WHEN NOT (EXISTS(SELECT 1 FROM recharges r WHERE r.user_id=referred.id AND r.status='approved') OR EXISTS(SELECT 1 FROM crypto_recharges c WHERE c.user_id=referred.id AND c.status='approved')) THEN 'awaiting_deposit'
                        ELSE 'pending' END AS status,
                   COALESCE(
                       (SELECT r.amount FROM recharges r WHERE r.user_id=referred.id AND r.status='approved' ORDER BY r.reviewed_at,r.id LIMIT 1),
                       (SELECT c.credited_inr FROM crypto_recharges c WHERE c.user_id=referred.id AND c.status='approved' ORDER BY c.reviewed_at,c.id LIMIT 1)
                   ) AS first_recharge_amount,
                   COALESCE(
                       (SELECT r.reviewed_at FROM recharges r WHERE r.user_id=referred.id AND r.status='approved' ORDER BY r.reviewed_at,r.id LIMIT 1),
                       (SELECT c.reviewed_at FROM crypto_recharges c WHERE c.user_id=referred.id AND c.status='approved' ORDER BY c.reviewed_at,c.id LIMIT 1)
                   ) AS first_recharge_approved_at
            FROM users referred
            JOIN users inviter ON inviter.id=referred.referred_by_user_id
            LEFT JOIN referral_rewards rr ON rr.referred_user_id=referred.id
            ORDER BY referred.created_at DESC LIMIT 500
        """, (REFERRAL_BONUS,))]
        return {"stats": stats, "users": users, "recharges": recharges,
                "withdrawals": withdrawals, "active_plans": active_plans,
                "activity": activity, "payment_qrs": payment_qrs, "crypto_wallets": crypto_wallets,
                "crypto_recharges": crypto_recharges, "referrals": referrals,
                "signup_bonuses": signup_bonuses, "plan_catalog": plan_catalog, "notifications": notifications,
                "support_conversations": support_conversations,
                "settings": settings, "visitors": visitors, "recent_visits": recent_visits,
                "visitor_daily": visitor_daily, "generated_at": now_iso()}

@app.post("/api/admin/notifications", dependencies=[Depends(require_admin)])
def create_admin_notification(p: AdminNotificationInput):
    title = " ".join(p.title.split())
    message = " ".join(p.message.split())
    if len(title) < 2 or len(message) < 2: raise HTTPException(400, "Enter a title and message")
    with db() as con:
        cur = con.execute("INSERT INTO notifications(title,message,created_at) VALUES(?,?,?)", (title,message,now_iso()))
        return {"id":cur.lastrowid,"sent":True}

@app.post("/api/admin/notifications/{notification_id}/remove", dependencies=[Depends(require_admin)])
def remove_admin_notification(notification_id: int):
    with db() as con:
        con.execute("DELETE FROM notification_reads WHERE notification_id=?", (notification_id,))
        cur = con.execute("DELETE FROM notifications WHERE id=?", (notification_id,))
        if cur.rowcount != 1: raise HTTPException(404, "Notification not found")
        return {"removed":True}

@app.post("/api/admin/referrals/{referred_user_id}/approve", dependencies=[Depends(require_admin)])
def approve_referral(referred_user_id: str):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        referral = con.execute("""
            SELECT referred.id AS referred_user_id,referred.public_id AS referred_public_id,
                   referred.name AS referred_name,inviter.id AS referrer_user_id,
                   inviter.public_id AS referrer_public_id,inviter.name AS referrer_name
            FROM users referred JOIN users inviter ON inviter.id=referred.referred_by_user_id
            WHERE referred.id=?
        """, (referred_user_id,)).fetchone()
        if not referral: raise HTTPException(404, "Referral record not found")
        if con.execute("SELECT 1 FROM referral_rewards WHERE referred_user_id=?", (referred_user_id,)).fetchone():
            raise HTTPException(409, "Referral bonus is already approved")
        if not user_has_approved_deposit(con, referral["referrer_user_id"]):
            raise HTTPException(409, "The referrer must make an approved deposit to unlock referral rewards")
        if not user_has_approved_deposit(con, referred_user_id):
            raise HTTPException(409, "The referred user must make an approved deposit before commission can be credited")
        approved_at = now_iso()
        con.execute("INSERT INTO referral_rewards(inviter_id,referred_user_id,amount,created_at) VALUES(?,?,?,?)", (referral["referrer_user_id"],referred_user_id,REFERRAL_BONUS,approved_at))
        con.execute("UPDATE users SET balance=balance+? WHERE id=?", (REFERRAL_BONUS,referral["referrer_user_id"]))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (referral["referrer_user_id"],"referral_bonus",REFERRAL_BONUS,f"REF-{referral['referred_public_id']}",approved_at))
        return {"status":"approved","credited":REFERRAL_BONUS,"referrer":{"id":referral["referrer_user_id"],"public_id":referral["referrer_public_id"],"name":referral["referrer_name"]},"referred_user":{"id":referral["referred_user_id"],"public_id":referral["referred_public_id"],"name":referral["referred_name"]}}

@app.post("/api/admin/crypto-wallets/{coin}", dependencies=[Depends(require_admin)])
def update_crypto_wallet(coin: str, p: CryptoWalletInput):
    coin = coin.strip().upper()
    if coin not in CRYPTO_NETWORKS: raise HTTPException(404, "Crypto network not found")
    address = p.address.strip()
    if any(ch.isspace() for ch in address): raise HTTPException(400, "Address cannot contain spaces")
    with db() as con:
        con.execute("UPDATE crypto_wallets SET address=?,updated_at=? WHERE coin=?", (address,now_iso(),coin))
    return {"coin":coin,"label":CRYPTO_LABELS[coin],"network":CRYPTO_NETWORKS[coin],"address":address}

@app.post("/api/admin/crypto-wallets/{coin}/remove", dependencies=[Depends(require_admin)])
def remove_crypto_wallet(coin: str):
    coin = coin.strip().upper()
    if coin not in CRYPTO_NETWORKS: raise HTTPException(404, "Crypto network not found")
    with db() as con: con.execute("UPDATE crypto_wallets SET address='',updated_at=? WHERE coin=?", (now_iso(),coin))
    return {"removed":True}

def validate_payment_qr(p: PaymentQrInput):
    upi_id = p.upi_id.strip()
    payee = p.payee.strip()
    admin_label = p.admin_label.strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}", upi_id):
        raise HTTPException(400, "Enter a valid UPI ID")
    if len(payee) < 2: raise HTTPException(400, "Enter a valid payee name")
    if len(admin_label) < 2: raise HTTPException(400, "Enter an internal caption or owner name")
    source = p.source if p.source in {"manual", "uploaded"} else "manual"
    image_bytes = image_mime = None
    if source == "uploaded" and p.image_data:
        image_bytes, image_mime, _ = decode_receipt_image(p.image_data)
    return upi_id, payee, admin_label, source, image_bytes, image_mime

@app.post("/api/admin/payment-qr-mode", dependencies=[Depends(require_admin)])
def update_payment_qr_mode(p: PaymentQrModeInput):
    if p.mode != "uploaded":
        raise HTTPException(409, "Auto-generated QR is disabled; only manual payment QR is available")
    with db() as con:
        if not con.execute("SELECT 1 FROM payment_qrs WHERE source=? AND (source!='uploaded' OR image_blob IS NOT NULL) LIMIT 1", (p.mode,)).fetchone():
            raise HTTPException(409, f"Add at least one {p.mode} QR before activating it")
        con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('payment_qr_mode',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (p.mode,now_iso()))
    return {"mode":p.mode,"active":True}

@app.post("/api/admin/payment-qrs", status_code=201, dependencies=[Depends(require_admin)])
def add_payment_qr(p: PaymentQrInput):
    upi_id, payee, admin_label, source, image_bytes, image_mime = validate_payment_qr(p)
    if source != "uploaded" or not image_bytes: raise HTTPException(400, "Upload the manual payment QR image")
    timestamp = now_iso()
    with db() as con:
        cur = con.execute("INSERT INTO payment_qrs(upi_id,payee,admin_label,source,image_blob,image_mime,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (upi_id,payee,admin_label,source,image_bytes,image_mime,timestamp,timestamp))
        return {"id": cur.lastrowid, "upi_id": upi_id, "payee": payee, "admin_label": admin_label, "source":source}

@app.post("/api/admin/payment-qrs/{qid}", dependencies=[Depends(require_admin)])
def update_payment_qr(qid: int, p: PaymentQrInput):
    upi_id, payee, admin_label, source, image_bytes, image_mime = validate_payment_qr(p)
    if source != "uploaded": raise HTTPException(400, "Only uploaded manual payment QR is supported")
    with db() as con:
        current = con.execute("SELECT image_blob,image_mime FROM payment_qrs WHERE id=?", (qid,)).fetchone()
        if not current: raise HTTPException(404, "Payment QR not found")
        if source == "uploaded":
            image_bytes = image_bytes or current["image_blob"]
            image_mime = image_mime or current["image_mime"]
            if not image_bytes: raise HTTPException(400, "Upload the manual payment QR image")
        else: image_bytes = image_mime = None
        cur = con.execute("UPDATE payment_qrs SET upi_id=?,payee=?,admin_label=?,source=?,image_blob=?,image_mime=?,updated_at=? WHERE id=?", (upi_id,payee,admin_label,source,image_bytes,image_mime,now_iso(),qid))
        if cur.rowcount != 1: raise HTTPException(404, "Payment QR not found")
        return {"id": qid, "upi_id": upi_id, "payee": payee, "admin_label": admin_label, "source":source}

@app.post("/api/admin/payment-qrs/{qid}/remove", dependencies=[Depends(require_admin)])
def remove_payment_qr(qid: int):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        target = con.execute("SELECT source FROM payment_qrs WHERE id=?", (qid,)).fetchone()
        if not target: raise HTTPException(404, "Payment QR not found")
        if target["source"] == "uploaded" and con.execute("SELECT COUNT(*) FROM payment_qrs WHERE source='uploaded' AND image_blob IS NOT NULL").fetchone()[0] <= 1:
            raise HTTPException(409, "Keep at least one uploaded manual payment QR active")
        cur = con.execute("DELETE FROM payment_qrs WHERE id=?", (qid,))
        if cur.rowcount != 1: raise HTTPException(404, "Payment QR not found")
        return {"removed": True}

def persist_admin_password(new_password):
    global ADMIN_TOKEN
    if ADMIN_TOKEN_FILE is None: raise HTTPException(503, "Secure password storage is not configured")
    ADMIN_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = ADMIN_TOKEN_FILE.with_name(f".{ADMIN_TOKEN_FILE.name}.tmp")
    try:
        temporary.write_text(new_password, encoding="utf-8")
        temporary.chmod(0o600)
        os.replace(temporary, ADMIN_TOKEN_FILE)
        ADMIN_TOKEN_FILE.chmod(0o600)
    except OSError as exc:
        try: temporary.unlink(missing_ok=True)
        except OSError: pass
        raise HTTPException(500, "Could not update the admin password") from exc
    ADMIN_TOKEN = new_password

@app.post("/api/admin/password", dependencies=[Depends(require_admin)])
def change_admin_password(p: AdminPasswordChange):
    if hmac.compare_digest(p.new_password, ADMIN_TOKEN): raise HTTPException(400, "Choose a different password")
    persist_admin_password(p.new_password)
    return {"changed": True}

@app.post("/api/admin/recovery-code", dependencies=[Depends(require_admin)])
def create_admin_recovery_code():
    if ADMIN_TOKEN_FILE is None: raise HTTPException(503, "Secure password storage is not configured")
    recovery_code = "MLF-" + "-".join(secrets.token_hex(3).upper() for _ in range(4))
    with db() as con:
        timestamp = now_iso()
        con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('admin_recovery_hash',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (password_hash(recovery_code),timestamp))
        con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('admin_recovery_created_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (timestamp,timestamp))
    return {"recovery_code": recovery_code, "created_at": timestamp, "message": "Save this one-time recovery code securely. Generating another code replaces it."}

_admin_recovery_attempts = {}

@app.post("/api/admin/recover-password")
def recover_admin_password(p: AdminPasswordRecovery, request: Request):
    remote = request.client.host if request.client else "unknown"
    cutoff = now() - timedelta(minutes=15)
    attempts = [attempt for attempt in _admin_recovery_attempts.get(remote, []) if attempt > cutoff]
    if len(attempts) >= 5:
        raise HTTPException(429, "Too many recovery attempts. Try again after 15 minutes.")
    with db() as con:
        stored_row = con.execute("SELECT value FROM app_settings WHERE key='admin_recovery_hash'").fetchone()
        stored_hash = stored_row["value"] if stored_row else ""
        valid = bool(stored_hash) and verify_password(p.recovery_code.strip().upper(), stored_hash)
        if not valid:
            attempts.append(now())
            _admin_recovery_attempts[remote] = attempts
            raise HTTPException(401, "Invalid or expired recovery code")
        if hmac.compare_digest(p.new_password, ADMIN_TOKEN):
            raise HTTPException(400, "Choose a different password")
        persist_admin_password(p.new_password)
        con.execute("DELETE FROM app_settings WHERE key IN ('admin_recovery_hash','admin_recovery_created_at')")
    _admin_recovery_attempts.pop(remote, None)
    return {"changed": True, "message": "Admin password recovered. This recovery code has now expired."}

def validate_plan_input(p: AdminPlanInput):
    if len(" ".join(p.name.split())) < 2: raise HTTPException(400, "Enter a plan name")
    if not p.coming_soon and (p.amount is None or p.total_return is None): raise HTTPException(400, "Active plans require amount and total return")
    if p.amount is not None and p.total_return is not None and p.total_return < p.amount: raise HTTPException(400, "Total return cannot be below the plan amount")
    if p.category != "vip" and (p.vip_locked or p.vip_activation): raise HTTPException(400, "VIP controls are only available for VIP plans")
    if p.vip_locked and p.vip_activation: raise HTTPException(400, "The VIP Activation Plan cannot be locked")
    if p.duration_unit == "hours" and not 1 <= p.days <= 12: raise HTTPException(400, "Hourly plans must be between 1 and 12 hours")
    if p.duration_unit == "hours" and p.payout_mode != "maturity": raise HTTPException(400, "Hourly plans must pay at maturity")

@app.post("/api/admin/plans", dependencies=[Depends(require_admin)])
def add_admin_plan(p: AdminPlanInput):
    validate_plan_input(p)
    with db() as con:
        numeric_ids = [int(row[0][1:]) for row in con.execute("SELECT id FROM plan_catalog WHERE id ~ '^p[0-9]'") if row[0][1:].isdigit()]
        plan_id = f"p{max(numeric_ids, default=0)+1}"
        sort_order = con.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM plan_catalog").fetchone()[0]
        con.execute("INSERT INTO plan_catalog(id,name,category,days,duration_unit,amount,total_return,daily_earning,payout_mode,purchase_limit,coming_soon,plan_locked,vip_locked,vip_activation,is_active,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)", (plan_id," ".join(p.name.split()),p.category,p.days,p.duration_unit,p.amount,p.total_return,p.daily_earning,p.payout_mode,p.purchase_limit,1 if p.coming_soon else 0,1 if p.plan_locked else 0,1 if p.vip_locked else 0,1 if p.vip_activation else 0,sort_order,now_iso()))
        return {"id":plan_id,"created":True}

@app.post("/api/admin/plans/reorder", dependencies=[Depends(require_admin)])
def reorder_admin_plans(p: AdminPlanOrderInput):
    if len(p.plan_ids) != len(set(p.plan_ids)):
        raise HTTPException(400, "Plan order contains duplicate IDs")
    with db() as con:
        active_ids = [row["id"] for row in con.execute("SELECT id FROM plan_catalog WHERE is_active=1 AND category IN ('plan','benefit','vip')")]
        if set(p.plan_ids) != set(active_ids):
            raise HTTPException(409, "Plan list changed; refresh the dashboard and try again")
        updated_at = now_iso()
        con.execute("BEGIN IMMEDIATE")
        con.executemany(
            "UPDATE plan_catalog SET sort_order=?,updated_at=? WHERE id=? AND is_active=1",
            [(sort_order, updated_at, plan_id) for sort_order, plan_id in enumerate(p.plan_ids)],
        )
        return {"updated": True, "plan_ids": p.plan_ids}

@app.post("/api/admin/plans/{plan_id}", dependencies=[Depends(require_admin)])
def update_admin_plan(plan_id: str, p: AdminPlanInput):
    validate_plan_input(p)
    with db() as con:
        cur = con.execute("UPDATE plan_catalog SET name=?,category=?,days=?,duration_unit=?,amount=?,total_return=?,daily_earning=?,payout_mode=?,purchase_limit=?,coming_soon=?,plan_locked=?,vip_locked=?,vip_activation=?,updated_at=? WHERE id=? AND is_active=1", (" ".join(p.name.split()),p.category,p.days,p.duration_unit,p.amount,p.total_return,p.daily_earning,p.payout_mode,p.purchase_limit,1 if p.coming_soon else 0,1 if p.plan_locked else 0,1 if p.vip_locked else 0,1 if p.vip_activation else 0,now_iso(),plan_id))
        if cur.rowcount != 1: raise HTTPException(404, "Plan not found")
        return {"id":plan_id,"updated":True}

@app.post("/api/admin/plans/{plan_id}/remove", dependencies=[Depends(require_admin)])
def remove_admin_plan(plan_id: str):
    with db() as con:
        plan = con.execute("SELECT image_name FROM plan_catalog WHERE id=? AND is_active=1", (plan_id,)).fetchone()
        if not plan: raise HTTPException(404, "Plan not found")
        cur = con.execute("UPDATE plan_catalog SET is_active=0,updated_at=? WHERE id=? AND is_active=1", (now_iso(),plan_id))
        if cur.rowcount != 1: raise HTTPException(404, "Plan not found")
    if plan["image_name"]:
        try: (PLAN_IMAGE_DIR / Path(plan["image_name"]).name).unlink(missing_ok=True)
        except OSError: pass
    return {"id":plan_id,"removed":True}

@app.post("/api/admin/plans/{plan_id}/image", dependencies=[Depends(require_admin)])
def upload_admin_plan_image(plan_id: str, p: AdminPlanImageInput):
    image_bytes, mime_type, extension = decode_plan_image(p.image_data)
    image_name = f"{secrets.token_urlsafe(24)}.{extension}"
    image_path = PLAN_IMAGE_DIR / image_name
    with db() as con:
        plan = con.execute("SELECT image_name FROM plan_catalog WHERE id=? AND is_active=1", (plan_id,)).fetchone()
    if not plan: raise HTTPException(404, "Plan not found")
    PLAN_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    try: image_path.write_bytes(image_bytes)
    except OSError as exc: raise HTTPException(500, "Could not save the plan image") from exc
    try:
        with db() as con:
            image_updated_at = now_iso()
            con.execute("UPDATE plan_catalog SET image_name=?,image_mime=?,image_auto_fit=1,image_updated_at=?,updated_at=? WHERE id=? AND is_active=1", (image_name,mime_type,image_updated_at,image_updated_at,plan_id))
    except Exception:
        try: image_path.unlink(missing_ok=True)
        except OSError: pass
        raise
    if plan["image_name"]:
        try: (PLAN_IMAGE_DIR / Path(plan["image_name"]).name).unlink(missing_ok=True)
        except OSError: pass
    return {"id":plan_id,"uploaded":True,"image_url":f"/api/plan-images/{plan_id}"}

@app.post("/api/admin/plans/{plan_id}/remove-image", dependencies=[Depends(require_admin)])
def remove_admin_plan_image(plan_id: str):
    with db() as con:
        plan = con.execute("SELECT image_name FROM plan_catalog WHERE id=? AND is_active=1", (plan_id,)).fetchone()
        if not plan: raise HTTPException(404, "Plan not found")
        con.execute("UPDATE plan_catalog SET image_name=NULL,image_mime=NULL,image_auto_fit=0,image_updated_at=NULL,updated_at=? WHERE id=?", (now_iso(),plan_id))
    if plan["image_name"]:
        try: (PLAN_IMAGE_DIR / Path(plan["image_name"]).name).unlink(missing_ok=True)
        except OSError: pass
    return {"id":plan_id,"removed":True}

@app.post("/api/admin/settings/company-name", dependencies=[Depends(require_admin)])
def update_company_name(p: CompanyNameInput):
    value = " ".join(p.company_name.split())
    with db() as con: con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('company_name',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (value,now_iso()))
    return {"company_name":value}

@app.post("/api/admin/settings/telegram-url", dependencies=[Depends(require_admin)])
def update_telegram_url(p: TelegramUrlInput):
    value = p.telegram_url.strip()
    # https only: the value is rendered as a target=_blank link, so other schemes are rejected.
    if not value.lower().startswith("https://"):
        raise HTTPException(400, "Telegram link must start with https://")
    if " " in value or len(value) < 12:
        raise HTTPException(400, "Enter a valid Telegram link, for example https://t.me/yourchannel")
    with db() as con:
        con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES('telegram_url',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (value,now_iso()))
    return {"telegram_url":value}

@app.post("/api/admin/settings/recharge", dependencies=[Depends(require_admin)])
def update_recharge_settings(p: AdminRechargeSettingsInput):
    if p.first_recharge_amount < p.minimum_recharge:
        raise HTTPException(400, "First recharge box amount cannot be below the minimum recharge")
    updated_at = now_iso()
    values = {"minimum_recharge":str(p.minimum_recharge), "first_recharge_amount":str(p.first_recharge_amount)}
    with db() as con:
        for key, value in values.items():
            con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (key,value,updated_at))
    return {"minimum_recharge":p.minimum_recharge,"first_recharge_amount":p.first_recharge_amount}

@app.post("/api/admin/settings/welcome-popup", dependencies=[Depends(require_admin)])
def update_welcome_popup(p: WelcomePopupInput):
    title = p.title.strip()
    message = p.message.strip()
    button_text = p.button_text.strip()
    if len(title) < 2 or len(message) < 2 or len(button_text) < 2:
        raise HTTPException(400, "Complete all welcome popup fields")
    updated_at = now_iso()
    values = {
        "welcome_popup_enabled": "1" if p.enabled else "0",
        "welcome_popup_title": title,
        "welcome_popup_message": message,
        "welcome_popup_button": button_text,
    }
    with db() as con:
        for key, value in values.items():
            con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (key,value,updated_at))
    return {"welcome_popup":{"enabled":p.enabled,"title":title,"message":message,"buttonText":button_text}}

@app.post("/api/admin/settings/home-banner", dependencies=[Depends(require_admin)])
def upload_home_banner(p: AdminPlanImageInput):
    image_bytes, mime_type, extension = decode_plan_image(p.image_data)
    image_name = f"{secrets.token_urlsafe(24)}.{extension}"
    image_path = HOME_BANNER_DIR / image_name
    HOME_BANNER_DIR.mkdir(parents=True, exist_ok=True)
    try: image_path.write_bytes(image_bytes)
    except OSError as exc: raise HTTPException(500, "Could not save the home photo") from exc
    updated_at = now_iso()
    try:
        with db() as con:
            previous = con.execute("SELECT value FROM app_settings WHERE key='home_banner_name'").fetchone()
            values = {"home_banner_name":image_name, "home_banner_mime":mime_type, "home_banner_updated_at":updated_at}
            for key, value in values.items():
                con.execute("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (key,value,updated_at))
    except Exception:
        image_path.unlink(missing_ok=True)
        raise
    if previous and previous["value"]:
        try: (HOME_BANNER_DIR / Path(previous["value"]).name).unlink(missing_ok=True)
        except OSError: pass
    return {"uploaded":True,"home_banner_url":f"/api/home-banner?v={updated_at}"}

@app.post("/api/admin/settings/home-banner/remove", dependencies=[Depends(require_admin)])
def remove_home_banner():
    with db() as con:
        previous = con.execute("SELECT value FROM app_settings WHERE key='home_banner_name'").fetchone()
        con.execute("DELETE FROM app_settings WHERE key IN ('home_banner_name','home_banner_mime','home_banner_updated_at')")
    if previous and previous["value"]:
        try: (HOME_BANNER_DIR / Path(previous["value"]).name).unlink(missing_ok=True)
        except OSError: pass
    return {"removed":True}

@app.post("/api/admin/users/{user_id}/disable", dependencies=[Depends(require_admin)])
def disable_user(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET is_disabled=1,disabled_at=? WHERE id=? AND archived_at IS NULL", (now_iso(),user_id))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
        con.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    return {"disabled":True}

@app.post("/api/admin/users/{user_id}/enable", dependencies=[Depends(require_admin)])
def enable_user(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET is_disabled=0,disabled_at=NULL WHERE id=? AND archived_at IS NULL", (user_id,))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
    return {"enabled":True}

@app.post("/api/admin/users/{user_id}/balance", dependencies=[Depends(require_admin)])
def adjust_user_balance(user_id: str, p: AdminBalanceAdjustmentInput):
    note = " ".join(p.note.split())
    if len(note) < 2: raise HTTPException(400, "Enter a reason for this balance adjustment")
    signed_amount = p.amount if p.operation == "credit" else -p.amount
    changed_at = now_iso()
    reference = f"ADMIN-{secrets.token_hex(4).upper()} • {note}"
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        user = con.execute("SELECT id,balance FROM users WHERE id=? AND archived_at IS NULL", (user_id,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        if p.operation == "debit" and user["balance"] < p.amount:
            raise HTTPException(409, f"Cannot deduct INR {p.amount}; available balance is INR {user['balance']}")
        new_balance = user["balance"] + signed_amount
        con.execute("UPDATE users SET balance=? WHERE id=?", (new_balance,user_id))
        cur = con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (user_id,"admin_credit" if p.operation == "credit" else "admin_debit",signed_amount,reference,changed_at))
        return {"transaction_id":cur.lastrowid,"user_id":user_id,"operation":p.operation,"amount":p.amount,"balance":new_balance,"reference":reference}

@app.post("/api/admin/withdrawals/{withdrawal_id}/receipt-time", dependencies=[Depends(require_admin)])
def update_withdrawal_receipt_time(withdrawal_id: int, p: AdminWithdrawalReceiptTimeInput):
    receipt_at = p.receipt_at
    receipt_reference = p.receipt_reference.strip()
    if not receipt_reference: raise HTTPException(400, "Receipt reference is required")
    if receipt_at.tzinfo is None:
        receipt_at = receipt_at.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
    normalized = receipt_at.astimezone(timezone.utc).isoformat()
    with db() as con:
        withdrawal = con.execute("SELECT id,user_id FROM withdrawals WHERE id=? AND archived_at IS NULL", (withdrawal_id,)).fetchone()
        if not withdrawal: raise HTTPException(404, "Withdrawal not found")
        con.execute("UPDATE withdrawals SET receipt_at=?,receipt_amount=?,receipt_reference=? WHERE id=?", (normalized,p.receipt_amount,receipt_reference,withdrawal_id))
    return {"withdrawal_id":withdrawal_id,"receipt_at":normalized,"receipt_amount":p.receipt_amount,"receipt_reference":receipt_reference,"updated":True}

@app.post("/api/admin/users/{user_id}/withdrawal-receipts/order", dependencies=[Depends(require_admin)])
def update_withdrawal_receipt_order(user_id: str, p: AdminWithdrawalReceiptOrderInput):
    ordered_ids = list(dict.fromkeys(p.withdrawal_ids))
    if len(ordered_ids) != len(p.withdrawal_ids): raise HTTPException(400, "Receipt order contains duplicate IDs")
    with db() as con:
        placeholders = ",".join("?" for _ in ordered_ids)
        matching = con.execute(f"SELECT COUNT(*) FROM withdrawals WHERE user_id=? AND archived_at IS NULL AND id IN ({placeholders})", (user_id,*ordered_ids)).fetchone()[0]
        if matching != len(ordered_ids): raise HTTPException(400, "One or more withdrawal receipts do not belong to this user")
        con.execute("BEGIN IMMEDIATE")
        total = len(ordered_ids)
        for index, withdrawal_id in enumerate(ordered_ids):
            con.execute("UPDATE withdrawals SET receipt_sort_order=? WHERE id=? AND user_id=?", (total-index,withdrawal_id,user_id))
    return {"user_id":user_id,"withdrawal_ids":ordered_ids,"updated":True}

@app.post("/api/admin/withdrawals/{withdrawal_id}/receipt-delete", dependencies=[Depends(require_admin)])
def delete_withdrawal_receipt(withdrawal_id: int):
    deleted_at = now_iso()
    with db() as con:
        cur = con.execute("UPDATE withdrawals SET receipt_hidden_at=? WHERE id=? AND archived_at IS NULL AND receipt_hidden_at IS NULL", (deleted_at,withdrawal_id))
        if cur.rowcount != 1: raise HTTPException(404, "Withdrawal receipt not found or already deleted")
    return {"withdrawal_id":withdrawal_id,"receipt_hidden_at":deleted_at,"deleted":True}

@app.post("/api/admin/users/{user_id}/persistent-login/enable", dependencies=[Depends(require_admin)])
def enable_persistent_login(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET remember_login=1 WHERE id=? AND archived_at IS NULL", (user_id,))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
        con.execute("UPDATE sessions SET expires_at=? WHERE user_id=?", ((now()+timedelta(days=365)).isoformat(),user_id))
    return {"remember_login":True}

@app.post("/api/admin/users/{user_id}/persistent-login/disable", dependencies=[Depends(require_admin)])
def disable_persistent_login(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET remember_login=0 WHERE id=? AND archived_at IS NULL", (user_id,))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
        con.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    return {"remember_login":False,"sessions_revoked":True}

@app.post("/api/admin/users/{user_id}/withdrawal/enable", dependencies=[Depends(require_admin)])
def enable_user_withdrawal(user_id: str):
    with db() as con:
        user = con.execute("SELECT id FROM users WHERE id=? AND archived_at IS NULL", (user_id,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        con.execute("UPDATE users SET withdrawal_enabled=1 WHERE id=?", (user_id,))
    return {"withdrawal_enabled":True}

@app.post("/api/admin/users/{user_id}/withdrawal/disable", dependencies=[Depends(require_admin)])
def disable_user_withdrawal(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET withdrawal_enabled=0 WHERE id=? AND archived_at IS NULL", (user_id,))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
    return {"withdrawal_enabled":False}

@app.post("/api/admin/users/{user_id}/vip-activate", dependencies=[Depends(require_admin)])
def activate_user_vip(user_id: str):
    with db() as con:
        user = con.execute("SELECT id FROM users WHERE id=? AND archived_at IS NULL", (user_id,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        approved_at = now_iso()
        con.execute("UPDATE users SET vip_approved_at=? WHERE id=?", (approved_at,user_id))
    return {"vip_active":True,"approved_at":approved_at}

@app.post("/api/admin/users/{user_id}/vip-deactivate", dependencies=[Depends(require_admin)])
def deactivate_user_vip(user_id: str):
    with db() as con:
        cur = con.execute("UPDATE users SET vip_approved_at=NULL WHERE id=? AND archived_at IS NULL", (user_id,))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
    return {"vip_active":False}

@app.post("/api/admin/users/{user_id}/archive", dependencies=[Depends(require_admin)])
def archive_user(user_id: str):
    with db() as con:
        financial_count = sum(con.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id=?", (user_id,)).fetchone()[0] for table in ("recharges","withdrawals","crypto_recharges","active_plans"))
        if financial_count: raise HTTPException(409, "This user has financial records. Disable the account instead of deleting it")
        cur = con.execute("UPDATE users SET is_disabled=1,disabled_at=COALESCE(disabled_at,?),archived_at=? WHERE id=? AND archived_at IS NULL", (now_iso(),now_iso(),user_id))
        if cur.rowcount != 1: raise HTTPException(404, "User not found")
        con.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    return {"archived":True}

@app.post("/api/admin/recharges/bulk-review", dependencies=[Depends(require_admin)])
def bulk_review_recharges(p: AdminBulkReview):
    request_ids = list(dict.fromkeys(p.ids))
    reviewed_at = now_iso()
    processed = []
    skipped = []
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        placeholders = ",".join("?" for _ in request_ids)
        records = {row["id"]: row for row in con.execute(f"SELECT * FROM recharges WHERE id IN ({placeholders})", tuple(request_ids)).fetchall()}
        for request_id in request_ids:
            recharge = records.get(request_id)
            if not recharge or recharge["status"] != "pending":
                skipped.append(request_id)
                continue
            if p.action == "approve":
                con.execute("UPDATE users SET balance=balance+? WHERE id=?", (recharge["amount"], recharge["user_id"]))
                con.execute("UPDATE recharges SET status='approved',reviewed_at=? WHERE id=?", (reviewed_at, request_id))
                con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (recharge["user_id"],"recharge",recharge["amount"],recharge["utr"],reviewed_at))
            else:
                con.execute("UPDATE recharges SET status='rejected',reviewed_at=? WHERE id=?", (reviewed_at, request_id))
            processed.append(request_id)
    return {"action":p.action,"processed":processed,"processed_count":len(processed),"skipped":skipped,"skipped_count":len(skipped)}

@app.post("/api/admin/withdrawals/bulk-review", dependencies=[Depends(require_admin)])
def bulk_review_withdrawals(p: AdminBulkReview):
    request_ids = list(dict.fromkeys(p.ids))
    reviewed_at = now_iso()
    processed = []
    skipped = []
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        placeholders = ",".join("?" for _ in request_ids)
        records = {row["id"]: row for row in con.execute(f"SELECT * FROM withdrawals WHERE id IN ({placeholders})", tuple(request_ids)).fetchall()}
        for request_id in request_ids:
            withdrawal = records.get(request_id)
            if not withdrawal or withdrawal["status"] != "requested":
                skipped.append(request_id)
                continue
            if p.action == "approve":
                con.execute("UPDATE withdrawals SET status='paid',reviewed_at=? WHERE id=?", (reviewed_at, request_id))
            else:
                con.execute("UPDATE withdrawals SET status='rejected',reviewed_at=? WHERE id=?", (reviewed_at, request_id))
                con.execute("UPDATE users SET balance=balance+? WHERE id=?", (withdrawal["amount"], withdrawal["user_id"]))
                con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (withdrawal["user_id"],"withdrawal_refund",withdrawal["amount"],f"WD-{request_id}",reviewed_at))
            processed.append(request_id)
    return {"action":p.action,"processed":processed,"processed_count":len(processed),"skipped":skipped,"skipped_count":len(skipped)}

@app.post("/api/admin/recharges/bulk-archive", dependencies=[Depends(require_admin)])
def bulk_archive_recharges(p: AdminRechargeBulkArchive):
    request_keys = list(dict.fromkeys(p.keys))
    archived_at = now_iso()
    archived = []
    skipped = []
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        for request_key in request_keys:
            kind, separator, raw_id = request_key.partition("-")
            if not separator or kind not in {"recharge","draft"} or not raw_id.isdigit():
                skipped.append(request_key)
                continue
            request_id = int(raw_id)
            if kind == "draft":
                cur = con.execute("DELETE FROM recharge_drafts WHERE id=? AND status='awaiting_utr' AND recharge_id IS NULL", (request_id,))
            else:
                cur = con.execute("UPDATE recharges SET archived_at=? WHERE id=? AND archived_at IS NULL", (archived_at,request_id))
            (archived if cur.rowcount == 1 else skipped).append(request_key)
    return {"archived":archived,"processed_count":len(archived),"skipped":skipped,"skipped_count":len(skipped)}

@app.post("/api/admin/recharges/{rid}/archive", dependencies=[Depends(require_admin)])
def archive_recharge(rid: int):
    with db() as con:
        cur = con.execute("UPDATE recharges SET archived_at=? WHERE id=? AND archived_at IS NULL", (now_iso(),rid))
        if cur.rowcount != 1: raise HTTPException(404, "Recharge request not found")
    return {"archived":True}

@app.post("/api/admin/recharge-drafts/{draft_id}/delete", dependencies=[Depends(require_admin)])
def delete_recharge_draft(draft_id: int):
    with db() as con:
        cur = con.execute("DELETE FROM recharge_drafts WHERE id=? AND status='awaiting_utr' AND recharge_id IS NULL", (draft_id,))
        if cur.rowcount != 1: raise HTTPException(404, "Awaiting UTR request not found")
    return {"deleted":True}

@app.post("/api/admin/recharge-drafts/{draft_id}/approve", dependencies=[Depends(require_admin)])
def approve_recharge_draft_without_utr(draft_id: int):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        draft = con.execute("SELECT * FROM recharge_drafts WHERE id=? AND status='awaiting_utr' AND recharge_id IS NULL", (draft_id,)).fetchone()
        if not draft: raise HTTPException(409, "Awaiting UTR request not found or already reviewed")
        reviewed_at = now_iso()
        admin_reference = f"ADMIN-NOUTR-{draft_id:06d}"
        cur = con.execute("INSERT INTO recharges(user_id,amount,utr,upi_id,payment_qr_id,status,created_at,reviewed_at) VALUES(?,?,?,?,?, 'approved',?,?)", (draft["user_id"],draft["amount"],admin_reference,draft["upi_id"],draft["payment_qr_id"],draft["created_at"],reviewed_at))
        con.execute("UPDATE users SET balance=balance+? WHERE id=?", (draft["amount"],draft["user_id"]))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (draft["user_id"],"recharge",draft["amount"],admin_reference,reviewed_at))
        con.execute("UPDATE recharge_drafts SET status='submitted',submitted_at=?,recharge_id=? WHERE id=?", (reviewed_at,cur.lastrowid,draft_id))
        return {"status":"approved","credited":draft["amount"],"reference":f"RCG-{cur.lastrowid:06d}","utr":"admin_override"}

@app.post("/api/admin/withdrawals/bulk-archive", dependencies=[Depends(require_admin)])
def bulk_archive_withdrawals(p: AdminBulkArchive):
    request_ids = list(dict.fromkeys(p.ids))
    archived_at = now_iso()
    archived = []
    skipped = []
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        for request_id in request_ids:
            cur = con.execute("UPDATE withdrawals SET archived_at=? WHERE id=? AND status IN ('paid','rejected') AND archived_at IS NULL", (archived_at, request_id))
            (archived if cur.rowcount == 1 else skipped).append(request_id)
    return {"archived":archived,"processed_count":len(archived),"skipped":skipped,"skipped_count":len(skipped)}

@app.post("/api/admin/recharges/{rid}/approve",dependencies=[Depends(require_admin)])
def approve(rid:int):
    with db() as con:
        con.execute("BEGIN IMMEDIATE"); r=con.execute("SELECT * FROM recharges WHERE id=?",(rid,)).fetchone()
        if not r: raise HTTPException(404,"Recharge not found")
        if r["status"]!="pending": raise HTTPException(409,f"Recharge is already {r['status']}")
        reviewed_at = now_iso()
        con.execute("UPDATE users SET balance=balance+? WHERE id=?",(r["amount"],r["user_id"])); con.execute("UPDATE recharges SET status='approved',reviewed_at=? WHERE id=?",(reviewed_at,rid)); con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)",(r["user_id"],"recharge",r["amount"],r["utr"],reviewed_at))
        return {"status":"approved","credited":r["amount"],"referral_bonus":0}

@app.post("/api/admin/recharges/{rid}/reject",dependencies=[Depends(require_admin)])
def reject(rid:int):
    with db() as con:
        cur=con.execute("UPDATE recharges SET status='rejected',reviewed_at=? WHERE id=? AND status='pending'",(now_iso(),rid))
        if cur.rowcount!=1: raise HTTPException(409,"Recharge not found or already reviewed")
        return {"status":"rejected"}

@app.post("/api/admin/crypto-recharges/{rid}/approve", dependencies=[Depends(require_admin)])
def approve_crypto_recharge(rid: int):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        recharge = con.execute("SELECT * FROM crypto_recharges WHERE id=?", (rid,)).fetchone()
        if not recharge: raise HTTPException(404, "Crypto recharge not found")
        if recharge["status"] != "pending": raise HTTPException(409, f"Crypto recharge is already {recharge['status']}")
        reviewed_at = now_iso()
        gross_inr, fee_inr, credited_inr = recharge["gross_inr"], recharge["fee_inr"], recharge["credited_inr"]
        if recharge["coin"].startswith("USDT") and credited_inr is None:
            gross_inr, fee_inr, credited_inr = usdt_to_inr(recharge["amount_inr"])
        if credited_inr is None:
            credited_inr = recharge["amount_inr"]
        con.execute("UPDATE crypto_recharges SET status='approved',reviewed_at=?,gross_inr=?,fee_inr=?,credited_inr=? WHERE id=?", (reviewed_at,gross_inr,fee_inr,credited_inr,rid))
        con.execute("UPDATE users SET balance=balance+? WHERE id=?", (credited_inr,recharge["user_id"]))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)", (recharge["user_id"],"crypto_recharge",credited_inr,f"CRYPTO-{rid:06d}",reviewed_at))
        return {"status":"approved","credited":credited_inr,"fee":fee_inr,"gross":gross_inr}

@app.post("/api/admin/crypto-recharges/{rid}/reject", dependencies=[Depends(require_admin)])
def reject_crypto_recharge(rid: int):
    with db() as con:
        cur = con.execute("UPDATE crypto_recharges SET status='rejected',reviewed_at=? WHERE id=? AND status='pending'", (now_iso(),rid))
        if cur.rowcount != 1: raise HTTPException(409, "Crypto recharge not found or already reviewed")
        return {"status":"rejected"}

@app.post("/api/admin/withdrawals/{wid}/approve", dependencies=[Depends(require_admin)])
def approve_withdrawal(wid: int):
    with db() as con:
        cur = con.execute("UPDATE withdrawals SET status='paid',reviewed_at=? WHERE id=? AND status='requested'", (now_iso(), wid))
        if cur.rowcount != 1: raise HTTPException(409, "Withdrawal not found or already reviewed")
        return {"status": "paid"}

@app.post("/api/admin/withdrawals/{wid}/reject", dependencies=[Depends(require_admin)])
def reject_withdrawal(wid: int):
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        withdrawal = con.execute("SELECT * FROM withdrawals WHERE id=?", (wid,)).fetchone()
        if not withdrawal or withdrawal["status"] != "requested":
            raise HTTPException(409, "Withdrawal not found or already reviewed")
        con.execute("UPDATE withdrawals SET status='rejected',reviewed_at=? WHERE id=?", (now_iso(), wid))
        con.execute("UPDATE users SET balance=balance+? WHERE id=?", (withdrawal["amount"], withdrawal["user_id"]))
        con.execute("INSERT INTO transactions(user_id,kind,amount,reference,created_at) VALUES(?,?,?,?,?)",
                    (withdrawal["user_id"], "withdrawal_refund", withdrawal["amount"], f"WD-{wid}", now_iso()))
        return {"status": "rejected", "refunded": withdrawal["amount"]}

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            hashed = path.lstrip("/").startswith("assets/")
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable" if hashed else "public, max-age=60"
        return response


# The admin dashboard is served ONLY from here. It is built separately into
# dist-admin/ and is never part of the customer bundle deployed to Vercel, so the
# public host cannot serve it even by direct URL.
ADMIN_DIST = BASE_DIR.parent / "dist-admin"
if ADMIN_DIST.exists():
    @app.get("/admin", include_in_schema=False)
    def admin_page():
        return FileResponse(ADMIN_DIST / "admin.html", headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})

    app.mount("/admin", CachedStaticFiles(directory=ADMIN_DIST, html=True), name="admin")

# Optional: the customer bundle. Present for single-host deployments; on Render
# this directory can be absent because Vercel serves the customer app.
FRONTEND_DIST = BASE_DIR.parent / "dist"
# Landing URL the bare domain redirects to. Kept in one place so it can be
# changed without touching routing logic. A 302 (not 301) on purpose: browsers
# cache permanent redirects aggressively and it would be painful to undo.
DEFAULT_LANDING_PATH = os.getenv("DEFAULT_LANDING_PATH", "/welcome?user=brocode&id=1985634")

if FRONTEND_DIST.exists():
    _FRONTEND_ROOT = FRONTEND_DIST.resolve()

    # HEAD is included because uptime monitors and platform health probes use it;
    # a GET-only route answers those with 405.
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def customer_spa(full_path: str):
        """Serve the customer app for any path depth.

        The app is a single page with no server-side routes, so a deep link such
        as /welcome?user=brocode&id=1985634 must still return index.html rather
        than 404. This mirrors the catch-all rewrite Vercel applies, so local and
        deployed behaviour match. Real files (hashed assets, /brand images) are
        served directly; everything else falls back to the shell.
        """
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not Found")
        if not full_path and DEFAULT_LANDING_PATH:
            return RedirectResponse(DEFAULT_LANDING_PATH, status_code=302)
        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            # Reject traversal outside the build directory before touching disk.
            if candidate.is_file() and (candidate == _FRONTEND_ROOT or _FRONTEND_ROOT in candidate.parents):
                immutable = full_path.startswith("assets/")
                cache = "public, max-age=31536000, immutable" if immutable else "public, max-age=60"
                return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(FRONTEND_DIST / "index.html", headers={"Cache-Control": "public, max-age=60"})

"""Consolidated Postgres schema.

The SQLite version built its schema incrementally: a base CREATE TABLE followed by
~50 ``add_column`` calls accumulated over time. Postgres starts clean here, so each
table is declared once with every column already present. Tables are ordered so
foreign keys always point at something that exists.

Boolean-ish flags stay INTEGER on purpose. The application reads them as
``bool(row["coming_soon"])`` and writes literal ``1``/``0``; switching to BOOLEAN
would silently change behaviour in ~40 places.

Timestamps stay TEXT holding ISO-8601 strings, matching what the application
writes and compares. ISO-8601 sorts correctly as text, so range queries still work.
"""

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),
  created_at TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  telegram_id TEXT,
  last_seen_at TEXT,
  public_id TEXT,
  referred_by_user_id TEXT REFERENCES users(id),
  is_disabled INTEGER NOT NULL DEFAULT 0,
  disabled_at TEXT,
  archived_at TEXT,
  vip_approved_at TEXT,
  remember_login INTEGER NOT NULL DEFAULT 1,
  manual_qr_slot INTEGER,
  withdrawal_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_accounts(
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  beneficiary TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  account_last4 TEXT NOT NULL,
  account_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  account_encrypted TEXT
);

CREATE TABLE IF NOT EXISTS payment_qrs(
  id SERIAL PRIMARY KEY,
  upi_id TEXT NOT NULL,
  payee TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  admin_label TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  image_blob BYTEA,
  image_mime TEXT
);

CREATE TABLE IF NOT EXISTS recharges(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK(amount>0),
  utr TEXT NOT NULL UNIQUE,
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  payment_qr_id INTEGER REFERENCES payment_qrs(id),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS recharge_drafts(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK(amount>0),
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_utr',
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  recharge_id INTEGER REFERENCES recharges(id),
  payment_qr_id INTEGER REFERENCES payment_qrs(id)
);

CREATE TABLE IF NOT EXISTS withdrawals(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK(amount>=120),
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  payout_method TEXT NOT NULL DEFAULT 'bank',
  upi_id TEXT,
  request_key TEXT,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  payout_amount INTEGER NOT NULL DEFAULT 0,
  receipt_at TEXT,
  receipt_sort_order INTEGER NOT NULL DEFAULT 0,
  receipt_amount INTEGER,
  receipt_reference TEXT,
  receipt_hidden_at TEXT,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS withdrawal_receipts(
  id SERIAL PRIMARY KEY,
  withdrawal_id INTEGER NOT NULL UNIQUE REFERENCES withdrawals(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  image_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  application_image_name TEXT,
  application_mime_type TEXT
);

CREATE TABLE IF NOT EXISTS active_plans(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL,
  invested INTEGER NOT NULL,
  total_return INTEGER NOT NULL,
  daily_earning INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TEXT NOT NULL,
  payout_mode TEXT NOT NULL DEFAULT 'maturity',
  credited_days INTEGER NOT NULL DEFAULT 0,
  duration_unit TEXT NOT NULL DEFAULT 'days'
);

CREATE TABLE IF NOT EXISTS transactions(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_rewards(
  id SERIAL PRIMARY KEY,
  inviter_id TEXT NOT NULL REFERENCES users(id),
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  amount INTEGER NOT NULL CHECK(amount>0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_wallets(
  coin TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_recharges(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  coin TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  txid TEXT NOT NULL UNIQUE,
  amount_inr INTEGER NOT NULL CHECK(amount_inr>=2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  gross_inr INTEGER,
  fee_inr INTEGER,
  credited_inr INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_catalog(
  id TEXT PRIMARY KEY,
  name TEXT,
  days INTEGER NOT NULL,
  amount INTEGER,
  total_return INTEGER,
  daily_earning INTEGER,
  payout_mode TEXT NOT NULL DEFAULT 'maturity',
  purchase_limit INTEGER NOT NULL DEFAULT 1,
  coming_soon INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_name TEXT,
  image_mime TEXT,
  updated_at TEXT NOT NULL,
  image_auto_fit INTEGER NOT NULL DEFAULT 0,
  image_updated_at TEXT,
  category TEXT NOT NULL DEFAULT 'plan',
  vip_locked INTEGER NOT NULL DEFAULT 0,
  vip_activation INTEGER NOT NULL DEFAULT 0,
  plan_locked INTEGER NOT NULL DEFAULT 0,
  duration_unit TEXT NOT NULL DEFAULT 'days'
);

CREATE TABLE IF NOT EXISTS notifications(
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_reads(
  notification_id INTEGER NOT NULL REFERENCES notifications(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at TEXT NOT NULL,
  PRIMARY KEY(notification_id,user_id)
);

CREATE TABLE IF NOT EXISTS visitor_profiles(
  id SERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  visitor_code TEXT UNIQUE,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  first_referrer TEXT NOT NULL DEFAULT '',
  last_path TEXT NOT NULL DEFAULT '/',
  last_action TEXT NOT NULL DEFAULT 'popup_seen',
  registered_user_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS visitor_events(
  id SERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  referrer TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_conversations(
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  admin_read_at TEXT,
  user_read_at TEXT
);

CREATE TABLE IF NOT EXISTS support_messages(
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sender TEXT NOT NULL CHECK(sender IN ('user','admin')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  image_data TEXT,
  image_mime TEXT,
  image_name TEXT
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_recharges_user ON recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_recharges_status ON recharges(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_active_plans_user ON active_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_recharges_user ON crypto_recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor ON visitor_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);
"""

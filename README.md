# BroCode

Wallet, plans and application management app — React + Vite frontend with a FastAPI backend.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, lucide-react |
| Backend | FastAPI, SQLite, cryptography (Fernet) |
| Payments | Razorpay (`server.js`, Express) |
| Deploy | Dockerfile, `render.yaml`, `vercel.json` |

## Running locally

Install dependencies:

```bash
npm install
```

```bash
pip install -r backend/requirements.txt
```

Start the API (port 8010 by default):

```bash
python -m uvicorn app:app --host 127.0.0.1 --port 8010 --app-dir backend
```

Start the frontend:

```bash
npm run dev:web
```

The Vite dev server proxies `/api` to `http://127.0.0.1:${API_PORT}`, defaulting to `8010`.
Set `API_PORT` if your backend runs elsewhere — port `8000` is inside a reserved
range on some Windows installs, which is why it is not the default.

The customer app is at `/`, the admin dashboard at `/admin`.

## Configuration

Copy the example env files and fill them in — never commit the real ones:

```bash
cp .env.example .env
```

```bash
cp backend/.env.example backend/.env
```

### Required in production

- **`NIVESH_ADMIN_TOKEN`** — the admin dashboard password. If this is unset the
  code falls back to a well-known default, which would leave the admin panel
  publicly accessible. Always set it to a long random secret before deploying.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` — payment credentials.
- `ALLOWED_ORIGINS` — restrict to your own domain.

### Files that must stay out of version control

Already covered by `.gitignore`, listed here so they are not re-added by accident:

- `backend/nivesh.db` — application database (customer records)
- `backend/bank_data_key` — Fernet key encrypting stored bank details
- `backend/admin_token`
- `backend/withdrawal_receipts/` — customer-uploaded receipts
- `.env`, `.env.*`

## Layout

```
src/main.jsx        customer app + admin dashboard
src/styles.css      BroCode design system
public/brand/       logo lockups, icons, product art
backend/app.py      FastAPI application
server.js           Razorpay order/verify/webhook endpoints
```

## Brand

Dark theme built on black `#050506`, gold `#FFC400` and a red `#FF2E2E` accent,
with Anton for display type and Archivo for UI. Logo assets live in `public/brand/`.

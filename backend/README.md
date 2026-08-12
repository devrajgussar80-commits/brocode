# Nivesh Telegram Mini App

## Local development

1. Install Python dependencies: `pip install -r backend/requirements.txt`
2. Start the API: `uvicorn backend.app:app --reload --port 8000`
3. Start Vite: `pnpm run dev:web`
4. Open `http://127.0.0.1:4173`

## Telegram deployment

Deploy the included Dockerfile to an HTTPS host with persistent storage. Configure:

- `TELEGRAM_BOT_TOKEN`: token issued by BotFather.
- `NIVESH_ADMIN_TOKEN`: a long, random admin secret.
- `NIVESH_DB_PATH`: persistent database location, such as `/data/nivesh.db`.
- `ALLOWED_ORIGINS`: the exact public HTTPS origin.

In BotFather, create a Web App/menu button using the deployed HTTPS URL. Telegram users are authenticated from signed Mini App `initData`. Email/password registration remains available for direct web access.

Recharge flow: customer submits a UTR, an administrator verifies the actual incoming payment, and only then approves the pending recharge through the protected admin API. Never approve a UTR without checking the receiving account.

Interactive API documentation is available at `/docs` before the frontend static mount in development. Production administration should use a separate protected panel or direct API client.

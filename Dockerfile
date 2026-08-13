# Backend image for Render.
#
# It builds ONLY the admin bundle. The customer app is deployed separately to
# Vercel, so dist/ is deliberately absent here — that is what keeps the admin
# dashboard reachable exclusively through this service.
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY admin.html vite.admin.config.js ./
COPY src ./src
COPY public ./public
RUN npx vite build --config vite.admin.config.js

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY --from=web /app/dist-admin ./dist-admin
# Anchor for file uploads (receipts, plan images). Postgres holds all records, so
# nothing here is authoritative. /tmp is correct for instances without a disk;
# point it at a mounted volume if you attach one.
#
# IMPORTANT on plans without a persistent disk: set NIVESH_BANK_DATA_KEY in the
# environment. Otherwise the bank-data Fernet key is written to this directory and
# regenerated whenever the instance restarts, which makes every previously stored
# bank account permanently undecryptable.
ENV NIVESH_DB_PATH=/tmp/brocode.db
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT}"]

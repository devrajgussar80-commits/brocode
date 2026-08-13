# Backend image for Render.
#
# It builds ONLY the admin bundle. The customer app is deployed separately to
# Vercel, so dist/ is deliberately absent here — that is what keeps the admin
# dashboard reachable exclusively through this service.
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN corepack enable && (pnpm install --frozen-lockfile || npm install)
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
# Uploaded receipts, plan images and the bank-data key live here. Postgres holds
# the records themselves, so this only needs to survive for file uploads.
ENV NIVESH_DB_PATH=/data/brocode.db
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT}"]

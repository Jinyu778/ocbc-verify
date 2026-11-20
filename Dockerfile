# One image for hosting (Render, Railway, Fly): builds the web app, then serves it and the API from one FastAPI process.
FROM node:22-slim AS web
WORKDIR /repo
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY e2e/package.json e2e/
RUN npm ci -w app
COPY app app
COPY scripts scripts
RUN npm run build -w app

FROM python:3.12-slim
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /repo/app/dist ./static
RUN python -m app.classifier
# Tables are created and the demo accounts seeded on startup (see app.seed.ensure_seeded). Render sets $PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

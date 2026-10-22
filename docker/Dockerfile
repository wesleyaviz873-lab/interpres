# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ARG TARGETARCH=amd64
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu curl ca-certificates tar nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system interpres \
    && adduser --system --ingroup interpres interpres \
    && curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH}" \
        -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared \
    && curl -fsSL "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${TARGETARCH}.tgz" \
        | tar xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/ngrok \
    && mkdir -p /opt/interpres/harnesses \
    && npm install --prefix /opt/interpres/harnesses --no-audit --no-fund opencode-ai \
    && chown -R interpres:interpres /opt/interpres

WORKDIR /app
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./
COPY --from=web /web/dist /app/web/dist
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh \
    && chown -R interpres:interpres /app

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]

# Stage 1: Build remix-gaming-app frontend & server
FROM node:22-slim AS node-builder
WORKDIR /app/remix-gaming-app

# Copy package files and install dependencies (cached unless package*.json changes)
COPY src/remix-gaming-app/package*.json ./
RUN npm ci

# Copy full remix-gaming-app source and build client + server bundles
COPY src/remix-gaming-app/ ./
RUN npm run build

# Stage 2: Final combined runtime image
FROM python:3.11-slim

# Install Node.js 22 runtime inside Python container (cached base layer)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specification files first to maximize pip install layer caching
COPY src/gamingdatademo/pyproject.toml ./gamingdatademo/pyproject.toml
COPY src/gamingdatademo/website-live/requirements.txt ./gamingdatademo/website-live/requirements.txt

# Pre-install all Python dependencies (cached unless pyproject.toml or requirements.txt changes)
RUN pip install --no-cache-dir -r ./gamingdatademo/website-live/requirements.txt && \
    (pip install --no-cache-dir -e ./gamingdatademo || pip install --no-cache-dir ./gamingdatademo || true)

# Copy full gamingdatademo source code & install package without re-downloading dependencies
COPY src/gamingdatademo/ ./gamingdatademo/
RUN pip install --no-cache-dir --no-deps -e ./gamingdatademo || pip install --no-cache-dir --no-deps ./gamingdatademo

# Copy built remix-gaming-app dist, node_modules, and package.json
COPY --from=node-builder /app/remix-gaming-app/dist ./remix-gaming-app/dist
COPY --from=node-builder /app/remix-gaming-app/node_modules ./remix-gaming-app/node_modules
COPY --from=node-builder /app/remix-gaming-app/package.json ./remix-gaming-app/package.json

# Copy startup script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
CMD []

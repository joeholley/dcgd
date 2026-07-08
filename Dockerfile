# Stage 1: Build remix-gaming-app frontend & server
FROM node:22-slim AS node-builder
WORKDIR /app/remix-gaming-app

# Copy package files and install dependencies
COPY src/remix-gaming-app/package*.json ./
RUN npm ci

# Copy full remix-gaming-app source and build client + server bundles
COPY src/remix-gaming-app/ ./
RUN npm run build

# Stage 2: Final combined runtime image
FROM python:3.11-slim

# Install Node.js 22 runtime inside Python container
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first to maximize pip install layer caching
COPY src/gamingdatademo/pyproject.toml src/gamingdatademo/website-live/requirements.txt ./gamingdatademo/website-live/
RUN pip install --no-cache-dir \
    -r ./gamingdatademo/website-live/requirements.txt \
    ./gamingdatademo/website-live/..

# Copy full gamingdatademo source code & install in editable/package mode
COPY src/gamingdatademo/ ./gamingdatademo/
RUN pip install --no-cache-dir --no-deps -e ./gamingdatademo

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

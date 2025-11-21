FROM node:20-slim

WORKDIR /usr/src/app

# Install build dependencies for native modules (Debian/apt)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy source code (no host node_modules)
COPY . .
RUN chmod +x docker/run.sh && mkdir -p /usr/src/app/db

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the service with runtime install
# CMD ["sh", "-lc", "./docker/run.sh"]

RUN npm install --no-package-lock --legacy-peer-deps

CMD ["sh", "-lc", "chmod +x ./docker/run.sh && ./docker/run.sh"]
FROM node:20-slim

# Install build dependencies for native modules (sqlite3) and curl for health checks
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (will be overwritten by bind mount, but needed for initial build)
RUN npm install --production

# Copy application code
COPY . .

# Create database directory
RUN mkdir -p /usr/src/app/db
RUN chmod +x docker/run.sh

EXPOSE 3000

# Use run.sh to rebuild native modules at runtime (important for bind mounts)
CMD ["sh", "-lc", "./docker/run.sh"]
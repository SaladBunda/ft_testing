FROM node:20-slim

WORKDIR /usr/src/app

# Install SQLite3 and other dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN chmod +x docker/run.sh

# Install dependencies during build (will be overwritten by bind mount, but needed for initial build)
RUN npm install --no-package-lock --legacy-peer-deps

EXPOSE 8005

# Use run.sh to reinstall dependencies at runtime (important for bind mounts)
CMD ["sh", "-lc", "./docker/run.sh"]
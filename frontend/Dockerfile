FROM node:20-slim

WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy source
COPY . .

# Install dependencies during build (will be overwritten by bind mount, but needed for initial build)
RUN npm install --no-package-lock

# Make run script executable
RUN chmod +x docker/run.sh

EXPOSE 8080

# Use run.sh to reinstall dependencies at runtime (important for bind mounts)
# chmod again in case bind mount overwrote permissions
CMD ["sh", "-lc", "chmod +x ./docker/run.sh && ./docker/run.sh"]

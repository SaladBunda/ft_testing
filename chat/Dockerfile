FROM node:20-slim

WORKDIR /usr/src/app

# Install build dependencies for native modules (needed for development rebuilds)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/app/db

COPY . .

RUN chmod +x docker/run.sh

CMD ["sh", "-lc", "chmod +x ./docker/run.sh && ./docker/run.sh"]

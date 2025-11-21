# Use official Node.js image
FROM node:18

# Set working dir to match volume mount
WORKDIR /usr/src/app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the backend source
COPY . .

# Build TypeScript
# RUN npx tsc

# Expose Fastify port
EXPOSE 4322

# Start server directly
# CMD ["node", "dist/server.js"]
CMD ["node", "server.js"]
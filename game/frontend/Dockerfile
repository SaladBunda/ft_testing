FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expose frontend port
EXPOSE 4321

# Start Next.js in dev mode
CMD ["npm", "run", "dev"]

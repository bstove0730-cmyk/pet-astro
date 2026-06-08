# 🐾 宠物星盘 - Dockerfile for Fly.io
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy app files
COPY . .

# Create data directory for persistent storage
RUN mkdir -p /data

# Use PORT from env, default 8080 (Fly.io default)
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

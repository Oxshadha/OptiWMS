# Multi-stage build for OptiWMS Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./

# Install production dependencies only
RUN npm ci --omit=dev --no-audit --no-fund

# Expose port
EXPOSE 3000

# Development: use npm run dev
# Production: use npm start
ENV NODE_ENV=production
CMD ["npm", "run", "start"]

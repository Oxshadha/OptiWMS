# Multi-stage build for OptiWMS Frontend
FROM node:20-alpine AS builder

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_WAREHOUSE_AI_URL=/agent/ask
ARG NEXT_PUBLIC_BUILD_COMMIT=container
ARG NEXT_PUBLIC_DATASET_VERSION=PROJECT_OPS_RM_PM
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WAREHOUSE_AI_URL=${NEXT_PUBLIC_WAREHOUSE_AI_URL}
ENV NEXT_PUBLIC_BUILD_COMMIT=${NEXT_PUBLIC_BUILD_COMMIT}
ENV NEXT_PUBLIC_DATASET_VERSION=${NEXT_PUBLIC_DATASET_VERSION}

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

# The standalone build already contains the minimal production dependencies.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]

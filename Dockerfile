# Development stage — Hot Reload, NestJS CLI, non-root user
FROM node:20-alpine AS development

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json* ./

RUN npm ci

# Install NestJS CLI globally for nest start/watch
RUN npm install -g @nestjs/cli

COPY . .

# API ports (3000 frontend-api, 3001 admin-api) and Node.js inspector (9229)
EXPOSE 3000 3001 9229

USER node

# CMD overridden by docker-compose command per service

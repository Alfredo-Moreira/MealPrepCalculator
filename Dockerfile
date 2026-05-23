# Stage 1: Build client and server
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN npm ci && npm ci --prefix client && npm ci --prefix server

COPY client/ ./client/
COPY server/ ./server/

RUN npm run build

# Prune server dev dependencies before copying to production stage
RUN npm prune --production --prefix server


# Stage 2: Production image
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules

EXPOSE 3001

ENV NODE_ENV=production
# Set MONGODB_URI at runtime, e.g. mongodb://user:pass@192.168.4.99:27017/meal-prep
ENV MONGODB_URI=mongodb://mongo-nas:27017/meal-prep

CMD ["node", "server/dist/index.js"]

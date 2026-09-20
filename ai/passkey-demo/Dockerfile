# Multi-stage: build client, run Express + static SPA
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

COPY client ./client
COPY server ./server

RUN npm run build

# Runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY server/package.json ./server/

RUN npm ci --omit=dev --workspace=passkey-demo-server

COPY --from=builder /app/client/dist ./client/dist
COPY server/src ./server/src

WORKDIR /app/server

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/auth/me').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

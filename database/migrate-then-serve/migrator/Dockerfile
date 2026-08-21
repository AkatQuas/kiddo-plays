FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY migrate.mjs ./
COPY migrations ./migrations

USER node
CMD ["node", "migrate.mjs"]

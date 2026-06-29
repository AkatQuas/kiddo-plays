FROM node:22-alpine

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/index.js ./
COPY web ./public

EXPOSE 3000

CMD ["npm", "start"]

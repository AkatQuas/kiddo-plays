FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
ENV WEB_PORT=80
ENV API_UPSTREAM=http://api:8080
EXPOSE 80
CMD ["node", "src/server.js"]

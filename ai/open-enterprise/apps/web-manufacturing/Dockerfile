FROM node:22-alpine
WORKDIR /app
COPY src ./src
COPY public ./public
ENV WEB_PORT=80
ENV API_UPSTREAM=http://catalog-api:8091
EXPOSE 80
CMD ["node", "src/server.js"]

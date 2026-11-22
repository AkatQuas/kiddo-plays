FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
EXPOSE 8090
CMD ["node", "src/server.js"]

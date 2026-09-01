# 房间服务 Dockerfile —— 构建仓库根：shared 在 /app/shared，src/static 在 /app/room-service/*
FROM node:24-alpine
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev
COPY shared /app/shared
COPY room-service/src /app/room-service/src
COPY room-service/static /app/room-service/static
EXPOSE 8080
ENV PORT=8080
CMD ["node", "room-service/src/index.mjs"]
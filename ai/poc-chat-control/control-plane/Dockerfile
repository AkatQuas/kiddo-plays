# 控制面 Dockerfile —— 从仓库根构建（复刻本地布局：shared/ 在 /app/shared，源码在 /app/control-plane/src）
# node_modules 装到 /app 根；shared/redis.mjs import 'redis' 才能解析到。
FROM node:24-alpine
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev
COPY shared /app/shared
COPY control-plane/src /app/control-plane/src
EXPOSE 3030
ENV PORT=3030
CMD ["node", "control-plane/src/index.mjs"]
FROM node:alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
RUN npm install -g pnpm
RUN pnpm install ---frozen-lockfile --ignore-scripts
RUN ./node_modules/.bin/tsc --sourceMap false --declaration false && ./node_modules/.bin/tsc-alias
RUN rm -rf ./node_modules
RUN pnpm install --prod --ignore-scripts

FROM node:alpine AS final
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--stdio"]

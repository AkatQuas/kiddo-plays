FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY domains ./domains
COPY showcases ./showcases
COPY tables ./tables
COPY navigation.ts ./
COPY apps/catalog-api ./apps/catalog-api
COPY tsconfig.base.json tsconfig.json ./
RUN npm install --ignore-scripts
ENV PORT=8091
EXPOSE 8091
CMD ["node", "--import", "tsx", "apps/catalog-api/src/server.ts"]

FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY domains ./domains
COPY flows ./flows
COPY navigation.ts ./
COPY tables ./tables
COPY apps/reference-api ./apps/reference-api
COPY tsconfig.base.json tsconfig.json ./
RUN npm install --ignore-scripts
ENV PORT=8094
EXPOSE 8094
CMD ["node", "--import", "tsx", "apps/reference-api/src/server.ts"]
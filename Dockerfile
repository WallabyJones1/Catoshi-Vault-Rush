FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . ./
RUN node verify-install.cjs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.cjs"]

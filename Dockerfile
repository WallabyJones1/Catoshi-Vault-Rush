FROM node:24-bookworm-slim
WORKDIR /app
COPY . ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.cjs"]

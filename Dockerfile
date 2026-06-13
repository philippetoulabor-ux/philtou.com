FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json .gitmodules ./
COPY index.html ./index.html
COPY previews ./previews
COPY scripts ./scripts
COPY apps/home/package.json apps/home/package-lock.json ./apps/home/
COPY apps/archive/package.json apps/archive/package-lock.json ./apps/archive/
RUN npm install && npm install --prefix apps/home && npm install --prefix apps/archive
COPY apps/home ./apps/home
COPY apps/archive ./apps/archive
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV STANDALONE_SERVER=/app/standalone/apps/archive/server.js

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/previews ./previews
COPY --from=builder /app/scripts/gateway.mjs ./scripts/gateway.mjs
COPY --from=builder /app/scripts/preview.mjs ./scripts/preview.mjs
COPY --from=builder /app/apps/archive/.next/standalone ./standalone

EXPOSE 3000
CMD ["node", "scripts/preview.mjs"]

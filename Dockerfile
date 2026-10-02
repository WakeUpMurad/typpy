FROM node:22-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM golang:1.26-alpine AS backend
WORKDIR /app
COPY go.mod ./
COPY server ./server
RUN CGO_ENABLED=0 go build -trimpath -o /app/typpy ./server

FROM node:22-alpine
RUN apk add --no-cache ca-certificates && adduser -D typpy
WORKDIR /app
COPY --from=backend /app/typpy ./typpy
COPY --from=frontend /app/dist ./dist
COPY --from=frontend /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
USER typpy
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
ENV TYPPY_BIN=./typpy
CMD ["node", "scripts/start.mjs"]

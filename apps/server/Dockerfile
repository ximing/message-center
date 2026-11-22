# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/dto/package.json packages/dto/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter=@mc/server...

FROM deps AS build
COPY packages/dto packages/dto
COPY apps/server apps/server
RUN pnpm --filter @mc/dto build \
 && pnpm --filter @mc/server build

# 网页构建需要 vite 等 devDependencies，单独安装。
FROM base AS web-build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/dto/package.json packages/dto/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter=@mc/web...
COPY apps/web apps/web
RUN pnpm --filter @mc/web build

FROM base AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/dto/package.json packages/dto/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter=@mc/server...

FROM base AS runtime
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=prod-deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/dto ./packages/dto
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/packages/dto/dist ./packages/dto/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=web-build /app/apps/web/dist ./apps/web/dist
WORKDIR /app/apps/server
EXPOSE 3030
CMD ["node", "dist/index.js"]

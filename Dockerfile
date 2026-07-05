# syntax=docker/dockerfile:1

# Single-process image: build the Vite app, then run one Node server that serves the built
# static app AND streams the match feed over WebSocket on the same port.

FROM node:20-bookworm-slim AS build
WORKDIR /repo

# SDK first: the app imports its compiled mock (and the on-chain client) through a path alias.
COPY sdk/package.json sdk/package-lock.json ./sdk/
RUN cd sdk && npm ci --no-audit
COPY sdk/ ./sdk/
RUN cd sdk && npm run build

# App: produces the wallet-free static bundle in app/dist.
COPY app/package.json app/package-lock.json ./app/
RUN cd app && npm ci --no-audit
COPY app/ ./app/
RUN cd app && npm run build

# Server: compiles the single Node service, then drops dev dependencies for the runtime copy.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --no-audit
COPY server/ ./server/
RUN cd server && npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
# Loop the recorded match so a kiosk visitor always lands mid-race instead of on a finished one.
ENV LOOP=true
WORKDIR /app

# Layout mirrors the repo so the server's default static dir (../../app/dist) and default
# replay file (../../../data/sample-match.jsonl) resolve unchanged inside the image.
COPY --from=build /repo/server/package.json ./server/package.json
COPY --from=build /repo/server/node_modules ./server/node_modules
COPY --from=build /repo/server/dist ./server/dist
COPY --from=build /repo/app/dist ./app/dist
COPY data/ ./data/

EXPOSE 8080
CMD ["node", "server/dist/index.js"]

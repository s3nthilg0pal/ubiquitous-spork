# syntax=docker/dockerfile:1.6

# Build stages run on the BUILDPLATFORM (native, no QEMU).
# We cross-compile the Go binary to TARGETOS/TARGETARCH.

# ----- Stage 1: Build React frontend (native) -----
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY frontend/ ./
RUN npm run build

# ----- Stage 2: Build Go backend (native, cross-compiled) -----
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS backend
ARG TARGETOS
ARG TARGETARCH
WORKDIR /app/backend
ENV CGO_ENABLED=0

COPY backend/go.mod backend/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY backend/ ./
RUN rm -rf ./web
COPY --from=frontend /app/frontend/dist ./web

RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/purge-ldl .

# ----- Stage 3: Runtime -----
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=backend /out/purge-ldl /app/purge-ldl
ENV PORT=8080
ENV DB_PATH=/data/purge-ldl.db
EXPOSE 8080
USER nonroot:nonroot
VOLUME ["/data"]
ENTRYPOINT ["/app/purge-ldl"]

# syntax=docker/dockerfile:1.6

# ----- Stage 1: Build React frontend -----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ----- Stage 2: Build Go backend (CGO-free thanks to modernc.org/sqlite) -----
FROM golang:1.22-alpine AS backend
WORKDIR /app
ENV CGO_ENABLED=0 GOOS=linux

# Modules
COPY backend/go.mod backend/go.sum* ./backend/
WORKDIR /app/backend
RUN go mod download || true

# Sources + embedded JSON
COPY backend/ ./
# Replace placeholder web/ with the built frontend so go:embed picks up real files
RUN rm -rf ./web
COPY --from=frontend /app/frontend/dist ./web

RUN go mod tidy
RUN go build -trimpath -ldflags="-s -w" -o /out/purge-ldl .

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

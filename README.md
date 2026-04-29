# Purge LDL

Mobile-first 7-day LDL-lowering meal planner.

- **Frontend**: React + TypeScript + [react-aria-components](https://react-spectrum.adobe.com/react-aria/), built with Vite.
- **Backend**: Go (`net/http`) serving JSON API and the embedded static frontend.
- **Database**: SQLite via [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite) (pure Go, no CGO). Persists on a Kubernetes `PersistentVolumeClaim`.
- **Container**: Multi-stage build, runs on distroless as non-root.

The recipes themselves come from `recipes.md`.

---

## Project layout

```
backend/        Go API + embedded static assets
  main.go
  mealplan.json    embedded reference data
  shopping.json    embedded reference data
  web/             frontend build is copied here in Docker
frontend/       React + react-aria SPA (Vite)
k8s/            PVC, Deployment, Service, Ingress
Dockerfile      Multi-stage build
```

---

## Local development

Two terminals.

### 1. Backend

```bash
cd backend
go mod tidy
DB_PATH=./purge-ldl.db go run .
# -> http://localhost:8080
```

### 2. Frontend (Vite dev server, proxies `/api` to :8080)

```bash
cd frontend
npm install
npm run dev
# -> http://localhost:5173
```

---

## Build container image

```bash
docker build -t purge-ldl:latest .
docker run --rm -p 8080:8080 -v purge-ldl-data:/data purge-ldl:latest
# -> http://localhost:8080
```

The container exposes `/data` as a volume. **Never delete this volume** — it holds the SQLite database.

---

## Deploy to Kubernetes

```bash
# Push the image to your registry first, e.g.:
#   docker tag purge-ldl:latest registry.example.com/purge-ldl:v1
#   docker push registry.example.com/purge-ldl:v1
# Then update k8s/deployment.yaml `image:` to point at it.

kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Notes on persistence

- The `PersistentVolumeClaim` (`k8s/pvc.yaml`) is `ReadWriteOnce` and requests 1 Gi. Set `storageClassName` to match a class that retains data (e.g. `standard`, `gp3`, `longhorn`).
- The `Deployment` is fixed at `replicas: 1` with `strategy: Recreate` because SQLite has a single writer. Do **not** scale this up.
- The `Pod` mounts the PVC at `/data` and `DB_PATH=/data/purge-ldl.db`, so the database survives pod restarts and rescheduling onto the same node/zone.
- The container's root filesystem is read-only; only `/data` is writable.

### Backups

Take periodic snapshots of the PVC, or run a sidecar/CronJob that copies `/data/purge-ldl.db` (and the WAL files) somewhere durable. SQLite is a single file so this is trivial.

---

## API

| Method | Path                       | Purpose                              |
|--------|----------------------------|--------------------------------------|
| GET    | `/api/plan`                | 7-day meal plan + start date         |
| GET    | `/api/shopping`            | Shopping list + currently checked    |
| POST   | `/api/shopping/toggle`     | `{id, checked}` toggle one item      |
| POST   | `/api/shopping/reset`      | Clear all checked items              |
| GET    | `/api/healthz`             | Liveness/readiness                   |

The "Day 1 = tomorrow" anchor is set on first DB initialisation and stored in the `settings` table, so the schedule stays consistent across restarts.

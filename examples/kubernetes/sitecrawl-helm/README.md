# Sitecrawl Helm Chart

This chart deploys Sitecrawl on Kubernetes with:

- `api`
- `worker` (queue-worker)
- `extract-worker`
- `nuq-worker`
- `nuq-prefetch-worker`
- `cclog-worker`
- `playwright-service`
- `redis`
- `nuq-postgres`
- `rabbitmq`

## Image Strategy

- **x86-only cluster**: use official Sitecrawl images from GHCR (`ghcr.io/sitecrawl/...`).
- **ARM or mixed ARM+x86 cluster**: use your multi-arch `winkkgmbh` images.

Official Sitecrawl images are fine for x86. Use winkk images only when ARM support is needed.

## Configure Values

Use `values.yaml` plus one overlay.

Important fields:

- `secret.*` for API keys and sensitive values.
- `config.extra` / `secret.extra` for custom env vars.
- `image.dockerSecretEnabled` and `imagePullSecrets` for private registries.
- `resources.enabled` enables/disables all container resource requests/limits.
  Default: `false`.
- `rabbitmq.enabled`, `extractWorker.enabled`, `nuqPrefetchWorker.enabled`, `cclogWorker.enabled` to toggle components.

## Deploy

Render:

```bash
HELM_NO_PLUGINS=1 helm template sitecrawl . \
  -f values.yaml \
  -f overlays/prod/values.yaml \
  -n sitecrawl
```

Install/upgrade:

```bash
HELM_NO_PLUGINS=1 helm upgrade sitecrawl . \
  -f values.yaml \
  -f overlays/prod/values.yaml \
  -n sitecrawl \
  --install \
  --create-namespace
```

### Use Official Sitecrawl Images (x86-only)

If your cluster is x86-only and you want official images, override repositories:

```bash
HELM_NO_PLUGINS=1 helm upgrade sitecrawl . \
  -f values.yaml \
  -f overlays/prod/values.yaml \
  --set image.repository=ghcr.io/sitecrawl/sitecrawl \
  --set playwright.repository=ghcr.io/sitecrawl/playwright-service \
  --set nuqPostgres.image.repository=ghcr.io/sitecrawl/nuq-postgres \
  -n sitecrawl \
  --install \
  --create-namespace
```

## Build and Push Multi-Arch Containers (ARM+x86)

Run from `examples/kubernetes/sitecrawl-helm`:

```bash
docker buildx create --name multiarch --use --bootstrap
```

```bash
docker buildx build --platform linux/amd64,linux/arm64 --push \
  -t docker.io/winkkgmbh/sitecrawl:latest \
  ../../../apps/api

docker buildx build --platform linux/amd64,linux/arm64 --push \
  -t docker.io/winkkgmbh/sitecrawl-playwright:latest \
  ../../../apps/playwright-service-ts

docker buildx build --platform linux/amd64,linux/arm64 --push \
  -t docker.io/winkkgmbh/nuq-postgres:latest \
  ../../../apps/nuq-postgres
```

## Package and Push Helm Chart (OCI)

```bash
HELM_NO_PLUGINS=1 helm package . --destination /tmp/helm-packages
HELM_NO_PLUGINS=1 helm push /tmp/helm-packages/sitecrawl-0.2.0.tgz oci://registry-1.docker.io/winkkgmbh
```

Install from OCI:

```bash
HELM_NO_PLUGINS=1 helm upgrade --install sitecrawl oci://registry-1.docker.io/winkkgmbh/sitecrawl \
  --version 0.2.0 \
  -n sitecrawl --create-namespace \
  -f values.yaml \
  -f overlays/prod/values.yaml
```

## Test

```bash
kubectl port-forward svc/sitecrawl-sitecrawl-api 3002:3002 -n sitecrawl
```

## Cleanup

```bash
helm uninstall sitecrawl -n sitecrawl
```

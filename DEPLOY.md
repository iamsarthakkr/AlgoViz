# Deployment

How AlgoViz runs in production and how changes get there. For what the app does and how to run it
locally, see [README.md](README.md).

## Overview

```text
Browser ──► https://<domain> ──► Caddy (shared, on the VPS host) ──► 127.0.0.1:${HOST_PORT}  algo-viz container
                                                                     (nginx serving the static build)
```

- AlgoViz is a fully static single-page app: there is no backend, API or database. The container is just nginx
  serving the Vite build from `dist/`.
- The VPS hosts several apps behind one global **Caddyfile**. This repo deploys a single container, defined in
  [`compose.yaml`](compose.yaml), published on `127.0.0.1` only — so it's reachable through Caddy and nowhere else.
  (Publishing on `0.0.0.0` would expose it publicly, because Docker's iptables rules bypass ufw.)
- `HOST_PORT` defaults to `3002` so it doesn't collide with the portfolio on the same VPS.
- **Nothing is built on the VPS.** Images are built and smoke-tested by GitHub on each release, published to GHCR
  (public) as `ghcr.io/iamsarthakkr/algo-viz:<version>`, and the VPS only pulls them. It needs just `compose.yaml`
  and `.env` — no repo checkout, Node or build tooling.

## Container

Built by the multi-stage [`Dockerfile`](Dockerfile): `npm ci` + `npm run build` on `node:22-alpine`, then the
`dist/` output is copied into `nginxinc/nginx-unprivileged` (runs as a non-root user, listens on `8080`).

[`nginx.conf`](nginx.conf):

- caches hashed `/assets/*` for a year and serves `index.html` with `no-cache`, so new deploys are picked up
  immediately;
- falls back to `index.html` for unknown paths, so a client-side router can be added later without nginx changes;
- sets a same-origin **Content-Security-Policy** (scripts, styles and fonts are all self-hosted) plus
  `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`, and hides the nginx version. If you ever add an
  external origin (CDN, analytics, web fonts), the CSP has to allow it;
- exposes `/healthz`, used by the compose healthcheck and the smoke test.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and push to `main`:

1. **Lint, test and build** — `npm run lint`, `npm run test:coverage` (fails below the thresholds in
   `vite.config.ts`), `npm run build` (type-checks `src` and `tests`, then bundles).
2. **Docker image** — builds the image and runs [`scripts/smoke-test.sh`](scripts/smoke-test.sh) against it:
   health check, app shell, SPA fallback, the hashed JS bundle being served with long-term caching, `no-cache` on
   `index.html`, all security headers present and the nginx version hidden.

The smoke test runs locally against any image:

```bash
docker build -t algo-viz:local . && scripts/smoke-test.sh algo-viz:local
SMOKE_PORT=18080 scripts/smoke-test.sh algo-viz:local   # if 8080 is taken
```

## Releasing a version

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs when a version tag is pushed:

1. re-runs the full CI workflow on that commit;
2. checks the tag matches `package.json` (otherwise the release is ambiguous and fails);
3. builds the image **once**, runs `scripts/smoke-test.sh` against it, and only then pushes that exact image as
   `ghcr.io/iamsarthakkr/algo-viz:<version>` and `:latest` — so what the VPS pulls is byte-for-byte what was tested;
4. creates the GitHub release last, so a release only exists once its image is pullable.

`main` is guarded by a repository ruleset that requires a pull request, so the version bump goes
through a PR, and the tag is pushed only once that PR is merged:

```bash
git checkout main && git pull
git checkout -b release/1.0.1
npm version patch --no-git-tag-version   # bump package.json (+ lock)
sed -i '' 's/^APP_VERSION=.*/APP_VERSION=1.0.1/' .env.example
git commit -am "Release 1.0.1"
git push -u origin release/1.0.1
gh pr create --base main --title "Release 1.0.1" --body "Version bump"
# merge it, then tag the merged main:
git checkout main && git pull
git tag v1.0.1
git push origin v1.0.1
```

Tag `main` after the merge, not the release branch. Squash and rebase merges create a new commit,
so a tag pushed beforehand would point at a commit that never lands on `main`. (v1.1.0 was tagged
on the branch first and merged with a merge commit, which keeps that commit in `main`'s history.)

## Deploying

### One-time setup

1. After the first release, make the GHCR package **public** (GitHub → your profile → Packages → `algo-viz` →
   Package settings → Change visibility). New packages are private by default, and the VPS would otherwise need a
   `docker login` with a token.
2. On the VPS, create the app directory with the two files it needs:

    ```bash
    mkdir -p /srv/apps/algo-viz && cd /srv/apps/algo-viz
    curl -fsSLO https://raw.githubusercontent.com/iamsarthakkr/AlgoViz/main/compose.yaml
    curl -fsSL -o .env https://raw.githubusercontent.com/iamsarthakkr/AlgoViz/main/.env.example
    # edit .env: APP_VERSION (the release to run) and HOST_PORT
    ```

3. Add the site to the global Caddyfile and reload Caddy:

    ```caddyfile
    viz.imsarthakkr.tech {
        reverse_proxy 127.0.0.1:3002
    }
    ```

### Deploying a version

```bash
cd /srv/apps/algo-viz
sed -i 's/^APP_VERSION=.*/APP_VERSION=1.0.1/' .env
docker compose pull
docker compose up -d
docker compose ps   # wait for "healthy" (the healthcheck polls /healthz every 30s)
```

`compose.yaml` refuses to start without `APP_VERSION`, so the VPS never silently runs `:latest`. If a release
changes `compose.yaml` itself, re-download it from that tag
(`https://raw.githubusercontent.com/iamsarthakkr/AlgoViz/v1.0.1/compose.yaml`) before running compose.

### Rolling back

Same as deploying, with the previous version — the old image is still on GHCR, so nothing is rebuilt:

```bash
sed -i 's/^APP_VERSION=.*/APP_VERSION=1.0.0/' .env
docker compose pull && docker compose up -d
```

### Image cleanup

Each deploy leaves the previous image on disk (handy for an instant rollback). Remove old ones occasionally:

```bash
docker image ls ghcr.io/iamsarthakkr/algo-viz
docker image prune   # removes dangling images only
```

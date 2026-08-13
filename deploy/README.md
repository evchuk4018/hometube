# HomeTube homelab deployment

HomeTube runs as an isolated Compose project with its own PostgreSQL service, web service, and one-at-a-time download worker. It stores media under `/srv/storage/hometube-media`, binds the web service only to `127.0.0.1:3010`, and is exposed privately by the existing Tailscale Serve `/hometube` route.

Set `HOMETUBE_PUID` and `HOMETUBE_PGID` to the owner of the host media directory (both are `1000` on `homelab`). The worker runs with that identity and the web service mounts the same directory read-only.

Normal deployment:

1. Copy the pushed workspace to `/srv/storage/wowzerbowser/hometube` without replacing its private `deployment.env`.
2. Build the current migration and worker images with `docker compose --env-file deployment.env --profile ops build migrate worker`.
3. Run `docker compose --env-file deployment.env --profile ops run --rm migrate`, then run `docker compose --env-file deployment.env run --rm worker npm run db:check`.
4. Run `docker compose --env-file deployment.env run --rm worker npm run media:backfill-audio`.
5. Build and recreate `web` and `worker`.
6. Verify `/hometube/api/health`, the worker healthcheck, and byte-range video and audio responses.

The installed PWA is available at `https://homelab.tail861ffd.ts.net/hometube/` while connected to the tailnet.

# HomeTube homelab deployment

HomeTube runs as an isolated Compose project with its own PostgreSQL service, web service, and one-at-a-time download worker. It stores media under `/srv/storage/hometube-media`, binds the web service only to `127.0.0.1:3010`, and is exposed privately by the existing Tailscale Serve `/hometube` route.

Set `HOMETUBE_PUID` and `HOMETUBE_PGID` to the owner of the host media directory (both are `1000` on `homelab`). The worker runs with that identity and the web service mounts the same directory read-only.

Normal deployment:

1. Copy the pushed workspace to `/srv/storage/wowzerbowser/hometube` without replacing its private `deployment.env`.
2. Run `docker compose --env-file deployment.env --profile ops run --rm migrate`.
3. Run the migration check in the worker image.
4. Build and recreate `web` and `worker`.
5. Verify `/hometube/api/health`, the worker healthcheck, and a byte-range media response.

The installed PWA is available at `https://homelab.tail861ffd.ts.net/hometube/` while connected to the tailnet.

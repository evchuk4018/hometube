# HomeTube homelab deployment

HomeTube runs as an isolated Compose project with its own PostgreSQL service, web service, and one-at-a-time download worker. On the homelab it stores media under `/srv/storage/wowzerbowser/hometube-media` and PostgreSQL data under `/srv/storage/wowzerbowser/hometube-postgres`, binds the web service only to `127.0.0.1:3010`, and is exposed privately by the existing Tailscale Serve `/hometube` route.

Set `HOMETUBE_PUID` and `HOMETUBE_PGID` to the owner of the host media directory (both are `1000` on `homelab`). The worker runs with that identity and the web service mounts the same directory read-only.

Normal deployment:

1. Test, commit, and push `main`, then create a clean release from that exact commit under `/srv/storage/wowzerbowser/hometube-releases/<commit>`. Preserve the existing checkout, its uncommitted changes, and its private `deployment.env`.
2. Save a protected snapshot of the old checkout and running image IDs. Back up PostgreSQL before applying migrations. Keep the existing absolute database/media mounts and the `download-vpn` network overlay.
3. Use the storage-guarded Compose wrapper below for all startup and migration commands. Set `HOMETUBE_REVISION` to the full pushed commit so both images record their source revision.
4. Build `web`, `worker`, and `migrate` before stopping the old worker. Stop it before migration `009_disable_ai_discovery.sql` so an in-flight legacy discovery cannot recreate trial channels.
5. Apply migrations, run `db:check`, and recreate only `web` and `worker`. Existing background-audio files do not need a backfill for this change.
6. Check both container health states and image revision labels, `/hometube/api/health`, feed channel groups, subscription-only recommendations, queue filtering, and representative byte-range video/audio responses. Retain the prior images and database backup for rollback.

Run on the homelab after transferring the release:

```sh
export DEPLOYMENT_ENV_FILE=/srv/storage/wowzerbowser/hometube/deployment.env
export HOMETUBE_REVISION=<full-pushed-commit>
release=/srv/storage/wowzerbowser/hometube-releases/$HOMETUBE_REVISION
compose() {
  /srv/storage/wowzerbowser/docker/compose.sh \
    --project-name hometube \
    --file "$release/docker-compose.yml" \
    --file /srv/storage/wowzerbowser/ops/download-vpn/hometube-compose.vpn.yaml "$@"
}
compose --profile ops build web worker migrate
compose stop worker
compose --profile ops run --rm migrate
compose run --rm --no-deps worker npm run db:check
compose up -d --no-deps web worker
```

AI discovery and automatic trial-channel refresh are disabled. The worker needs no OpenRouter credentials. Historical trial records and previously downloaded videos remain available, and manually subscribed channels are eligible regardless of their original provenance.

The installed PWA is available at `https://homelab.tail861ffd.ts.net/hometube/` while connected to the tailnet.

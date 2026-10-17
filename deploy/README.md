# HomeTube homelab deployment

HomeTube runs as an isolated Compose project with its own PostgreSQL service, web service, and one-at-a-time download worker. On the homelab it stores media under `/srv/storage/wowzerbowser/hometube-media` and PostgreSQL data under `/srv/storage/wowzerbowser/hometube-postgres`, binds the web service only to `127.0.0.1:3010`, and is exposed privately by the existing Tailscale Serve `/hometube` route. The download worker uses the ordinary Compose network and the host's Internet connection.

Set `HOMETUBE_PUID` and `HOMETUBE_PGID` to the owner of the host media directory (both are `1000` on `homelab`). The worker runs with that identity and the web service mounts the same directory read-only.

Normal deployment:

1. Test, commit, and push `main`, then create a clean release from that exact commit under `/srv/storage/wowzerbowser/hometube-releases/<commit>`. Keep source directories readable/traversable (`0755`) and files readable (`0644`) by the container runtime identities, including the media owner's worker identity. Preserve the existing checkout, its uncommitted changes, and its private `deployment.env`.
2. Save a protected snapshot of the old checkout and running image IDs. Back up PostgreSQL before applying migrations. Keep the existing absolute database/media mounts. Use the base Compose file without the `download-vpn` overlay.
3. Use the storage-guarded Compose wrapper below for all startup and migration commands. Set `HOMETUBE_REVISION` to the full pushed commit so both images record their source revision.
4. Build `web`, `worker`, and `migrate` before stopping the old worker. Stop it before migration `009_disable_ai_discovery.sql` so an in-flight legacy discovery cannot recreate trial channels.
5. Apply migrations, run `db:check`, and recreate only `web` and `worker`. Wait for both services to become healthy. Existing background-audio files do not need a backfill for this change.
6. Run `deploy/check.sh` from the release to verify both container health states, image revision labels, ordinary worker networking, migration status, and `/hometube/api/health`. The web health endpoint checks PostgreSQL only; it cannot establish that downloads work. Confirm a queued download reaches `Ready to play` and check representative byte-range video/audio responses. Retain the prior images and database backup for rollback.

Run on the homelab after transferring the release:

```sh
export DEPLOYMENT_ENV_FILE=/srv/storage/wowzerbowser/hometube/deployment.env
export HOMETUBE_REVISION=<full-pushed-commit>
release=/srv/storage/wowzerbowser/hometube-releases/$HOMETUBE_REVISION
compose() {
  /srv/storage/wowzerbowser/docker/compose.sh \
    --project-name hometube \
    --file "$release/docker-compose.yml" "$@"
}
compose --profile ops build web worker migrate
compose stop worker
compose --profile ops run --rm -T --interactive=false migrate
compose run --rm --no-deps -T --interactive=false worker npm run db:check
compose up -d --no-deps --force-recreate --wait --wait-timeout 120 web worker
sh "$release/deploy/check.sh"
```

The Windscribe download gateway and its Tailscale exit-routing supervisor are intentionally stopped and disabled (`wowzerbowser-download-vpn.service` and `wowzerbowser-tailscale-exit.service`, both user services). The gateway container's restart policy is `no`. Keep these settings when deploying: the old supervisor removes the HomeTube worker whenever the VPN is unhealthy, including a worker started with ordinary networking. The VPN configuration, secrets, stopped gateway container, and Docker networks are retained for an explicit future rollback. Tailscale itself remains enabled with its normal routing and firewall management.

The October 2026 outage left queued downloads at zero attempts because the VPN supervisor removed the worker while its WireGuard tunnel received no replies. Disabling the two supervisors and starting the worker from the base Compose file lets those jobs resume without deleting jobs, resetting the database, or re-requesting downloads. Do not run `docker compose down --volumes` as a recovery step.

AI discovery and automatic trial-channel refresh are disabled. The worker needs no OpenRouter credentials. Historical trial records and previously downloaded videos remain available, and manually subscribed channels are eligible regardless of their original provenance.

The installed PWA is available at `https://homelab.tail861ffd.ts.net/hometube/` while connected to the tailnet.

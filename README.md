# HomeTube

HomeTube is a single-user, self-hosted YouTube replacement focused on local
playback, a persistent metadata catalog, personalized channel-level discovery,
and podcast listening. It is a Next.js App Router PWA with PostgreSQL and a
separate worker that owns yt-dlp downloads and cache cleanup.

## Product shape

The three primary pages are `/` (Home), `/channels`, and `/podcasts`. Channel
detail views live below `/channels/:channelId`; API routes live below `/api`.
Metadata and downloaded media are separate records. Deleting local media marks
the media record deleted and does not delete the logical video or its watch
history.

The cache policy is centralized in `src/domain/media-policy.ts`:

- maximum height: 720p;
- immutable maximum allocation: 137,438,953,472 bytes (128 GiB);
- normal target: 120 GiB unless configured lower;
- one primary MP4 copy per video;
- protected unwatched/in-progress podcast episodes and pinned videos;
- eviction order: completed podcast media, watched normal media, pruned
  channels, ignored/trial media, then older low-ranked normal media.

## Local development

```powershell
Copy-Item .env.example .env.local
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Without `DATABASE_URL`, the three pages show a small demo catalog so the UI can
be inspected without PostgreSQL. Real data requires PostgreSQL migrations and
the seed catalog:

```powershell
$env:DATABASE_URL = "postgresql://hometube:password@localhost:5432/hometube"
npm run db:migrate
npm run db:check
npm run db:seed
```

The seed file contains more than 100 channel entries. Replace or extend it as
your interests evolve; channel source and stable provider IDs are retained.

## Homelab deployment

The Compose stack has `postgres`, `web`, `worker`, an optional isolated
`opendataloader-hybrid` profile, and an optional `discord` profile. In the
normal homelab profile, web and worker reuse the already-running private
`wowzerbowser-opendataloader-hybrid` container over the external
`wowzerbowser-application` network, so the existing OCR service is not
duplicated. The isolated profile is CPU-only, capped at 2 CPUs and 3 GiB RAM,
uses the named `wowzerbowser-opendataloader-cache` volume, and does not publish
port 5002. The web container binds only to localhost; Tailscale Serve remains
the private HTTPS boundary.

On homelab, from the checked-out application directory:

```bash
docker compose --env-file /srv/storage/wowzerbowser/deployment.env up -d --build
docker compose exec web npm run db:migrate
docker compose exec web npm run db:check
docker compose exec web npm run db:seed
curl --fail http://127.0.0.1:3010/api/health
```

The default `3010` binding intentionally avoids the existing Wowzer Bowser
listener on port 3000. To expose HomeTube privately without replacing the
existing root or `/drive` Serve routes, add a path route once the stack is
healthy, then confirm it with `tailscale serve status`:

```bash
tailscale serve --bg --set-path /hometube http://127.0.0.1:3010
```

The resulting private URL is
`https://homelab.tail861ffd.ts.net/hometube`.

When HomeTube is mounted below a Tailscale Serve path, keep
`NEXT_PUBLIC_BASE_PATH=/hometube` in the deployment environment so generated
links, API calls, PWA assets, and the service worker stay inside that path.

Keep the deployment environment private. `APP_ACCESS_TOKEN` is optional because
the service is already behind Tailscale, but it can add a second boundary.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite covers format selection/rejection, the hard cache ceiling and
eviction order, logical-record preservation semantics, watch transitions,
podcast protection, channel scoring, trial behavior, Home diversity and
replenishment, and stable/idempotent synchronization. Per repository
instructions, verification is command-based; no browser or screenshot checks
are used.

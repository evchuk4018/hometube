# Self-Hosted YouTube Replacement

## Summary

Build a greenfield single-user PWA using Next.js, PostgreSQL, and a separate background worker. The application will maintain a large metadata catalog while treating downloaded media as a capped, rotating cache under `/srv/storage`.

The first implementation will cover the complete requirements: three-page responsive UI, channel discovery, channel-level recommendations, trial/pruning, podcast mode, persistent watch state, local playback, yt-dlp downloads, and strict 720p/128 GiB enforcement.

## Architecture

- Next.js App Router frontend/API with exactly three primary pages:
  - `/` — Home
  - `/channels` — channel list and channel detail views
  - `/podcasts` — podcast channels and episode states
- PostgreSQL repositories for channels, videos, watch history, recommendations, download jobs, media records, and configuration.
- Domain services for:
  - channel preference and feed ranking
  - AI discovery and trial evaluation
  - podcast synchronization
  - download orchestration
  - media-cache eviction
  - playback progress
- Separate worker process for scheduled jobs and yt-dlp execution.
- Provider adapter around yt-dlp so YouTube-specific behavior remains isolated.
- Docker Compose deployment compatible with the existing homelab stack.
- Tailscale provides network access; no multi-user account system will be introduced. An optional environment-configured access token can protect the private app boundary.

## Core Data and Behavior

- Keep logical `videos` and physical `media_files` as separate records.
- Use stable YouTube video/channel IDs so deleting and rediscovering media never creates duplicate logical records.
- Preserve metadata, thumbnails, watch state, watch percentage, and recommendation history after media deletion.
- Track channel source, subscription/manual retention, podcast status, pruning protection, engagement totals, recent engagement, and last interaction.
- Track video states as unwatched, in-progress, or watched, with configurable completion threshold.
- Rank Home using channel preference, watch percentage, recency, diversity, trial status, and historical evidence; prevent one video from overpowering long-term channel history.
- Maintain approximately 40 active Home recommendations and replenish them after watching/removal.
- Newly discovered channels receive a trial pool of approximately 10 most-viewed unwatched videos.
- Periodically send the strongest approximately 10 channels to OpenRouter and persist proposed channels, evaluations, rejection history, and justification.
- Keep AI model, cadence, thresholds, and API configuration in environment variables, with safe defaults documented in deployment configuration.
- Podcast channels bypass recommendation pruning and automatically acquire every new upload.

## Download and Storage Policy

- Store media only in a dedicated directory under `/srv/storage`.
- Enforce:
  - hard ceiling: `128 GiB` (`137438953472` bytes)
  - normal operating target below the ceiling to preserve download headroom
  - one primary local copy per video
  - maximum video height of 720p
- Centralize format selection so all automatic and manual downloads use a 720p-or-lower yt-dlp format selector.
- Prefer directly playable browser formats and avoid unnecessary transcoding.
- Give unwatched/in-progress podcast episodes stronger retention than normal cache content.
- Evict in priority order:
  - watched normal videos
  - media from pruned channels
  - ignored trial/recommendation media
  - older low-ranked normal videos
- Never evict pinned videos or protected podcast episodes.
- Make downloads atomic and recheck size/resolution before committing them to the media directory.
- Expose download, queued, failed, unavailable, and deleted-media states in the UI.

## Implementation and Verification

- Add migrations, seed configuration for roughly 100 initial channels, environment examples, Docker Compose services, and deployment documentation.
- Add API contracts for feed retrieval, channel/catalog browsing, video actions, playback progress, podcast conversion, downloads, pinning, and media deletion.
- Add automated tests for:
  - 720p format selection and rejection of oversized resolutions
  - hard cache ceiling and eviction ordering
  - preservation of logical records after media deletion
  - watch-state transitions and completion threshold
  - podcast protection and automatic cleanup after completion
  - channel scoring, trial promotion, pruning, and rejection memory
  - Home replenishment and diversity behavior
  - stable video identity and idempotent synchronization
- Run type checks, linting, unit tests, database migration checks, and production build verification.
- Push the completed implementation to `main`.
- Apply pending migrations to the local `homelab` deployment and verify the migration state before completion.
- Do not use browser or screenshot verification, per repository instructions.

## Assumptions

- The repository is empty and will be initialized as a Next.js TypeScript project.
- PostgreSQL is the authoritative database and the worker shares the application schema.
- yt-dlp is the initial YouTube provider.
- Initial channel seeds will be represented by a checked-in seed/config file rather than manually entered through the UI.
- Settings are operationally configured through `deployment.env`; user-facing settings pages are out of scope because the product requires exactly three main pages.
- The media ceiling is immutable above 128 GiB, even if an environment variable is misconfigured.

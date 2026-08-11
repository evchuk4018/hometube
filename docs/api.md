# HomeTube API contracts

All API routes are private when `APP_ACCESS_TOKEN` is set. Send the value as
`Authorization: Bearer <token>` or `X-Access-Token`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health and database status |
| GET | `/api/feed` | Current Home recommendations |
| GET/POST | `/api/channels` | Browse or add channels |
| GET | `/api/channels/:channelId` | Channel metadata catalog |
| POST | `/api/channels/:channelId/actions` | Retain, prune, pin, or change podcast mode |
| GET | `/api/podcasts` | Podcast channels and episode sections |
| GET | `/api/videos/:videoId` | One logical video record |
| POST | `/api/videos/:videoId/actions` | Watch state, pinning, download, or media deletion |
| PATCH | `/api/videos/:videoId/progress` | Persist playback position and watch percentage |
| POST | `/api/videos/:videoId/download` | Queue a manual download |
| GET/DELETE | `/api/videos/:videoId/media` | Stream or remove the local media file |

All download paths converge on the worker's `YTDLP_FORMAT_SELECTOR`, which
rejects a result above 720p or above the immutable 128 GiB per-file ceiling.
The media DELETE operation changes only the physical media record; the logical
video, thumbnail, watch state, and recommendation history remain intact.


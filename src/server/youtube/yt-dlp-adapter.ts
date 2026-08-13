import { channelCatalogUrls } from '@/domain/youtube-url';
import type { ImportedChannel, ImportedVideo } from '@/server/channels/channel-repository';
import { runProcess } from './process-runner';

type YtDlpEntry = {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  upload_date?: string;
  timestamp?: number;
  view_count?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string; width?: number }>;
  webpage_url?: string;
  url?: string;
  availability?: string;
  live_status?: string;
  channel_id?: string;
  channel?: string;
  uploader_id?: string;
  uploader?: string;
  channel_url?: string;
};

export type CatalogEntry = { channel: ImportedChannel; video: ImportedVideo };

export function buildCatalogArgs(url: string): string[] {
  return [
    '--ignore-config', '--flat-playlist', '--lazy-playlist', '--dump-json',
    '--ignore-errors', '--no-warnings', '--no-call-home', url
  ];
}

function uploadDate(entry: YtDlpEntry): string | null {
  if (entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
    return `${entry.upload_date.slice(0, 4)}-${entry.upload_date.slice(4, 6)}-${entry.upload_date.slice(6, 8)}`;
  }
  if (entry.timestamp) return new Date(entry.timestamp * 1000).toISOString().slice(0, 10);
  return null;
}

function bestThumbnail(entry: YtDlpEntry): string | null {
  const sorted = [...(entry.thumbnails ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? entry.thumbnail ?? (entry.id ? `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` : null);
}

export function mapCatalogEntry(entry: YtDlpEntry): CatalogEntry | null {
  if (!entry.id || !/^[A-Za-z0-9_-]{6,20}$/.test(entry.id)) return null;
  const channelName = entry.channel ?? entry.uploader ?? null;
  const handle = entry.uploader_id?.startsWith('@') ? entry.uploader_id : null;
  return {
    channel: {
      youtubeChannelId: entry.channel_id ?? null,
      name: channelName,
      handle,
      thumbnailUrl: null
    },
    video: {
      id: entry.id,
      title: entry.title ?? 'Unavailable video',
      description: entry.description ?? null,
      durationSeconds: Number.isFinite(entry.duration) ? Math.max(0, Math.round(entry.duration ?? 0)) : null,
      uploadDate: uploadDate(entry),
      viewCount: Number.isFinite(entry.view_count) ? Math.max(0, Math.round(entry.view_count ?? 0)) : null,
      thumbnailUrl: bestThumbnail(entry),
      webUrl: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
      availability: entry.availability ?? 'public',
      liveStatus: entry.live_status ?? null
    }
  };
}

export async function importChannelCatalog(
  sourceUrl: string,
  onEntry: (entry: CatalogEntry, importedCount: number) => Promise<void>
): Promise<number> {
  let importedCount = 0;
  const seen = new Set<string>();
  for (const catalogUrl of channelCatalogUrls(sourceUrl)) {
    await runProcess(process.env.YTDLP_COMMAND ?? 'yt-dlp', buildCatalogArgs(catalogUrl), {
      onStdoutLine: async (line) => {
        let parsed: YtDlpEntry;
        try {
          parsed = JSON.parse(line) as YtDlpEntry;
        } catch {
          return;
        }
        const entry = mapCatalogEntry(parsed);
        if (!entry || seen.has(entry.video.id)) return;
        seen.add(entry.video.id);
        importedCount += 1;
        await onEntry(entry, importedCount);
      }
    });
  }
  return importedCount;
}


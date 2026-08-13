'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { appPath } from '@/lib/app-path';
import type { FeedPayload, VideoSummary } from '@/protocol/schemas';
import { BrandMark } from './channel-browser';

export function FeedBrowser({ initialPayload }: { initialPayload: FeedPayload }) {
  useEffect(() => {
    if (initialPayload.videos.length === 0) return;
    void fetch(appPath('/api/feed'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoIds: initialPayload.videos.map((video) => video.id) })
    }).catch(() => undefined);
  }, [initialPayload.videos]);

  if (initialPayload.videos.length === 0) {
    return (
      <section className="feed-empty">
        <BrandMark />
        <h2>Your Home feed is ready for channels</h2>
        <p>Subscribe to a YouTube channel and its videos will begin appearing here.</p>
        <Link className="primary-button empty-action" href="/channels">Add channels</Link>
      </section>
    );
  }
  return (
    <section className="home-feed" aria-label="Recommended videos">
      {initialPayload.videos.map((video) => <FeedCard key={video.id} video={video} />)}
    </section>
  );
}

function FeedCard({ video }: { video: VideoSummary }) {
  return (
    <article className="feed-card">
      <Link href={`/watch/${video.id}`} aria-label={`Watch ${video.title}`}>
        <div className="thumbnail-wrap">
          {video.thumbnailUrl
            ? <Image src={video.thumbnailUrl} alt="" fill sizes="(max-width: 620px) 100vw, (max-width: 1000px) 50vw, 33vw" />
            : <div className="thumbnail-placeholder"><BrandMark /></div>}
          {video.durationSeconds !== null && <span className="duration-badge">{formatDuration(video.durationSeconds)}</span>}
          {video.watchState === 'in_progress' && <span className="watch-progress-bar" style={{ width: `${video.watchPercentage * 100}%` }} />}
        </div>
        <div className="feed-card-copy">
          <h2>{video.title}</h2>
          <p>{video.channelName}</p>
          <p>{video.viewCount !== null ? `${compactNumber(video.viewCount)} views · ` : ''}{formatDate(video.uploadDate)}</p>
          <div className="feed-status">
            <span>{video.mediaStatus === 'ready' ? 'Downloaded' : video.mediaStatus === 'downloading' || video.mediaStatus === 'queued' ? 'Downloading' : 'Not downloaded'}</span>
            {video.watchState === 'in_progress' && <span>{Math.round(video.watchPercentage * 100)}% watched</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}` : `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

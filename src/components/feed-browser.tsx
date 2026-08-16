'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appPath } from '@/lib/app-path';
import type { FeedPayload, VideoSummary } from '@/protocol/schemas';
import { BrandMark } from './channel-browser';

const PULL_THRESHOLD = 80;
const MAX_PULL = 110;
const PULL_DAMPING = 0.5;
const FEED_LIMIT = 40;

export function FeedBrowser({ initialPayload }: { initialPayload: FeedPayload }) {
  const [videos, setVideos] = useState(initialPayload.videos);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const shellRef = useRef<HTMLElement>(null);
  const pullRef = useRef(0);
  const pulledRef = useRef(false);

  useEffect(() => {
    if (videos.length === 0) return;
    void fetch(appPath('/api/feed'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoIds: videos.map((video) => video.id) })
    }).catch(() => undefined);
  }, [videos]);

  const refreshFeed = useCallback(async () => {
    if (refreshing || videos.length === 0) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    try {
      const response = await fetch(appPath('/api/feed/refresh'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoIds: videos.slice(0, 2).map((video) => video.id) })
      });
      const payload = response.ok
        ? await response.json() as FeedPayload
        : await fetch(appPath(`/api/feed?limit=${FEED_LIMIT}`), { cache: 'no-store' })
            .then((fallback) => fallback.ok ? fallback.json() as Promise<FeedPayload> : null);
      if (payload) setVideos(payload.videos);
    } catch {
      const fallback = await fetch(appPath(`/api/feed?limit=${FEED_LIMIT}`), { cache: 'no-store' }).catch(() => undefined);
      if (fallback?.ok) setVideos((await fallback.json() as FeedPayload).videos);
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [refreshing, videos]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let startY = 0;
    let tracking = false;
    let pulling = false;

    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || event.touches.length !== 1) return;
      tracking = true;
      pulling = false;
      pulledRef.current = false;
      startY = event.touches[0].clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (!pulling && window.scrollY > 0) return;
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY > 0 || pulling) {
        pulling = true;
        event.preventDefault();
        const next = Math.max(0, Math.min(deltaY * PULL_DAMPING, MAX_PULL));
        pullRef.current = next;
        setPull(next);
      }
    };

    const endPull = () => {
      if (!tracking) return;
      tracking = false;
      pulledRef.current = pulling;
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD;
      pullRef.current = 0;
      if (shouldRefresh) void refreshFeed();
      else setPull(0);
    };

    shell.addEventListener('touchstart', onTouchStart, { passive: true });
    shell.addEventListener('touchmove', onTouchMove, { passive: false });
    shell.addEventListener('touchend', endPull, { passive: true });
    shell.addEventListener('touchcancel', endPull, { passive: true });
    return () => {
      shell.removeEventListener('touchstart', onTouchStart);
      shell.removeEventListener('touchmove', onTouchMove);
      shell.removeEventListener('touchend', endPull);
      shell.removeEventListener('touchcancel', endPull);
    };
  }, [refreshFeed]);

  const pulling = pull > 0;
  const indicatorActive = pulling || refreshing;

  return (
    <section
      ref={shellRef}
      className={`feed-shell${pulling ? ' pulling' : ''}`}
      style={{ transform: indicatorActive ? `translateY(${pull}px)` : undefined }}
    >
      <header className="app-header">
        <button
          className="home-brand brand-button"
          type="button"
          onClick={() => { if (pulledRef.current || refreshing) return; void refreshFeed(); }}
          aria-label="Refresh recommended videos"
        >
          <BrandMark />
          <span>HomeTube</span>
        </button>
        <span className={`feed-refresh-indicator${indicatorActive ? ' active' : ''}${refreshing ? ' spinning' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" style={{ transform: `rotate(${pull * (360 / PULL_THRESHOLD)}deg)` }}>
            <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
      </header>

      {videos.length === 0 ? (
        <section className="feed-empty">
          <BrandMark />
          <h2>Your Home feed is ready for channels</h2>
          <p>Subscribe to a YouTube channel and its videos will begin appearing here.</p>
          <Link className="primary-button empty-action" href="/channels">Add channels</Link>
        </section>
      ) : (
        <section className="home-feed" aria-label="Recommended videos">
          {videos.map((video) => <FeedCard key={video.id} video={video} />)}
        </section>
      )}
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

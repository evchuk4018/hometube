'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { appPath } from '@/lib/app-path';
import type { ChannelPagePayload, JobSummary, VideoSummary } from '@/protocol/schemas';

const PAGE_SIZE = 50;

export function ChannelBrowser({ initialPayload }: { initialPayload: ChannelPagePayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [visibleLimit, setVisibleLimit] = useState(Math.max(PAGE_SIZE, initialPayload.videos.length));
  const [downloadJobs, setDownloadJobs] = useState<Record<string, JobSummary>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshPage = useCallback(async (limit = visibleLimit) => {
    const response = await fetch(appPath(`/api/channels/${initialPayload.channel.id}?limit=${limit}`), { cache: 'no-store' });
    if (!response.ok) return;
    setPayload(await response.json() as ChannelPagePayload);
  }, [initialPayload.channel.id, visibleLimit]);

  const activeDownloadJobs = useMemo(
    () => Object.entries(downloadJobs).filter(([, job]) => job.status === 'queued' || job.status === 'running'),
    [downloadJobs]
  );
  const shouldPoll = payload.activeJob?.status === 'queued' || payload.activeJob?.status === 'running'
    || payload.videos.some((video) => video.mediaStatus === 'queued' || video.mediaStatus === 'downloading')
    || activeDownloadJobs.length > 0;

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      void refreshPage();
      for (const [videoId, job] of activeDownloadJobs) {
        void fetch(appPath(`/api/jobs/${job.id}`), { cache: 'no-store' })
          .then((response) => response.ok ? response.json() as Promise<JobSummary> : null)
          .then((updated) => {
            if (!updated) return;
            setDownloadJobs((current) => ({ ...current, [videoId]: updated }));
            if (updated.status === 'ready' || updated.status === 'failed') void refreshPage();
          }).catch(() => undefined);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeDownloadJobs, refreshPage, shouldPoll]);

  async function download(video: VideoSummary) {
    setNotice(null);
    const response = await fetch(appPath(`/api/videos/${video.id}/download`), { method: 'POST' });
    const result = await response.json() as { ready?: boolean; job?: JobSummary | null; error?: string };
    if (!response.ok) {
      setNotice(result.error ?? 'Unable to start the download.');
      return;
    }
    if (result.job) setDownloadJobs((current) => ({ ...current, [video.id]: result.job as JobSummary }));
    await refreshPage();
  }

  async function refreshCatalog() {
    setRefreshing(true);
    setNotice(null);
    const response = await fetch(appPath(`/api/channels/${payload.channel.id}/refresh`), { method: 'POST' });
    const result = await response.json() as { error?: string };
    if (!response.ok) setNotice(result.error ?? 'Unable to refresh this channel.');
    await refreshPage();
    setRefreshing(false);
  }

  async function loadMore() {
    const nextLimit = visibleLimit + PAGE_SIZE;
    setVisibleLimit(nextLimit);
    await refreshPage(nextLimit);
  }

  const importRunning = payload.activeJob?.status === 'queued' || payload.activeJob?.status === 'running';

  return (
    <main className="channel-page">
      <header className="channel-header">
        <Link className="brand-link" href="/" aria-label="HomeTube home"><BrandMark /><span>HomeTube</span></Link>
        <button className="secondary-button" onClick={() => void refreshCatalog()} disabled={refreshing || importRunning}>
          {refreshing || importRunning ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="channel-identity">
        <div className="channel-avatar" aria-hidden="true">{payload.channel.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{payload.channel.name}</h1>
          <p>{payload.channel.handle ?? `${payload.channel.videoCount.toLocaleString()} videos`} · last 7 days</p>
        </div>
      </section>

      {payload.activeJob && importRunning && (
        <section className="import-progress" aria-live="polite">
          <div><span>{payload.activeJob.stage}</span><span>{Math.round(payload.activeJob.progress)}%</span></div>
          <progress max="100" value={payload.activeJob.progress} />
        </section>
      )}
      {payload.channel.importStatus === 'failed' && <p className="error-banner">{payload.channel.importError ?? 'Channel import failed.'}</p>}
      {notice && <p className="error-banner" role="alert">{notice}</p>}

      <section className="video-grid" aria-label={`${payload.channel.name} videos`}>
        {payload.videos.map((video) => (
          <VideoCard key={video.id} video={video} job={downloadJobs[video.id]} onDownload={() => void download(video)} />
        ))}
      </section>

      {payload.videos.length === 0 && !importRunning && <div className="empty-state"><h2>No videos found</h2><p>Try refreshing the channel.</p></div>}
      {payload.videos.length < payload.total && <button className="load-more" onClick={() => void loadMore()}>Load more videos</button>}
    </main>
  );
}

function VideoCard({ video, job, onDownload }: { video: VideoSummary; job?: JobSummary; onDownload: () => void }) {
  const active = video.mediaStatus === 'queued' || video.mediaStatus === 'downloading';
  const progress = job?.progress ?? (video.mediaStatus === 'downloading' ? 5 : 0);
  return (
    <article className="video-card">
      <div className="thumbnail-wrap">
        {video.thumbnailUrl
          ? <Image src={video.thumbnailUrl} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
          : <div className="thumbnail-placeholder"><BrandMark /></div>}
        {video.durationSeconds !== null && <span className="duration-badge">{formatDuration(video.durationSeconds)}</span>}
        {video.liveStatus === 'is_live' && <span className="live-badge">LIVE</span>}
      </div>
      <div className="video-card-body">
        <h2>{video.title}</h2>
        <p>{video.channelName}</p>
        <p>{video.viewCount !== null ? `${compactNumber(video.viewCount)} views · ` : ''}{formatDate(video.uploadDate)}</p>
        {active && (
          <div className="download-progress" aria-live="polite">
            <div><span>{job?.stage ?? (video.mediaStatus === 'queued' ? 'Queued' : 'Downloading')}</span><span>{job ? `${Math.round(progress)}%` : ''}</span></div>
            <progress max="100" value={progress} />
          </div>
        )}
        {video.mediaError && <p className="card-error">{video.mediaError}</p>}
        <div className="card-actions">
          {video.mediaStatus === 'ready'
            ? <Link className="play-button" href={`/watch/${video.id}`}><PlayIcon /> Play</Link>
            : <button className="download-button" onClick={onDownload} disabled={!video.downloadable || active}>
                <DownloadIcon /> {active ? 'Downloading' : video.mediaStatus === 'failed' ? 'Retry' : video.downloadable ? 'Download' : 'Unavailable'}
              </button>}
        </div>
      </div>
    </article>
  );
}

export function BrandMark() {
  return <svg viewBox="0 0 32 24" aria-hidden="true"><rect width="32" height="24" rx="7" fill="currentColor" /><path d="m13 7 8 5-8 5V7Z" fill="#fff" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" fill="currentColor" /></svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

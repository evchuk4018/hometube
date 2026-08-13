'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { appPath } from '@/lib/app-path';
import type { JobSummary, VideoSummary } from '@/protocol/schemas';
import { SubscriptionButton } from './subscription-button';
import { VideoPlayer } from './video-player';

export function WatchExperience({ initialVideo, subscribed }: { initialVideo: VideoSummary; subscribed: boolean }) {
  const [video, setVideo] = useState(initialVideo);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState<string | null>(initialVideo.mediaError);
  const startedRef = useRef(false);

  useEffect(() => {
    void fetch(appPath(`/api/videos/${video.id}/open`), { method: 'POST' }).catch(() => undefined);
  }, [video.id]);

  useEffect(() => {
    if (video.mediaStatus === 'ready' || !video.downloadable || startedRef.current) return;
    startedRef.current = true;
    void startDownload();
  // startDownload deliberately runs once for the initial status.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.downloadable, video.id, video.mediaStatus]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const timer = window.setInterval(() => {
      void fetch(appPath(`/api/jobs/${job.id}`), { cache: 'no-store' })
        .then((response) => response.ok ? response.json() as Promise<JobSummary> : Promise.reject(new Error('Unable to read download status.')))
        .then(async (updated) => {
          setJob(updated);
          if (updated.status === 'ready') {
            const response = await fetch(appPath(`/api/videos/${video.id}`), { cache: 'no-store' });
            if (response.ok) setVideo(await response.json() as VideoSummary);
          } else if (updated.status === 'failed') {
            setError(updated.error ?? 'The download failed.');
          }
        }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job, video.id]);

  async function startDownload() {
    setError(null);
    setJob(null);
    startedRef.current = true;
    const response = await fetch(appPath(`/api/videos/${video.id}/download`), { method: 'POST' });
    const result = await response.json() as { ready?: boolean; job?: JobSummary | null; error?: string };
    if (!response.ok) {
      setError(result.error ?? 'Unable to start this download.');
      return;
    }
    if (result.ready) {
      const refreshed = await fetch(appPath(`/api/videos/${video.id}`), { cache: 'no-store' });
      if (refreshed.ok) setVideo(await refreshed.json() as VideoSummary);
    } else {
      setJob(result.job ?? null);
    }
  }

  const progress = job?.progress ?? (video.mediaStatus === 'downloading' ? 5 : 0);
  return (
    <main className="watch-page app-page-with-nav">
      {video.mediaStatus === 'ready'
        ? <VideoPlayer video={video} />
        : <section className="watch-download-state">
            <div className="download-poster" style={video.thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.8)), url(${video.thumbnailUrl})` } : undefined}>
              <div className="download-waiting">
                <h1>{error ? 'Download interrupted' : 'Getting your video ready'}</h1>
                {error
                  ? <><p>{error}</p><button className="primary-button" type="button" onClick={() => void startDownload()}>Retry download</button></>
                  : <><p>{job?.stage ?? 'Starting download'}</p><progress max="100" value={progress} /><span>{Math.round(progress)}%</span></>}
              </div>
            </div>
          </section>}
      <section className="watch-metadata">
        <h1>{video.title}</h1>
        <div className="watch-channel-row">
          <Link href={`/channels/${video.channelId}`}>{video.channelName}</Link>
          <SubscriptionButton channelId={video.channelId} initialSubscribed={subscribed} />
        </div>
      </section>
    </main>
  );
}

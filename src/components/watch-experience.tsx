'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appPath } from '@/lib/app-path';
import type { JobSummary, QueueEntry, VideoSummary } from '@/protocol/schemas';
import type { PlayerControl } from './video-player';
import { AutoplayQueue } from './autoplay-queue';
import { SleepTimer } from './sleep-timer';
import { SubscriptionButton } from './subscription-button';
import { VideoPlayer } from './video-player';

export function WatchExperience({ initialVideo, subscribed }: { initialVideo: VideoSummary; subscribed: boolean }) {
  const [video, setVideo] = useState(initialVideo);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [error, setError] = useState<string | null>(initialVideo.mediaError);
  const [autoplayTick, setAutoplayTick] = useState(0);
  const playerControlRef = useRef<PlayerControl | null>(null);
  const sleepTimerExpiredRef = useRef(false);

  useEffect(() => {
    void fetch(appPath(`/api/videos/${video.id}/open`), { method: 'POST' }).catch(() => undefined);
  }, [video.id]);

  const refreshQueue = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(appPath('/api/queue'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentVideoId: video.id })
      });
      if (!response.ok) return false;
      const result = await response.json() as { entries: QueueEntry[] };
      setQueue(result.entries);
      const head = result.entries[0];
      if (head?.video.id === video.id) {
        setVideo(head.video);
        setError(head.video.mediaError);
      }
      return true;
    } catch {
      return false;
    }
  }, [video.id]);

  useEffect(() => {
    void (async () => {
      if (!await refreshQueue()) await startDownload();
    })();
    // refreshQueue intentionally runs once per video; startDownload covers the fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshQueue]);

  async function startDownload() {
    setError(null);
    const response = await fetch(appPath(`/api/videos/${video.id}/download`), { method: 'POST' });
    if (!response.ok) {
      const result = await response.json() as { error?: string };
      setError(result.error ?? 'Unable to start this download.');
      return;
    }
    await refreshQueue();
  }

  useEffect(() => {
    const entries = queue.filter((entry) => entry.job !== null && entry.job.status !== 'ready' && entry.job.status !== 'failed');
    if (entries.length === 0) return;
    const timer = window.setInterval(() => {
      void Promise.all(entries.map(async (entry) => {
        const job = entry.job as JobSummary;
        const response = await fetch(appPath(`/api/jobs/${job.id}`), { cache: 'no-store' });
        if (!response.ok) return null;
        const updatedJob = await response.json() as JobSummary;
        let updatedVideo = entry.video;
        if (updatedJob.status === 'ready' || updatedJob.status === 'failed') {
          const videoResponse = await fetch(appPath(`/api/videos/${entry.video.id}`), { cache: 'no-store' });
          if (videoResponse.ok) updatedVideo = await videoResponse.json() as VideoSummary;
        }
        return { videoId: entry.video.id, job: updatedJob, video: updatedVideo };
      })).then((results) => {
        const fresh = new Map(
          results.filter((result): result is NonNullable<typeof result> => result !== null)
            .map((result) => [result.videoId, result])
        );
        if (fresh.size === 0) return;
        setQueue((current) => current.map((entry) => fresh.get(entry.video.id) ?? entry));
        setVideo((currentVideo) => fresh.get(currentVideo.id)?.video ?? currentVideo);
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [queue]);

  const playEntry = useCallback((entry: QueueEntry, autoplay: boolean) => {
    if (autoplay && !sleepTimerExpiredRef.current) setAutoplayTick((tick) => tick + 1);
    setQueue((current) => {
      const index = current.findIndex((item) => item.video.id === entry.video.id);
      return index >= 0 ? current.slice(index) : current;
    });
    setVideo(entry.video);
    setError(entry.video.mediaError);
  }, []);

  const handleEnded = useCallback(() => {
    const next = queue[1];
    if (next) playEntry(next, true);
  }, [queue, playEntry]);

  const handleNextTrack = useCallback(() => {
    const next = queue[1];
    if (next) playEntry(next, true);
  }, [queue, playEntry]);

  const handleSleepTimerExpire = useCallback(() => { sleepTimerExpiredRef.current = true; }, []);
  const handleSleepTimerRearm = useCallback(() => { sleepTimerExpiredRef.current = false; }, []);

  const progress = queue[0]?.job?.progress ?? (video.mediaStatus === 'downloading' ? 5 : 0);
  return (
    <main className="watch-page app-page-with-nav">
      {video.mediaStatus === 'ready'
        ? <VideoPlayer video={video} playerControlRef={playerControlRef} onEnded={handleEnded} onNextTrack={handleNextTrack} autoplayTick={autoplayTick} />
        : <section className="watch-download-state">
            <div className="download-poster" style={video.thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.8)), url(${video.thumbnailUrl})` } : undefined}>
              <div className="download-waiting">
                <h1>{error ? 'Download interrupted' : 'Getting your video ready'}</h1>
                {error
                  ? <><p>{error}</p><button className="primary-button" type="button" onClick={() => void startDownload()}>Retry download</button></>
                  : <><p>{queue[0]?.job?.stage ?? 'Starting download'}</p><progress max="100" value={progress} /><span>{Math.round(progress)}%</span></>}
              </div>
            </div>
          </section>}
      <section className="watch-metadata">
        <h1>{video.title}</h1>
        <div className="watch-channel-row">
          <Link href={`/channels/${video.channelId}`}>{video.channelName}</Link>
          <SubscriptionButton channelId={video.channelId} initialSubscribed={subscribed} />
        </div>
        <SleepTimer playerControlRef={playerControlRef} onExpire={handleSleepTimerExpire} onRearm={handleSleepTimerRearm} />
        <AutoplayQueue queue={queue} currentVideoId={video.id} onPlayEntry={(entry) => playEntry(entry, true)} />
      </section>
    </main>
  );
}

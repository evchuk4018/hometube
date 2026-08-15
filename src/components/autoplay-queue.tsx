'use client';

import Image from 'next/image';
import type { QueueEntry } from '@/protocol/schemas';

export function AutoplayQueue({ queue, currentVideoId, onPlayEntry }: {
  queue: QueueEntry[];
  currentVideoId: string;
  onPlayEntry: (entry: QueueEntry) => void;
}) {
  if (queue.length === 0) return null;
  const current = queue[0];
  const upcoming = queue.filter((entry) => entry.video.id !== currentVideoId);
  return (
    <section className="autoplay-queue" aria-label="Up next queue">
      <div className="autoplay-queue-heading">
        <h2 className="autoplay-queue-title">Up next</h2>
        <span className="autoplay-queue-count">{upcoming.length} of {queue.length} videos queued</span>
      </div>
      <div className="autoplay-queue-row autoplay-queue-current">
        <span className="autoplay-queue-now-label">Now playing</span>
        <span className="autoplay-queue-copy">
          <span className="autoplay-queue-video-title">{current.video.title}</span>
          <span className="autoplay-queue-meta">{current.video.channelName}</span>
        </span>
        <StatusBadge entry={current} />
      </div>
      {upcoming.map((entry) => (
        <button key={entry.video.id} className="autoplay-queue-row autoplay-queue-entry" type="button" onClick={() => onPlayEntry(entry)}>
          <span className="autoplay-queue-thumb">
            {entry.video.thumbnailUrl
              ? <Image src={entry.video.thumbnailUrl} alt="" fill sizes="96px" />
              : null}
          </span>
          <span className="autoplay-queue-copy">
            <span className="autoplay-queue-video-title">{entry.video.title}</span>
            <span className="autoplay-queue-meta">{entry.video.channelName}</span>
          </span>
          <StatusBadge entry={entry} />
        </button>
      ))}
    </section>
  );
}

function StatusBadge({ entry }: { entry: QueueEntry }) {
  const status = entry.video.mediaStatus;
  const job = entry.job;
  let label = 'Not downloaded';
  if (status === 'ready') label = 'Downloaded';
  else if (status === 'failed') label = 'Download failed';
  else if (status === 'queued' || status === 'downloading') {
    label = job && job.status !== 'ready' && job.status !== 'failed' ? `Downloading ${Math.round(job.progress)}%` : 'Downloading';
  }
  return <span className={`autoplay-queue-status ${status}`}>{label}</span>;
}

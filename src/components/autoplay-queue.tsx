'use client';

import Image from 'next/image';
import { useRef, useState, type TouchEvent } from 'react';
import { isHorizontalSwipe, shouldDismissSwipe } from '@/domain/swipe-dismiss';
import type { QueueEntry } from '@/protocol/schemas';

const MAX_SWIPE = 140;
const CLICK_SUPPRESSION = 8;

export function AutoplayQueue({ queue, currentVideoId, onPlayEntry, onDismissEntry }: {
  queue: QueueEntry[];
  currentVideoId: string;
  onPlayEntry: (entry: QueueEntry) => void;
  onDismissEntry: (entry: QueueEntry) => void | Promise<void>;
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
        <SwipeableEntry key={entry.video.id} entry={entry} onPlay={onPlayEntry} onDismiss={onDismissEntry} />
      ))}
    </section>
  );
}

type Gesture = {
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  captured: boolean;
};

function SwipeableEntry({ entry, onPlay, onDismiss }: {
  entry: QueueEntry;
  onPlay: (entry: QueueEntry) => void;
  onDismiss: (entry: QueueEntry) => void | Promise<void>;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const gestureRef = useRef<Gesture | null>(null);
  const suppressClickRef = useRef(false);

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    if (dismissing) return;
    const touch = event.touches[0];
    if (!touch) return;
    gestureRef.current = { startX: touch.clientX, startY: touch.clientY, deltaX: 0, deltaY: 0, captured: false };
    suppressClickRef.current = false;
  }

  function handleTouchMove(event: TouchEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    if (!gesture || dismissing) return;
    const touch = event.touches[0];
    if (!touch) return;
    gesture.deltaX = touch.clientX - gesture.startX;
    gesture.deltaY = touch.clientY - gesture.startY;
    if (!gesture.captured) {
      if (gesture.deltaX >= 0 || !isHorizontalSwipe(gesture.deltaX, gesture.deltaY)) return;
      gesture.captured = true;
      setDragging(true);
    }
    if (Math.abs(gesture.deltaX) > CLICK_SUPPRESSION) suppressClickRef.current = true;
    setOffsetX(Math.max(-MAX_SWIPE, Math.min(0, gesture.deltaX)));
  }

  function releaseGesture(allowDismiss: boolean) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setDragging(false);
    if (!gesture) return;
    if (allowDismiss && gesture.captured && shouldDismissSwipe(gesture.deltaX, gesture.deltaY)) {
      void dismiss();
      return;
    }
    setOffsetX(0);
  }

  async function dismiss() {
    if (dismissing) return;
    setDismissing(true);
    suppressClickRef.current = true;
    setOffsetX(-MAX_SWIPE);
    try {
      await onDismiss(entry);
    } finally {
      setDismissing(false);
      setOffsetX(0);
    }
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dismissing) return;
    onPlay(entry);
  }

  return (
    <div className="autoplay-queue-swipe">
      <span className="autoplay-queue-dismiss-action" aria-hidden="true">Remove</span>
      <button
        className={`autoplay-queue-row autoplay-queue-entry${dragging ? ' dragging' : ''}`}
        type="button"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => releaseGesture(true)}
        onTouchCancel={() => releaseGesture(false)}
        onClick={handleClick}
      >
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
    </div>
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

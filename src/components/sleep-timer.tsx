'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { DEFAULT_MINUTES, MAX_MINUTES, STEP_MINUTES, adjustMinutes, formatCountdown } from '@/domain/sleep-timer';
import type { PlayerControl } from './video-player';

type TimerState = 'idle' | 'picking' | 'counting';

export function SleepTimer({ playerControlRef, onExpire, onRearm }: {
  playerControlRef: RefObject<PlayerControl | null>;
  onExpire?: () => void;
  onRearm?: () => void;
}) {
  const [state, setState] = useState<TimerState>('idle');
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const endAtRef = useRef(0);

  useEffect(() => {
    if (state !== 'counting') return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        playerControlRef.current?.pause();
        endAtRef.current = 0;
        setState('idle');
        setMinutes(DEFAULT_MINUTES);
        onExpire?.();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [state, playerControlRef, onExpire]);

  if (state === 'idle') {
    return (
      <div className="sleep-timer">
        <button className="secondary-button" type="button" onClick={() => setState('picking')}>Sleep timer</button>
      </div>
    );
  }

  if (state === 'counting') {
    return (
      <div className="sleep-timer">
        <span className="sleep-timer-countdown" aria-live="polite">{formatCountdown(remainingSeconds)}</span>
        <button className="secondary-button" type="button" onClick={() => { endAtRef.current = 0; setState('idle'); setMinutes(DEFAULT_MINUTES); onRearm?.(); }}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="sleep-timer">
      <button className="timer-step-button" type="button" aria-label="Subtract 5 minutes" disabled={minutes <= 0} onClick={() => setMinutes(adjustMinutes(minutes, -STEP_MINUTES))}>−</button>
      <span className="sleep-timer-value">{minutes}</span>
      <button className="timer-step-button" type="button" aria-label="Add 5 minutes" disabled={minutes >= MAX_MINUTES} onClick={() => setMinutes(adjustMinutes(minutes, STEP_MINUTES))}>+</button>
      <button className="primary-button timer-set-button" type="button" disabled={minutes <= 0} onClick={() => {
        endAtRef.current = Date.now() + minutes * 60 * 1000;
        setRemainingSeconds(minutes * 60);
        setState('counting');
        onRearm?.();
      }}>Set</button>
    </div>
  );
}

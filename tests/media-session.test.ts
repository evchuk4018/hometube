import { describe, expect, it } from "vitest";
import {
  configureMediaAction,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition
} from "@/app/watch/media-session";

function fakeSession(overrides: Partial<MediaSession> = {}): MediaSession {
  return {
    metadata: null,
    playbackState: "none",
    setActionHandler: () => undefined,
    setPositionState: () => undefined,
    ...overrides
  } as MediaSession;
}

describe("media session helpers", () => {
  it("registers supported actions and tolerates unsupported actions", () => {
    const actions: Array<{ action: MediaSessionAction; handler: ((details: MediaSessionActionDetails) => void) | null }> = [];
    const session = fakeSession({ setActionHandler: (action, handler) => actions.push({ action, handler }) });
    const handler = () => undefined;

    configureMediaAction(session, "play", handler);
    expect(actions).toEqual([{ action: "play", handler }]);

    const unsupported = fakeSession({ setActionHandler: () => { throw new Error("unsupported"); } });
    expect(() => configureMediaAction(unsupported, "seekforward", handler)).not.toThrow();
  });

  it("updates playback state and clamps valid position state", () => {
    const positions: MediaPositionState[] = [];
    const session = fakeSession({ setPositionState: (position) => { if (position) positions.push(position); } });
    const previousNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaSession: session } });

    setMediaSessionPlaybackState(session, "playing");
    updateMediaSessionPosition({ duration: 120, currentTime: 140, playbackRate: 1 });

    expect(session.playbackState).toBe("playing");
    expect(positions).toEqual([{ duration: 120, playbackRate: 1, position: 120 }]);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousNavigator });
  });

  it("does not publish position state for unloaded media", () => {
    const positions: MediaPositionState[] = [];
    const session = fakeSession({ setPositionState: (position) => { if (position) positions.push(position); } });
    const previousNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaSession: session } });

    updateMediaSessionPosition({ duration: Number.NaN, currentTime: 0, playbackRate: 1 });

    expect(positions).toHaveLength(0);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousNavigator });
  });
});

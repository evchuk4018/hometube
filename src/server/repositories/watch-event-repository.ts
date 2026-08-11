import { query } from "../db";

export async function recordWatchEvent(input: { videoId: string; eventType: "presented" | "opened" | "progress" | "watched" | "manual"; positionSeconds: number; watchPercentage: number }): Promise<void> {
  await query(
    `INSERT INTO watch_events (video_id, event_type, position_seconds, watch_percentage) VALUES ($1, $2, $3, $4)`,
    [input.videoId, input.eventType, Math.max(0, input.positionSeconds), Math.min(1, Math.max(0, input.watchPercentage))]
  );
}

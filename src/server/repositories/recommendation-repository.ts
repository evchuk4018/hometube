import type { FeedVideo } from "@/domain/types";
import { withTransaction } from "../db";

export async function replaceActiveRecommendations(videos: FeedVideo[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`UPDATE recommendations SET active = false WHERE active = true`);
    for (const video of videos) {
      const source = video.isPodcast ? "podcast" : video.isTrial ? "trial" : video.recommendationPosition <= 10 ? "preference" : video.recommendationPosition % 3 === 0 ? "diversity" : "recent";
      await client.query(
        `INSERT INTO recommendations (video_id, source, score, position, reason, active) VALUES ($1, $2, $3, $4, $5, true)`,
        [video.id, source, video.recommendationScore, video.recommendationPosition, video.recommendationReason]
      );
    }
  });
}


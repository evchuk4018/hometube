import { PodcastsClient } from "../podcasts-client";
import { getPodcastData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export default async function PodcastsPage() {
  const data = await getPodcastData();
  return <PodcastsClient {...data} />;
}


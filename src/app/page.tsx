import { HomeClient } from "./home-client";
import { getHomeData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();
  return <HomeClient initialVideos={data.videos} generatedAt={data.generatedAt} />;
}

